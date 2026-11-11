import { Hono } from 'hono'
import type { Context } from 'hono'
import { effective } from '../clients/assignments'
import { addDays, localDate } from '../dates'
import { notFound, nowIso, readJson, validation } from '../http'
import { currentUser } from '../session'
import type { AppBindings } from '../types'

/**
 * Mejoras del 11/11/2026:
 * - Pendientes de la entrenadora en su inicio: clientes que llevan días sin entrenar, rutinas que terminan pronto y
 *   comentarios nuevos de sus clientes en entrenamientos finalizados.
 * - Avisos de la entrenadora a un cliente (dentro de la app; no hay correos). El cliente los ve en su inicio.
 * Todo se limita a los clientes de la entrenadora de la sesión; un cliente ajeno se trata como inexistente (404).
 */
export const trainerNotices = new Hono<AppBindings>()
export const portalNotices = new Hono<AppBindings>()
type Ctx = Context<AppBindings>

/** Días sin entrenar a partir de los cuales un cliente con rutina vigente aparece en pendientes. */
export const INACTIVE_DAYS = 7
/** Rutinas que terminan dentro de estos días. */
export const ENDING_DAYS = 7
/** Comentarios de entrenamientos finalizados en estos últimos días. */
export const COMMENT_DAYS = 30
const MAX_MESSAGE = 1000

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

async function ownsClient(c: Ctx, clientId: number) {
  return !!(await c.env.DB.prepare('SELECT 1 AS x FROM clients WHERE id = ? AND trainer_id = ?').bind(clientId, currentUser(c).id).first())
}

trainerNotices.get('/pending', async (c) => {
  const db = c.env.DB
  const trainer = currentUser(c).id
  const today = localDate()
  const [assignmentRows, lastRows, commentRows] = await db.batch([
    db
      .prepare(
        `SELECT a.id, a.client_id, c.first_name, c.last_name, a.start_date, a.end_date, a.status, v.title
           FROM routine_assignments a JOIN clients c ON c.id = a.client_id
           JOIN routine_versions v ON v.id = a.routine_version_id
          WHERE c.trainer_id = ? AND c.status = 'Active' AND a.status IN (1, 2)`,
      )
      .bind(trainer),
    db
      .prepare(
        `SELECT l.client_id, MAX(l.started_at) AS last_at FROM training_logs l JOIN clients c ON c.id = l.client_id
          WHERE c.trainer_id = ? GROUP BY l.client_id`,
      )
      .bind(trainer),
    db
      .prepare(
        `SELECT l.id, l.client_id, c.first_name, c.last_name, l.day_name, l.routine_title, l.completed_at, l.comment,
                (SELECT COUNT(*) FROM training_log_exercises e WHERE e.training_log_id = l.id AND e.comment IS NOT NULL) AS exercise_comments
           FROM training_logs l JOIN clients c ON c.id = l.client_id
          WHERE c.trainer_id = ? AND l.status = 2 AND l.completed_at >= ?
            AND (l.comment IS NOT NULL OR EXISTS (SELECT 1 FROM training_log_exercises e WHERE e.training_log_id = l.id AND e.comment IS NOT NULL))
            AND NOT EXISTS (SELECT 1 FROM training_log_reviews r WHERE r.training_log_id = l.id)
          ORDER BY l.completed_at DESC LIMIT 50`,
      )
      .bind(trainer, `${addDays(today, -COMMENT_DAYS)}T00:00:00.000Z`),
  ])
  type A = { id: number; client_id: number; first_name: string; last_name: string; start_date: string; end_date: string | null; status: number; title: string }
  const current = (assignmentRows.results as A[]).filter((a) => effective(a.status, a.start_date, a.end_date, today) === 2)
  const lastBy = new Map((lastRows.results as { client_id: number; last_at: string }[]).map((r) => [r.client_id, localDate(new Date(r.last_at))]))

  // Sin entrenar: clientes con rutina vigente cuyo último entrenamiento (o el inicio de su rutina, si nunca ha entrenado
  // desde entonces) fue hace INACTIVE_DAYS días o más.
  const byClient = new Map<number, A[]>()
  for (const a of current) byClient.set(a.client_id, [...(byClient.get(a.client_id) ?? []), a])
  const inactive = [...byClient.entries()]
    .map(([clientId, list]) => {
      const last = lastBy.get(clientId) ?? null
      const firstStart = list.map((a) => a.start_date).sort()[0]
      const since = last && last > firstStart ? last : firstStart
      return { clientId, name: `${list[0].first_name} ${list[0].last_name}`, lastTrainingDate: last, days: daysBetween(since, today), neverTrained: last === null }
    })
    .filter((r) => r.days >= INACTIVE_DAYS)
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name, 'es'))

  const limit = addDays(today, ENDING_DAYS)
  const ending = current
    .filter((a) => a.end_date !== null && a.end_date >= today && a.end_date <= limit)
    .sort((a, b) => a.end_date!.localeCompare(b.end_date!) || a.id - b.id)
    .map((a) => ({
      assignmentId: a.id,
      clientId: a.client_id,
      name: `${a.first_name} ${a.last_name}`,
      routineTitle: a.title,
      endDate: a.end_date,
      daysLeft: daysBetween(today, a.end_date!),
    }))

  type C = { id: number; client_id: number; first_name: string; last_name: string; day_name: string | null; routine_title: string | null; completed_at: string; comment: string | null; exercise_comments: number }
  const comments = (commentRows.results as C[]).map((r) => ({
    sessionId: r.id,
    clientId: r.client_id,
    name: `${r.first_name} ${r.last_name}`,
    dayName: r.day_name,
    routineTitle: r.routine_title,
    completedAt: r.completed_at,
    comment: r.comment,
    exerciseComments: r.exercise_comments,
  }))

  return c.json({ inactiveDays: INACTIVE_DAYS, endingDays: ENDING_DAYS, inactive, ending, comments })
})

/** Marca un entrenamiento como revisado: sus comentarios dejan de salir en pendientes. */
trainerNotices.post('/clients/:clientId{[0-9]+}/sessions/:id{[0-9]+}/review', async (c) => {
  const clientId = Number(c.req.param('clientId'))
  const id = Number(c.req.param('id'))
  if (!(await ownsClient(c, clientId))) return notFound(c)
  const log = await c.env.DB.prepare('SELECT id FROM training_logs WHERE id = ? AND client_id = ? AND status = 2').bind(id, clientId).first()
  if (!log) return notFound(c)
  await c.env.DB.prepare('INSERT INTO training_log_reviews (training_log_id, reviewed_at) VALUES (?, ?) ON CONFLICT DO NOTHING').bind(id, nowIso()).run()
  return c.body(null, 204)
})

interface MessageRow {
  id: number
  training_log_id: number | null
  day_name: string | null
  body: string
  created_at: string
  read_at: string | null
}
const toMessage = (m: MessageRow) => ({ id: m.id, sessionId: m.training_log_id, sessionDayName: m.day_name, body: m.body, createdAt: m.created_at, readAt: m.read_at })
const MESSAGE_SELECT = `SELECT m.id, m.training_log_id, l.day_name, m.body, m.created_at, m.read_at
  FROM client_messages m LEFT JOIN training_logs l ON l.id = m.training_log_id`

trainerNotices.get('/clients/:clientId{[0-9]+}/messages', async (c) => {
  const clientId = Number(c.req.param('clientId'))
  if (!(await ownsClient(c, clientId))) return notFound(c)
  const { results } = await c.env.DB.prepare(`${MESSAGE_SELECT} WHERE m.client_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 100`).bind(clientId).all<MessageRow>()
  return c.json(results.map(toMessage))
})

trainerNotices.post('/clients/:clientId{[0-9]+}/messages', async (c) => {
  const clientId = Number(c.req.param('clientId'))
  if (!(await ownsClient(c, clientId))) return notFound(c)
  const body = (await readJson(c)) ?? {}
  const errors: Record<string, string[]> = {}
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (!text) errors.body = ['Escribe el aviso.']
  else if (text.length > MAX_MESSAGE) errors.body = [`Máximo ${MAX_MESSAGE} caracteres.`]
  const sessionId = body.sessionId === undefined || body.sessionId === null ? null : body.sessionId
  if (sessionId !== null && (typeof sessionId !== 'number' || !Number.isInteger(sessionId))) errors.sessionId = ['Entrenamiento no válido.']
  if (Object.keys(errors).length) return validation(c, errors)
  if (sessionId !== null) {
    const log = await c.env.DB.prepare('SELECT 1 AS x FROM training_logs WHERE id = ? AND client_id = ?').bind(sessionId, clientId).first()
    if (!log) return validation(c, { sessionId: ['El entrenamiento no es de este cliente.'] })
  }
  const now = nowIso()
  const row = await c.env.DB.prepare(
    'INSERT INTO client_messages (client_id, author_user_id, training_log_id, body, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
  )
    .bind(clientId, currentUser(c).id, sessionId, text, now)
    .first<{ id: number }>()
  // Contestar un entrenamiento también lo marca como revisado.
  if (sessionId !== null) {
    await c.env.DB.prepare(
      `INSERT INTO training_log_reviews (training_log_id, reviewed_at) SELECT id, ? FROM training_logs WHERE id = ? AND status = 2
        ON CONFLICT DO NOTHING`,
    )
      .bind(now, sessionId)
      .run()
  }
  return c.json({ id: row!.id }, 201)
})

/** Un aviso se puede borrar mientras el cliente no lo haya visto (por ejemplo, para corregir un error al escribirlo). */
trainerNotices.delete('/clients/:clientId{[0-9]+}/messages/:id{[0-9]+}', async (c) => {
  const clientId = Number(c.req.param('clientId'))
  if (!(await ownsClient(c, clientId))) return notFound(c)
  const id = Number(c.req.param('id'))
  const msg = await c.env.DB.prepare('SELECT read_at FROM client_messages WHERE id = ? AND client_id = ?').bind(id, clientId).first<{ read_at: string | null }>()
  if (!msg) return notFound(c)
  if (msg.read_at !== null) return c.json({ status: 409, title: 'Conflicto', detail: 'Tu cliente ya vio este aviso; ya no se puede borrar.' }, 409)
  await c.env.DB.prepare('DELETE FROM client_messages WHERE id = ? AND client_id = ? AND read_at IS NULL').bind(id, clientId).run()
  return c.body(null, 204)
})

async function portalClient(c: Ctx) {
  const row = await c.env.DB.prepare('SELECT id FROM clients WHERE user_id = ?').bind(currentUser(c).id).first<{ id: number }>()
  return row?.id ?? null
}

portalNotices.get('/messages', async (c) => {
  const client = await portalClient(c)
  if (client === null) return c.json([])
  const { results } = await c.env.DB.prepare(`${MESSAGE_SELECT} WHERE m.client_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 50`).bind(client).all<MessageRow>()
  return c.json(results.map(toMessage))
})

/** El cliente marca como vistos sus avisos (todos los que tenía hasta ahora). */
portalNotices.post('/messages/read', async (c) => {
  const client = await portalClient(c)
  if (client === null) return notFound(c)
  await c.env.DB.prepare('UPDATE client_messages SET read_at = ? WHERE client_id = ? AND read_at IS NULL').bind(nowIso(), client).run()
  return c.body(null, 204)
})

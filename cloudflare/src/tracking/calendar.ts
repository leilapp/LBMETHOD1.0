import { Hono } from 'hono'
import type { Context } from 'hono'
import { audit } from '../audit'
import { addDays, dayOfWeek, isDate, localDate } from '../dates'
import { notFound, nowIso, problem, readJson, validation } from '../http'
import { currentUser } from '../session'
import { clean } from '../text'
import type { AppBindings } from '../types'
import { EVENT_TYPE_NAMES, EVENT_TYPES } from './labels'

/**
 * Calendario de entrenamientos. Une datos guardados: eventos que crea la entrenadora, las asignaciones (inicio, fin y
 * días de rutina que tienen día de la semana), los entrenamientos registrados y las evaluaciones. Los descansos solo se
 * deducen cuando todos los días de la rutina tienen día de la semana; si no, no se inventan.
 */
export const calendarEvents = new Hono<AppBindings>()
type Ctx = Context<AppBindings>

export const MAX_RANGE_DAYS = 62
const MAX_TITLE = 150
const MAX_NOTES = 1000

const EVENT_KIND: Record<number, string> = { 1: 'training', 2: 'rest', 3: 'evaluation', 4: 'program-start', 5: 'program-end', 99: 'other' }
const STATUS_TEXT: Record<number, string> = { 1: 'planned', 2: 'completed', 3: 'cancelled' }
const KIND_ORDER: Record<string, number> = { 'program-start': 0, planned: 1, training: 2, session: 3, evaluation: 4, rest: 5, other: 6 }

export interface CalendarItem {
  kind: string
  date: string
  title: string
  detail: string | null
  status: string
  clientId: number | null
  clientName: string | null
  eventId: number | null
  sessionId: number | null
  evaluationId: number | null
  startTime: string | null
  endTime: string | null
  notes: string | null
}

const item = (x: Partial<CalendarItem> & Pick<CalendarItem, 'kind' | 'date' | 'title' | 'status'>): CalendarItem => ({
  detail: null, clientId: null, clientName: null, eventId: null, sessionId: null, evaluationId: null, startTime: null, endTime: null, notes: null, ...x,
})

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** Revisa el rango pedido. Devuelve la respuesta de error o null. */
export function checkRange(c: Ctx, from: string | undefined, to: string | undefined) {
  if (!isDate(from) || !isDate(to)) return validation(c, { from: ['Indica el rango de fechas.'] })
  if (to < from) return validation(c, { to: ['La fecha final no puede ser anterior a la inicial.'] })
  if (daysBetween(from, to) > MAX_RANGE_DAYS) return validation(c, { to: [`Máximo ${MAX_RANGE_DAYS} días por consulta.`] })
  return null
}

interface Viewer {
  /** Entrenadora: sus clientes (uno o todos). Cliente: solo lo suyo, sin eventos generales ni cancelados. */
  trainerId: number | null
  clientId: number | null
}

/** Elementos del calendario entre dos fechas (inclusive). Quien llama ya comprobó que puede ver al cliente. */
export async function buildCalendar(db: D1Database, from: string, to: string, viewer: Viewer): Promise<CalendarItem[]> {
  const isClient = viewer.trainerId === null
  const clientId = viewer.clientId
  const { results: clientRows } = isClient
    ? await db.prepare("SELECT id, first_name || ' ' || last_name AS name FROM clients WHERE id = ?").bind(clientId).all<{ id: number; name: string }>()
    : await db
        .prepare("SELECT id, first_name || ' ' || last_name AS name FROM clients WHERE trainer_id = ?1 AND (?2 IS NULL OR id = ?2)")
        .bind(viewer.trainerId, clientId)
        .all<{ id: number; name: string }>()
  const names = new Map(clientRows.map((r) => [r.id, r.name]))
  const nameOf = (id: number | null) => (isClient || id === null ? null : (names.get(id) ?? null))
  const ids = JSON.stringify([...names.keys()])
  const items: CalendarItem[] = []

  const eventsQuery = isClient
    ? db.prepare('SELECT * FROM calendar_events WHERE client_id = ?1 AND status <> 3 AND date BETWEEN ?2 AND ?3 ORDER BY date, start_time, id').bind(clientId, from, to)
    : db
        .prepare('SELECT * FROM calendar_events WHERE trainer_id = ?1 AND (?2 IS NULL OR client_id = ?2) AND date BETWEEN ?3 AND ?4 ORDER BY date, start_time, id')
        .bind(viewer.trainerId, clientId, from, to)
  // Los entrenamientos se traen con un día de margen en UTC y se filtran por su fecha local exacta.
  const [events, assignments, days, logs, evaluations] = await db.batch([
    eventsQuery,
    db
      .prepare(
        `SELECT a.id, a.client_id, a.start_date, a.end_date, a.routine_version_id, v.title FROM routine_assignments a
           JOIN routine_versions v ON v.id = a.routine_version_id
          WHERE a.client_id IN (SELECT value FROM json_each(?1)) AND a.status <> 4 AND a.start_date <= ?3 AND (a.end_date IS NULL OR a.end_date >= ?2)
          ORDER BY a.id`,
      )
      .bind(ids, from, to),
    db
      .prepare(
        `SELECT d.id, d.routine_version_id, d.position, d.name, d.day_of_week FROM routine_days d
          WHERE d.routine_version_id IN (SELECT a.routine_version_id FROM routine_assignments a
                                          WHERE a.client_id IN (SELECT value FROM json_each(?1)) AND a.status <> 4 AND a.start_date <= ?3
                                            AND (a.end_date IS NULL OR a.end_date >= ?2))
          ORDER BY d.position`,
      )
      .bind(ids, from, to),
    db
      .prepare(
        `SELECT id, client_id, started_at, status, day_name, routine_title, routine_day_id FROM training_logs
          WHERE client_id IN (SELECT value FROM json_each(?1)) AND started_at >= ?2 AND started_at < ?3 ORDER BY started_at, id`,
      )
      .bind(ids, `${addDays(from, -1)}T00:00:00.000Z`, `${addDays(to, 2)}T00:00:00.000Z`),
    db
      .prepare(
        `SELECT e.id, e.client_id, e.evaluated_on, (SELECT COUNT(*) FROM measurements m WHERE m.evaluation_id = e.id) AS count
           FROM evaluations e WHERE e.client_id IN (SELECT value FROM json_each(?1)) AND e.evaluated_on BETWEEN ?2 AND ?3 ORDER BY e.id`,
      )
      .bind(ids, from, to),
  ])

  type EventRow = { id: number; client_id: number | null; type: number; status: number; title: string; date: string; start_time: string | null; end_time: string | null; notes: string | null; training_log_id: number | null; evaluation_id: number | null }
  const eventRows = events.results as EventRow[]
  for (const e of eventRows)
    items.push(item({
      kind: EVENT_KIND[e.type] ?? 'other', date: e.date, title: e.title, detail: EVENT_TYPES[e.type] ?? null, status: STATUS_TEXT[e.status],
      clientId: e.client_id, clientName: nameOf(e.client_id), eventId: e.id, sessionId: e.training_log_id, evaluationId: e.evaluation_id,
      startTime: e.start_time, endTime: e.end_time, notes: e.notes,
    }))

  type DayRow = { id: number; routine_version_id: number; position: number; name: string; day_of_week: number | null }
  const daysOf = new Map<number, DayRow[]>()
  for (const d of days.results as DayRow[]) daysOf.set(d.routine_version_id, [...(daysOf.get(d.routine_version_id) ?? []), d])
  type AssignmentRow = { id: number; client_id: number; start_date: string; end_date: string | null; routine_version_id: number; title: string }
  const assignmentRows = assignments.results as AssignmentRow[]

  type LogRow = { id: number; client_id: number; started_at: string; status: number; day_name: string | null; routine_title: string | null; routine_day_id: number | null }
  const sessions = (logs.results as LogRow[]).map((l) => ({ ...l, date: localDate(new Date(l.started_at)) })).filter((l) => l.date >= from && l.date <= to)

  for (const a of assignmentRows) {
    if (a.start_date >= from && a.start_date <= to)
      items.push(item({ kind: 'program-start', date: a.start_date, title: `Inicio: ${a.title}`, status: 'planned', clientId: a.client_id, clientName: nameOf(a.client_id) }))
    if (a.end_date !== null && a.end_date >= from && a.end_date <= to)
      items.push(item({ kind: 'program-end', date: a.end_date, title: `Fin: ${a.title}`, status: 'planned', clientId: a.client_id, clientName: nameOf(a.client_id) }))
  }

  // Para una sola clienta: los días de rutina con día de la semana y, si todos los tienen, los descansos.
  if (clientId !== null) {
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const dow = dayOfWeek(date)
      const current = assignmentRows.filter((a) => a.start_date <= date && (a.end_date === null || a.end_date >= date))
      const planned = current.flatMap((a) => (daysOf.get(a.routine_version_id) ?? []).filter((d) => d.day_of_week === dow).map((d) => ({ a, d })))
      for (const { a, d } of planned) {
        const done = sessions.some((s) => s.date === date && s.routine_day_id === d.id && s.status === 2)
        items.push(item({ kind: 'planned', date, title: d.name, detail: a.title, status: done ? 'completed' : 'planned', clientId: a.client_id, clientName: nameOf(a.client_id) }))
      }
      const allScheduled =
        current.length > 0 && current.every((a) => (daysOf.get(a.routine_version_id) ?? []).length > 0 && (daysOf.get(a.routine_version_id) ?? []).every((d) => d.day_of_week !== null))
      if (planned.length === 0 && allScheduled && !eventRows.some((e) => e.date === date && e.type === 2 && e.status !== 3))
        items.push(item({ kind: 'rest', date, title: 'Descanso', detail: 'Según los días de la rutina', status: 'planned', clientId, clientName: nameOf(clientId) }))
    }
  }

  for (const s of sessions)
    items.push(item({
      kind: 'session', date: s.date, title: s.day_name ?? 'Entrenamiento', detail: s.routine_title, status: s.status === 2 ? 'completed' : 'in-progress',
      clientId: s.client_id, clientName: nameOf(s.client_id), sessionId: s.id,
    }))

  // Una evaluación enlazada a un evento ya aparece como ese evento.
  const linked = new Set(eventRows.filter((e) => e.evaluation_id !== null).map((e) => e.evaluation_id))
  for (const e of evaluations.results as { id: number; client_id: number; evaluated_on: string; count: number }[]) {
    if (linked.has(e.id)) continue
    items.push(item({
      kind: 'evaluation', date: e.evaluated_on, title: 'Evaluación', detail: `${e.count} ${e.count === 1 ? 'medida' : 'medidas'}`, status: 'completed',
      clientId: e.client_id, clientName: nameOf(e.client_id), evaluationId: e.id,
    }))
  }

  const byName = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? -1 : b === null ? 1 : a < b ? -1 : a > b ? 1 : 0)
  return items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? '00:00:00').localeCompare(b.startTime ?? '00:00:00') ||
      (KIND_ORDER[a.kind] ?? 7) - (KIND_ORDER[b.kind] ?? 7) ||
      byName(a.clientName, b.clientName),
  )
}

// ---------- Eventos de la entrenadora (nunca se borran: se marcan como hechos o se cancelan) ----------

/** Hora opcional: acepta HH:MM o HH:MM:SS y la guarda como HH:MM:SS. */
function readTime(value: unknown): { ok: boolean; value: string | null } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, value: null }
  const m = value.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?$/)
  return m ? { ok: true, value: `${m[1]}:${m[2]}:${m[3] ?? '00'}` } : { ok: false, value: null }
}

interface EventInput {
  clientId: number | null
  type: number
  title: string | null
  date: string
  startTime: string | null
  endTime: string | null
  notes: string | null
}

/** Errores por campo; null si la clienta indicada no es de la entrenadora (se responde 404). */
async function readEvent(c: Ctx): Promise<{ input: EventInput; errors: Record<string, string[]> } | null> {
  const body = (await readJson(c)) ?? {}
  const errors: Record<string, string[]> = {}
  const add = (f: string, m: string) => (errors[f] ??= []).push(m)
  const clientId = body.clientId === undefined || body.clientId === null ? null : body.clientId
  if (clientId !== null) {
    if (!Number.isInteger(clientId)) return null
    const owned = await c.env.DB.prepare('SELECT 1 AS x FROM clients WHERE id = ? AND trainer_id = ?').bind(clientId, currentUser(c).id).first()
    if (!owned) return null
  }
  const type = typeof body.type === 'number' ? body.type : 0
  if (!EVENT_TYPES[type]) add('type', 'Elige el tipo de evento.')
  const date = body.date
  if (!isDate(date) || date < '2000-01-01') add('date', 'Indica la fecha.')
  const title = typeof body.title === 'string' ? body.title : null
  if (body.title !== undefined && body.title !== null && typeof body.title !== 'string') add('title', 'Debe ser texto.')
  if (title !== null && title.length > MAX_TITLE) add('title', `Máximo ${MAX_TITLE} caracteres.`)
  const notes = typeof body.notes === 'string' ? body.notes : null
  if (notes !== null && notes.length > MAX_NOTES) add('notes', `Máximo ${MAX_NOTES} caracteres.`)
  const start = readTime(body.startTime)
  const end = readTime(body.endTime)
  if (!start.ok) add('startTime', 'Hora no válida.')
  if (!end.ok) add('endTime', 'Hora no válida.')
  if (end.value !== null && start.value === null && start.ok) add('startTime', 'Indica la hora de inicio.')
  if (end.value !== null && start.value !== null && end.value < start.value) add('endTime', 'La hora de fin no puede ser anterior al inicio.')
  if (clientId === null && (type === 3 || type === 2)) add('clientId', 'Elige la clienta para una evaluación o un descanso.')
  return {
    input: {
      clientId: clientId as number | null,
      type,
      title: title !== null && title.trim() ? clean(title) : null,
      date: date as string,
      startTime: start.value,
      endTime: end.value,
      notes: notes !== null && notes.trim() ? notes.trim() : null,
    },
    errors,
  }
}

calendarEvents.post('/events', async (c) => {
  const read = await readEvent(c)
  if (!read) return notFound(c)
  if (Object.keys(read.errors).length) return validation(c, read.errors)
  const e = read.input
  const now = nowIso()
  const row = await c.env.DB.prepare(
    `INSERT INTO calendar_events (trainer_id, client_id, type, status, title, date, start_time, end_time, notes, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(currentUser(c).id, e.clientId, e.type, e.title ?? EVENT_TYPES[e.type], e.date, e.startTime, e.endTime, e.notes, now, now)
    .first<{ id: number }>()
  await audit(c, 'CalendarEventCreated', 'CalendarEvent', row!.id, `${EVENT_TYPE_NAMES[e.type]} ${e.date}`)
  return c.json({ id: row!.id }, 201)
})

const ownedEvent = (c: Ctx) =>
  c.env.DB.prepare('SELECT id, status FROM calendar_events WHERE id = ? AND trainer_id = ?')
    .bind(Number(c.req.param('id')), currentUser(c).id)
    .first<{ id: number; status: number }>()

calendarEvents.put('/events/:id{[0-9]+}', async (c) => {
  const event = await ownedEvent(c)
  if (!event) return notFound(c)
  if (event.status !== 1) return problem(c, 409, 'Conflicto', 'Solo se editan eventos programados.')
  const read = await readEvent(c)
  if (!read) return notFound(c)
  if (Object.keys(read.errors).length) return validation(c, read.errors)
  const e = read.input
  await c.env.DB.prepare(
    `UPDATE calendar_events SET client_id = ?, type = ?, title = ?, date = ?, start_time = ?, end_time = ?, notes = ?, updated_at = ?
      WHERE id = ? AND status = 1`,
  )
    .bind(e.clientId, e.type, e.title ?? EVENT_TYPES[e.type], e.date, e.startTime, e.endTime, e.notes, nowIso(), event.id)
    .run()
  await audit(c, 'CalendarEventUpdated', 'CalendarEvent', event.id, `${EVENT_TYPE_NAMES[e.type]} ${e.date}`)
  return c.body(null, 204)
})

/** Marca el evento como hecho (2) o cancelado (3). Nunca se borra: queda en el calendario con su estado. */
calendarEvents.post('/events/:id{[0-9]+}/status', async (c) => {
  const event = await ownedEvent(c)
  if (!event) return notFound(c)
  const status = ((await readJson(c)) ?? {}).status
  if (status !== 2 && status !== 3) return validation(c, { status: ['Estado no válido.'] })
  if (event.status !== 1) return problem(c, 409, 'Conflicto', 'Este evento ya no está programado.')
  const { meta } = await c.env.DB.prepare('UPDATE calendar_events SET status = ?, updated_at = ? WHERE id = ? AND status = 1').bind(status, nowIso(), event.id).run()
  if (!meta.changes) return problem(c, 409, 'Conflicto', 'Este evento ya no está programado.')
  await audit(c, status === 3 ? 'CalendarEventCancelled' : 'CalendarEventCompleted', 'CalendarEvent', event.id)
  return c.body(null, 204)
})

/** Vista del calendario de la entrenadora: todos sus clientes o uno. */
calendarEvents.get('/', async (c) => {
  const from = c.req.query('from')
  const to = c.req.query('to')
  const invalid = checkRange(c, from, to)
  if (invalid) return invalid
  const raw = c.req.query('clientId')
  const clientId = raw ? Number(raw) : null
  const trainerId = currentUser(c).id
  if (clientId !== null) {
    if (!Number.isInteger(clientId)) return notFound(c)
    const owned = await c.env.DB.prepare('SELECT 1 AS x FROM clients WHERE id = ? AND trainer_id = ?').bind(clientId, trainerId).first()
    if (!owned) return notFound(c)
  }
  return c.json(await buildCalendar(c.env.DB, from!, to!, { trainerId, clientId }))
})

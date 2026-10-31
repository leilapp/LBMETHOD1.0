import { Hono } from 'hono'
import type { Context } from 'hono'
import { audit } from '../audit'
import { isDate, localDate } from '../dates'
import { notFound, nowIso, problem, readJson, validation } from '../http'
import { currentUser } from '../session'
import type { AppBindings } from '../types'

/**
 * Asignación de versiones publicadas a clientes. Cada asignación apunta a una versión concreta, así que varios clientes
 * comparten la misma definición de ejercicios sin copiarla. Nunca se borran: se terminan o se cancelan y quedan como
 * historial. Un cliente puede tener varias rutinas vigentes a la vez (por ejemplo, gimnasio y casa).
 */
export const assignments = new Hono<AppBindings>()

type Ctx = Context<AppBindings>

export const STATUS: Record<number, string> = { 1: 'Scheduled', 2: 'Active', 3: 'Completed', 4: 'Cancelled', 5: 'Replaced' }
export const STATUS_LABELS: Record<number, string> = { 1: 'Programada', 2: 'Vigente', 3: 'Terminada', 4: 'Cancelada', 5: 'Reemplazada' }
const MAX_CLIENTS = 50
const MAX_NOTES = 1000

/**
 * Estado real en una fecha. Cancelada, reemplazada o terminada a mano se respetan; en otro caso el estado se deduce de
 * las fechas (programada → vigente → terminada), sin tareas automáticas.
 */
export function effective(stored: number, start: string, end: string | null, today: string) {
  if (stored === 3 || stored === 4 || stored === 5) return stored
  if (start > today) return 1
  if (end !== null && end < today) return 3
  return 2
}

interface AssignmentRow {
  id: number
  client_id: number
  first_name: string
  last_name: string
  routine_id: number
  title: string
  routine_version_id: number
  version_number: number
  latest_id: number | null
  latest_number: number | null
  start_date: string
  end_date: string | null
  status: number
  notes: string | null
  created_at: string
}

/**
 * Asignaciones con su estado real del día. «where» filtra sobre a (asignación), c (cliente), v (versión).
 * Primero lo actual (vigente y programado) y luego el historial; dentro de cada grupo, lo más reciente primero.
 */
export async function listAssignments(db: D1Database, where: string, params: unknown[]) {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.client_id, c.first_name, c.last_name, v.routine_id, v.title, a.routine_version_id, v.version_number,
              a.start_date, a.end_date, a.status, a.notes, a.created_at, lv.id AS latest_id, lv.version_number AS latest_number
         FROM routine_assignments a
         JOIN clients c ON c.id = a.client_id
         JOIN routine_versions v ON v.id = a.routine_version_id
         LEFT JOIN routine_versions lv ON lv.id = (SELECT id FROM routine_versions WHERE routine_id = v.routine_id AND status = 2
                                                    ORDER BY version_number DESC LIMIT 1)
        WHERE ${where}`,
    )
    .bind(...params)
    .all<AssignmentRow>()
  const today = localDate()
  const group = (s: number) => (s === 2 ? 0 : s === 1 ? 1 : 2)
  return results
    .map((r) => {
      const status = effective(r.status, r.start_date, r.end_date, today)
      return {
        id: r.id,
        clientId: r.client_id,
        clientName: `${r.first_name} ${r.last_name}`,
        routineId: r.routine_id,
        routineName: r.title,
        routineVersionId: r.routine_version_id,
        versionNumber: r.version_number,
        latestVersionNumber: r.latest_number,
        latestVersionId: r.latest_id,
        startDate: r.start_date,
        endDate: r.end_date,
        status: STATUS[status],
        statusLabel: STATUS_LABELS[status],
        notes: r.notes,
        createdAt: r.created_at,
        group: group(status),
      }
    })
    .sort((a, b) => a.group - b.group || b.startDate.localeCompare(a.startDate) || b.id - a.id)
    .map(({ group: _, ...rest }) => rest)
}

/** Asigna una versión publicada a uno o varios clientes (cada cliente recibe su propia asignación). */
assignments.post('/', async (c) => {
  const body = await readJson(c)
  if (!body) return validation(c, { body: ['Datos no válidos.'] })
  const versionId = body.routineVersionId
  if (versionId === undefined || versionId === null) return validation(c, { routineVersionId: ['Elige la rutina y su versión.'] })
  if (typeof versionId !== 'number' || !Number.isInteger(versionId)) return validation(c, { routineVersionId: ['Valor no válido.'] })
  if (body.startDate === undefined || body.startDate === null) return validation(c, { startDate: ['Indica la fecha de inicio.'] })

  const errors: Record<string, string[]> = {}
  const add = (field: string, message: string) => (errors[field] ??= []).push(message)
  const rawIds = body.clientIds ?? []
  if (!Array.isArray(rawIds) || !rawIds.every((x) => typeof x === 'number' && Number.isInteger(x))) add('clientIds', 'Lista de clientes no válida.')
  const clientIds = Array.isArray(rawIds) ? [...new Set(rawIds as number[])] : []
  if (!errors.clientIds && clientIds.length === 0) add('clientIds', 'Elige al menos un cliente.')
  if (clientIds.length > MAX_CLIENTS) add('clientIds', `Máximo ${MAX_CLIENTS} clientes a la vez.`)
  const start = body.startDate
  const end = body.endDate ?? null
  if (!isDate(start) || start < '2000-01-01') add('startDate', 'Fecha de inicio no válida.')
  if (end !== null && !isDate(end)) add('endDate', 'Fecha de fin no válida.')
  else if (end !== null && isDate(start) && end < start) add('endDate', 'La fecha de fin no puede ser anterior al inicio.')
  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') add('notes', 'Debe ser texto.')
  const notes = typeof body.notes === 'string' ? body.notes : null
  if (notes && notes.length > MAX_NOTES) add('notes', `Máximo ${MAX_NOTES} caracteres.`)
  if (Object.keys(errors).length) return validation(c, errors)
  const startDate = start as string

  const db = c.env.DB
  const userId = currentUser(c).id
  const version = await db
    .prepare(
      `SELECT v.id, v.status, r.kind, r.status AS routine_status FROM routine_versions v JOIN routines r ON r.id = v.routine_id
        WHERE v.id = ? AND r.trainer_id = ?`,
    )
    .bind(versionId, userId)
    .first<{ id: number; status: number; kind: number; routine_status: number }>()
  if (!version) return notFound(c)
  if (version.status !== 2) return validation(c, { routineVersionId: ['Solo se puede asignar una versión publicada.'] })
  if (version.kind !== 1) return validation(c, { routineVersionId: ['Una plantilla no se asigna: primero crea una rutina a partir de ella.'] })
  if (version.routine_status === 2) return validation(c, { routineVersionId: ['La rutina está archivada. Restáurala para asignarla.'] })

  const { results: found } = await db
    .prepare('SELECT id, first_name, last_name, status FROM clients WHERE trainer_id = ? AND id IN (SELECT value FROM json_each(?))')
    .bind(userId, JSON.stringify(clientIds))
    .all<{ id: number; first_name: string; last_name: string; status: string }>()
  if (found.length !== clientIds.length) return notFound(c)
  const inactive = found.filter((x) => x.status !== 'Active').map((x) => `${x.first_name} ${x.last_name}`)
  if (inactive.length) return validation(c, { clientIds: [`Cliente inactivo: ${inactive.join(', ')}. Reactívalo para asignarle una rutina.`] })

  const now = nowIso()
  const status = startDate > localDate() ? 1 : 2
  const cleanNotes = notes?.trim() ? notes.trim() : null
  // Todas juntas en un batch (una transacción): o se crean todas o ninguna.
  const results = await db.batch<{ id: number }>(
    clientIds.flatMap((clientId) => [
      db
        .prepare(
          `INSERT INTO routine_assignments (client_id, routine_version_id, assigned_by_user_id, start_date, end_date, status, status_changed_at,
                                            notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        )
        .bind(clientId, version.id, userId, startDate, end, status, now, cleanNotes, now, now),
      db
        .prepare(
          `INSERT INTO audit_logs (occurred_at, user_id, action, entity_type, entity_id, details)
           VALUES (?, ?, 'AssignmentCreated', 'RoutineAssignment', CAST(last_insert_rowid() AS TEXT), ?)`,
        )
        .bind(now, userId, `cliente ${clientId}, versión ${version.id}`),
    ]),
  )
  return c.json({ ids: results.filter((_, i) => i % 2 === 0).map((r) => r.results[0].id) }, 201)
})

const ownedAssignment = (c: Ctx) =>
  c.env.DB.prepare(
    'SELECT a.id, a.start_date, a.end_date, a.status FROM routine_assignments a JOIN clients c ON c.id = a.client_id WHERE a.id = ? AND c.trainer_id = ?',
  )
    .bind(Number(c.req.param('id')), currentUser(c).id)
    .first<{ id: number; start_date: string; end_date: string | null; status: number }>()

/**
 * Fija el último día de una asignación. Si ese día ya llegó, queda terminada. Sirve para terminar un programa o para
 * extenderlo o acortarlo. No borra nada.
 */
assignments.post('/:id{[0-9]+}/end-date', async (c) => {
  const body = (await readJson(c)) ?? {}
  if (body.endDate === undefined || body.endDate === null) return validation(c, { endDate: ['Indica la fecha de fin.'] })
  if (!isDate(body.endDate)) return validation(c, { endDate: ['Fecha de fin no válida.'] })
  const endDate = body.endDate
  const a = await ownedAssignment(c)
  if (!a) return notFound(c)
  const today = localDate()
  const current = effective(a.status, a.start_date, a.end_date, today)
  if (current === 4 || current === 5) return problem(c, 409, 'Conflicto', 'Esta asignación ya no está vigente; queda solo como historial.')
  if (endDate < a.start_date) return validation(c, { endDate: ['La fecha de fin no puede ser anterior al inicio.'] })
  const status = endDate <= today ? 3 : a.start_date > today ? 1 : 2
  const now = nowIso()
  await c.env.DB.prepare('UPDATE routine_assignments SET end_date = ?, status = ?, status_changed_at = ?, updated_at = ? WHERE id = ?')
    .bind(endDate, status, now, now, a.id)
    .run()
  await audit(c, 'AssignmentEndDateSet', 'RoutineAssignment', a.id, endDate)
  return c.body(null, 204)
})

/** Cancela una asignación que aún no empieza (por ejemplo, asignada por error). Queda en el historial. */
assignments.post('/:id{[0-9]+}/cancel', async (c) => {
  const a = await ownedAssignment(c)
  if (!a) return notFound(c)
  if (effective(a.status, a.start_date, a.end_date, localDate()) !== 1)
    return problem(c, 409, 'Conflicto', 'Solo se cancela una asignación que aún no empieza. Para una vigente, termínala.')
  const now = nowIso()
  await c.env.DB.prepare('UPDATE routine_assignments SET status = 4, status_changed_at = ?, updated_at = ? WHERE id = ?').bind(now, now, a.id).run()
  await audit(c, 'AssignmentCancelled', 'RoutineAssignment', a.id)
  return c.body(null, 204)
})

/** Clientes que tienen (o tuvieron) asignada una rutina, en cualquiera de sus versiones. Se monta en /trainer/routines. */
export const routineAssignments = new Hono<AppBindings>()
routineAssignments.get('/:routineId{[0-9]+}/assignments', async (c) =>
  c.json(await listAssignments(c.env.DB, 'v.routine_id = ? AND c.trainer_id = ?', [Number(c.req.param('routineId')), currentUser(c).id])),
)

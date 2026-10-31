import { Hono } from 'hono'
import type { Context } from 'hono'
import { audit } from '../audit'
import { effective } from '../clients/assignments'
import { addDays, isDate, localDate } from '../dates'
import { notFound, nowIso, readJson, validation } from '../http'
import { detect, serveObject } from '../library/media'
import { duplicate } from '../library/catalogs'
import { currentUser } from '../session'
import { clean, cleanOptional, normalize } from '../text'
import { sessionDetail, summaryRows, toSummary } from '../training/queries'
import type { AppBindings } from '../types'
import {
  EVENT_ORDER, EVENT_TYPES, KIND_ORDER, KINDS, MAX_EVALUATION_NOTES, MAX_MEASUREMENTS_PER_EVALUATION, MAX_NOTES, PHOTO_CATEGORIES, PHOTO_ORDER,
  toCenti, valueError,
} from './labels'
import { buildProgress, evaluationsOf, photosOf } from './shared'

/**
 * Seguimiento de la entrenadora: tipos de medida, evaluaciones, fotos privadas, progreso y entrenamientos registrados de
 * sus clientes. Un cliente ajeno se trata como inexistente (404). Nada se borra: una medida se corrige y queda en la
 * bitácora.
 */
export const trackingTrainer = new Hono<AppBindings>()
type Ctx = Context<AppBindings>
type Errors = Record<string, string[]>

const photoUrl = (id: number) => `/api/trainer/photos/${id}/content`
const mediaUrl = (id: number) => `/api/trainer/library/media/${id}/content`
const addTo = (errors: Errors) => (field: string, message: string) => (errors[field] ??= []).push(message)

async function ownsClient(c: Ctx, clientId: number) {
  return !!(await c.env.DB.prepare('SELECT 1 AS x FROM clients WHERE id = ? AND trainer_id = ?').bind(clientId, currentUser(c).id).first())
}
const clientParam = (c: Ctx) => Number(c.req.param('clientId'))

trackingTrainer.get('/tracking/options', (c) =>
  c.json({
    kinds: KIND_ORDER.map((k) => ({ value: k, label: KINDS[k].label, units: KINDS[k].units })),
    photoCategories: PHOTO_ORDER.map((k) => ({ value: k, label: PHOTO_CATEGORIES[k] })),
    eventTypes: EVENT_ORDER.map((k) => ({ value: k, label: EVENT_TYPES[k] })),
  }),
)

// ---------- Tipos de medida ----------

interface TypeRow {
  id: number
  name_es: string
  name_en: string
  kind: number
  unit: string
  sort_order: number
  is_active: number
  measurement_count: number
}

trackingTrainer.get('/measurement-types', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, (SELECT COUNT(*) FROM measurements m WHERE m.measurement_type_id = t.id) AS measurement_count
       FROM measurement_types t ORDER BY t.sort_order, t.id`,
  ).all<TypeRow>()
  return c.json(
    results.map((t) => ({
      id: t.id, nameEs: t.name_es, nameEn: t.name_en, kind: t.kind, kindLabel: KINDS[t.kind]?.label ?? 'Otra', unit: t.unit, sortOrder: t.sort_order,
      isActive: t.is_active === 1, measurementCount: t.measurement_count,
    })),
  )
})

async function readType(c: Ctx) {
  const body = (await readJson(c)) ?? {}
  const errors: Errors = {}
  const add = addTo(errors)
  const rawEs = typeof body.nameEs === 'string' ? body.nameEs : ''
  const rawEn = typeof body.nameEn === 'string' ? body.nameEn : null
  const kind = typeof body.kind === 'number' ? body.kind : 0
  const unit = typeof body.unit === 'string' ? body.unit : ''
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : true
  if (!rawEs.trim()) add('nameEs', 'Escribe el nombre.')
  else if (rawEs.trim().length > 100) add('nameEs', 'Máximo 100 caracteres.')
  if (rawEn !== null && rawEn.length > 100) add('nameEn', 'Máximo 100 caracteres.')
  const def = KINDS[kind]
  if (!def) add('kind', 'Elige el tipo de medida.')
  else if (!def.units.includes(unit)) add('unit', `Para «${def.label}» la unidad debe ser ${def.units.join(', ')}.`)
  const nameEs = clean(rawEs)
  const nameEn = rawEn && rawEn.trim() ? clean(rawEn) : nameEs
  return { errors, nameEs, nameEn, kind, unit, isActive }
}

async function typeDuplicate(c: Ctx, nameEs: string, nameEn: string, exceptId: number) {
  const db = c.env.DB
  if (await db.prepare('SELECT 1 AS x FROM measurement_types WHERE name_es_key = ? AND id <> ?').bind(normalize(nameEs), exceptId).first())
    return duplicate(c, 'nameEs', 'Ya existe un tipo de medida con ese nombre.')
  if (await db.prepare('SELECT 1 AS x FROM measurement_types WHERE name_en_key = ? AND id <> ?').bind(normalize(nameEn), exceptId).first())
    return duplicate(c, 'nameEn', 'Ya existe un tipo de medida con ese nombre en inglés.')
  return null
}

trackingTrainer.post('/measurement-types', async (c) => {
  const t = await readType(c)
  if (Object.keys(t.errors).length) return validation(c, t.errors)
  const dup = await typeDuplicate(c, t.nameEs, t.nameEn, 0)
  if (dup) return dup
  const now = nowIso()
  const row = await c.env.DB.prepare(
    `INSERT INTO measurement_types (name_es, name_en, name_es_key, name_en_key, kind, unit, sort_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM measurement_types), ?, ?, ?) RETURNING id`,
  )
    .bind(t.nameEs, t.nameEn, normalize(t.nameEs), normalize(t.nameEn), t.kind, t.unit, t.isActive ? 1 : 0, now, now)
    .first<{ id: number }>()
  await audit(c, 'MeasurementTypeCreated', 'MeasurementType', row!.id, `${t.nameEs} (${t.unit})`)
  return c.json({ id: row!.id }, 201)
})

/** Edita nombre y estado. La unidad y el tipo solo cambian si aún no hay medidas, para no mezclar unidades en el historial. */
trackingTrainer.put('/measurement-types/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const db = c.env.DB
  const current = await db.prepare('SELECT id, kind, unit FROM measurement_types WHERE id = ?').bind(id).first<{ id: number; kind: number; unit: string }>()
  if (!current) return notFound(c)
  const t = await readType(c)
  if (Object.keys(t.errors).length) return validation(c, t.errors)
  const dup = await typeDuplicate(c, t.nameEs, t.nameEn, id)
  if (dup) return dup
  if ((current.unit !== t.unit || current.kind !== t.kind) && (await db.prepare('SELECT 1 AS x FROM measurements WHERE measurement_type_id = ? LIMIT 1').bind(id).first()))
    return validation(c, { unit: ['Ya hay medidas registradas con este tipo y unidad. Para usar otra unidad, crea un tipo nuevo; así el historial no mezcla unidades.'] })
  await db
    .prepare('UPDATE measurement_types SET name_es = ?, name_en = ?, name_es_key = ?, name_en_key = ?, kind = ?, unit = ?, is_active = ?, updated_at = ? WHERE id = ?')
    .bind(t.nameEs, t.nameEn, normalize(t.nameEs), normalize(t.nameEn), t.kind, t.unit, t.isActive ? 1 : 0, nowIso(), id)
    .run()
  await audit(c, 'MeasurementTypeUpdated', 'MeasurementType', id, `${t.nameEs} (${t.unit})${t.isActive ? '' : ' inactivo'}`)
  return c.body(null, 204)
})

// ---------- Resumen de seguimiento e inicio ----------

trackingTrainer.get('/tracking', async (c) => {
  const db = c.env.DB
  const trainerId = currentUser(c).id
  const today = localDate()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [clients, assignments] = await db.batch([
    db
      .prepare(
        `SELECT c.id, c.first_name || ' ' || c.last_name AS name, c.status,
                (SELECT MAX(e.evaluated_on) FROM evaluations e WHERE e.client_id = c.id) AS last_evaluation,
                (SELECT MIN(ev.date) FROM calendar_events ev WHERE ev.client_id = c.id AND ev.type = 3 AND ev.status = 1 AND ev.date >= ?2) AS next_evaluation,
                (SELECT MAX(l.started_at) FROM training_logs l WHERE l.client_id = c.id) AS last_session,
                (SELECT COUNT(*) FROM training_logs l WHERE l.client_id = c.id AND l.status = 2 AND l.started_at >= ?3) AS recent,
                (SELECT COUNT(*) FROM training_logs l WHERE l.client_id = c.id AND l.status = 1) AS open
           FROM clients c WHERE c.trainer_id = ?1 ORDER BY c.first_name, c.last_name, c.id`,
      )
      .bind(trainerId, today, since),
    db
      .prepare(
        `SELECT a.client_id, a.status, a.start_date, a.end_date, v.title FROM routine_assignments a
           JOIN clients c ON c.id = a.client_id JOIN routine_versions v ON v.id = a.routine_version_id
          WHERE c.trainer_id = ? ORDER BY a.id`,
      )
      .bind(trainerId),
  ])
  const current = new Map<number, string[]>()
  for (const a of assignments.results as { client_id: number; status: number; start_date: string; end_date: string | null; title: string }[])
    if (effective(a.status, a.start_date, a.end_date, today) === 2) current.set(a.client_id, [...(current.get(a.client_id) ?? []), a.title])
  type Row = { id: number; name: string; status: string; last_evaluation: string | null; next_evaluation: string | null; last_session: string | null; recent: number; open: number }
  return c.json(
    (clients.results as Row[]).map((r) => ({
      clientId: r.id, name: r.name, status: r.status, currentProgram: current.get(r.id)?.join(', ') ?? null, lastEvaluation: r.last_evaluation,
      nextEvaluation: r.next_evaluation, lastSession: r.last_session, sessionsLast30Days: r.recent, sessionsInProgress: r.open,
    })),
  )
})

/** Próximas evaluaciones (14 días) y actividad reciente de los clientes, para el inicio de la entrenadora. */
trackingTrainer.get('/dashboard', async (c) => {
  const db = c.env.DB
  const trainerId = currentUser(c).id
  const today = localDate()
  const [upcoming, sessions, evaluations] = await db.batch([
    db
      .prepare(
        `SELECT e.id, e.client_id, c.first_name || ' ' || c.last_name AS client_name, e.date, e.start_time, e.title
           FROM calendar_events e JOIN clients c ON c.id = e.client_id
          WHERE e.trainer_id = ?1 AND e.type = 3 AND e.status = 1 AND e.date BETWEEN ?2 AND ?3
          ORDER BY e.date, e.start_time, e.id LIMIT 10`,
      )
      .bind(trainerId, today, addDays(today, 14)),
    db
      .prepare(
        `SELECT l.id, l.client_id, c.first_name || ' ' || c.last_name AS client_name, l.completed_at, l.day_name, l.routine_title
           FROM training_logs l JOIN clients c ON c.id = l.client_id
          WHERE c.trainer_id = ? AND l.status = 2 ORDER BY l.completed_at DESC, l.id DESC LIMIT 8`,
      )
      .bind(trainerId),
    db
      .prepare(
        `SELECT e.id, e.client_id, c.first_name || ' ' || c.last_name AS client_name, e.created_at,
                (SELECT COUNT(*) FROM measurements m WHERE m.evaluation_id = e.id) AS count
           FROM evaluations e JOIN clients c ON c.id = e.client_id
          WHERE c.trainer_id = ? ORDER BY e.created_at DESC, e.id DESC LIMIT 8`,
      )
      .bind(trainerId),
  ])
  type U = { id: number; client_id: number; client_name: string; date: string; start_time: string | null; title: string }
  type S = { id: number; client_id: number; client_name: string; completed_at: string; day_name: string | null; routine_title: string | null }
  type E = { id: number; client_id: number; client_name: string; created_at: string; count: number }
  const activity = [
    ...(sessions.results as S[]).map((s) => ({
      kind: 'session', clientId: s.client_id, clientName: s.client_name, occurredAt: s.completed_at, title: s.day_name ?? 'Entrenamiento', detail: s.routine_title,
      sessionId: s.id, evaluationId: null,
    })),
    ...(evaluations.results as E[]).map((e) => ({
      kind: 'evaluation', clientId: e.client_id, clientName: e.client_name, occurredAt: e.created_at, title: 'Evaluación', detail: `${e.count} medidas`,
      sessionId: null, evaluationId: e.id,
    })),
  ]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 8)
  return c.json({
    upcomingEvaluations: (upcoming.results as U[]).map((u) => ({ eventId: u.id, clientId: u.client_id, clientName: u.client_name, date: u.date, startTime: u.start_time, title: u.title })),
    recentActivity: activity,
  })
})

// ---------- Evaluaciones y medidas ----------

trackingTrainer.get('/clients/:clientId{[0-9]+}/evaluations', async (c) => {
  const clientId = clientParam(c)
  if (!(await ownsClient(c, clientId))) return notFound(c)
  return c.json(await evaluationsOf(c.env.DB, clientId, photoUrl))
})

interface MeasurementInput {
  measurementTypeId: number
  value: number
  notes: string | null
}

type TypeInfo = { id: number; name_es: string; unit: string; is_active: number }

/** Lee y revisa una evaluación. Devuelve los datos limpios y los errores con la ruta exacta de cada campo. */
async function readEvaluation(c: Ctx) {
  const body = (await readJson(c)) ?? {}
  const errors: Errors = {}
  const add = addTo(errors)
  const date = body.evaluatedOn
  if (date === undefined || date === null) add('evaluatedOn', 'Indica la fecha de la evaluación.')
  else if (!isDate(date)) add('evaluatedOn', 'Fecha no válida.')
  else if (date > localDate()) add('evaluatedOn', 'La fecha no puede ser futura.')
  else if (date < '2000-01-01') add('evaluatedOn', 'Fecha no válida.')
  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') add('notes', 'Debe ser texto.')
  const notes = typeof body.notes === 'string' ? body.notes : null
  if (notes !== null && notes.length > MAX_EVALUATION_NOTES) add('notes', `Máximo ${MAX_EVALUATION_NOTES} caracteres.`)
  const raw = body.measurements ?? []
  const list = Array.isArray(raw) ? raw : (add('measurements', 'Valor no válido.'), [])
  if (list.length > MAX_MEASUREMENTS_PER_EVALUATION) add('measurements', `Máximo ${MAX_MEASUREMENTS_PER_EVALUATION} medidas por evaluación.`)

  const { results: types } = await c.env.DB.prepare('SELECT id, name_es, unit, is_active FROM measurement_types').all<TypeInfo>()
  const typeById = new Map(types.map((t) => [t.id, t]))
  const seen = new Set<number>()
  const measurements: MeasurementInput[] = []
  list.slice(0, MAX_MEASUREMENTS_PER_EVALUATION).forEach((m: unknown, i: number) => {
    const key = `measurements[${i}]`
    const obj = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>
    const typeId = typeof obj.measurementTypeId === 'number' ? obj.measurementTypeId : 0
    const type = typeById.get(typeId)
    if (!type || type.is_active !== 1) return add(`${key}.measurementTypeId`, 'Elige un tipo de medida activo.')
    if (seen.has(typeId)) add(`${key}.measurementTypeId`, 'Esta medida está repetida.')
    seen.add(typeId)
    const error = valueError(obj.value, type.unit)
    if (error) add(`${key}.value`, error)
    const mNotes = typeof obj.notes === 'string' ? obj.notes : null
    if (mNotes !== null && mNotes.length > MAX_NOTES) add(`${key}.notes`, `Máximo ${MAX_NOTES} caracteres.`)
    measurements.push({ measurementTypeId: typeId, value: obj.value as number, notes: cleanOptional(mNotes) })
  })
  return { errors, date: date as string, notes: cleanOptional(notes), measurements, rawCount: list.length, typeById }
}

const measurementsJson = (list: MeasurementInput[], typeById: Map<number, TypeInfo>) =>
  JSON.stringify(list.map((m) => ({ t: m.measurementTypeId, v: toCenti(m.value), u: typeById.get(m.measurementTypeId)!.unit, n: m.notes })))

trackingTrainer.post('/clients/:clientId{[0-9]+}/evaluations', async (c) => {
  const clientId = clientParam(c)
  if (!(await ownsClient(c, clientId))) return notFound(c)
  const e = await readEvaluation(c)
  if (e.rawCount === 0 && e.notes === null) addTo(e.errors)('measurements', 'Registra al menos una medida o escribe una nota.')
  if (Object.keys(e.errors).length) return validation(c, e.errors)
  const db = c.env.DB
  const userId = currentUser(c).id
  const now = nowIso()
  const evaluation = '(SELECT MAX(id) FROM evaluations)'
  // Todo en un batch (una transacción). Si había una evaluación programada ese día, queda como hecha y enlazada.
  const [inserted] = await db.batch<{ id: number }>([
    db
      .prepare('INSERT INTO evaluations (client_id, evaluated_on, performed_by_user_id, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
      .bind(clientId, e.date, userId, e.notes, now, now),
    db
      .prepare(
        `INSERT INTO measurements (client_id, measurement_type_id, evaluation_id, measured_on, value_centi, unit, recorded_by_user_id, notes, created_at, updated_at)
         SELECT ?2, j.value ->> 't', ${evaluation}, ?3, j.value ->> 'v', j.value ->> 'u', ?4, j.value ->> 'n', ?5, ?5 FROM json_each(?1) j`,
      )
      .bind(measurementsJson(e.measurements, e.typeById), clientId, e.date, userId, now),
    db
      .prepare(
        `UPDATE calendar_events SET status = 2, evaluation_id = ${evaluation}, updated_at = ?3
          WHERE client_id = ?1 AND date = ?2 AND type = 3 AND status = 1`,
      )
      .bind(clientId, e.date, now),
    db
      .prepare(
        `INSERT INTO audit_logs (occurred_at, user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, 'EvaluationCreated', 'Evaluation', CAST(${evaluation} AS TEXT), ?)`,
      )
      .bind(now, userId, `Cliente ${clientId}, ${e.date}, ${e.measurements.length} medidas`),
  ])
  return c.json({ id: inserted.results[0].id }, 201)
})

/** Cambia la fecha o las notas y agrega medidas nuevas. Las medidas existentes se corrigen una por una. */
trackingTrainer.put('/evaluations/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const db = c.env.DB
  const userId = currentUser(c).id
  const current = await db
    .prepare('SELECT e.id, e.client_id, e.evaluated_on, e.notes FROM evaluations e JOIN clients c ON c.id = e.client_id WHERE e.id = ? AND c.trainer_id = ?')
    .bind(id, userId)
    .first<{ id: number; client_id: number; evaluated_on: string; notes: string | null }>()
  if (!current) return notFound(c)
  const e = await readEvaluation(c)
  const { results: existing } = await db.prepare('SELECT measurement_type_id FROM measurements WHERE evaluation_id = ?').bind(id).all<{ measurement_type_id: number }>()
  const present = new Set(existing.map((m) => m.measurement_type_id))
  e.measurements.forEach((m, i) => {
    if (present.has(m.measurementTypeId))
      addTo(e.errors)(`measurements[${i}].measurementTypeId`, 'Esta medida ya está en la evaluación; corrígela en lugar de agregarla otra vez.')
  })
  if (Object.keys(e.errors).length) return validation(c, e.errors)

  const changes: string[] = []
  if (current.evaluated_on !== e.date) changes.push(`fecha ${current.evaluated_on} → ${e.date}`)
  if (current.notes !== e.notes) changes.push('notas')
  for (const m of e.measurements) changes.push(`nueva medida ${e.typeById.get(m.measurementTypeId)!.name_es}`)
  const now = nowIso()
  await db.batch([
    db.prepare('UPDATE evaluations SET evaluated_on = ?, notes = ?, updated_at = ? WHERE id = ?').bind(e.date, e.notes, now, id),
    db.prepare('UPDATE measurements SET measured_on = ?, updated_at = ? WHERE evaluation_id = ? AND measured_on <> ?').bind(e.date, now, id, e.date),
    db
      .prepare(
        `INSERT INTO measurements (client_id, measurement_type_id, evaluation_id, measured_on, value_centi, unit, recorded_by_user_id, notes, created_at, updated_at)
         SELECT ?2, j.value ->> 't', ?3, ?4, j.value ->> 'v', j.value ->> 'u', ?5, j.value ->> 'n', ?6, ?6 FROM json_each(?1) j`,
      )
      .bind(measurementsJson(e.measurements, e.typeById), current.client_id, id, e.date, userId, now),
  ])
  if (changes.length) await audit(c, 'EvaluationUpdated', 'Evaluation', id, changes.join('; '))
  return c.body(null, 204)
})

/** Corrige el valor o la nota de una medida. El valor anterior queda registrado en la bitácora. */
trackingTrainer.put('/measurements/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const m = await c.env.DB.prepare(
    'SELECT m.id, m.value_centi, m.unit FROM measurements m JOIN clients c ON c.id = m.client_id WHERE m.id = ? AND c.trainer_id = ?',
  )
    .bind(id, currentUser(c).id)
    .first<{ id: number; value_centi: number; unit: string }>()
  if (!m) return notFound(c)
  const body = (await readJson(c)) ?? {}
  const errors: Errors = {}
  const error = valueError(body.value, m.unit)
  if (error) errors.value = [error]
  const notes = typeof body.notes === 'string' ? body.notes : null
  if (notes !== null && notes.length > MAX_NOTES) errors.notes = [`Máximo ${MAX_NOTES} caracteres.`]
  if (Object.keys(errors).length) return validation(c, errors)
  const value = body.value as number
  await c.env.DB.prepare('UPDATE measurements SET value_centi = ?, notes = ?, updated_at = ? WHERE id = ?').bind(toCenti(value), cleanOptional(notes), nowIso(), id).run()
  await audit(c, 'MeasurementCorrected', 'Measurement', id, `${(m.value_centi / 100).toFixed(2)} ${m.unit} → ${value} ${m.unit}`)
  return c.body(null, 204)
})

// ---------- Fotos de progreso (R2 privado) ----------

trackingTrainer.get('/clients/:clientId{[0-9]+}/photos', async (c) => {
  const clientId = clientParam(c)
  if (!(await ownsClient(c, clientId))) return notFound(c)
  return c.json(await photosOf(c.env.DB, clientId, photoUrl))
})

trackingTrainer.post('/clients/:clientId{[0-9]+}/photos', async (c) => {
  const clientId = clientParam(c)
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return validation(c, { file: ['Selecciona una foto.'] })
  }
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return validation(c, { file: ['Selecciona una foto.'] })
  if (!(await ownsClient(c, clientId))) return notFound(c)

  const errors: Errors = {}
  const add = addTo(errors)
  const field = (name: string) => {
    const v = form.get(name)
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  const takenOn = field('takenOn')
  if (takenOn === null || !isDate(takenOn)) add('takenOn', 'Indica la fecha de la foto.')
  else if (takenOn > localDate()) add('takenOn', 'La fecha no puede ser futura.')
  const rawCategory = field('category')
  const category = rawCategory === null ? null : Number(rawCategory)
  if (category !== null && !PHOTO_CATEGORIES[category]) add('category', 'Categoría no válida.')
  const notes = field('notes')
  if (notes !== null && notes.length > MAX_NOTES) add('notes', `Máximo ${MAX_NOTES} caracteres.`)
  const rawEvaluation = field('evaluationId')
  const evaluationId = rawEvaluation === null ? null : Number(rawEvaluation)
  if (evaluationId !== null) {
    const ok = Number.isInteger(evaluationId) && (await c.env.DB.prepare('SELECT 1 AS x FROM evaluations WHERE id = ? AND client_id = ?').bind(evaluationId, clientId).first())
    if (!ok) add('evaluationId', 'La evaluación no es de este cliente.')
  }
  const max = Number(c.env.MAX_PHOTO_BYTES)
  if (file.size > max) add('file', `La foto supera el máximo de ${Math.floor(max / (1024 * 1024))} MB.`)
  if (Object.keys(errors).length) return validation(c, errors)

  const signature = detect(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!signature || signature.type !== 1) return validation(c, { file: ['Formato no permitido. Usa una foto JPG, PNG o WEBP.'] })

  const fileId = crypto.randomUUID()
  const key = `progress/${fileId.replace(/-/g, '')}${signature.extension}`
  await c.env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: signature.contentType } })
  const now = nowIso()
  try {
    const [, inserted] = await c.env.DB.batch<{ id: number }>([
      c.env.DB.prepare(
        `INSERT INTO stored_files (id, purpose, owner_client_id, uploaded_by_user_id, original_file_name, content_type, size_bytes, storage_key, created_at)
         VALUES (?, 'ProgressPhoto', ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(fileId, clientId, currentUser(c).id, `progreso-${takenOn}${signature.extension}`, signature.contentType, file.size, key, now),
      c.env.DB.prepare(
        `INSERT INTO progress_photos (client_id, stored_file_id, evaluation_id, taken_on, category, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      ).bind(clientId, fileId, evaluationId, takenOn, category, notes, now),
    ])
    const photoId = inserted.results[0].id
    await audit(c, 'ProgressPhotoUploaded', 'ProgressPhoto', photoId, `Cliente ${clientId}`)
    return c.json({ id: photoId }, 201)
  } catch (err) {
    await c.env.MEDIA.delete(key) // no dejar archivos huérfanos
    throw err
  }
})

trackingTrainer.get('/photos/:id{[0-9]+}/content', async (c) => {
  const file = await c.env.DB.prepare(
    `SELECT f.storage_key, f.content_type FROM progress_photos p JOIN stored_files f ON f.id = p.stored_file_id JOIN clients c ON c.id = p.client_id
      WHERE p.id = ? AND c.trainer_id = ? AND f.deleted_at IS NULL`,
  )
    .bind(Number(c.req.param('id')), currentUser(c).id)
    .first<{ storage_key: string; content_type: string }>()
  if (!file) return notFound(c)
  return serveObject(c, file.storage_key, file.content_type)
})

// ---------- Progreso y entrenamientos registrados ----------

trackingTrainer.get('/clients/:clientId{[0-9]+}/progress', async (c) => {
  const clientId = clientParam(c)
  if (!(await ownsClient(c, clientId))) return notFound(c)
  return c.json(await buildProgress(c.env.DB, clientId))
})

trackingTrainer.get('/clients/:clientId{[0-9]+}/sessions', async (c) => {
  const clientId = clientParam(c)
  if (!(await ownsClient(c, clientId))) return notFound(c)
  return c.json((await summaryRows(c.env.DB, { where: 'l.client_id = ?', params: [clientId] }, 'ORDER BY l.started_at DESC, l.id DESC LIMIT 200')).map(toSummary))
})

trackingTrainer.get('/clients/:clientId{[0-9]+}/sessions/:id{[0-9]+}', async (c) => {
  const clientId = clientParam(c)
  if (!(await ownsClient(c, clientId))) return notFound(c)
  const detail = await sessionDetail(c.env.DB, { where: 'l.client_id = ?', params: [clientId] }, Number(c.req.param('id')), mediaUrl)
  return detail ? c.json(detail) : notFound(c)
})

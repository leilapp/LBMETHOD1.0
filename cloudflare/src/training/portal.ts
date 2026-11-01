import { Hono } from 'hono'
import type { Context } from 'hono'
import { effective, STATUS, STATUS_LABELS } from '../clients/assignments'
import { addDays, dayOfWeek, localDate, shortDate } from '../dates'
import { notFound, nowIso, problem, readJson, validation } from '../http'
import { serveObject } from '../library/media'
import { dayLabel, SET_TYPES } from '../routines/model'
import { currentUser } from '../session'
import type { AppBindings } from '../types'
import { mediaFor, sessionDetail, summaryRows, toSummary, unit, weight, type Visible } from './queries'

/**
 * Portal del cliente: su rutina (solo lectura), los medios autorizados y el registro de sus entrenamientos.
 * Todo se resuelve con la sesión actual; nunca se aceptan ids de cliente. Lo de otro cliente responde 404.
 */
export const portalTraining = new Hono<AppBindings>()
type Ctx = Context<AppBindings>

const LIMITS = { maxReps: 1000, maxWeight: 2000, maxExtraSets: 20, maxSessionComment: 2000, maxExerciseComment: 1000, maxSetNotes: 500 }
const portalMediaUrl = (id: number) => `/api/portal/media/${id}/content`
const isCurrent = (status: number) => status === 1 || status === 2
const opt = (s: string | null) => (s === null || !s.trim() ? null : s.trim())
const isHalf = (v: number) => Math.round(v * 2) === v * 2
const centi = (v: number | null) => (v === null ? null : Math.round(v * 100))

/** Cliente de la sesión actual (null si la cuenta no tiene perfil de cliente). */
async function clientId(c: Ctx) {
  const row = await c.env.DB.prepare('SELECT id FROM clients WHERE user_id = ?').bind(currentUser(c).id).first<{ id: number }>()
  return row?.id ?? null
}

const mine = (id: number): Visible => ({ where: 'l.client_id = ?', params: [id] })

interface AssignmentRow {
  id: number
  routine_version_id: number
  start_date: string
  end_date: string | null
  status: number
  notes: string | null
  title: string
  version_number: number
  description: string | null
  goal: string | null
  duration_weeks: number | null
}

/** Asignaciones vigentes o por empezar del cliente, con su estado real de hoy. */
async function currentAssignments(db: D1Database, client: number, today: string) {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.routine_version_id, a.start_date, a.end_date, a.status, a.notes, v.title, v.version_number, v.description, v.goal, v.duration_weeks
         FROM routine_assignments a JOIN routine_versions v ON v.id = a.routine_version_id
        WHERE a.client_id = ? AND a.status NOT IN (3, 4, 5)`,
    )
    .bind(client)
    .all<AssignmentRow>()
  return results.map((a) => ({ ...a, effective: effective(a.status, a.start_date, a.end_date, today) })).filter((a) => isCurrent(a.effective))
}

interface DayRow {
  id: number
  routine_version_id: number
  position: number
  name: string
  day_of_week: number | null
  notes: string | null
}

async function daysOf(db: D1Database, versionIds: number[]) {
  const { results } = await db
    .prepare('SELECT id, routine_version_id, position, name, day_of_week, notes FROM routine_days WHERE routine_version_id IN (SELECT value FROM json_each(?)) ORDER BY position')
    .bind(JSON.stringify(versionIds))
    .all<DayRow>()
  const byVersion = new Map<number, DayRow[]>()
  for (const d of results) byVersion.set(d.routine_version_id, [...(byVersion.get(d.routine_version_id) ?? []), d])
  return byVersion
}

/** Asignaciones vigentes o por empezar, con días, ejercicios, parámetros y medios. */
portalTraining.get('/program', async (c) => {
  const client = await clientId(c)
  if (client === null) return notFound(c)
  const db = c.env.DB
  const assignments = (await currentAssignments(db, client, localDate())).sort(
    (a, b) => (a.effective === 2 ? 0 : 1) - (b.effective === 2 ? 0 : 1) || a.start_date.localeCompare(b.start_date) || a.id - b.id,
  )
  if (assignments.length === 0) return c.json([])
  const versionIds = JSON.stringify([...new Set(assignments.map((a) => a.routine_version_id))])
  const [days, exercises, sets] = await db.batch([
    db.prepare('SELECT id, routine_version_id, position, name, day_of_week, notes FROM routine_days WHERE routine_version_id IN (SELECT value FROM json_each(?)) ORDER BY position').bind(versionIds),
    db
      .prepare(
        `SELECT e.*, x.name_es, x.name_en, x.instructions, x.technical_tips,
                (SELECT mg.name_es FROM exercise_muscles em JOIN muscle_groups mg ON mg.id = em.muscle_group_id
                  WHERE em.exercise_id = x.id AND em.role = 1) AS primary_muscle
           FROM routine_exercises e
           JOIN routine_days d ON d.id = e.routine_day_id JOIN exercises x ON x.id = e.exercise_id
          WHERE d.routine_version_id IN (SELECT value FROM json_each(?)) ORDER BY e.position`,
      )
      .bind(versionIds),
    db
      .prepare(
        `SELECT s.* FROM routine_exercise_sets s JOIN routine_exercises e ON e.id = s.routine_exercise_id JOIN routine_days d ON d.id = e.routine_day_id
          WHERE d.routine_version_id IN (SELECT value FROM json_each(?)) ORDER BY s.set_number`,
      )
      .bind(versionIds),
  ])
  type Ex = Record<string, number | string | null> & { id: number; routine_day_id: number; exercise_id: number }
  type SetRow = Record<string, number | string | null> & { routine_exercise_id: number }
  const setsOf = new Map<number, SetRow[]>()
  for (const s of sets.results as SetRow[]) setsOf.set(s.routine_exercise_id, [...(setsOf.get(s.routine_exercise_id) ?? []), s])
  const exercisesOf = new Map<number, Ex[]>()
  for (const e of exercises.results as Ex[]) exercisesOf.set(e.routine_day_id, [...(exercisesOf.get(e.routine_day_id) ?? []), e])
  const daysOfVersion = new Map<number, DayRow[]>()
  for (const d of days.results as DayRow[]) daysOfVersion.set(d.routine_version_id, [...(daysOfVersion.get(d.routine_version_id) ?? []), d])
  const media = await mediaFor(db, [...new Set((exercises.results as Ex[]).map((e) => e.exercise_id))], portalMediaUrl)
  const n = (v: number | string | null) => v as number | null
  const s = (v: number | string | null) => v as string | null

  return c.json(
    assignments.map((a) => ({
      assignmentId: a.id,
      routineName: a.title,
      versionNumber: a.version_number,
      description: a.description,
      goal: a.goal,
      durationWeeks: a.duration_weeks,
      startDate: a.start_date,
      endDate: a.end_date,
      status: STATUS[a.effective],
      statusLabel: STATUS_LABELS[a.effective],
      notes: a.notes,
      days: (daysOfVersion.get(a.routine_version_id) ?? []).map((d) => ({
        id: d.id,
        position: d.position,
        name: d.name,
        dayLabel: dayLabel(d.day_of_week),
        notes: d.notes,
        exercises: (exercisesOf.get(d.id) ?? []).map((e) => ({
          id: e.id,
          position: n(e.position),
          exerciseId: e.exercise_id,
          nameEs: s(e.name_es),
          nameEn: s(e.name_en),
          primaryMuscleGroup: s(e.primary_muscle),
          supersetGroup: s(e.superset_group),
          sets: n(e.sets),
          repsMin: n(e.reps_min),
          repsMax: n(e.reps_max),
          suggestedWeight: weight(n(e.suggested_weight_centi)),
          weightUnit: unit(n(e.suggested_weight_unit)),
          restSeconds: n(e.rest_seconds),
          tempo: s(e.tempo),
          rir: n(e.rir),
          rpe: n(e.rpe),
          setType: n(e.set_type) ?? 1,
          setTypeLabel: SET_TYPES[n(e.set_type) ?? 1] ?? 'Otra',
          notes: s(e.notes),
          instructions: s(e.instructions),
          technicalTips: s(e.technical_tips),
          setDetails: (setsOf.get(e.id) ?? []).map((x) => ({
            setNumber: n(x.set_number),
            setType: n(x.set_type) ?? 1,
            setTypeLabel: SET_TYPES[n(x.set_type) ?? 1] ?? 'Otra',
            repsMin: n(x.reps_min),
            repsMax: n(x.reps_max),
            suggestedWeight: weight(n(x.suggested_weight_centi)),
            weightUnit: unit(n(x.suggested_weight_unit)),
            restSeconds: n(x.rest_seconds),
            rir: n(x.rir),
            rpe: n(x.rpe),
            notes: s(x.notes),
          })),
          media: media.get(e.exercise_id) ?? [],
        })),
      })),
    })),
  )
})

/**
 * Imagen o video privado, solo si el ejercicio está en alguna rutina asignada al cliente (no cancelada).
 * Cualquier otro medio se trata como inexistente.
 */
portalTraining.get('/media/:mediaId{[0-9]+}/content', async (c) => {
  const client = await clientId(c)
  if (client === null) return notFound(c)
  const file = await c.env.DB.prepare(
    `SELECT f.storage_key, f.content_type FROM exercise_media m JOIN stored_files f ON f.id = m.stored_file_id
      WHERE m.id = ? AND f.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM routine_assignments a JOIN routine_days d ON d.routine_version_id = a.routine_version_id
                      JOIN routine_exercises e ON e.routine_day_id = d.id
                     WHERE a.client_id = ? AND a.status <> 4 AND e.exercise_id = m.exercise_id)`,
  )
    .bind(Number(c.req.param('mediaId')), client)
    .first<{ storage_key: string; content_type: string }>()
  if (!file) return notFound(c)
  // Sin caché: securityHeaders pone «Cache-Control: no-store» en toda la API.
  return serveObject(c, file.storage_key, file.content_type)
})

/** Inicio: entrenamiento en curso, próximo entrenamiento, semana actual y último entrenamiento. */
portalTraining.get('/home', async (c) => {
  const client = await clientId(c)
  if (client === null) return notFound(c)
  const db = c.env.DB
  const today = localDate()
  const monday = addDays(today, -((dayOfWeek(today) + 6) % 7))
  const active = (await currentAssignments(db, client, today)).sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id)
  const days = await daysOf(db, [...new Set(active.map((a) => a.routine_version_id))])

  // La semana empieza el lunes a medianoche en el centro de México. Se trae con un margen en UTC y se filtra por la
  // fecha local exacta de cada entrenamiento.
  const visible = mine(client)
  const localOf = (iso: string) => localDate(new Date(iso))
  const recent = (await summaryRows(db, visible, 'AND (l.started_at >= ? OR l.status = 1) ORDER BY l.started_at', [`${addDays(monday, -1)}T00:00:00.000Z`])).filter(
    (r) => r.status === 1 || localOf(r.started_at) >= monday,
  )
  const [last] = await summaryRows(db, visible, 'AND l.status = 2 ORDER BY l.completed_at DESC LIMIT 1')
  const inProgress = recent.find((r) => r.status === 1)

  // Próximo entrenamiento por rutina vigente: si los días tienen día de la semana, el siguiente desde hoy que aún no se
  // hizo; si no, el día que sigue al último entrenado (en el orden de la rutina).
  const { results: lastDays } = await db
    .prepare(
      `SELECT routine_assignment_id, routine_day_id FROM (
         SELECT routine_assignment_id, routine_day_id,
                ROW_NUMBER() OVER (PARTITION BY routine_assignment_id ORDER BY started_at DESC, id DESC) AS rn
           FROM training_logs WHERE client_id = ? AND routine_assignment_id IS NOT NULL AND routine_day_id IS NOT NULL)
        WHERE rn = 1`,
    )
    .bind(client)
    .all<{ routine_assignment_id: number; routine_day_id: number }>()
  const lastDayByAssignment = new Map(lastDays.map((r) => [r.routine_assignment_id, r.routine_day_id]))
  const doneTodayDays = new Set(recent.filter((r) => localOf(r.started_at) === today).map((r) => r.routine_day_id))

  const next = []
  for (const a of active.filter((x) => x.start_date <= today)) {
    const list = days.get(a.routine_version_id) ?? []
    if (list.length === 0) continue
    let pick: DayRow | undefined
    if (list.every((d) => d.day_of_week !== null)) {
      for (let offset = 0; offset < 7 && !pick; offset++) {
        const date = addDays(today, offset)
        pick = list.find((d) => d.day_of_week === dayOfWeek(date) && !(date === today && doneTodayDays.has(d.id)))
      }
      pick ??= list[0]
    } else {
      const lastDay = lastDayByAssignment.get(a.id)
      const lastIndex = lastDay === undefined ? -1 : list.findIndex((d) => d.id === lastDay)
      pick = list[(lastIndex + 1) % list.length]
    }
    next.push({ assignmentId: a.id, routineName: a.title, routineDayId: pick.id, dayName: pick.name, dayLabel: dayLabel(pick.day_of_week) })
  }

  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((date) => {
    const dow = dayOfWeek(date)
    return {
      date,
      label: dayLabel(dow),
      planned: active
        .filter((a) => a.start_date <= date && (a.end_date === null || a.end_date >= date))
        .flatMap((a) => (days.get(a.routine_version_id) ?? []).filter((d) => d.day_of_week === dow).map((d) => d.name)),
      sessions: recent.filter((r) => localOf(r.started_at) === date).map(toSummary),
    }
  })

  return c.json({ inProgress: inProgress ? toSummary(inProgress) : null, next, week, last: last ? toSummary(last) : null })
})

portalTraining.get('/sessions', async (c) => {
  const client = await clientId(c)
  if (client === null) return c.json([])
  return c.json((await summaryRows(c.env.DB, mine(client), 'ORDER BY l.started_at DESC, l.id DESC LIMIT 200')).map(toSummary))
})

portalTraining.get('/sessions/current', async (c) => {
  const client = await clientId(c)
  if (client === null) return c.body(null, 204)
  const open = await c.env.DB.prepare('SELECT id FROM training_logs WHERE client_id = ? AND status = 1').bind(client).first<{ id: number }>()
  if (!open) return c.body(null, 204)
  const detail = await sessionDetail(c.env.DB, mine(client), open.id, portalMediaUrl)
  return detail ? c.json(detail) : c.body(null, 204)
})

portalTraining.get('/sessions/:id{[0-9]+}', async (c) => {
  const client = await clientId(c)
  if (client === null) return notFound(c)
  const detail = await sessionDetail(c.env.DB, mine(client), Number(c.req.param('id')), portalMediaUrl)
  return detail ? c.json(detail) : notFound(c)
})

const isUniqueViolation = (e: unknown) => String((e as Error)?.message ?? e).includes('UNIQUE constraint failed')
const isHistoryViolation = (e: unknown) => String((e as Error)?.message ?? e).includes('history_is_permanent')

/** Inicia (o retoma, si es el mismo día) un entrenamiento. Copia lo prescrito para que el historial no cambie. */
portalTraining.post('/sessions', async (c) => {
  const body = (await readJson(c)) ?? {}
  const assignmentId = body.assignmentId
  const routineDayId = body.routineDayId
  if (assignmentId === undefined || assignmentId === null || routineDayId === undefined || routineDayId === null)
    return validation(c, { routineDayId: ['Elige la rutina y el día.'] })
  if (!Number.isInteger(assignmentId)) return validation(c, { assignmentId: ['Valor no válido.'] })
  if (!Number.isInteger(routineDayId)) return validation(c, { routineDayId: ['Valor no válido.'] })

  const client = await clientId(c)
  if (client === null) return notFound(c)
  const db = c.env.DB
  const assignment = await db
    .prepare(
      `SELECT a.id, a.routine_version_id, a.start_date, a.end_date, a.status, v.title, v.version_number
         FROM routine_assignments a JOIN routine_versions v ON v.id = a.routine_version_id WHERE a.id = ? AND a.client_id = ?`,
    )
    .bind(assignmentId, client)
    .first<{ id: number; routine_version_id: number; start_date: string; end_date: string | null; status: number; title: string; version_number: number }>()
  if (!assignment) return notFound(c)
  const status = effective(assignment.status, assignment.start_date, assignment.end_date, localDate())
  if (status === 1) return problem(c, 409, 'Conflicto', `Esta rutina empieza el ${shortDate(assignment.start_date)}.`)
  if (status !== 2) return problem(c, 409, 'Conflicto', 'Esta rutina ya no está vigente.')

  const day = await db
    .prepare('SELECT id, name FROM routine_days WHERE id = ? AND routine_version_id = ?')
    .bind(routineDayId, assignment.routine_version_id)
    .first<{ id: number; name: string }>()
  if (!day) return notFound(c)

  const open = await db
    .prepare('SELECT id, routine_assignment_id, routine_day_id, day_name FROM training_logs WHERE client_id = ? AND status = 1')
    .bind(client)
    .first<{ id: number; routine_assignment_id: number | null; routine_day_id: number | null; day_name: string | null }>()
  if (open)
    return open.routine_assignment_id === assignment.id && open.routine_day_id === day.id
      ? c.json({ id: open.id })
      : problem(c, 409, 'Conflicto', `Tienes un entrenamiento en curso («${open.day_name}»). Termínalo o retómalo antes de empezar otro.`)

  const now = nowIso()
  // El entrenamiento en curso del cliente es único, así que sirve de referencia dentro del mismo batch.
  const log = '(SELECT id FROM training_logs WHERE client_id = ?1 AND status = 1)'
  try {
    const [inserted] = await db.batch<{ id: number }>([
      db
        .prepare(
          `INSERT INTO training_logs (client_id, routine_assignment_id, routine_day_id, routine_title, routine_version_number, day_name, status,
                                      started_at, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7, ?7) RETURNING id`,
        )
        .bind(client, assignment.id, day.id, assignment.title, assignment.version_number, day.name, now),
      db
        .prepare(
          `INSERT INTO training_log_exercises (training_log_id, exercise_id, routine_exercise_id, position, exercise_name_es, exercise_name_en,
                                               superset_group, prescribed_sets, prescribed_reps_min, prescribed_reps_max, prescribed_weight_centi,
                                               prescribed_weight_unit, prescribed_rest_seconds, prescribed_tempo, prescribed_rir, prescribed_rpe,
                                               prescribed_notes, is_completed, created_at, updated_at)
           SELECT ${log}, e.exercise_id, e.id, e.position, x.name_es, x.name_en, e.superset_group, e.sets, e.reps_min, e.reps_max,
                  e.suggested_weight_centi, e.suggested_weight_unit, e.rest_seconds, e.tempo, e.rir, e.rpe, e.notes, 0, ?3, ?3
             FROM routine_exercises e JOIN exercises x ON x.id = e.exercise_id
            WHERE e.routine_day_id = ?2 ORDER BY e.position`,
        )
        .bind(client, day.id, now),
      // Series detalladas por la entrenadora: se copian tal cual.
      db
        .prepare(
          `INSERT INTO training_log_sets (training_log_exercise_id, set_number, set_type, is_prescribed, prescribed_reps_min, prescribed_reps_max,
                                          prescribed_weight_centi, prescribed_weight_unit, prescribed_rest_seconds, prescribed_rir, prescribed_rpe,
                                          prescribed_notes, is_completed, created_at, updated_at)
           SELECT le.id, s.set_number, s.set_type, 1, s.reps_min, s.reps_max, s.suggested_weight_centi, s.suggested_weight_unit, s.rest_seconds,
                  s.rir, s.rpe, s.notes, 0, ?2, ?2
             FROM training_log_exercises le JOIN routine_exercise_sets s ON s.routine_exercise_id = le.routine_exercise_id
            WHERE le.training_log_id = ${log}`,
        )
        .bind(client, now),
      // Sin detalle por serie: tantas series como indica el ejercicio, con sus mismos parámetros.
      db
        .prepare(
          `WITH RECURSIVE n(k) AS (SELECT 1 UNION ALL SELECT k + 1 FROM n WHERE k < 30)
           INSERT INTO training_log_sets (training_log_exercise_id, set_number, set_type, is_prescribed, prescribed_reps_min, prescribed_reps_max,
                                          prescribed_weight_centi, prescribed_weight_unit, prescribed_rest_seconds, prescribed_rir, prescribed_rpe,
                                          is_completed, created_at, updated_at)
           SELECT le.id, n.k, e.set_type, 1, e.reps_min, e.reps_max, e.suggested_weight_centi, e.suggested_weight_unit, e.rest_seconds,
                  e.rir, e.rpe, 0, ?2, ?2
             FROM training_log_exercises le JOIN routine_exercises e ON e.id = le.routine_exercise_id JOIN n ON n.k <= e.sets
            WHERE le.training_log_id = ${log}
              AND NOT EXISTS (SELECT 1 FROM routine_exercise_sets s WHERE s.routine_exercise_id = e.id)`,
        )
        .bind(client, now),
    ])
    return c.json({ id: inserted.results[0].id })
  } catch (e) {
    // Dos inicios simultáneos (por ejemplo, doble toque): el índice único impide el entrenamiento duplicado.
    if (isUniqueViolation(e)) return problem(c, 409, 'Conflicto', 'Ya tienes un entrenamiento en curso. Recarga la página para retomarlo.')
    throw e
  }
})

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)

interface SetInput {
  setNumber: number
  reps: number | null
  weight: number | null
  weightUnit: number | null
  rir: number | null
  rpe: number | null
  isCompleted: boolean
  notes: string | null
}
interface ExerciseInput {
  id: number
  isCompleted: boolean
  comment: string | null
  sets: SetInput[]
}

/** Lee el avance revisando el tipo de cada valor (como hace .NET al recibirlo); los errores usan la ruta del campo. */
function readProgress(body: Json, errors: Record<string, string[]>) {
  const add = (field: string, message: string) => (errors[field] ??= []).push(message)
  const int = (o: Json, k: string, p: string) => {
    const v = o[k]
    if (v === undefined || v === null) return null
    if (typeof v !== 'number' || !Number.isInteger(v)) return add(p, 'Valor no válido.'), null
    return v
  }
  const num = (o: Json, k: string, p: string) => {
    const v = o[k]
    if (v === undefined || v === null) return null
    if (typeof v !== 'number' || !Number.isFinite(v)) return add(p, 'Valor no válido.'), null
    return v
  }
  const str = (o: Json, k: string, p: string) => {
    const v = o[k]
    if (v === undefined || v === null) return null
    if (typeof v !== 'string') return add(p, 'Debe ser texto.'), null
    return v
  }
  const bool = (o: Json, k: string, p: string) => {
    const v = o[k]
    if (v === undefined || v === null) return false
    if (typeof v !== 'boolean') return add(p, 'Valor no válido.'), false
    return v
  }
  const list = (o: Json, k: string, p: string) => {
    const v = o[k]
    if (v === undefined || v === null) return []
    if (!Array.isArray(v) || !v.every(isObject)) return add(p, 'Valor no válido.'), []
    return v
  }
  const comment = str(body, 'comment', 'comment')
  const rawExercises = list(body, 'exercises', 'exercises')
  // Un entrenamiento tiene a lo más 40 ejercicios; una lista mucho mayor no se recorre.
  if (rawExercises.length > 100) return add('exercises', 'Demasiados ejercicios.'), { comment, exercises: [] as ExerciseInput[] }
  const exercises: ExerciseInput[] = rawExercises.map((x, i) => {
    const p = `exercises[${i}]`
    const rawSets = list(x, 'sets', `${p}.sets`)
    return {
      id: int(x, 'id', `${p}.id`) ?? 0,
      isCompleted: bool(x, 'isCompleted', `${p}.isCompleted`),
      comment: str(x, 'comment', `${p}.comment`),
      sets: rawSets.length > 200 ? (add(`${p}.sets`, 'Demasiadas series.'), []) : rawSets.map((s, k) => {
        const sp = `${p}.sets[${k}]`
        return {
          setNumber: int(s, 'setNumber', `${sp}.setNumber`) ?? 0,
          reps: int(s, 'reps', `${sp}.reps`),
          weight: num(s, 'weight', `${sp}.weight`),
          weightUnit: int(s, 'weightUnit', `${sp}.weightUnit`),
          rir: num(s, 'rir', `${sp}.rir`),
          rpe: num(s, 'rpe', `${sp}.rpe`),
          isCompleted: bool(s, 'isCompleted', `${sp}.isCompleted`),
          notes: str(s, 'notes', `${sp}.notes`),
        }
      }),
    }
  })
  return { comment, exercises }
}

/**
 * Guarda el avance completo de un entrenamiento en curso. Se puede llamar las veces que sea (guardado automático):
 * actualiza lo realizado sin tocar lo prescrito y sin duplicar series.
 */
portalTraining.put('/sessions/:id{[0-9]+}', async (c) => {
  const client = await clientId(c)
  if (client === null) return notFound(c)
  const db = c.env.DB
  const id = Number(c.req.param('id'))
  const log = await db.prepare('SELECT id, status FROM training_logs WHERE id = ? AND client_id = ?').bind(id, client).first<{ id: number; status: number }>()
  if (!log) return notFound(c)
  const finished = () => problem(c, 409, 'Conflicto', 'Este entrenamiento ya se finalizó; queda en tu historial.')
  if (log.status !== 1) return finished()

  const body = await readJson(c)
  if (!body) return validation(c, { body: ['Datos no válidos.'] })
  const errors: Record<string, string[]> = {}
  const input = readProgress(body, errors)
  if (Object.keys(errors).length) return validation(c, errors)

  // Reglas (las mismas de .NET), con los ejercicios y series que ya tiene el entrenamiento.
  const { results: existing } = await db
    .prepare(
      `SELECT e.id, s.set_number, s.is_prescribed FROM training_log_exercises e LEFT JOIN training_log_sets s ON s.training_log_exercise_id = e.id
        WHERE e.training_log_id = ?`,
    )
    .bind(id)
    .all<{ id: number; set_number: number | null; is_prescribed: number | null }>()
  const prescribedOf = new Map<number, Set<number>>()
  for (const r of existing) {
    if (!prescribedOf.has(r.id)) prescribedOf.set(r.id, new Set())
    if (r.is_prescribed === 1 && r.set_number !== null) prescribedOf.get(r.id)!.add(r.set_number)
  }
  const add = (field: string, message: string) => (errors[field] ??= []).push(message)
  if (input.comment !== null && input.comment.length > LIMITS.maxSessionComment) add('comment', `Máximo ${LIMITS.maxSessionComment} caracteres.`)
  if (new Set(input.exercises.map((e) => e.id)).size !== input.exercises.length) add('exercises', 'Ejercicio repetido.')
  input.exercises.forEach((ex, i) => {
    const p = `exercises[${i}]`
    const prescribed = prescribedOf.get(ex.id)
    if (!prescribed) return add(p, 'El ejercicio no pertenece a este entrenamiento.')
    if (ex.comment !== null && ex.comment.length > LIMITS.maxExerciseComment) add(`${p}.comment`, `Máximo ${LIMITS.maxExerciseComment} caracteres.`)
    const numbers = ex.sets.map((s) => s.setNumber)
    if (new Set(numbers).size !== numbers.length) add(`${p}.sets`, 'Serie repetida.')
    if (![...prescribed].every((n) => numbers.includes(n))) add(`${p}.sets`, 'Las series indicadas por tu entrenadora no se pueden quitar.')
    if (numbers.length - prescribed.size > LIMITS.maxExtraSets) add(`${p}.sets`, `Máximo ${LIMITS.maxExtraSets} series extra.`)
    ex.sets.forEach((s, k) => {
      const sp = `${p}.sets[${k}]`
      if (s.setNumber < 1 || s.setNumber > 100) add(`${sp}.setNumber`, 'Número de serie no válido.')
      if (s.reps !== null && (s.reps < 0 || s.reps > LIMITS.maxReps)) add(`${sp}.reps`, `De 0 a ${LIMITS.maxReps}.`)
      if (s.weight !== null) {
        if (s.weight < 0 || s.weight > LIMITS.maxWeight) add(`${sp}.weight`, `De 0 a ${LIMITS.maxWeight}.`)
        if (s.weightUnit !== 1 && s.weightUnit !== 2) add(`${sp}.weightUnit`, 'Elige kg o lb.')
      }
      if (s.rir !== null && (s.rir < 0 || s.rir > 10 || !isHalf(s.rir))) add(`${sp}.rir`, 'De 0 a 10, en pasos de 0.5.')
      if (s.rpe !== null && (s.rpe < 1 || s.rpe > 10 || !isHalf(s.rpe))) add(`${sp}.rpe`, 'De 1 a 10, en pasos de 0.5.')
      if (s.notes !== null && s.notes.length > LIMITS.maxSetNotes) add(`${sp}.notes`, `Máximo ${LIMITS.maxSetNotes} caracteres.`)
    })
  })
  if (Object.keys(errors).length) return validation(c, errors)

  const now = nowIso()
  const exercisesJson = JSON.stringify(input.exercises.map((e) => ({ id: e.id, c: e.isCompleted ? 1 : 0, m: opt(e.comment) })))
  const setsJson = JSON.stringify(
    input.exercises.flatMap((e) =>
      e.sets.map((s) => ({
        e: e.id,
        n: s.setNumber,
        r: s.reps,
        w: centi(s.weight),
        u: s.weight === null ? null : s.weightUnit,
        ir: s.rir,
        pe: s.rpe,
        c: s.isCompleted ? 1 : 0,
        t: opt(s.notes),
      })),
    ),
  )
  // Todo en un batch (una transacción). Si el entrenamiento se finalizó mientras tanto, los disparadores lo impiden.
  try {
    await db.batch([
      db.prepare('UPDATE training_logs SET comment = ?, updated_at = ? WHERE id = ? AND status = 1').bind(opt(input.comment), now, id),
      db
        .prepare(
          `UPDATE training_log_exercises SET is_completed = j.value ->> 'c', comment = j.value ->> 'm', updated_at = ?2
             FROM json_each(?1) j WHERE training_log_exercises.id = j.value ->> 'id' AND training_log_exercises.training_log_id = ?3`,
        )
        .bind(exercisesJson, now, id),
      // Una serie extra que el cliente quitó se elimina; las prescritas se conservan siempre.
      db
        .prepare(
          `DELETE FROM training_log_sets WHERE is_prescribed = 0
              AND training_log_exercise_id IN (SELECT value ->> 'id' FROM json_each(?1))
              AND NOT EXISTS (SELECT 1 FROM json_each(?2) j WHERE j.value ->> 'e' = training_log_sets.training_log_exercise_id
                                                              AND j.value ->> 'n' = training_log_sets.set_number)`,
        )
        .bind(exercisesJson, setsJson),
      db
        .prepare(
          `INSERT INTO training_log_sets (training_log_exercise_id, set_number, set_type, is_prescribed, reps, weight_centi, weight_unit, rir, rpe,
                                          is_completed, notes, created_at, updated_at)
           SELECT j.value ->> 'e', j.value ->> 'n', 1, 0, j.value ->> 'r', j.value ->> 'w', j.value ->> 'u', j.value ->> 'ir', j.value ->> 'pe',
                  j.value ->> 'c', j.value ->> 't', ?2, ?2
             FROM json_each(?1) j WHERE true
           ON CONFLICT (training_log_exercise_id, set_number) DO UPDATE SET
             reps = excluded.reps, weight_centi = excluded.weight_centi, weight_unit = excluded.weight_unit, rir = excluded.rir,
             rpe = excluded.rpe, is_completed = excluded.is_completed, notes = excluded.notes, updated_at = excluded.updated_at`,
        )
        .bind(setsJson, now),
    ])
  } catch (e) {
    if (isHistoryViolation(e)) return finished()
    throw e
  }
  return c.body(null, 204)
})

/** Finaliza el entrenamiento, aunque haya ejercicios sin completar. Después ya no se edita. */
portalTraining.post('/sessions/:id{[0-9]+}/finish', async (c) => {
  const client = await clientId(c)
  if (client === null) return notFound(c)
  const id = Number(c.req.param('id'))
  const log = await c.env.DB.prepare('SELECT id, status FROM training_logs WHERE id = ? AND client_id = ?').bind(id, client).first<{ id: number; status: number }>()
  if (!log) return notFound(c)
  const done = () => problem(c, 409, 'Conflicto', 'Este entrenamiento ya se finalizó.')
  if (log.status !== 1) return done()
  const now = nowIso()
  const { meta } = await c.env.DB.prepare('UPDATE training_logs SET status = 2, completed_at = ?, updated_at = ? WHERE id = ? AND status = 1').bind(now, now, id).run()
  return meta.changes === 0 ? done() : c.body(null, 204)
})


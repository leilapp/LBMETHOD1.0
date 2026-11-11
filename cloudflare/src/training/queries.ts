import { SET_TYPES } from '../routines/model'

/**
 * Consultas de entrenamientos registrados, compartidas por el portal del cliente y (en la etapa 6) por el seguimiento de
 * la entrenadora. Quien llama decide qué entrenamientos son visibles con un filtro sobre «l» (training_logs).
 */

export const unit = (u: number | null) => (u === 1 ? 'kg' : u === 2 ? 'lb' : null)
export const weight = (centi: number | null) => (centi === null ? null : centi / 100)
export const LOG_STATUS = (s: number) => (s === 1 ? 'InProgress' : 'Completed')

export interface Visible {
  where: string
  params: unknown[]
}

export interface SummaryRow {
  id: number
  routine_assignment_id: number | null
  routine_day_id: number | null
  routine_title: string | null
  routine_version_number: number | null
  day_name: string | null
  status: number
  started_at: string
  completed_at: string | null
  exercises_completed: number
  exercises_total: number
  sets_completed: number
}

const SUMMARY_COLUMNS = `l.id, l.routine_assignment_id, l.routine_day_id, l.routine_title, l.routine_version_number, l.day_name, l.status,
  l.started_at, l.completed_at,
  (SELECT COUNT(*) FROM training_log_exercises e WHERE e.training_log_id = l.id AND e.is_completed = 1) AS exercises_completed,
  (SELECT COUNT(*) FROM training_log_exercises e WHERE e.training_log_id = l.id) AS exercises_total,
  (SELECT COUNT(*) FROM training_log_sets s JOIN training_log_exercises e ON e.id = s.training_log_exercise_id
    WHERE e.training_log_id = l.id AND s.is_completed = 1) AS sets_completed`

/** Filas de resumen; «extra» agrega condiciones, orden y límite (por ejemplo «ORDER BY l.started_at DESC LIMIT 200»). */
export async function summaryRows(db: D1Database, visible: Visible, extra = '', extraParams: unknown[] = []) {
  const { results } = await db
    .prepare(`SELECT ${SUMMARY_COLUMNS} FROM training_logs l WHERE (${visible.where}) ${extra}`)
    .bind(...visible.params, ...extraParams)
    .all<SummaryRow>()
  return results
}

export const toSummary = (r: SummaryRow) => ({
  id: r.id,
  routineTitle: r.routine_title,
  versionNumber: r.routine_version_number,
  dayName: r.day_name,
  status: LOG_STATUS(r.status),
  startedAt: r.started_at,
  completedAt: r.completed_at,
  exercisesCompleted: r.exercises_completed,
  exercisesTotal: r.exercises_total,
  setsCompleted: r.sets_completed,
})
export type SessionSummary = ReturnType<typeof toSummary>

export interface MediaItem {
  id: number
  type: 'Video' | 'Image'
  title: string | null
  url: string
  isExternal: boolean
}

/** Imágenes y videos de los ejercicios indicados (sin los archivos ya borrados), en su orden. */
export async function mediaFor(db: D1Database, exerciseIds: number[], mediaUrl: (id: number) => string) {
  const byExercise = new Map<number, MediaItem[]>()
  if (exerciseIds.length === 0) return byExercise
  const { results } = await db
    .prepare(
      `SELECT m.id, m.exercise_id, m.media_type, m.title, m.external_url FROM exercise_media m LEFT JOIN stored_files f ON f.id = m.stored_file_id
        WHERE m.exercise_id IN (SELECT value FROM json_each(?)) AND (m.stored_file_id IS NULL OR f.deleted_at IS NULL)
        ORDER BY m.sort_order, m.id`,
    )
    .bind(JSON.stringify(exerciseIds))
    .all<{ id: number; exercise_id: number; media_type: number; title: string | null; external_url: string | null }>()
  for (const m of results) {
    const item: MediaItem = {
      id: m.id,
      type: m.media_type === 2 ? 'Video' : 'Image',
      title: m.title,
      url: m.external_url ?? mediaUrl(m.id),
      isExternal: m.external_url !== null,
    }
    byExercise.set(m.exercise_id, [...(byExercise.get(m.exercise_id) ?? []), item])
  }
  return byExercise
}

interface DetailLogRow {
  id: number
  client_id: number
  routine_assignment_id: number | null
  routine_title: string | null
  routine_version_number: number | null
  day_name: string | null
  status: number
  started_at: string
  completed_at: string | null
  comment: string | null
}

interface DetailExerciseRow {
  id: number
  position: number
  exercise_id: number
  exercise_name_es: string
  exercise_name_en: string | null
  superset_group: string | null
  prescribed_sets: number | null
  prescribed_reps_min: number | null
  prescribed_reps_max: number | null
  prescribed_weight_centi: number | null
  prescribed_weight_unit: number | null
  prescribed_rest_seconds: number | null
  prescribed_tempo: string | null
  prescribed_rir: number | null
  prescribed_rpe: number | null
  prescribed_notes: string | null
  is_completed: number
  comment: string | null
}

interface DetailSetRow {
  training_log_exercise_id: number
  set_number: number
  set_type: number
  is_prescribed: number
  prescribed_reps_min: number | null
  prescribed_reps_max: number | null
  prescribed_weight_centi: number | null
  prescribed_weight_unit: number | null
  prescribed_rest_seconds: number | null
  prescribed_rir: number | null
  prescribed_rpe: number | null
  prescribed_notes: string | null
  reps: number | null
  weight_centi: number | null
  weight_unit: number | null
  rir: number | null
  rpe: number | null
  is_completed: number
  notes: string | null
}

/** Entrenamiento completo con lo prescrito y lo realizado serie por serie, solo si es visible para quien llama. */
export async function sessionDetail(db: D1Database, visible: Visible, id: number, mediaUrl: (id: number) => string) {
  const log = await db
    .prepare(
      `SELECT l.id, l.client_id, l.routine_assignment_id, l.routine_title, l.routine_version_number, l.day_name, l.status, l.started_at, l.completed_at, l.comment
         FROM training_logs l WHERE l.id = ? AND (${visible.where})`,
    )
    .bind(id, ...visible.params)
    .first<DetailLogRow>()
  if (!log) return null
  const [exercises, sets] = await db.batch([
    db.prepare('SELECT * FROM training_log_exercises WHERE training_log_id = ? ORDER BY position').bind(id),
    db
      .prepare(
        `SELECT s.* FROM training_log_sets s JOIN training_log_exercises e ON e.id = s.training_log_exercise_id
          WHERE e.training_log_id = ? ORDER BY s.set_number`,
      )
      .bind(id),
  ])
  const exerciseRows = exercises.results as DetailExerciseRow[]
  const setsOf = new Map<number, DetailSetRow[]>()
  for (const s of sets.results as DetailSetRow[]) setsOf.set(s.training_log_exercise_id, [...(setsOf.get(s.training_log_exercise_id) ?? []), s])
  const media = await mediaFor(db, [...new Set(exerciseRows.map((e) => e.exercise_id))], mediaUrl)
  const history = await exerciseHistory(db, log.client_id, log.id, log.started_at)
  return {
    id: log.id,
    assignmentId: log.routine_assignment_id,
    routineTitle: log.routine_title,
    versionNumber: log.routine_version_number,
    dayName: log.day_name,
    status: LOG_STATUS(log.status),
    startedAt: log.started_at,
    completedAt: log.completed_at,
    comment: log.comment,
    exercises: exerciseRows.map((e) => ({
      id: e.id,
      position: e.position,
      exerciseId: e.exercise_id,
      nameEs: e.exercise_name_es,
      nameEn: e.exercise_name_en,
      supersetGroup: e.superset_group,
      prescribedSets: e.prescribed_sets,
      prescribedRepsMin: e.prescribed_reps_min,
      prescribedRepsMax: e.prescribed_reps_max,
      prescribedWeight: weight(e.prescribed_weight_centi),
      prescribedWeightUnit: unit(e.prescribed_weight_unit),
      prescribedRestSeconds: e.prescribed_rest_seconds,
      prescribedTempo: e.prescribed_tempo,
      prescribedRir: e.prescribed_rir,
      prescribedRpe: e.prescribed_rpe,
      prescribedNotes: e.prescribed_notes,
      isCompleted: e.is_completed === 1,
      comment: e.comment,
      sets: (setsOf.get(e.id) ?? []).map((s) => ({
        setNumber: s.set_number,
        setTypeLabel: SET_TYPES[s.set_type] ?? 'Otra',
        isPrescribed: s.is_prescribed === 1,
        prescribedRepsMin: s.prescribed_reps_min,
        prescribedRepsMax: s.prescribed_reps_max,
        prescribedWeight: weight(s.prescribed_weight_centi),
        prescribedWeightUnit: unit(s.prescribed_weight_unit),
        prescribedRestSeconds: s.prescribed_rest_seconds,
        prescribedRir: s.prescribed_rir,
        prescribedRpe: s.prescribed_rpe,
        prescribedNotes: s.prescribed_notes,
        reps: s.reps,
        weight: weight(s.weight_centi),
        weightUnit: s.weight_unit,
        rir: s.rir,
        rpe: s.rpe,
        isCompleted: s.is_completed === 1,
        notes: s.notes,
      })),
      media: media.get(e.exercise_id) ?? [],
      previous: history.previous.get(e.exercise_id) ?? null,
      best: history.best.get(e.exercise_id) ?? null,
    })),
  }
}

/** Kilos de un peso guardado en centésimas (1 lb = 0.45359237 kg), para comparar pesos registrados en distintas unidades. */
export const kgOf = (centiValue: number, unitValue: number | null) => (unitValue === 2 ? (centiValue / 100) * 0.45359237 : centiValue / 100)

export interface PreviousExercise {
  date: string
  sets: { setNumber: number; reps: number | null; weight: number | null; weightUnit: string | null }[]
}
export interface BestLift {
  weight: number
  weightUnit: string
  weightKg: number
  reps: number | null
  date: string
}

/**
 * Lo que el cliente hizo antes de este entrenamiento, por ejercicio: la última vez (series con algún valor) y su mejor
 * peso. Solo cuenta entrenamientos finalizados y anteriores; es una referencia, nunca llena nada por el cliente.
 */
export async function exerciseHistory(db: D1Database, client: number, logId: number, startedAt: string) {
  const [prev, best] = await db.batch([
    db
      .prepare(
        `WITH candidates AS (
           SELECT e.id AS lex_id, e.exercise_id, l.started_at,
                  ROW_NUMBER() OVER (PARTITION BY e.exercise_id ORDER BY l.started_at DESC, l.id DESC, e.position) AS rn
             FROM training_log_exercises e JOIN training_logs l ON l.id = e.training_log_id
            WHERE l.client_id = ?1 AND l.status = 2 AND l.id <> ?2 AND l.started_at < ?3
              AND e.exercise_id IN (SELECT exercise_id FROM training_log_exercises WHERE training_log_id = ?2)
              AND EXISTS (SELECT 1 FROM training_log_sets s WHERE s.training_log_exercise_id = e.id AND (s.reps IS NOT NULL OR s.weight_centi IS NOT NULL)))
         SELECT c.exercise_id, c.started_at, s.set_number, s.reps, s.weight_centi, s.weight_unit
           FROM candidates c JOIN training_log_sets s ON s.training_log_exercise_id = c.lex_id
          WHERE c.rn = 1 AND (s.reps IS NOT NULL OR s.weight_centi IS NOT NULL)
          ORDER BY c.exercise_id, s.set_number`,
      )
      .bind(client, logId, startedAt),
    db
      .prepare(
        `SELECT exercise_id, started_at, reps, weight_centi, weight_unit FROM (
           SELECT e.exercise_id, l.started_at, s.reps, s.weight_centi, s.weight_unit,
                  ROW_NUMBER() OVER (PARTITION BY e.exercise_id
                    ORDER BY CASE WHEN s.weight_unit = 2 THEN s.weight_centi * 0.45359237 ELSE s.weight_centi END DESC, s.reps DESC, l.started_at) AS rn
             FROM training_log_sets s JOIN training_log_exercises e ON e.id = s.training_log_exercise_id JOIN training_logs l ON l.id = e.training_log_id
            WHERE l.client_id = ?1 AND l.status = 2 AND l.id <> ?2 AND l.started_at < ?3
              AND e.exercise_id IN (SELECT exercise_id FROM training_log_exercises WHERE training_log_id = ?2)
              AND s.weight_centi > 0 AND (s.reps IS NULL OR s.reps > 0))
          WHERE rn = 1`,
      )
      .bind(client, logId, startedAt),
  ])
  type PrevRow = { exercise_id: number; started_at: string; set_number: number; reps: number | null; weight_centi: number | null; weight_unit: number | null }
  type BestRow = { exercise_id: number; started_at: string; reps: number | null; weight_centi: number; weight_unit: number | null }
  const previous = new Map<number, PreviousExercise>()
  for (const r of prev.results as PrevRow[]) {
    const item = previous.get(r.exercise_id) ?? { date: r.started_at, sets: [] }
    item.sets.push({ setNumber: r.set_number, reps: r.reps, weight: weight(r.weight_centi), weightUnit: unit(r.weight_unit) })
    previous.set(r.exercise_id, item)
  }
  const bestMap = new Map<number, BestLift>()
  for (const r of best.results as BestRow[]) {
    bestMap.set(r.exercise_id, {
      weight: r.weight_centi / 100,
      weightUnit: unit(r.weight_unit) ?? 'kg',
      weightKg: Math.round(kgOf(r.weight_centi, r.weight_unit) * 100) / 100,
      reps: r.reps,
      date: r.started_at,
    })
  }
  return { previous, best: bestMap }
}

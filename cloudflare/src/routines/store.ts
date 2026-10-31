import { normalize } from '../text'
import type { Catalog, DayInput, Header, SetInput } from './model'
import { cleanedHeader, rows } from './model'

/**
 * Sentencias de D1 para el contenido de una versión. Cada grupo (días, ejercicios, series) se inserta con una sola
 * sentencia que recorre un JSON con json_each: así no se topa con el límite de 100 parámetros por consulta y todo
 * cabe en un batch, que en D1 es una transacción (o se guarda todo o nada).
 *
 * «versionRef» es la expresión SQL que identifica la versión destino:
 *   - un borrador existente: el parámetro ?3 con su id;
 *   - una versión recién insertada en el mismo batch: NEW_VERSION.
 * Los días y ejercicios se encuentran por su posición, que es única dentro de la versión y del día.
 */
export type VersionRef = { sql: string; id?: number }

/**
 * La versión que se acaba de insertar en este mismo batch. Un batch de D1 es una sola transacción y SQLite no deja
 * que otra escritura se intercale, así que el id mayor es el de esa versión.
 */
export const NEW_VERSION: VersionRef = { sql: '(SELECT MAX(id) FROM routine_versions)' }
export const draftOf = (routineId: number): VersionRef => ({ sql: `(SELECT id FROM routine_versions WHERE routine_id = ?3 AND status = 1)`, id: routineId })
export const versionId = (id: number): VersionRef => ({ sql: '?3', id })

const refParams = (ref: VersionRef) => (ref.id === undefined ? [] : [ref.id])

/** Inserta el contenido escrito en el constructor. */
export function contentStatements(db: D1Database, ref: VersionRef, days: DayInput[], now: string): D1PreparedStatement[] {
  const { dayRows, exerciseRows, setRows } = rows(days)
  const out: D1PreparedStatement[] = []
  if (dayRows.length)
    out.push(
      db
        .prepare(
          `INSERT INTO routine_days (routine_version_id, position, name, day_of_week, notes, created_at, updated_at)
           SELECT ${ref.sql}, j.value->>'p', j.value->>'name', j.value->>'dow', j.value->>'notes', ?1, ?1 FROM json_each(?2) j`,
        )
        .bind(now, JSON.stringify(dayRows), ...refParams(ref)),
    )
  if (exerciseRows.length)
    out.push(
      db
        .prepare(
          `INSERT INTO routine_exercises (routine_day_id, exercise_id, position, superset_group, sets, reps_min, reps_max, suggested_weight_centi,
                                          suggested_weight_unit, rest_seconds, tempo, rir, rpe, set_type, notes, created_at, updated_at)
           SELECT d.id, j.value->>'ex', j.value->>'p', j.value->>'sg', j.value->>'sets', j.value->>'rmin', j.value->>'rmax', j.value->>'w',
                  j.value->>'wu', j.value->>'rest', j.value->>'tempo', j.value->>'rir', j.value->>'rpe', j.value->>'st', j.value->>'notes', ?1, ?1
             FROM json_each(?2) j JOIN routine_days d ON d.routine_version_id = ${ref.sql} AND d.position = j.value->>'d'`,
        )
        .bind(now, JSON.stringify(exerciseRows), ...refParams(ref)),
    )
  if (setRows.length)
    out.push(
      db
        .prepare(
          `INSERT INTO routine_exercise_sets (routine_exercise_id, set_number, set_type, reps_min, reps_max, suggested_weight_centi,
                                              suggested_weight_unit, rest_seconds, rir, rpe, notes, created_at, updated_at)
           SELECT e.id, j.value->>'n', j.value->>'st', j.value->>'rmin', j.value->>'rmax', j.value->>'w', j.value->>'wu', j.value->>'rest',
                  j.value->>'rir', j.value->>'rpe', j.value->>'notes', ?1, ?1
             FROM json_each(?2) j
             JOIN routine_days d ON d.routine_version_id = ${ref.sql} AND d.position = j.value->>'d'
             JOIN routine_exercises e ON e.routine_day_id = d.id AND e.position = j.value->>'e'`,
        )
        .bind(now, JSON.stringify(setRows), ...refParams(ref)),
    )
  return out
}

/** Copia días, ejercicios y series de otra versión (dentro de la base, sin pasar por el Worker). */
export function copyStatements(db: D1Database, ref: VersionRef, sourceVersionId: number, now: string): D1PreparedStatement[] {
  const p = [now, sourceVersionId, ...refParams(ref)]
  return [
    db
      .prepare(
        `INSERT INTO routine_days (routine_version_id, position, name, day_of_week, notes, created_at, updated_at)
         SELECT ${ref.sql}, position, name, day_of_week, notes, ?1, ?1 FROM routine_days WHERE routine_version_id = ?2`,
      )
      .bind(...p),
    db
      .prepare(
        `INSERT INTO routine_exercises (routine_day_id, exercise_id, position, superset_group, sets, reps_min, reps_max, suggested_weight_centi,
                                        suggested_weight_unit, rest_seconds, tempo, rir, rpe, set_type, notes, created_at, updated_at)
         SELECT nd.id, e.exercise_id, e.position, e.superset_group, e.sets, e.reps_min, e.reps_max, e.suggested_weight_centi,
                e.suggested_weight_unit, e.rest_seconds, e.tempo, e.rir, e.rpe, e.set_type, e.notes, ?1, ?1
           FROM routine_exercises e
           JOIN routine_days sd ON sd.id = e.routine_day_id
           JOIN routine_days nd ON nd.routine_version_id = ${ref.sql} AND nd.position = sd.position
          WHERE sd.routine_version_id = ?2`,
      )
      .bind(...p),
    db
      .prepare(
        `INSERT INTO routine_exercise_sets (routine_exercise_id, set_number, set_type, reps_min, reps_max, suggested_weight_centi,
                                            suggested_weight_unit, rest_seconds, rir, rpe, notes, created_at, updated_at)
         SELECT ne.id, s.set_number, s.set_type, s.reps_min, s.reps_max, s.suggested_weight_centi, s.suggested_weight_unit,
                s.rest_seconds, s.rir, s.rpe, s.notes, ?1, ?1
           FROM routine_exercise_sets s
           JOIN routine_exercises e ON e.id = s.routine_exercise_id
           JOIN routine_days sd ON sd.id = e.routine_day_id
           JOIN routine_days nd ON nd.routine_version_id = ${ref.sql} AND nd.position = sd.position
           JOIN routine_exercises ne ON ne.routine_day_id = nd.id AND ne.position = e.position
          WHERE sd.routine_version_id = ?2`,
      )
      .bind(...p),
  ]
}

/** Crea la rutina con su primer borrador (v1), vacío o copiado de otra versión, y su registro en la bitácora. */
export function createStatements(db: D1Database, trainerId: number, kind: number, header: Header, sourceVersionId: number | null, now: string) {
  const h = cleanedHeader(header)
  return [
    db
      .prepare('INSERT INTO routines (trainer_id, kind, name, name_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
      .bind(trainerId, kind, h.title, normalize(h.title), now, now),
    db
      .prepare(
        `INSERT INTO routine_versions (routine_id, version_number, title, description, goal, duration_weeks, source_version_id, created_at, updated_at)
         VALUES (last_insert_rowid(), 1, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(h.title, h.description, h.goal, h.durationWeeks, sourceVersionId, now, now),
    ...(sourceVersionId === null ? [] : copyStatements(db, NEW_VERSION, sourceVersionId, now)),
    db
      .prepare(
        `INSERT INTO audit_logs (occurred_at, user_id, action, entity_type, entity_id, details)
         SELECT ?, ?, ?, 'Routine', CAST(routine_id AS TEXT), ? FROM routine_versions WHERE id = ${NEW_VERSION.sql}`,
      )
      .bind(now, trainerId, sourceVersionId === null ? 'RoutineCreated' : 'RoutineCreatedFromVersion', sourceVersionId === null ? null : String(sourceVersionId)),
  ]
}

/** Ejercicios de la biblioteca usados en la rutina (existencia, nombre y si están activos). */
export async function loadCatalog(db: D1Database, ids: number[]): Promise<Catalog> {
  const catalog: Catalog = new Map()
  if (!ids.length) return catalog
  const { results } = await db
    .prepare('SELECT id, name_es, is_active FROM exercises WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(ids))
    .all<{ id: number; name_es: string; is_active: number }>()
  for (const r of results) catalog.set(r.id, { nameEs: r.name_es, isActive: r.is_active === 1 })
  return catalog
}

export interface VersionRow {
  id: number
  routine_id: number
  kind: number
  version_number: number
  status: number
  title: string
  description: string | null
  goal: string | null
  duration_weeks: number | null
  change_notes: string | null
  published_at: string | null
  source_version_id: number | null
  updated_at: string
}

interface DayRow {
  id: number
  position: number
  name: string
  day_of_week: number | null
  notes: string | null
}

interface PrescriptionRow {
  set_type: number
  reps_min: number | null
  reps_max: number | null
  suggested_weight_centi: number | null
  suggested_weight_unit: number | null
  rest_seconds: number | null
  rir: number | null
  rpe: number | null
  notes: string | null
}

export interface ExerciseRow extends PrescriptionRow {
  id: number
  routine_day_id: number
  position: number
  exercise_id: number
  name_es: string
  name_en: string | null
  is_active: number
  primary_muscle: string | null
  superset_group: string | null
  sets: number
  tempo: string | null
}

interface SetRow extends PrescriptionRow {
  routine_exercise_id: number
  set_number: number
}

/** Versión completa, solo si pertenece a la entrenadora indicada. */
export async function loadVersion(db: D1Database, trainerId: number, id: number) {
  const version = await db
    .prepare(
      `SELECT v.id, v.routine_id, r.kind, v.version_number, v.status, v.title, v.description, v.goal, v.duration_weeks, v.change_notes,
              v.published_at, v.source_version_id, v.updated_at
         FROM routine_versions v JOIN routines r ON r.id = v.routine_id
        WHERE v.id = ? AND r.trainer_id = ?`,
    )
    .bind(id, trainerId)
    .first<VersionRow>()
  if (!version) return null
  const [days, exercises, sets] = await db.batch([
    db.prepare('SELECT id, position, name, day_of_week, notes FROM routine_days WHERE routine_version_id = ? ORDER BY position').bind(id),
    db
      .prepare(
        `SELECT e.*, x.name_es, x.name_en, x.is_active,
                (SELECT mg.name_es FROM exercise_muscles em JOIN muscle_groups mg ON mg.id = em.muscle_group_id
                  WHERE em.exercise_id = x.id AND em.role = 1) AS primary_muscle
           FROM routine_exercises e JOIN routine_days d ON d.id = e.routine_day_id JOIN exercises x ON x.id = e.exercise_id
          WHERE d.routine_version_id = ? ORDER BY d.position, e.position`,
      )
      .bind(id),
    db
      .prepare(
        `SELECT s.* FROM routine_exercise_sets s JOIN routine_exercises e ON e.id = s.routine_exercise_id JOIN routine_days d ON d.id = e.routine_day_id
          WHERE d.routine_version_id = ? ORDER BY s.set_number`,
      )
      .bind(id),
  ])
  const setsOf = new Map<number, SetRow[]>()
  for (const s of sets.results as SetRow[]) setsOf.set(s.routine_exercise_id, [...(setsOf.get(s.routine_exercise_id) ?? []), s])
  const exercisesOf = new Map<number, (ExerciseRow & { details: SetRow[] })[]>()
  for (const e of exercises.results as ExerciseRow[])
    exercisesOf.set(e.routine_day_id, [...(exercisesOf.get(e.routine_day_id) ?? []), { ...e, details: setsOf.get(e.id) ?? [] }])
  return { version, days: (days.results as DayRow[]).map((d) => ({ ...d, exercises: exercisesOf.get(d.id) ?? [] })) }
}

export type LoadedVersion = NonNullable<Awaited<ReturnType<typeof loadVersion>>>

const weight = (centi: number | null) => (centi === null ? null : centi / 100)

function toSetInput(r: PrescriptionRow): SetInput {
  return {
    setType: r.set_type, repsMin: r.reps_min, repsMax: r.reps_max, suggestedWeight: weight(r.suggested_weight_centi),
    suggestedWeightUnit: r.suggested_weight_unit, restSeconds: r.rest_seconds, rir: r.rir, rpe: r.rpe, notes: r.notes,
  }
}

/** Contenido guardado convertido a los datos del constructor (para revisar las reglas al publicar). */
export function toInput(loaded: LoadedVersion): DayInput[] {
  return loaded.days.map((d) => ({
    name: d.name,
    dayOfWeek: d.day_of_week,
    notes: d.notes,
    exercises: d.exercises.map((e) => ({
      ...toSetInput(e), exerciseId: e.exercise_id, supersetGroup: e.superset_group, sets: e.sets, tempo: e.tempo, setDetails: e.details.map(toSetInput),
    })),
  }))
}

export const prescription = (r: PrescriptionRow) => ({
  repsMin: r.reps_min,
  repsMax: r.reps_max,
  suggestedWeight: weight(r.suggested_weight_centi),
  suggestedWeightUnit: r.suggested_weight_unit,
  restSeconds: r.rest_seconds,
})

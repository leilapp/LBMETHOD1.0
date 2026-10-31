import { addDays, dayOfWeek, localDate } from '../dates'
import { fromCenti, KINDS, PHOTO_CATEGORIES, round2 } from './labels'

/**
 * Lecturas de seguimiento de un cliente, compartidas por la entrenadora y el portal. Quien llama ya comprobó el acceso.
 */

export async function photosOf(db: D1Database, clientId: number, photoUrl: (id: number) => string) {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.taken_on, p.category, p.evaluation_id, p.notes FROM progress_photos p JOIN stored_files f ON f.id = p.stored_file_id
        WHERE p.client_id = ? AND f.deleted_at IS NULL ORDER BY p.taken_on DESC, p.id DESC`,
    )
    .bind(clientId)
    .all<{ id: number; taken_on: string; category: number | null; evaluation_id: number | null; notes: string | null }>()
  return results.map((p) => ({
    id: p.id,
    takenOn: p.taken_on,
    category: p.category,
    categoryLabel: p.category === null ? null : (PHOTO_CATEGORIES[p.category] ?? null),
    evaluationId: p.evaluation_id,
    notes: p.notes,
    url: photoUrl(p.id),
  }))
}

export async function evaluationsOf(db: D1Database, clientId: number, photoUrl: (id: number) => string) {
  const [evaluations, measurements] = await db.batch([
    db.prepare('SELECT id, evaluated_on, notes, created_at FROM evaluations WHERE client_id = ? ORDER BY evaluated_on DESC, id DESC').bind(clientId),
    db
      .prepare(
        `SELECT m.id, m.evaluation_id, m.measurement_type_id, t.name_es, t.kind, m.value_centi, m.unit, m.notes
           FROM measurements m JOIN measurement_types t ON t.id = m.measurement_type_id
          WHERE m.client_id = ? AND m.evaluation_id IS NOT NULL ORDER BY t.sort_order, m.id`,
      )
      .bind(clientId),
  ])
  type M = { id: number; evaluation_id: number; measurement_type_id: number; name_es: string; kind: number; value_centi: number; unit: string; notes: string | null }
  const byEvaluation = new Map<number, M[]>()
  for (const m of measurements.results as M[]) byEvaluation.set(m.evaluation_id, [...(byEvaluation.get(m.evaluation_id) ?? []), m])
  const photos = (await photosOf(db, clientId, photoUrl)).filter((p) => p.evaluationId !== null)
  return (evaluations.results as { id: number; evaluated_on: string; notes: string | null; created_at: string }[]).map((e) => ({
    id: e.id,
    evaluatedOn: e.evaluated_on,
    notes: e.notes,
    createdAt: e.created_at,
    measurements: (byEvaluation.get(e.id) ?? []).map((m) => ({
      id: m.id,
      measurementTypeId: m.measurement_type_id,
      name: m.name_es,
      kind: KINDS[m.kind]?.name ?? 'Other',
      value: fromCenti(m.value_centi),
      unit: m.unit,
      notes: m.notes,
    })),
    photos: photos.filter((p) => p.evaluationId === e.id),
  }))
}

const KG_PER_LB = 0.45359237
const FREQUENCY_WEEKS = 12
const unitName = (u: number) => (u === 1 ? 'kg' : 'lb')

/**
 * Progreso calculado solo con datos guardados: medidas corporales, cargas de los entrenamientos finalizados y frecuencia.
 * No se rellenan huecos ni se interpolan valores. El peso corporal (medidas) y la carga de los ejercicios
 * (entrenamientos) salen de tablas distintas y nunca se mezclan.
 */
export async function buildProgress(db: D1Database, clientId: number) {
  const [measurementRows, setRows, logRows] = await db.batch([
    db
      .prepare(
        `SELECT m.id, m.measurement_type_id, t.name_es, t.kind, t.sort_order, m.unit, m.measured_on, m.value_centi, m.evaluation_id, m.notes
           FROM measurements m JOIN measurement_types t ON t.id = m.measurement_type_id
          WHERE m.client_id = ? ORDER BY m.measured_on, m.id`,
      )
      .bind(clientId),
    db
      .prepare(
        `SELECT l.id AS log_id, l.started_at, e.exercise_id, e.exercise_name_es, s.weight_centi, s.weight_unit, s.reps
           FROM training_logs l JOIN training_log_exercises e ON e.training_log_id = l.id JOIN training_log_sets s ON s.training_log_exercise_id = e.id
          WHERE l.client_id = ? AND l.status = 2 AND s.weight_centi IS NOT NULL AND s.weight_unit IS NOT NULL AND s.reps IS NOT NULL AND s.reps > 0
          ORDER BY l.id, e.position, s.set_number`,
      )
      .bind(clientId),
    db.prepare('SELECT started_at, status FROM training_logs WHERE client_id = ?').bind(clientId),
  ])

  // Medidas: una serie por tipo y unidad (si hubiera dos unidades, son dos series: nunca se mezclan).
  type M = { id: number; measurement_type_id: number; name_es: string; kind: number; sort_order: number; unit: string; measured_on: string; value_centi: number; evaluation_id: number | null; notes: string | null }
  const groups = new Map<string, M[]>()
  for (const m of measurementRows.results as M[]) {
    const key = `${m.measurement_type_id}|${m.unit}`
    groups.set(key, [...(groups.get(key) ?? []), m])
  }
  const measurements = [...groups.values()]
    .sort((a, b) => a[0].sort_order - b[0].sort_order || (a[0].unit < b[0].unit ? -1 : a[0].unit > b[0].unit ? 1 : 0))
    .map((g) => ({
      measurementTypeId: g[0].measurement_type_id,
      name: g[0].name_es,
      kind: KINDS[g[0].kind]?.name ?? 'Other',
      unit: g[0].unit,
      points: g.map((m) => ({ measurementId: m.id, date: m.measured_on, value: fromCenti(m.value_centi), evaluationId: m.evaluation_id, notes: m.notes })),
    }))

  // Cargas: la mejor serie de cada entrenamiento finalizado, en la unidad con la que más se registró el ejercicio.
  type S = { log_id: number; started_at: string; exercise_id: number; exercise_name_es: string; weight_centi: number; weight_unit: number; reps: number }
  const byExercise = new Map<number, S[]>()
  for (const s of setRows.results as S[]) byExercise.set(s.exercise_id, [...(byExercise.get(s.exercise_id) ?? []), s])
  const exercises = [...byExercise.entries()]
    .map(([exerciseId, sets]) => {
      const counts = new Map<number, number>()
      for (const s of sets) counts.set(s.weight_unit, (counts.get(s.weight_unit) ?? 0) + 1)
      const unit = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
      const to = (s: S) => {
        const w = fromCenti(s.weight_centi)
        return s.weight_unit === unit ? w : round2(unit === 1 ? w * KG_PER_LB : w / KG_PER_LB)
      }
      const sessions = new Map<number, S[]>()
      for (const s of sets) sessions.set(s.log_id, [...(sessions.get(s.log_id) ?? []), s])
      const points = [...sessions.entries()]
        .map(([sessionId, list]) => {
          const top = [...list].sort((a, b) => to(b) - to(a) || b.reps - a.reps)[0]
          return {
            date: localDate(new Date(top.started_at)),
            sessionId,
            weight: to(top),
            reps: top.reps,
            volume: round2(list.reduce((sum, s) => sum + to(s) * s.reps, 0)),
            setsLogged: list.length,
            converted: top.weight_unit !== unit,
            originalWeight: fromCenti(top.weight_centi),
            originalUnit: unitName(top.weight_unit),
          }
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.sessionId - b.sessionId)
      const latest = [...sets].sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
      return { exerciseId, name: latest.exercise_name_es, unit: unitName(unit), hasConvertedValues: sets.some((s) => s.weight_unit !== unit), points }
    })
    .sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name, 'es'))

  // Frecuencia: entrenamientos finalizados por semana (de lunes a domingo), las últimas 12 semanas.
  const logs = logRows.results as { started_at: string; status: number }[]
  const completedDates = logs.filter((l) => l.status === 2).map((l) => localDate(new Date(l.started_at))).sort()
  const today = localDate()
  const monday = addDays(today, -((dayOfWeek(today) + 6) % 7))
  const weeks = Array.from({ length: FREQUENCY_WEEKS }, (_, i) => addDays(monday, -7 * (FREQUENCY_WEEKS - 1 - i))).map((start) => {
    const end = addDays(start, 7)
    return { weekStart: start, completed: completedDates.filter((d) => d >= start && d < end).length }
  })
  return {
    measurements,
    exercises,
    frequency: {
      completed: completedDates.length,
      inProgress: logs.filter((l) => l.status === 1).length,
      firstSession: completedDates[0] ?? null,
      lastSession: completedDates.at(-1) ?? null,
      weeks,
    },
  }
}

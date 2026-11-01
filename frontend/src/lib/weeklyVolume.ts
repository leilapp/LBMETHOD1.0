/**
 * Series por músculo a la semana (pedido por Leilani el 31/10/2026).
 * - Suma las series de todos los días de la rutina (cada día cuenta una vez por semana).
 * - Cada ejercicio cuenta para su músculo principal de la biblioteca.
 * - No cuenta las series de calentamiento (tipo 2): solo las de trabajo.
 * Solo muestra lo que la entrenadora escribió; no recomienda ni cambia nada.
 */
export const WARMUP = 2
export const NO_MUSCLE = 'Sin grupo muscular'

export interface VolumeItem {
  muscle: string | null
  /** Series indicadas cuando no hay detalle serie por serie. */
  sets: number
  /** Tipo de serie del ejercicio (se usa cuando no hay detalle). */
  setType: number
  /** Tipo de cada serie, si la entrenadora las detalló una por una. */
  detailTypes: number[]
}

export interface MuscleVolume {
  muscle: string
  sets: number
}

/** Series de trabajo de un ejercicio (sin calentamiento). */
export function workingSets(item: VolumeItem) {
  if (item.detailTypes.length > 0) return item.detailTypes.filter((t) => t !== WARMUP).length
  return item.setType === WARMUP ? 0 : Math.max(0, item.sets || 0)
}

/** Total por músculo, de mayor a menor (empates por nombre). */
export function weeklyVolume(items: VolumeItem[]): MuscleVolume[] {
  const totals = new Map<string, number>()
  for (const item of items) {
    const n = workingSets(item)
    if (n === 0) continue
    const key = item.muscle || NO_MUSCLE
    totals.set(key, (totals.get(key) ?? 0) + n)
  }
  return [...totals]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle, 'es'))
}

/* ---------- Adaptadores para cada forma en que llega una rutina ---------- */

interface VersionLike {
  days: {
    exercises: { primaryMuscleGroup?: string | null; sets: number; setType?: number; setDetails: { setType?: number }[] }[]
  }[]
}

/** Rutina guardada (entrenadora) o programa del cliente. Si la API no manda el músculo, devuelve null. */
export function volumeFromVersion(v: VersionLike): MuscleVolume[] | null {
  const exercises = v.days.flatMap((d) => d.exercises)
  if (exercises.some((e) => e.primaryMuscleGroup === undefined)) return null
  return weeklyVolume(
    exercises.map((e) => ({
      muscle: e.primaryMuscleGroup ?? null,
      sets: e.sets,
      setType: e.setType ?? 1,
      detailTypes: e.setDetails.map((s) => s.setType ?? 1),
    })),
  )
}

interface BuilderLike {
  days: { exercises: { primaryMuscle: string | null; sets: string; setType: string; details: { setType: string }[] | null }[] }[]
}

/** Constructor: se recalcula mientras la entrenadora escribe. */
export function volumeFromBuilder(state: BuilderLike): MuscleVolume[] {
  return weeklyVolume(
    state.days.flatMap((d) =>
      d.exercises.map((e) => ({
        muscle: e.primaryMuscle,
        sets: Number(e.sets) || 0,
        setType: Number(e.setType) || 1,
        detailTypes: (e.details ?? []).map((s) => Number(s.setType) || 1),
      })),
    ),
  )
}

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

/* ---------- Músculo principal de cada día (pedido por Leilani el 10/11/2026) ---------- */

/**
 * Músculo principal de un día: el músculo principal (de la biblioteca) que suma más series
 * de trabajo ese día, con la misma regla de conteo que «Series por músculo a la semana».
 * - Empate: se muestran todos los empatados («Pecho y Espalda»).
 * - Los ejercicios sin músculo no cuentan; si el día no tiene series con músculo, no hay etiqueta.
 * Es solo una etiqueta informativa: no cambia ni sugiere nada de la rutina.
 */
export interface DayMainMuscle {
  muscles: string[]
  /** Series de trabajo del músculo principal (de cada uno, si hay empate). */
  sets: number
  /** Series de trabajo de todo el día. */
  total: number
}

export function dayMainMuscle(items: VolumeItem[]): DayMainMuscle | null {
  const rows = weeklyVolume(items)
  const total = rows.reduce((sum, r) => sum + r.sets, 0)
  const named = rows.filter((r) => r.muscle !== NO_MUSCLE)
  if (named.length === 0) return null
  const top = named[0].sets
  return { muscles: named.filter((r) => r.sets === top).map((r) => r.muscle), sets: top, total }
}

/** «Pecho», «Pecho y Espalda», «Pecho, Espalda y Hombros». */
export function joinMuscles(muscles: string[]) {
  if (muscles.length <= 1) return muscles[0] ?? ''
  return `${muscles.slice(0, -1).join(', ')} y ${muscles[muscles.length - 1]}`
}

/** Texto corto para el PDF: «Músculo principal: Pecho (9 de 14 series)». */
export function mainMuscleText(m: DayMainMuscle) {
  const label = m.muscles.length > 1 ? 'Músculos principales' : 'Músculo principal'
  const each = m.muscles.length > 1 ? ' cada uno' : ''
  return `${label}: ${joinMuscles(m.muscles)} (${m.sets} de ${m.total} series${each})`
}

type VersionDayLike = VersionLike['days'][number]

/** Día de una rutina guardada o del programa del cliente. Si la API no manda el músculo, devuelve null. */
export function mainMuscleFromVersionDay(day: VersionDayLike): DayMainMuscle | null {
  if (day.exercises.some((e) => e.primaryMuscleGroup === undefined)) return null
  return dayMainMuscle(
    day.exercises.map((e) => ({
      muscle: e.primaryMuscleGroup ?? null,
      sets: e.sets,
      setType: e.setType ?? 1,
      detailTypes: e.setDetails.map((s) => s.setType ?? 1),
    })),
  )
}

type BuilderDayLike = BuilderLike['days'][number]

/** Día del constructor: se recalcula mientras la entrenadora escribe. */
export function mainMuscleFromBuilderDay(day: BuilderDayLike): DayMainMuscle | null {
  return dayMainMuscle(
    day.exercises.map((e) => ({
      muscle: e.primaryMuscle,
      sets: Number(e.sets) || 0,
      setType: Number(e.setType) || 1,
      detailTypes: (e.details ?? []).map((s) => Number(s.setType) || 1),
    })),
  )
}

import type { DraftPayload, RoutineSet, RoutineVersion, SetPayload } from '../../api/routines'

/*
 * Estado editable del constructor. Los números se guardan como texto mientras se escriben
 * para permitir campos vacíos (parámetros opcionales); se convierten al guardar.
 */

export interface SetRow {
  key: string
  setType: string
  repsMin: string
  repsMax: string
  weight: string
  unit: string
  rest: string
  rir: string
  rpe: string
  notes: string
}

export interface ExerciseRow extends Omit<SetRow, 'key'> {
  key: string
  exerciseId: number
  nameEs: string
  nameEn: string | null
  primaryMuscle: string | null
  isActive: boolean
  supersetGroup: string
  sets: string
  tempo: string
  details: SetRow[] | null
}

export interface DayRow {
  key: string
  name: string
  dayOfWeek: string
  notes: string
  exercises: ExerciseRow[]
}

export interface BuilderState {
  draftVersionId: number
  title: string
  description: string
  goal: string
  durationWeeks: string
  days: DayRow[]
}

let counter = 0
export const newKey = () => `k${++counter}`

const text = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v))

function setRowFrom(s: RoutineSet): SetRow {
  return {
    key: newKey(),
    setType: String(s.setType),
    repsMin: text(s.repsMin),
    repsMax: text(s.repsMax),
    weight: text(s.suggestedWeight),
    unit: text(s.suggestedWeightUnit ?? 1),
    rest: text(s.restSeconds),
    rir: text(s.rir),
    rpe: text(s.rpe),
    notes: s.notes ?? '',
  }
}

export function stateFromVersion(v: RoutineVersion): BuilderState {
  return {
    draftVersionId: v.id,
    title: v.title,
    description: v.description ?? '',
    goal: v.goal ?? '',
    durationWeeks: text(v.durationWeeks),
    days: v.days.map((d) => ({
      key: newKey(),
      name: d.name,
      dayOfWeek: text(d.dayOfWeek),
      notes: d.notes ?? '',
      exercises: d.exercises.map((e) => ({
        key: newKey(),
        exerciseId: e.exerciseId,
        nameEs: e.exerciseNameEs,
        nameEn: e.exerciseNameEn,
        primaryMuscle: e.primaryMuscleGroup,
        isActive: e.exerciseIsActive,
        supersetGroup: e.supersetGroup ?? '',
        sets: String(e.sets),
        repsMin: text(e.repsMin),
        repsMax: text(e.repsMax),
        weight: text(e.suggestedWeight),
        unit: text(e.suggestedWeightUnit ?? 1),
        rest: text(e.restSeconds),
        tempo: e.tempo ?? '',
        rir: text(e.rir),
        rpe: text(e.rpe),
        setType: String(e.setType),
        notes: e.notes ?? '',
        details: e.setDetails.length ? e.setDetails.map(setRowFrom) : null,
      })),
    })),
  }
}

/** Ejercicio recién agregado: sin parámetros. La entrenadora los define todos. */
export function emptyExercise(ex: { id: number; nameEs: string; nameEn: string | null; primaryMuscleGroup: string | null }): ExerciseRow {
  return {
    key: newKey(),
    exerciseId: ex.id,
    nameEs: ex.nameEs,
    nameEn: ex.nameEn,
    primaryMuscle: ex.primaryMuscleGroup,
    isActive: true,
    supersetGroup: '',
    sets: '',
    repsMin: '',
    repsMax: '',
    weight: '',
    unit: '1',
    rest: '',
    tempo: '',
    rir: '',
    rpe: '',
    setType: '1',
    notes: '',
    details: null,
  }
}

export function emptySet(from?: Partial<SetRow>): SetRow {
  return { key: newKey(), setType: '1', repsMin: '', repsMax: '', weight: '', unit: '1', rest: '', rir: '', rpe: '', notes: '', ...from }
}

/** Copia con claves nuevas (para duplicar días y ejercicios). */
export function cloneExercise(e: ExerciseRow): ExerciseRow {
  return { ...e, key: newKey(), details: e.details?.map((s) => ({ ...s, key: newKey() })) ?? null }
}

export function cloneDay(d: DayRow, name: string): DayRow {
  return { ...d, key: newKey(), name, exercises: d.exercises.map(cloneExercise) }
}

const int = (v: string) => (v.trim() === '' ? null : Number(v))
const dec = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
const opt = (v: string) => (v.trim() === '' ? null : v.trim())

function setPayload(s: Omit<SetRow, 'key'>): SetPayload {
  const weight = dec(s.weight)
  return {
    setType: Number(s.setType),
    repsMin: int(s.repsMin),
    repsMax: int(s.repsMax),
    suggestedWeight: weight,
    suggestedWeightUnit: weight === null ? null : Number(s.unit),
    restSeconds: int(s.rest),
    rir: dec(s.rir),
    rpe: dec(s.rpe),
    notes: opt(s.notes),
  }
}

export function toPayload(state: BuilderState): DraftPayload {
  return {
    draftVersionId: state.draftVersionId,
    title: state.title.trim(),
    description: opt(state.description),
    goal: opt(state.goal),
    durationWeeks: int(state.durationWeeks),
    days: state.days.map((d) => ({
      name: d.name.trim(),
      dayOfWeek: d.dayOfWeek === '' ? null : Number(d.dayOfWeek),
      notes: opt(d.notes),
      exercises: d.exercises.map((e) => ({
        ...setPayload(e),
        exerciseId: e.exerciseId,
        supersetGroup: opt(e.supersetGroup)?.toUpperCase() ?? null,
        sets: e.details ? e.details.length : (int(e.sets) ?? 0),
        tempo: opt(e.tempo),
        setDetails: e.details?.map(setPayload) ?? [],
      })),
    })),
  }
}

export type FieldErrors = Record<string, string>

/** Entero opcional dentro de un rango (vacío es válido). */
function isNumber(v: string, { min, max }: { min: number; max: number }) {
  if (v.trim() === '') return true
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max
}

function checkPrescription(errors: FieldErrors, p: string, s: Omit<SetRow, 'key'>) {
  if (!isNumber(s.repsMin, { min: 0, max: 1000 })) errors[`${p}.repsMin`] = 'Número entero de 0 a 1000.'
  if (!isNumber(s.repsMax, { min: 0, max: 1000 })) errors[`${p}.repsMax`] = 'Número entero de 0 a 1000.'
  if (s.repsMin && s.repsMax && Number(s.repsMin) > Number(s.repsMax)) errors[`${p}.repsMax`] = 'El máximo no puede ser menor que el mínimo.'
  if (s.weight.trim() !== '' && !(Number(s.weight.replace(',', '.')) >= 0 && Number(s.weight.replace(',', '.')) <= 2000))
    errors[`${p}.suggestedWeight`] = 'Peso de 0 a 2000.'
  if (!isNumber(s.rest, { min: 0, max: 3600 })) errors[`${p}.restSeconds`] = 'Segundos enteros de 0 a 3600.'
  const half = (v: string) => v.trim() === '' || Number.isInteger(Number(v.replace(',', '.')) * 2)
  if (s.rir.trim() !== '' && !(Number(s.rir.replace(',', '.')) >= 0 && Number(s.rir.replace(',', '.')) <= 10 && half(s.rir)))
    errors[`${p}.rir`] = 'De 0 a 10, enteros o medios.'
  if (s.rpe.trim() !== '' && !(Number(s.rpe.replace(',', '.')) >= 1 && Number(s.rpe.replace(',', '.')) <= 10 && half(s.rpe)))
    errors[`${p}.rpe`] = 'De 1 a 10, enteros o medios.'
}

/** Validación inmediata en pantalla (el servidor vuelve a validar todo). */
export function validate(state: BuilderState): FieldErrors {
  const errors: FieldErrors = {}
  if (!state.title.trim()) errors.title = 'Escribe el nombre de la rutina.'
  if (state.durationWeeks && !isNumber(state.durationWeeks, { min: 1, max: 104 })) errors.durationWeeks = 'De 1 a 104 semanas.'
  state.days.forEach((d, i) => {
    const p = `days[${i}]`
    if (!d.name.trim()) errors[`${p}.name`] = 'Escribe el nombre del día.'
    d.exercises.forEach((e, j) => {
      const xp = `${p}.exercises[${j}]`
      if (!e.details && !isNumber(e.sets, { min: 1, max: 30 })) errors[`${xp}.sets`] = 'Indica las series (1 a 30).'
      if (!e.details && e.sets.trim() === '') errors[`${xp}.sets`] = 'Indica las series.'
      if (e.details && e.details.length === 0) errors[`${xp}.sets`] = 'Agrega al menos una serie.'
      if (e.supersetGroup.trim() && !/^[A-Za-z0-9]{1,3}$/.test(e.supersetGroup.trim())) errors[`${xp}.supersetGroup`] = 'Etiqueta corta: A, B, C1…'
      checkPrescription(errors, xp, e)
      e.details?.forEach((s, k) => checkPrescription(errors, `${xp}.setDetails[${k}]`, s))
    })
  })
  return errors
}

/** Texto breve de la prescripción, por ejemplo "4 × 8–12 · 60 kg · 90 s · RIR 2". */
export function summarize(e: {
  sets: number | string
  repsMin: number | string | null
  repsMax: number | string | null
  weight?: number | string | null
  unitLabel?: string
  rest: number | string | null
  tempo?: string | null
  rir: number | string | null
  rpe: number | string | null
}) {
  const has = (v: unknown) => v !== null && v !== undefined && v !== ''
  const reps = has(e.repsMin) && has(e.repsMax) && String(e.repsMin) !== String(e.repsMax)
    ? `${e.repsMin}–${e.repsMax}`
    : has(e.repsMin) ? String(e.repsMin) : has(e.repsMax) ? String(e.repsMax) : null
  const parts = [has(e.sets) ? `${e.sets}${reps ? ` × ${reps}` : ' series'}` : reps ? `× ${reps}` : null]
  if (has(e.weight)) parts.push(`${e.weight} ${e.unitLabel ?? 'kg'}`)
  if (has(e.rest)) parts.push(`${e.rest} s descanso`)
  if (has(e.tempo)) parts.push(`tempo ${e.tempo}`)
  if (has(e.rir)) parts.push(`RIR ${e.rir}`)
  if (has(e.rpe)) parts.push(`RPE ${e.rpe}`)
  return parts.filter(Boolean).join(' · ')
}

/** Convierte el estado del constructor en la misma forma que una versión guardada, para la vista previa. */
export function previewFromState(
  state: BuilderState,
  labels: { setTypes: Map<number, string>; days: Map<number, string>; units: Map<number, string> },
): RoutineVersion {
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
  const set = (s: Omit<SetRow, 'key'>, n: number) => ({
    setNumber: n,
    setType: Number(s.setType),
    setTypeLabel: labels.setTypes.get(Number(s.setType)) ?? '',
    repsMin: num(s.repsMin),
    repsMax: num(s.repsMax),
    suggestedWeight: num(s.weight),
    suggestedWeightUnit: num(s.weight) === null ? null : Number(s.unit),
    restSeconds: num(s.rest),
    rir: num(s.rir),
    rpe: num(s.rpe),
    notes: s.notes.trim() || null,
  })
  return {
    id: state.draftVersionId,
    routineId: 0,
    routineKind: 'Program',
    versionNumber: 0,
    status: 'Draft',
    title: state.title,
    description: state.description || null,
    goal: state.goal || null,
    durationWeeks: num(state.durationWeeks),
    changeNotes: null,
    publishedAt: null,
    sourceVersionId: null,
    updatedAt: '',
    days: state.days.map((d, i) => ({
      id: i,
      position: i + 1,
      name: d.name,
      dayOfWeek: d.dayOfWeek === '' ? null : Number(d.dayOfWeek),
      dayLabel: d.dayOfWeek === '' ? null : (labels.days.get(Number(d.dayOfWeek)) ?? null),
      notes: d.notes || null,
      exercises: d.exercises.map((e, j) => ({
        ...set(e, 0),
        id: j,
        position: j + 1,
        exerciseId: e.exerciseId,
        exerciseNameEs: e.nameEs,
        exerciseNameEn: e.nameEn,
        exerciseIsActive: e.isActive,
        primaryMuscleGroup: e.primaryMuscle,
        supersetGroup: e.supersetGroup.trim().toUpperCase() || null,
        sets: e.details ? e.details.length : (num(e.sets) ?? 0),
        tempo: e.tempo.trim() || null,
        setDetails: e.details?.map((s, k) => set(s, k + 1)) ?? [],
      })),
    })),
  }
}

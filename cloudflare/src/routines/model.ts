import { cleanOptional } from '../text'

/** Límites y textos del constructor (los mismos de la versión .NET). */
export const LIMITS = { maxDays: 14, maxExercisesPerDay: 40, maxSets: 30, maxReps: 1000, maxWeight: 2000, maxRestSeconds: 3600, maxDurationWeeks: 104 }

export const SET_TYPES: Record<number, string> = {
  1: 'Efectiva',
  2: 'Calentamiento',
  3: 'Dropset',
  4: 'Al fallo',
  5: 'Rest-pause',
  6: 'Back-off',
  99: 'Otra',
}

/** 0 = domingo … 6 = sábado (como .NET); se listan de lunes a domingo. */
export const DAYS: [number, string][] = [
  [1, 'Lunes'],
  [2, 'Martes'],
  [3, 'Miércoles'],
  [4, 'Jueves'],
  [5, 'Viernes'],
  [6, 'Sábado'],
  [0, 'Domingo'],
]
export const dayLabel = (value: number | null) => (value === null ? null : (DAYS.find(([v]) => v === value)?.[1] ?? null))

export const KINDS: Record<number, 'Program' | 'Template'> = { 1: 'Program', 2: 'Template' }
export const ROUTINE_STATUS: Record<number, 'Active' | 'Archived'> = { 1: 'Active', 2: 'Archived' }
export const VERSION_STATUS: Record<number, 'Draft' | 'Published'> = { 1: 'Draft', 2: 'Published' }

export interface Header {
  title: string
  description: string | null
  goal: string | null
  durationWeeks: number | null
}

export interface SetInput {
  setType: number
  repsMin: number | null
  repsMax: number | null
  suggestedWeight: number | null
  suggestedWeightUnit: number | null
  restSeconds: number | null
  rir: number | null
  rpe: number | null
  notes: string | null
}

export interface ExerciseInput extends SetInput {
  exerciseId: number
  supersetGroup: string | null
  sets: number
  tempo: string | null
  setDetails: SetInput[]
}

export interface DayInput {
  name: string
  dayOfWeek: number | null
  notes: string | null
  exercises: ExerciseInput[]
}

export type Errors = Record<string, string[]>
export const addError = (errors: Errors, field: string, message: string) => (errors[field] ??= []).push(message)

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Lee el JSON del constructor revisando el tipo de cada valor (como hace .NET al recibirlo). Los errores usan la
 * ruta exacta del campo (days[0].exercises[1].repsMax) para que la pantalla los muestre junto al campo.
 * Las listas más largas que el límite no se recorren: se informa el límite y se detiene ahí.
 */
export class Reader {
  errors: Errors = {}

  private invalid(path: string) {
    addError(this.errors, path, 'Valor no válido.')
  }

  int(obj: Json, key: string, path: string): number | null {
    const v = obj[key]
    if (v === undefined || v === null) return null
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      this.invalid(path)
      return null
    }
    return v
  }

  num(obj: Json, key: string, path: string): number | null {
    const v = obj[key]
    if (v === undefined || v === null) return null
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.invalid(path)
      return null
    }
    return v
  }

  str(obj: Json, key: string, path: string): string | null {
    const v = obj[key]
    if (v === undefined || v === null) return null
    if (typeof v !== 'string') {
      addError(this.errors, path, 'Debe ser texto.')
      return null
    }
    return v
  }

  list(obj: Json, key: string, path: string, max: number, limitMessage: string): Json[] {
    const v = obj[key]
    if (v === undefined || v === null) return []
    if (!Array.isArray(v) || !v.every(isObject)) {
      this.invalid(path)
      return []
    }
    if (v.length > max) {
      addError(this.errors, path, limitMessage)
      return []
    }
    return v
  }

  header(body: Json): Header {
    return {
      title: this.str(body, 'title', 'title') ?? '',
      description: this.str(body, 'description', 'description'),
      goal: this.str(body, 'goal', 'goal'),
      durationWeeks: this.int(body, 'durationWeeks', 'durationWeeks'),
    }
  }

  private set(obj: Json, p: string): SetInput {
    return {
      setType: this.int(obj, 'setType', `${p}.setType`) ?? 0,
      repsMin: this.int(obj, 'repsMin', `${p}.repsMin`),
      repsMax: this.int(obj, 'repsMax', `${p}.repsMax`),
      suggestedWeight: this.num(obj, 'suggestedWeight', `${p}.suggestedWeight`),
      suggestedWeightUnit: this.int(obj, 'suggestedWeightUnit', `${p}.suggestedWeightUnit`),
      restSeconds: this.int(obj, 'restSeconds', `${p}.restSeconds`),
      rir: this.num(obj, 'rir', `${p}.rir`),
      rpe: this.num(obj, 'rpe', `${p}.rpe`),
      notes: this.str(obj, 'notes', `${p}.notes`),
    }
  }

  days(body: Json): DayInput[] {
    return this.list(body, 'days', 'days', LIMITS.maxDays, `Máximo ${LIMITS.maxDays} días por rutina.`).map((day, d) => {
      const p = `days[${d}]`
      return {
        name: this.str(day, 'name', `${p}.name`) ?? '',
        dayOfWeek: this.int(day, 'dayOfWeek', `${p}.dayOfWeek`),
        notes: this.str(day, 'notes', `${p}.notes`),
        exercises: this.list(day, 'exercises', `${p}.exercises`, LIMITS.maxExercisesPerDay, `Máximo ${LIMITS.maxExercisesPerDay} ejercicios por día.`).map((x, i) => {
          const xp = `${p}.exercises[${i}]`
          return {
            ...this.set(x, xp),
            exerciseId: this.int(x, 'exerciseId', `${xp}.exerciseId`) ?? 0,
            supersetGroup: this.str(x, 'supersetGroup', `${xp}.supersetGroup`),
            sets: this.int(x, 'sets', `${xp}.sets`) ?? 0,
            tempo: this.str(x, 'tempo', `${xp}.tempo`),
            setDetails: this.list(x, 'setDetails', `${xp}.sets`, LIMITS.maxSets, `Máximo ${LIMITS.maxSets} series.`).map((s, n) => this.set(s, `${xp}.setDetails[${n}]`)),
          }
        }),
      }
    })
  }
}

const SUPERSET = /^[A-Z0-9]{1,3}$/
const tooLong = (value: string | null, max: number) => (value?.trim().length ?? 0) > max
const isHalf = (v: number) => Math.round(v * 2) === v * 2

export function validateHeader(h: Header, errors: Errors) {
  const title = h.title.trim()
  if (!title) addError(errors, 'title', 'Escribe el nombre de la rutina.')
  if (title.length > 150) addError(errors, 'title', 'Máximo 150 caracteres.')
  if (tooLong(h.description, 2000)) addError(errors, 'description', 'Máximo 2000 caracteres.')
  if (tooLong(h.goal, 500)) addError(errors, 'goal', 'Máximo 500 caracteres.')
  if (h.durationWeeks !== null && (h.durationWeeks < 1 || h.durationWeeks > LIMITS.maxDurationWeeks))
    addError(errors, 'durationWeeks', `La duración debe estar entre 1 y ${LIMITS.maxDurationWeeks} semanas.`)
}

function validatePrescription(errors: Errors, p: string, x: SetInput) {
  const { repsMin, repsMax, suggestedWeight: weight, suggestedWeightUnit: unit, restSeconds: rest, rir, rpe } = x
  if (repsMin !== null && (repsMin < 0 || repsMin > LIMITS.maxReps)) addError(errors, `${p}.repsMin`, `Entre 0 y ${LIMITS.maxReps}.`)
  if (repsMax !== null && (repsMax < 0 || repsMax > LIMITS.maxReps)) addError(errors, `${p}.repsMax`, `Entre 0 y ${LIMITS.maxReps}.`)
  if (repsMin !== null && repsMax !== null && repsMin > repsMax) addError(errors, `${p}.repsMax`, 'El máximo no puede ser menor que el mínimo.')
  if (weight !== null && (weight < 0 || weight > LIMITS.maxWeight)) addError(errors, `${p}.suggestedWeight`, `Entre 0 y ${LIMITS.maxWeight}.`)
  if (weight !== null && unit === null) addError(errors, `${p}.suggestedWeightUnit`, 'Indica la unidad del peso (kg o lb).')
  if (unit !== null && unit !== 1 && unit !== 2) addError(errors, `${p}.suggestedWeightUnit`, 'Unidad no válida.')
  if (rest !== null && (rest < 0 || rest > LIMITS.maxRestSeconds)) addError(errors, `${p}.restSeconds`, `Entre 0 y ${LIMITS.maxRestSeconds} segundos.`)
  if (rir !== null && (rir < 0 || rir > 10)) addError(errors, `${p}.rir`, 'El RIR va de 0 a 10.')
  if (rpe !== null && (rpe < 1 || rpe > 10)) addError(errors, `${p}.rpe`, 'El RPE va de 1 a 10.')
  if (rir !== null && !isHalf(rir)) addError(errors, `${p}.rir`, 'Usa enteros o medios (por ejemplo 1.5).')
  if (rpe !== null && !isHalf(rpe)) addError(errors, `${p}.rpe`, 'Usa enteros o medios (por ejemplo 7.5).')
}

export type Catalog = Map<number, { nameEs: string; isActive: boolean }>

/**
 * Reglas de los días (las mismas de .NET). Un borrador puede guardarse incompleto; para publicar, cada día necesita
 * ejercicios, ningún ejercicio puede estar desactivado y cada superserie necesita al menos dos ejercicios.
 */
export function validateDays(days: DayInput[], catalog: Catalog, errors: Errors, forPublish: boolean) {
  if (forPublish && days.length === 0) addError(errors, 'days', 'Agrega al menos un día con ejercicios antes de publicar.')
  days.forEach((day, d) => {
    const p = `days[${d}]`
    const name = day.name.trim()
    if (!name) addError(errors, `${p}.name`, 'Escribe el nombre del día.')
    if (name.length > 100) addError(errors, `${p}.name`, 'Máximo 100 caracteres.')
    if (day.dayOfWeek !== null && (day.dayOfWeek < 0 || day.dayOfWeek > 6)) addError(errors, `${p}.dayOfWeek`, 'Día de la semana no válido.')
    if (tooLong(day.notes, 1000)) addError(errors, `${p}.notes`, 'Máximo 1000 caracteres.')
    if (forPublish && day.exercises.length === 0) addError(errors, `${p}.exercises`, `El día «${name}» no tiene ejercicios.`)

    day.exercises.forEach((x, i) => {
      const xp = `${p}.exercises[${i}]`
      const master = catalog.get(x.exerciseId)
      if (!master) addError(errors, `${xp}.exerciseId`, 'El ejercicio no existe en la biblioteca.')
      else if (forPublish && !master.isActive)
        addError(errors, `${xp}.exerciseId`, `«${master.nameEs}» está desactivado en la biblioteca. Reactívalo o quítalo antes de publicar.`)
      if (x.supersetGroup && !SUPERSET.test(x.supersetGroup.trim().toUpperCase())) addError(errors, `${xp}.supersetGroup`, 'Usa una etiqueta corta, por ejemplo A, B o C1.')
      if (tooLong(x.tempo, 20)) addError(errors, `${xp}.tempo`, 'Máximo 20 caracteres.')
      if (tooLong(x.notes, 1000)) addError(errors, `${xp}.notes`, 'Máximo 1000 caracteres.')
      if (!(x.setType in SET_TYPES)) addError(errors, `${xp}.setType`, 'Tipo de serie no válido.')
      if (x.setDetails.length === 0 && (x.sets < 1 || x.sets > LIMITS.maxSets)) addError(errors, `${xp}.sets`, `Las series deben estar entre 1 y ${LIMITS.maxSets}.`)
      validatePrescription(errors, xp, x)
      x.setDetails.forEach((s, n) => {
        const sp = `${xp}.setDetails[${n}]`
        if (!(s.setType in SET_TYPES)) addError(errors, `${sp}.setType`, 'Tipo de serie no válido.')
        if (tooLong(s.notes, 500)) addError(errors, `${sp}.notes`, 'Máximo 500 caracteres.')
        validatePrescription(errors, sp, s)
      })
    })

    if (forPublish) {
      const groups = new Map<string, number>()
      for (const x of day.exercises) {
        const g = x.supersetGroup?.trim().toUpperCase()
        if (g) groups.set(g, (groups.get(g) ?? 0) + 1)
      }
      for (const [g, count] of groups)
        if (count < 2) addError(errors, `${p}.exercises`, `La superserie ${g} del día «${name}» tiene un solo ejercicio.`)
    }
  })
}

export const exerciseIds = (days: DayInput[]) => [...new Set(days.flatMap((d) => d.exercises.map((x) => x.exerciseId)))]

/** Valores tal como se guardan: textos limpios, superserie en mayúsculas, pesos en centésimas y sin unidad si no hay peso. */
export function cleanedHeader(h: Header) {
  return { title: h.title.trim(), description: cleanOptional(h.description), goal: cleanOptional(h.goal), durationWeeks: h.durationWeeks }
}

const centi = (weight: number | null) => (weight === null ? null : Math.round(weight * 100))

function cleanedSet(s: SetInput) {
  return {
    st: s.setType,
    rmin: s.repsMin,
    rmax: s.repsMax,
    w: centi(s.suggestedWeight),
    wu: s.suggestedWeight === null ? null : s.suggestedWeightUnit,
    rest: s.restSeconds,
    rir: s.rir,
    rpe: s.rpe,
    notes: cleanOptional(s.notes),
  }
}

/** Filas planas (días, ejercicios y series) para insertarlas en tres sentencias con json_each. */
export function rows(days: DayInput[]) {
  const dayRows = days.map((day, d) => ({ p: d + 1, name: day.name.trim(), dow: day.dayOfWeek, notes: cleanOptional(day.notes) }))
  const exerciseRows = days.flatMap((day, d) =>
    day.exercises.map((x, i) => ({
      d: d + 1,
      p: i + 1,
      ex: x.exerciseId,
      sg: x.supersetGroup?.trim() ? x.supersetGroup.trim().toUpperCase() : null,
      // Si hay detalle por serie, el número de series es el número de filas.
      sets: x.setDetails.length > 0 ? x.setDetails.length : x.sets,
      tempo: cleanOptional(x.tempo),
      ...cleanedSet(x),
    })),
  )
  const setRows = days.flatMap((day, d) => day.exercises.flatMap((x, i) => x.setDetails.map((s, n) => ({ d: d + 1, e: i + 1, n: n + 1, ...cleanedSet(s) }))))
  return { dayRows, exerciseRows, setRows }
}

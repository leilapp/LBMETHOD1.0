/** Textos y reglas del seguimiento (los mismos de la versión .NET). */

export const KINDS: Record<number, { name: string; label: string; units: string[] }> = {
  1: { name: 'BodyWeight', label: 'Peso corporal', units: ['kg', 'lb'] },
  2: { name: 'Circumference', label: 'Perímetro', units: ['cm', 'in'] },
  3: { name: 'BodyComposition', label: 'Composición corporal', units: ['%', 'kg', 'lb'] },
  99: { name: 'Other', label: 'Otra', units: ['kg', 'lb', 'cm', 'in', '%'] },
}
export const KIND_ORDER = [1, 2, 3, 99]

/** Rango razonable de un valor según su unidad, para atrapar errores de captura (por ejemplo, 625 en lugar de 62.5 kg). */
export const RANGES: Record<string, [number, number]> = { kg: [1, 500], lb: [2, 1100], cm: [1, 300], in: [0.5, 120], '%': [0.1, 100] }

export const PHOTO_CATEGORIES: Record<number, string> = { 1: 'Frente', 2: 'Perfil', 3: 'Espalda', 99: 'Otra' }
export const PHOTO_ORDER = [1, 2, 3, 99]

/** Tipos de evento que la entrenadora crea a mano. Inicio y fin de programa salen de las asignaciones. */
export const EVENT_TYPES: Record<number, string> = { 1: 'Entrenamiento', 2: 'Descanso', 3: 'Evaluación', 99: 'Otro' }
export const EVENT_ORDER = [1, 2, 3, 99]
export const EVENT_TYPE_NAMES: Record<number, string> = { 1: 'ScheduledTraining', 2: 'RestDay', 3: 'Evaluation', 4: 'ProgramStart', 5: 'ProgramEnd', 99: 'Other' }

export const MAX_NOTES = 1000
export const MAX_EVALUATION_NOTES = 2000
export const MAX_MEASUREMENTS_PER_EVALUATION = 40

/** Revisa el valor de una medida según su unidad. Devuelve el mensaje de error o null. */
export function valueError(value: unknown, unit: string): string | null {
  if (value === undefined || value === null) return 'Escribe el valor.'
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Valor no válido.'
  if (Math.abs(Math.round(value * 100) - value * 100) > 1e-6) return 'Máximo dos decimales.'
  const range = RANGES[unit]
  if (!range) return value <= 0 || value > 99999 ? 'Valor fuera de rango.' : null
  return value < range[0] || value > range[1] ? `Debe estar entre ${range[0]} y ${range[1]} ${unit}.` : null
}

export const toCenti = (v: number) => Math.round(v * 100)
export const fromCenti = (v: number) => v / 100

/** Redondeo a 2 decimales «al par» en el punto medio, como decimal.Round de .NET. */
export function round2(x: number) {
  const v = x * 100
  const floor = Math.floor(v)
  const diff = v - floor
  let r: number
  if (Math.abs(diff - 0.5) < 1e-9) r = floor % 2 === 0 ? floor : floor + 1
  else r = Math.round(v)
  return r / 100
}

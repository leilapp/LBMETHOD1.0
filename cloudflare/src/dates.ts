/** Zona horaria del negocio: centro de México (Guanajuato). Las fechas de calendario se guardan como AAAA-MM-DD. */
export const BUSINESS_TIME_ZONE = 'America/Mexico_City'

/** Fecha de hoy (o de un instante) en el centro de México, como AAAA-MM-DD. */
export const localDate = (instant: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)

/** Valida una fecha de calendario AAAA-MM-DD que exista de verdad (sin 31 de febrero). */
export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** Suma años a una fecha AAAA-MM-DD (el 29 de febrero pasa al 28 si el año no es bisiesto, como en .NET). */
export function addYears(value: string, years: number) {
  const [y, m, d] = value.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y + years, m, 0)).getUTCDate()
  return `${String(y + years).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}

/** Suma (o resta) días a una fecha AAAA-MM-DD. */
export function addDays(value: string, days: number) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Día de la semana de una fecha AAAA-MM-DD: 0 = domingo … 6 = sábado (como .NET). */
export function dayOfWeek(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Formato dd/MM/yyyy para mensajes. */
export const shortDate = (value: string) => value.split('-').reverse().join('/')

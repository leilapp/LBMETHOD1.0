/** Fecha de calendario (aaaa-mm-dd) en formato de México, sin conversiones de zona horaria. */
export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Fecha y hora guardadas en UTC, mostradas en la hora de Guanajuato (centro de México). */
export function formatDateTime(isoUtc: string) {
  return new Date(isoUtc).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Fecha de hoy (aaaa-mm-dd) en Guanajuato, sin importar la zona horaria del dispositivo. */
export function todayInMexico(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Suma días a una fecha de calendario aaaa-mm-dd. */
export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/** Iniciales para el avatar: «Leilani Bermúdez» → «LB». */
export function initials(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w))
  if (parts.length === 0) return '·'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toLocaleUpperCase('es-MX')
}

/** Fecha de hoy en palabras, en la hora de Guanajuato: «viernes, 31 de octubre». */
export function todayLong(now = new Date()) {
  return now.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long' })
}

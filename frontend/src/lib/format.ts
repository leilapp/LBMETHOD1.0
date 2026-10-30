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

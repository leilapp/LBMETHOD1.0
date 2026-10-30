import { ApiError } from '../../api/client'

export const trackingKeys = {
  options: ['trainer', 'tracking', 'options'] as const,
  types: ['trainer', 'tracking', 'types'] as const,
  overview: ['trainer', 'tracking', 'overview'] as const,
  dashboard: ['trainer', 'dashboard'] as const,
  client: (id: number) => ['trainer', 'tracking', 'client', id] as const,
  evaluations: (id: number) => ['trainer', 'tracking', 'client', id, 'evaluations'] as const,
  photos: (id: number) => ['trainer', 'tracking', 'client', id, 'photos'] as const,
  progress: (id: number) => ['trainer', 'tracking', 'client', id, 'progress'] as const,
  sessions: (id: number) => ['trainer', 'tracking', 'client', id, 'sessions'] as const,
  calendar: ['trainer', 'calendar'] as const,
  portal: ['portal', 'tracking'] as const,
}

/** Primer mensaje de cada campo con error, tal como lo devuelve la API (por ejemplo, «measurements[0].value»). */
export function fieldErrors(e: unknown): Record<string, string> {
  return e instanceof ApiError ? Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v[0]])) : {}
}

/** Número con formato de México y, como máximo, dos decimales. */
export const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 2 })

/** Fecha corta con año (por ejemplo, «30 sept 2026») para encabezados de tablas angostas. */
export function shortDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')
}

/** Convierte lo escrito en un número (acepta coma decimal); vacío = null. */
export const toNumber = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

/** Primer día (lunes) de la semana de una fecha aaaa-mm-dd. */
export function mondayOf(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

/** Días de la cuadrícula mensual (de lunes a domingo, completando semanas). */
export function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
  const start = mondayOf(first)
  const last = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10)
  const end = mondayOf(last)
  const days: string[] = []
  for (let d = start; d <= end || days.length % 7 !== 0; ) {
    days.push(d)
    const [yy, mm, dd] = d.split('-').map(Number)
    d = new Date(Date.UTC(yy, mm - 1, dd + 1)).toISOString().slice(0, 10)
  }
  return days
}

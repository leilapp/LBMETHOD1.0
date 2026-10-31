import { SET_TYPES } from '../routines/model'

/** Textos de exportación (Excel y PDF), ya en español y con unidades, como en la versión .NET. */

export const unitName = (u: number | null) => (u === 1 ? 'kg' : u === 2 ? 'lb' : null)

/** Número con formato mexicano sin ceros sobrantes: 42.5, 60, 2.25. */
const number = (v: number, decimals: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: decimals, useGrouping: false }).format(v)

export function reps(min: number | null, max: number | null) {
  if (min === null && max === null) return null
  if (min !== null && max !== null && min !== max) return `${min}–${max}`
  return `${min ?? max}`
}

export function weight(centi: number | null, unit: number | null) {
  if (centi === null) return null
  return `${number(centi / 100, 2)} ${unitName(unit) ?? ''}`.trim()
}

export function rest(seconds: number | null) {
  if (seconds === null) return null
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`
}

export function effort(rir: number | null, rpe: number | null) {
  const parts: string[] = []
  if (rir !== null) parts.push(`RIR ${number(rir, 1)}`)
  if (rpe !== null) parts.push(`RPE ${number(rpe, 1)}`)
  return parts.length ? parts.join(' · ') : null
}

export interface SetLike {
  set_number: number
  set_type: number
  reps_min: number | null
  reps_max: number | null
  suggested_weight_centi: number | null
  suggested_weight_unit: number | null
  rest_seconds: number | null
  rir: number | null
  rpe: number | null
}

export const setTypeLabel = (t: number) => SET_TYPES[t] ?? 'Otra'

/** «S1 Calentamiento · 12 reps · 20 kg | S2 Efectiva · 8 reps · 45 lb · 2 min» */
export const setDetailText = (sets: SetLike[]) =>
  [...sets]
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => {
      const r = reps(s.reps_min, s.reps_max)
      return [`S${s.set_number} ${setTypeLabel(s.set_type)}`, r ? `${r} reps` : null, weight(s.suggested_weight_centi, s.suggested_weight_unit), rest(s.rest_seconds), effort(s.rir, s.rpe)]
        .filter((x) => x !== null)
        .join(' · ')
    })
    .join(' | ')

/** Nombre de archivo seguro: sin acentos, espacios ni signos. */
export function slug(text: string, fallback = 'rutina') {
  const ascii = text.normalize('NFD').replace(/\p{Mn}/gu, '')
  const s = ascii
    .split('')
    .map((ch) => (/[A-Za-z0-9]/.test(ch) ? ch.toLowerCase() : '-'))
    .join('')
    .split('-')
    .filter(Boolean)
    .join('-')
  return s.length === 0 ? fallback : s.slice(0, 60)
}

export const download = (bytes: Uint8Array, contentType: string, fileName: string) =>
  new Response(bytes, {
    headers: { 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}` },
  })

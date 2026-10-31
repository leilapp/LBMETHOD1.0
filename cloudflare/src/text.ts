/**
 * Normaliza nombres para compararlos sin distinguir mayúsculas ni acentos (como la intercalación de SQL Server
 * de la versión .NET): «  Sentadilla   Búlgara » y «sentadilla bulgara» son el mismo nombre.
 */
export function normalize(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Recorta y une espacios repetidos, conservando acentos y mayúsculas tal como se escribieron. */
export const clean = (value: string) => value.trim().split(/\s+/).filter(Boolean).join(' ')

/** Texto opcional: vacío o solo espacios cuenta como «sin dato». */
export function cleanOptional(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Escapa un término para usarlo dentro de LIKE '%…%' ESCAPE '\'. */
export const likeTerm = (term: string) => `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`

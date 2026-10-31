import type { Context } from 'hono'

/**
 * Respuestas de error con el mismo formato que la API .NET (ProblemDetails), para que las pantallas
 * muestren los mensajes en español sin cambios.
 */
export function problem(c: Context, status: number, title: string, detail?: string, errors?: Record<string, string[]>) {
  return c.json({ status, title, detail, errors }, status as 400, { 'Content-Type': 'application/problem+json' })
}

export const notFound = (c: Context) => problem(c, 404, 'No encontrado', 'No se encontró la información solicitada.')

export const validation = (c: Context, errors: Record<string, string[]>) => problem(c, 400, 'Datos no válidos', undefined, errors)

/** Lee el cuerpo JSON como objeto; cualquier otra cosa es un error de validación (nunca se muestra el detalle interno). */
export async function readJson(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const body = await c.req.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Texto obligatorio con longitud máxima; agrega el error al campo si no cumple. */
export function text(body: Record<string, unknown>, field: string, max: number, errors: Record<string, string[]>, required = true) {
  const raw = body[field]
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (raw !== undefined && raw !== null && typeof raw !== 'string') errors[field] = ['Debe ser texto.']
  else if (required && !value) errors[field] = ['Este campo es obligatorio.']
  else if (value.length > max) errors[field] = [`Máximo ${max} caracteres.`]
  return value
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function email(body: Record<string, unknown>, field: string, errors: Record<string, string[]>) {
  const value = text(body, field, 256, errors)
  if (value && !errors[field] && !EMAIL.test(value)) errors[field] = ['El correo no es válido.']
  return value.toLowerCase()
}

export const nowIso = () => new Date().toISOString()

/** Cabeceras de seguridad en todas las respuestas (las mismas que la versión .NET). */
export function securityHeaders(res: Response, path: string): Response {
  const out = new Response(res.body, res)
  const h = out.headers
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('X-Frame-Options', 'DENY')
  h.set('Referrer-Policy', 'no-referrer')
  h.set('Strict-Transport-Security', 'max-age=31536000')
  h.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; " +
      "connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  )
  // Los archivos de /assets llevan una huella en el nombre: se pueden guardar en caché sin quedar viejos.
  h.set('Cache-Control', path.startsWith('/assets/') && res.ok ? 'public, max-age=31536000, immutable' : 'no-store')
  return out
}

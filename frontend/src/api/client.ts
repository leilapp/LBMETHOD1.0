/**
 * Cliente HTTP de LB METHOD.
 * - Usa la cookie de sesión del mismo origen (nunca guarda tokens en localStorage).
 * - Envía el token CSRF en cada operación que modifica datos.
 * - Convierte las respuestas de error (ProblemDetails) en mensajes en español.
 */
import { saveBlob } from '../lib/saveFile'

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string[]>

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

interface ProblemDetails {
  title?: string
  detail?: string
  errors?: Record<string, string[]>
}

let csrfToken: string | null = null

/** El token queda ligado a la identidad: se descarta al iniciar o cerrar sesión. */
export function resetCsrfToken() {
  csrfToken = null
}

async function getCsrfToken(): Promise<string> {
  if (!csrfToken) {
    const res = await fetch('/api/auth/csrf', { credentials: 'same-origin' })
    if (!res.ok) throw new ApiError(res.status, 'No se pudo preparar la conexión segura. Recarga la página.')
    csrfToken = ((await res.json()) as { token: string }).token
  }
  return csrfToken
}

const statusMessages: Record<number, string> = {
  401: 'Tu sesión no es válida o ha expirado. Vuelve a iniciar sesión.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No se encontró la información solicitada.',
  409: 'La información entra en conflicto con un registro existente.',
  429: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
}

async function toError(res: Response): Promise<ApiError> {
  let problem: ProblemDetails = {}
  try {
    problem = (await res.json()) as ProblemDetails
  } catch {
    /* respuesta sin cuerpo */
  }
  const fieldErrors = problem.errors ?? {}
  const firstFieldError = Object.values(fieldErrors).flat()[0]
  const message =
    problem.detail ?? firstFieldError ?? statusMessages[res.status] ?? 'Ocurrió un error inesperado. Inténtalo de nuevo.'
  return new ApiError(res.status, message, fieldErrors)
}

async function send<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const isForm = body instanceof FormData
  if (method !== 'GET') {
    // Con FormData el navegador define el Content-Type (multipart con su separador).
    if (!isForm) headers['Content-Type'] = 'application/json'
    headers['X-CSRF-TOKEN'] = await getCsrfToken()
  }

  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: method === 'GET' ? undefined : isForm ? body : JSON.stringify(body ?? {}),
    })
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.')
  }

  // Un token CSRF vencido (p. ej. tras renovar la sesión) se renueva una sola vez.
  if (res.status === 400 && method !== 'GET' && retry) {
    const clone = res.clone()
    const problem = (await clone.json().catch(() => ({}))) as ProblemDetails
    if (problem.detail?.includes('CSRF')) {
      resetCsrfToken()
      return send<T>(method, path, body, false)
    }
  }

  if (!res.ok) throw await toError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Descarga un archivo protegido (Excel o PDF) con la sesión actual y lo guarda en el equipo. */
async function download(path: string, fallbackName: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(path, { credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.')
  }
  if (!res.ok) throw await toError(res)
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const name = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1] ?? /filename="?([^";]+)"?/i.exec(disposition)?.[1]
  await saveBlob(await res.blob(), name ? decodeURIComponent(name) : fallbackName, 0)
}

export const api = {
  get: <T>(path: string) => send<T>('GET', path),
  post: <T>(path: string, body?: unknown) => send<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => send<T>('PUT', path, body),
  del: <T>(path: string) => send<T>('DELETE', path),
  download,
}

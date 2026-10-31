import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { hmac, randomToken, sameText, sha256 } from './crypto'
import { nowIso, problem } from './http'
import type { AppBindings, Role, SessionUser } from './types'

export const SESSION_COOKIE = 'lb.session'
export const CSRF_COOKIE = 'lb.csrf'
export const CSRF_HEADER = 'X-CSRF-TOKEN'

const cookieOptions = { httpOnly: true, secure: true, sameSite: 'Strict', path: '/' } as const

/** Con contraseña temporal solo se permite consultar la sesión, cambiar la contraseña o salir (igual que en .NET). */
const ALLOWED_WITH_TEMPORARY_PASSWORD = new Set(['/api/auth/me', '/api/auth/csrf', '/api/auth/change-password', '/api/auth/logout'])

/**
 * Carga la sesión desde la cookie. La sesión se busca en D1 en cada petición, así que desactivar una cuenta
 * o cerrar sesión la invalida al instante. La caducidad se renueva mientras se usa (8 h por defecto).
 */
export const loadSession: MiddlewareHandler<AppBindings> = async (c, next) => {
  c.set('user', null)
  const token = getCookie(c, SESSION_COOKIE)
  if (token) {
    const id = await sha256(token)
    const row = await c.env.DB.prepare(
      `SELECT s.id, s.expires_at, s.last_seen_at, u.id AS user_id, u.email, u.display_name, u.role, u.must_change_password
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND u.is_enabled = 1`,
    )
      .bind(id)
      .first<{ id: string; expires_at: string; last_seen_at: string; user_id: number; email: string; display_name: string; role: Role; must_change_password: number }>()
    const now = Date.now()
    if (row && Date.parse(row.expires_at) > now) {
      c.set('user', {
        id: row.user_id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        mustChangePassword: row.must_change_password === 1,
        sessionId: row.id,
      })
      // Renovar como mucho una vez cada 5 minutos para no escribir en cada petición.
      if (now - Date.parse(row.last_seen_at) > 5 * 60_000) {
        await c.env.DB.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
          .bind(new Date(now).toISOString(), expiry(c), row.id)
          .run()
      }
    } else {
      if (row) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(row.id).run()
      deleteCookie(c, SESSION_COOKIE, cookieOptions)
    }
  }
  const user = c.get('user')
  if (user?.mustChangePassword && !ALLOWED_WITH_TEMPORARY_PASSWORD.has(c.req.path)) {
    return problem(c, 403, 'Cambio de contraseña requerido', 'Debes cambiar tu contraseña temporal antes de continuar.')
  }
  await next()
}

const expiry = (c: Context<AppBindings>) => new Date(Date.now() + Number(c.env.SESSION_HOURS) * 3_600_000).toISOString()

export async function startSession(c: Context<AppBindings>, userId: number) {
  const token = randomToken()
  const now = nowIso()
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(token), userId, now, expiry(c), now)
    .run()
  setCookie(c, SESSION_COOKIE, token, cookieOptions)
}

export async function endSession(c: Context<AppBindings>) {
  const user = c.get('user')
  if (user) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(user.sessionId).run()
  deleteCookie(c, SESSION_COOKIE, cookieOptions)
}

/**
 * Token CSRF ligado a la identidad: firma (HMAC con APP_SECRET) de una cookie aleatoria y de la sesión actual.
 * Al iniciar o cerrar sesión el token anterior deja de servir; las pantallas ya lo piden de nuevo en ese momento.
 */
export async function issueCsrfToken(c: Context<AppBindings>) {
  let secret = getCookie(c, CSRF_COOKIE)
  if (!secret) {
    secret = randomToken()
    setCookie(c, CSRF_COOKIE, secret, cookieOptions)
  }
  return hmac(c.env.APP_SECRET, `${secret}|${c.get('user')?.sessionId ?? 'anonimo'}`)
}

/** Toda operación que modifica datos en /api (incluido el inicio de sesión) exige el token CSRF. */
export const requireCsrf: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const secret = getCookie(c, CSRF_COOKIE)
    const sent = c.req.header(CSRF_HEADER)
    const expected = secret ? await hmac(c.env.APP_SECRET, `${secret}|${c.get('user')?.sessionId ?? 'anonimo'}`) : null
    if (!sent || !expected || !sameText(sent, expected)) {
      return problem(c, 400, 'Solicitud no válida', 'Falta o no es válido el token de seguridad (CSRF). Vuelve a cargar la página.')
    }
  }
  await next()
}

/** Exige sesión y, si se indica, un rol. Sin sesión: 401; rol equivocado: 403 (igual que en .NET). */
export function requireRole(role?: Role): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const user = c.get('user')
    if (!user) return problem(c, 401, 'No autorizado', 'Tu sesión no es válida o ha expirado. Vuelve a iniciar sesión.')
    if (role && user.role !== role) return problem(c, 403, 'Prohibido', 'No tienes permiso para realizar esta acción.')
    await next()
  }
}

export const currentUser = (c: Context<AppBindings>): SessionUser => c.get('user')!

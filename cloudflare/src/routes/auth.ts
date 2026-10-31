import { Hono } from 'hono'
import type { Context } from 'hono'
import { DUMMY_HASH, hashPassword, passwordProblems, verifyPassword } from '../crypto'
import { audit } from '../audit'
import { email, nowIso, problem, readJson, validation } from '../http'
import { currentUser, endSession, issueCsrfToken, requireRole, startSession } from '../session'
import type { AppBindings, Role } from '../types'

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos, o la cuenta está bloqueada temporalmente.'

export const auth = new Hono<AppBindings>()

/** Token CSRF que las pantallas envían en la cabecera X-CSRF-TOKEN. Se pide de nuevo tras iniciar o cerrar sesión. */
auth.get('/csrf', async (c) => c.json({ token: await issueCsrfToken(c) }))

auth.post('/login', async (c) => {
  if (!(await withinRateLimit(c))) {
    return problem(c, 429, 'Demasiadas solicitudes', 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.')
  }
  const body = await readJson(c)
  const errors: Record<string, string[]> = {}
  const mail = body ? email(body, 'email', errors) : ''
  const password = body && typeof body.password === 'string' ? body.password : ''
  if (!body || !password || password.length > 128) errors.password ??= ['Este campo es obligatorio.']
  if (Object.keys(errors).length) return validation(c, errors)

  const user = await c.env.DB.prepare(
    'SELECT id, password_hash, is_enabled, failed_logins, lockout_until FROM users WHERE email = ?',
  )
    .bind(mail)
    .first<{ id: number; password_hash: string; is_enabled: number; failed_logins: number; lockout_until: string | null }>()

  // Siempre se calcula una verificación, exista o no la cuenta, para que el tiempo de respuesta no lo revele.
  const passwordOk = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH)
  if (!user) {
    console.log('Inicio de sesión fallido: cuenta inexistente.')
    return problem(c, 401, 'No autorizado', INVALID_CREDENTIALS)
  }
  const locked = user.lockout_until !== null && Date.parse(user.lockout_until) > Date.now()
  if (locked || user.is_enabled !== 1 || !passwordOk) {
    if (!locked && user.is_enabled === 1) {
      const failed = user.failed_logins + 1
      const lockNow = failed >= Number(c.env.MAX_FAILED_LOGINS)
      await c.env.DB.prepare('UPDATE users SET failed_logins = ?, lockout_until = ? WHERE id = ?')
        .bind(lockNow ? 0 : failed, lockNow ? new Date(Date.now() + Number(c.env.LOCKOUT_MINUTES) * 60_000).toISOString() : null, user.id)
        .run()
    }
    console.log(`Inicio de sesión fallido para el usuario ${user.id}. Bloqueado: ${locked}. Deshabilitado: ${user.is_enabled !== 1}.`)
    return problem(c, 401, 'No autorizado', INVALID_CREDENTIALS)
  }

  await c.env.DB.prepare('UPDATE users SET failed_logins = 0, lockout_until = NULL, last_login_at = ? WHERE id = ?')
    .bind(nowIso(), user.id)
    .run()
  await startSession(c, user.id)
  console.log(`Inicio de sesión correcto del usuario ${user.id}.`)
  return c.json(await sessionFor(c, user.id))
})

auth.post('/logout', requireRole(), async (c) => {
  await endSession(c)
  return c.body(null, 204)
})

auth.get('/me', requireRole(), async (c) => c.json(await sessionFor(c, currentUser(c).id)))

auth.post('/change-password', requireRole(), async (c) => {
  const body = (await readJson(c)) ?? {}
  const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const next = typeof body.newPassword === 'string' ? body.newPassword : ''
  const user = currentUser(c)
  if (!current || !next || next.length > 128) return validation(c, { password: ['Escribe tu contraseña actual y la nueva.'] })
  if (current === next) return validation(c, { password: ['La nueva contraseña debe ser distinta de la actual.'] })

  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first<{ password_hash: string }>()
  if (!row || !(await verifyPassword(current, row.password_hash))) return validation(c, { password: ['Contraseña incorrecta.'] })
  const problems = passwordProblems(next)
  if (problems.length) return validation(c, { password: [problems.join(' ')] })

  // Cambiar la contraseña cierra las demás sesiones abiertas de esa cuenta y conserva la actual.
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').bind(await hashPassword(next), user.id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').bind(user.id, user.sessionId),
  ])
  await audit(c, 'PasswordChanged', 'User', user.id)
  return c.body(null, 204)
})

async function sessionFor(c: Context<AppBindings>, userId: number) {
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.display_name, u.email, u.role, u.must_change_password, cl.id AS client_id
       FROM users u LEFT JOIN clients cl ON cl.user_id = u.id
      WHERE u.id = ?`,
  )
    .bind(userId)
    .first<{ id: number; display_name: string; email: string; role: Role; must_change_password: number; client_id: number | null }>()
  return {
    userId: row!.id,
    displayName: row!.display_name,
    email: row!.email,
    role: row!.role,
    mustChangePassword: row!.must_change_password === 1,
    // El perfil del cliente se busca por la cuenta ya verificada, nunca por un dato recibido.
    clientId: row!.role === 'CLIENT' ? row!.client_id : null,
  }
}

/** Límite de intentos por dirección IP en ventanas de un minuto (10 por defecto), guardado en D1. */
async function withinRateLimit(c: Context<AppBindings>) {
  const ip = c.req.header('CF-Connecting-IP') ?? 'desconocida'
  const window = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString()
  const row = await c.env.DB.prepare(
    `INSERT INTO login_rate (ip, window_start, attempts) VALUES (?, ?, 1)
     ON CONFLICT (ip, window_start) DO UPDATE SET attempts = attempts + 1
     RETURNING attempts`,
  )
    .bind(ip, window)
    .first<{ attempts: number }>()
  // Limpieza ocasional de ventanas viejas.
  if (Math.random() < 0.05) await c.env.DB.prepare('DELETE FROM login_rate WHERE window_start < ?').bind(window).run()
  return (row?.attempts ?? 1) <= Number(c.env.LOGIN_REQUESTS_PER_MINUTE)
}

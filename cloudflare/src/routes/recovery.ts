import { Hono } from 'hono'
import type { Context } from 'hono'
import { audit } from '../audit'
import { DUMMY_HASH, hashPassword, normalizeRecoveryCode, passwordProblems, recoveryCode, sha256, verifyPassword } from '../crypto'
import { email, nowIso, problem, readJson, validation } from '../http'
import { currentUser } from '../session'
import type { AppBindings } from '../types'
import { withinRateLimit } from './auth'

/**
 * «Olvidé mi contraseña» sin correo electrónico (todavía no se envían correos).
 *
 * Solo la cuenta de la entrenadora (rol TRAINER) puede recuperar su contraseña sola, con uno de sus códigos de
 * recuperación de un solo uso. Los clientes no: su entrenadora les da una contraseña temporal nueva desde su ficha.
 * Los códigos se generan en Configuración (con la contraseña actual) y se muestran una sola vez.
 *
 * Protección: mismo límite por IP que el inicio de sesión (10 por minuto) y cada código equivocado cuenta como un
 * intento fallido de la cuenta (bloqueo de 15 minutos tras 5), además de que cada código tiene unos 59 bits al azar.
 */
const CODES_PER_SET = 10
const INVALID_CODE = 'El correo o el código de recuperación no son válidos, o la cuenta está bloqueada temporalmente.'

/** Rutas públicas: /api/auth/recovery/... */
export const recovery = new Hono<AppBindings>()

/**
 * Detecta qué hacer con el correo escrito: si es la entrenadora, pide un código; para cualquier otro correo
 * (cliente o inexistente) indica que pida a su entrenadora una contraseña temporal.
 */
recovery.post('/check', async (c) => {
  if (!(await withinRateLimit(c))) return tooMany(c)
  const body = await readJson(c)
  const errors: Record<string, string[]> = {}
  const mail = body ? email(body, 'email', errors) : ''
  if (!body || Object.keys(errors).length) return validation(c, Object.keys(errors).length ? errors : { email: ['Este campo es obligatorio.'] })
  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ? AND role = 'TRAINER' AND is_enabled = 1").bind(mail).first()
  return c.json({ method: user ? 'recovery-code' : 'ask-trainer' })
})

recovery.post('/reset', async (c) => {
  if (!(await withinRateLimit(c))) return tooMany(c)
  const body = await readJson(c)
  const errors: Record<string, string[]> = {}
  const mail = body ? email(body, 'email', errors) : ''
  const code = body && typeof body.code === 'string' ? normalizeRecoveryCode(body.code) : ''
  const next = body && typeof body.newPassword === 'string' ? body.newPassword : ''
  if (!code || code.length > 40) errors.code = ['Escribe uno de tus códigos de recuperación.']
  if (!next || next.length > 128) errors.newPassword = ['Escribe tu nueva contraseña.']
  else if (passwordProblems(next).length) errors.newPassword = [passwordProblems(next).join(' ')]
  if (!body || Object.keys(errors).length) return validation(c, errors)

  const user = await c.env.DB.prepare(
    "SELECT id, is_enabled, failed_logins, lockout_until FROM users WHERE email = ? AND role = 'TRAINER'",
  )
    .bind(mail)
    .first<{ id: number; is_enabled: number; failed_logins: number; lockout_until: string | null }>()
  const codeHash = await sha256(code)
  if (!user) {
    await verifyPassword(next, DUMMY_HASH) // mismo tiempo de respuesta exista o no la cuenta
    return validation(c, { code: [INVALID_CODE] })
  }
  const locked = user.lockout_until !== null && Date.parse(user.lockout_until) > Date.now()
  const row = await c.env.DB.prepare('SELECT id FROM recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL')
    .bind(user.id, codeHash)
    .first<{ id: number }>()
  if (locked || user.is_enabled !== 1 || !row) {
    if (!locked && user.is_enabled === 1) {
      const failed = user.failed_logins + 1
      const lockNow = failed >= Number(c.env.MAX_FAILED_LOGINS)
      await c.env.DB.prepare('UPDATE users SET failed_logins = ?, lockout_until = ? WHERE id = ?')
        .bind(lockNow ? 0 : failed, lockNow ? new Date(Date.now() + Number(c.env.LOCKOUT_MINUTES) * 60_000).toISOString() : null, user.id)
        .run()
    }
    console.log(`Recuperación fallida para el usuario ${user.id}. Bloqueado: ${locked}.`)
    return validation(c, { code: [INVALID_CODE] })
  }

  // Se marca el código como usado primero: si llegan dos peticiones con el mismo código, solo una gana.
  const used = await c.env.DB.prepare('UPDATE recovery_codes SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(nowIso(), row.id).run()
  if (used.meta.changes !== 1) return validation(c, { code: [INVALID_CODE] })
  // Nueva contraseña, sin bloqueo, y se cierran todas las sesiones abiertas (por si alguien más tenía una).
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, failed_logins = 0, lockout_until = NULL WHERE id = ?').bind(
      await hashPassword(next),
      user.id,
    ),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
  ])
  const remaining = await countRemaining(c, user.id)
  await c.env.DB.prepare('INSERT INTO audit_logs (occurred_at, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(nowIso(), user.id, 'PasswordRecoveredWithCode', 'User', String(user.id), `Códigos sin usar: ${remaining}`)
    .run()
  return c.json({ remainingCodes: remaining })
})

/** Rutas de la entrenadora con sesión: /api/trainer/recovery-codes */
export const recoveryCodes = new Hono<AppBindings>()

recoveryCodes.get('/', async (c) => {
  const user = currentUser(c)
  const row = await c.env.DB.prepare(
    'SELECT COUNT(*) AS total, SUM(CASE WHEN used_at IS NULL THEN 1 ELSE 0 END) AS remaining, MAX(created_at) AS generated_at FROM recovery_codes WHERE user_id = ?',
  )
    .bind(user.id)
    .first<{ total: number; remaining: number | null; generated_at: string | null }>()
  return c.json({ total: row?.total ?? 0, remaining: row?.remaining ?? 0, generatedAt: row?.generated_at ?? null })
})

/** Genera un juego nuevo (los anteriores dejan de servir). Pide la contraseña actual. Los códigos solo se ven aquí. */
recoveryCodes.post('/', async (c) => {
  const user = currentUser(c)
  const body = (await readJson(c)) ?? {}
  const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  if (!current || current.length > 128) return validation(c, { currentPassword: ['Escribe tu contraseña actual.'] })
  const stored = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first<{ password_hash: string }>()
  if (!stored || !(await verifyPassword(current, stored.password_hash))) return validation(c, { currentPassword: ['Contraseña incorrecta.'] })

  const codes = Array.from({ length: CODES_PER_SET }, () => recoveryCode())
  const now = nowIso()
  const hashes = await Promise.all(codes.map((code) => sha256(normalizeRecoveryCode(code))))
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM recovery_codes WHERE user_id = ?').bind(user.id),
    ...hashes.map((h) => c.env.DB.prepare('INSERT INTO recovery_codes (user_id, code_hash, created_at) VALUES (?, ?, ?)').bind(user.id, h, now)),
  ])
  await audit(c, 'RecoveryCodesGenerated', 'User', user.id)
  return c.json({ codes, generatedAt: now })
})

async function countRemaining(c: Context<AppBindings>, userId: number) {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL').bind(userId).first<{ n: number }>()
  return row?.n ?? 0
}

const tooMany = (c: Context<AppBindings>) => problem(c, 429, 'Demasiadas solicitudes', 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.')

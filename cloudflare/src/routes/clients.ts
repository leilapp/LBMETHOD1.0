import { Hono } from 'hono'
import { audit } from '../audit'
import { hashPassword, temporaryPassword } from '../crypto'
import { email, notFound, nowIso, problem, readJson, text, validation } from '../http'
import { localDate } from '../dates'
import { currentUser } from '../session'
import type { AppBindings } from '../types'

/**
 * Clientes de la entrenadora (cuentas y perfil básico).
 * Separación de datos: TODAS las consultas filtran por trainer_id de la sesión; un cliente ajeno responde 404.
 */
export const clients = new Hono<AppBindings>()

interface ClientRow {
  id: number
  first_name: string
  last_name: string
  email: string
  status: string
  user_id: number | null
  created_at: string
}

const summary = (r: ClientRow, currentProgram: string | null = null) => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  status: r.status,
  hasAccount: r.user_id !== null,
  currentProgram,
  registeredAt: r.created_at,
})

/** Clientes de la entrenadora, con los programas que tienen vigentes hoy (puede haber varios a la vez). */
clients.get('/', async (c) => {
  const trainerId = currentUser(c).id
  const today = localDate()
  const [list, current] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT id, first_name, last_name, email, status, user_id, created_at
         FROM clients WHERE trainer_id = ? ORDER BY last_name, first_name`,
    ).bind(trainerId),
    c.env.DB.prepare(
      `SELECT a.client_id, v.title FROM routine_assignments a
         JOIN clients c ON c.id = a.client_id JOIN routine_versions v ON v.id = a.routine_version_id
        WHERE c.trainer_id = ?1 AND a.status NOT IN (3, 4, 5) AND a.start_date <= ?2 AND (a.end_date IS NULL OR a.end_date >= ?2)
        ORDER BY a.start_date DESC, a.id DESC`,
    ).bind(trainerId, today),
  ])
  const programs = new Map<number, string[]>()
  for (const r of current.results as { client_id: number; title: string }[]) programs.set(r.client_id, [...(programs.get(r.client_id) ?? []), r.title])
  return c.json((list.results as ClientRow[]).map((r) => summary(r, programs.get(r.id)?.join(' · ') ?? null)))
})

clients.get('/:clientId{[0-9]+}', async (c) => {
  const row = await owned(c.env.DB, currentUser(c).id, Number(c.req.param('clientId')))
  return row ? c.json(summary(row)) : notFound(c)
})

/** Crea el perfil básico y la cuenta del cliente. La contraseña temporal se muestra una sola vez. */
clients.post('/', async (c) => {
  const body = await readJson(c)
  if (!body) return validation(c, { body: ['Datos no válidos.'] })
  const errors: Record<string, string[]> = {}
  const firstName = text(body, 'firstName', 100, errors)
  const lastName = text(body, 'lastName', 100, errors)
  const mail = email(body, 'email', errors)
  const phone = text(body, 'phone', 30, errors, false)
  if (phone && !/^[0-9+()\-.\s]{7,30}$/.test(phone)) errors.phone = ['El teléfono no es válido.']
  if (Object.keys(errors).length) return validation(c, errors)

  const trainerId = currentUser(c).id
  const inUse = await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ? UNION SELECT 1 FROM clients WHERE email = ?')
    .bind(mail, mail)
    .first()
  if (inUse) return problem(c, 409, 'Correo en uso', 'Ya existe una cuenta con ese correo.')

  const password = temporaryPassword()
  const now = nowIso()
  // Cuenta y perfil se crean juntos (batch de D1 = una transacción): nunca queda uno sin el otro.
  const [, created] = await c.env.DB.batch<{ id: number }>([
    c.env.DB.prepare(
      `INSERT INTO users (email, display_name, password_hash, role, must_change_password, created_at)
       VALUES (?, ?, ?, 'CLIENT', 1, ?)`,
    ).bind(mail, `${firstName} ${lastName}`.trim(), await hashPassword(password), now),
    c.env.DB.prepare(
      `INSERT INTO clients (trainer_id, user_id, first_name, last_name, email, phone, created_at, updated_at)
       VALUES (?, last_insert_rowid(), ?, ?, ?, ?, ?, ?) RETURNING id`,
    ).bind(trainerId, firstName, lastName, mail, phone || null, now, now),
  ])
  const clientId = created.results[0].id
  await audit(c, 'ClientAccountCreated', 'Client', clientId)
  return c.json({ clientId, temporaryPassword: password }, 201, { Location: `/api/trainer/clients/${clientId}` })
})

clients.post('/:clientId{[0-9]+}/reset-password', async (c) => {
  const clientId = Number(c.req.param('clientId'))
  const row = await owned(c.env.DB, currentUser(c).id, clientId)
  if (!row?.user_id) return notFound(c)
  const password = temporaryPassword()
  // La contraseña anterior deja de servir y se cierran las sesiones abiertas del cliente.
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, failed_logins = 0, lockout_until = NULL WHERE id = ?').bind(
      await hashPassword(password),
      row.user_id,
    ),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.user_id),
  ])
  await audit(c, 'ClientPasswordReset', 'Client', clientId)
  return c.json({ clientId, temporaryPassword: password })
})

/** Habilita o deshabilita el acceso del cliente. Deshabilitar cierra sus sesiones y no borra datos. */
clients.post('/:clientId{[0-9]+}/access', async (c) => {
  const body = await readJson(c)
  if (!body || typeof body.enabled !== 'boolean') return validation(c, { enabled: ['Indica si el acceso queda habilitado.'] })
  const clientId = Number(c.req.param('clientId'))
  const row = await owned(c.env.DB, currentUser(c).id, clientId)
  if (!row?.user_id) return notFound(c)
  const enabled = body.enabled
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET is_enabled = ? WHERE id = ?').bind(enabled ? 1 : 0, row.user_id),
    c.env.DB.prepare('UPDATE clients SET status = ?, deactivated_at = ?, updated_at = ? WHERE id = ?').bind(
      enabled ? 'Active' : 'Inactive',
      enabled ? null : nowIso(),
      nowIso(),
      clientId,
    ),
    ...(enabled ? [] : [c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.user_id)]),
  ])
  await audit(c, enabled ? 'ClientAccessEnabled' : 'ClientAccessDisabled', 'Client', clientId)
  return c.body(null, 204)
})

function owned(db: D1Database, trainerId: number, clientId: number) {
  return db
    .prepare('SELECT id, first_name, last_name, email, status, user_id, created_at FROM clients WHERE id = ? AND trainer_id = ?')
    .bind(clientId, trainerId)
    .first<ClientRow>()
}

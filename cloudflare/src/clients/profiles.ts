import { Hono } from 'hono'
import type { Context } from 'hono'
import { addYears, isDate, localDate } from '../dates'
import { notFound, nowIso, readJson, validation } from '../http'
import { duplicate } from '../library/catalogs'
import { currentUser } from '../session'
import type { AppBindings } from '../types'
import { listAssignments } from './assignments'

/**
 * Perfil completo del cliente, observaciones privadas e historial de asignaciones (solo la entrenadora dueña; para
 * cualquier otra responde 404). Las observaciones privadas nunca se envían al cliente.
 */
export const profiles = new Hono<AppBindings>()

type Ctx = Context<AppBindings>

export const EXPERIENCE: Record<number, string> = { 1: 'Principiante', 2: 'Intermedio', 3: 'Avanzado' }
export const LOCATIONS: Record<number, string> = { 1: 'Gimnasio', 2: 'Casa', 3: 'Exterior', 4: 'Mixto' }
export const WEEK_DAYS: [number, string][] = [
  [1, 'Lunes'],
  [2, 'Martes'],
  [4, 'Miércoles'],
  [8, 'Jueves'],
  [16, 'Viernes'],
  [32, 'Sábado'],
  [64, 'Domingo'],
]
export const dayNames = (days: number) => WEEK_DAYS.filter(([flag]) => (days & flag) !== 0).map(([, label]) => label)
const MAX_NOTE = 4000

export interface ProfileRow {
  id: number
  user_id: number | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  birth_date: string | null
  height_centi: number | null
  height_unit: number | null
  weight_centi: number | null
  weight_unit: number | null
  experience_level: number | null
  goal: string | null
  training_location: number | null
  available_days: number
  session_duration_minutes: number | null
  declared_limitations: string | null
  status: string
  created_at: string
  deactivated_at: string | null
}

export const PROFILE_COLUMNS = `id, user_id, first_name, last_name, email, phone, birth_date, height_centi, height_unit, weight_centi, weight_unit,
  experience_level, goal, training_location, available_days, session_duration_minutes, declared_limitations, status, created_at, deactivated_at`

export const fromCenti = (v: number | null) => (v === null ? null : v / 100)

const ownedProfile = (c: Ctx, clientId: number) =>
  c.env.DB.prepare(`SELECT ${PROFILE_COLUMNS} FROM clients WHERE id = ? AND trainer_id = ?`).bind(clientId, currentUser(c).id).first<ProfileRow>()
const ownsClient = async (c: Ctx, clientId: number) =>
  !!(await c.env.DB.prepare('SELECT 1 FROM clients WHERE id = ? AND trainer_id = ?').bind(clientId, currentUser(c).id).first())
const clientId = (c: Ctx) => Number(c.req.param('clientId'))

profiles.get('/options', (c) =>
  c.json({
    experienceLevels: Object.entries(EXPERIENCE).map(([value, label]) => ({ value: Number(value), label })),
    trainingLocations: Object.entries(LOCATIONS).map(([value, label]) => ({ value: Number(value), label })),
    days: WEEK_DAYS.map(([value, label]) => ({ value, label })),
    weightUnits: [
      { value: 1, label: 'kg' },
      { value: 2, label: 'lb' },
    ],
    lengthUnits: [
      { value: 1, label: 'cm' },
      { value: 2, label: 'in' },
    ],
  }),
)

profiles.get('/:clientId{[0-9]+}/profile', async (c) => {
  const p = await ownedProfile(c, clientId(c))
  if (!p) return notFound(c)
  return c.json({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
    phone: p.phone,
    birthDate: p.birth_date,
    height: fromCenti(p.height_centi),
    heightUnit: p.height_unit,
    weight: fromCenti(p.weight_centi),
    weightUnit: p.weight_unit,
    experienceLevel: p.experience_level,
    experienceLabel: p.experience_level ? EXPERIENCE[p.experience_level] : null,
    goal: p.goal,
    trainingLocation: p.training_location,
    trainingLocationLabel: p.training_location ? LOCATIONS[p.training_location] : null,
    availableDays: p.available_days,
    availableDayNames: dayNames(p.available_days),
    sessionDurationMinutes: p.session_duration_minutes,
    declaredLimitations: p.declared_limitations,
    status: p.status,
    hasAccount: p.user_id !== null,
    registeredAt: p.created_at,
    deactivatedAt: p.deactivated_at,
  })
})

const opt = (s: string | null) => (s && s.trim() ? s.trim() : null)

function isEmail(value: string) {
  const v = value.trim()
  return v.length > 0 && v.length <= 256 && !/\s/.test(v) && /^[^@]+@[^@]+\.[^@]+$/.test(v) && !v.startsWith('.') && !v.includes('..')
}

/** Solo nombre, apellidos y correo son obligatorios. Cambiar el correo cambia también el correo para entrar al portal. */
profiles.put('/:clientId{[0-9]+}/profile', async (c) => {
  const body = await readJson(c)
  if (!body) return validation(c, { body: ['Datos no válidos.'] })
  const errors: Record<string, string[]> = {}
  const add = (field: string, message: string) => (errors[field] ??= []).push(message)
  const str = (field: string) => {
    const v = body[field]
    if (v !== undefined && v !== null && typeof v !== 'string') add(field, 'Debe ser texto.')
    return typeof v === 'string' ? v : null
  }
  const num = (field: string, integer: boolean) => {
    const v = body[field]
    if (v === undefined || v === null) return null
    if (typeof v !== 'number' || !Number.isFinite(v) || (integer && !Number.isInteger(v))) {
      add(field, 'Valor no válido.')
      return null
    }
    return v
  }

  const firstName = str('firstName') ?? ''
  const lastName = str('lastName') ?? ''
  const email = (str('email') ?? '').trim()
  const phone = str('phone')
  const birth = body.birthDate ?? null
  const height = num('height', false)
  const heightUnit = num('heightUnit', true)
  const weight = num('weight', false)
  const weightUnit = num('weightUnit', true)
  const experience = num('experienceLevel', true)
  const goal = str('goal')
  const location = num('trainingLocation', true)
  const days = num('availableDays', true) ?? 0
  const duration = num('sessionDurationMinutes', true)
  const limitations = str('declaredLimitations')

  if (!firstName.trim()) add('firstName', 'Escribe el nombre.')
  else if (firstName.trim().length > 100) add('firstName', 'Máximo 100 caracteres.')
  if (!lastName.trim()) add('lastName', 'Escribe los apellidos.')
  else if (lastName.trim().length > 100) add('lastName', 'Máximo 100 caracteres.')
  if (!isEmail(email)) add('email', 'Escribe un correo válido.')
  if (phone && (phone.trim().length > 30 || /[^0-9 +\-()]/.test(phone))) add('phone', 'Teléfono no válido.')
  const today = localDate()
  if (birth !== null && (!isDate(birth) || birth > today || birth < addYears(today, -110))) add('birthDate', 'Fecha de nacimiento no válida.')
  if (height !== null) {
    if (heightUnit !== 1 && heightUnit !== 2) add('heightUnit', 'Elige la unidad.')
    else if (heightUnit === 1 ? height < 50 || height > 250 : height < 20 || height > 100) add('height', heightUnit === 1 ? 'Entre 50 y 250 cm.' : 'Entre 20 y 100 in.')
  }
  if (weight !== null) {
    if (weightUnit !== 1 && weightUnit !== 2) add('weightUnit', 'Elige la unidad.')
    else if (weightUnit === 1 ? weight < 20 || weight > 400 : weight < 44 || weight > 880) add('weight', weightUnit === 1 ? 'Entre 20 y 400 kg.' : 'Entre 44 y 880 lb.')
  }
  if (experience !== null && !(experience in EXPERIENCE)) add('experienceLevel', 'Nivel no válido.')
  if (location !== null && !(location in LOCATIONS)) add('trainingLocation', 'Lugar no válido.')
  if (days < 0 || days > 127) add('availableDays', 'Días no válidos.')
  if (duration !== null && (duration < 10 || duration > 300)) add('sessionDurationMinutes', 'Entre 10 y 300 minutos.')
  if (goal && goal.length > 500) add('goal', 'Máximo 500 caracteres.')
  if (limitations && limitations.length > 2000) add('declaredLimitations', 'Máximo 2000 caracteres.')

  const id = clientId(c)
  const db = c.env.DB
  const client = await db.prepare('SELECT id, user_id, email FROM clients WHERE id = ? AND trainer_id = ?').bind(id, currentUser(c).id).first<{ id: number; user_id: number | null; email: string }>()
  if (!client) return notFound(c)
  if (Object.keys(errors).length) return validation(c, errors)

  const newEmail = email.toLowerCase()
  const emailChanged = newEmail !== client.email.toLowerCase()
  if (emailChanged) {
    const inUse = await db
      .prepare('SELECT 1 FROM clients WHERE id <> ? AND email = ? UNION ALL SELECT 1 FROM users WHERE email = ? AND id IS NOT ?')
      .bind(id, newEmail, newEmail, client.user_id)
      .first()
    if (inUse) return duplicate(c, 'email', 'Ya existe una cuenta con ese correo.')
  }

  const now = nowIso()
  const userId = currentUser(c).id
  const auditStatement = (action: string, details: string | null) =>
    db.prepare(`INSERT INTO audit_logs (occurred_at, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, 'Client', ?, ?)`).bind(now, userId, action, String(id), details)
  const name = `${firstName.trim()} ${lastName.trim()}`
  try {
    // Perfil y cuenta juntos (una transacción): el correo para entrar siempre es el del perfil.
    await db.batch([
      ...(client.user_id === null
        ? []
        : [
            db.prepare('UPDATE users SET email = ?, display_name = ? WHERE id = ?').bind(newEmail, name, client.user_id),
            ...(emailChanged ? [auditStatement('ClientEmailChanged', null)] : []),
          ]),
      db
        .prepare(
          `UPDATE clients SET first_name = ?, last_name = ?, email = ?, phone = ?, birth_date = ?, height_centi = ?, height_unit = ?, weight_centi = ?,
                  weight_unit = ?, experience_level = ?, goal = ?, training_location = ?, available_days = ?, session_duration_minutes = ?,
                  declared_limitations = ?, updated_at = ?
            WHERE id = ?`,
        )
        .bind(
          firstName.trim(), lastName.trim(), newEmail, opt(phone), birth,
          height === null ? null : Math.round(height * 100), height === null ? null : heightUnit,
          weight === null ? null : Math.round(weight * 100), weight === null ? null : weightUnit,
          experience, opt(goal), location, days, duration, opt(limitations), now, id,
        ),
      auditStatement('ClientProfileUpdated', emailChanged ? 'correo cambiado' : null),
    ])
  } catch (err) {
    // Otro registro tomó el correo mientras tanto.
    if (/UNIQUE constraint failed/i.test(String(err))) return duplicate(c, 'email', 'Ya existe una cuenta con ese correo.')
    throw err
  }
  return c.body(null, 204)
})

/** Observaciones privadas: solo la entrenadora las ve. No se editan ni se borran (historial). */
profiles.get('/:clientId{[0-9]+}/notes', async (c) => {
  if (!(await ownsClient(c, clientId(c)))) return notFound(c)
  const { results } = await c.env.DB.prepare('SELECT id, content, created_at FROM client_notes WHERE client_id = ? ORDER BY created_at DESC, id DESC')
    .bind(clientId(c))
    .all<{ id: number; content: string; created_at: string }>()
  return c.json(results.map((n) => ({ id: n.id, content: n.content, createdAt: n.created_at })))
})

profiles.post('/:clientId{[0-9]+}/notes', async (c) => {
  if (!(await ownsClient(c, clientId(c)))) return notFound(c)
  const body = (await readJson(c)) ?? {}
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return validation(c, { content: ['Escribe la observación.'] })
  if (content.length > MAX_NOTE) return validation(c, { content: [`Máximo ${MAX_NOTE} caracteres.`] })
  const now = nowIso()
  const row = await c.env.DB.prepare('INSERT INTO client_notes (client_id, author_user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .bind(clientId(c), currentUser(c).id, content, now, now)
    .first<{ id: number }>()
  return c.json({ id: row!.id }, 201)
})

profiles.get('/:clientId{[0-9]+}/assignments', async (c) => {
  if (!(await ownsClient(c, clientId(c)))) return notFound(c)
  return c.json(await listAssignments(c.env.DB, 'a.client_id = ? AND c.trainer_id = ?', [clientId(c), currentUser(c).id]))
})

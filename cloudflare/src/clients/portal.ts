import { Hono } from 'hono'
import type { Context } from 'hono'
import { notFound } from '../http'
import { currentUser } from '../session'
import type { AppBindings } from '../types'
import { listAssignments } from './assignments'
import { dayNames, EXPERIENCE, fromCenti, LOCATIONS, PROFILE_COLUMNS, type ProfileRow } from './profiles'

/**
 * Portal del cliente: siempre trabaja con el perfil de la sesión actual, sin recibir ids. Nunca incluye las
 * observaciones privadas de la entrenadora.
 */
export const portalProfile = new Hono<AppBindings>()

export const currentClient = (c: Context<AppBindings>) =>
  c.env.DB.prepare(`SELECT ${PROFILE_COLUMNS} FROM clients WHERE user_id = ?`).bind(currentUser(c).id).first<ProfileRow>()

portalProfile.get('/profile', async (c) => {
  const p = await currentClient(c)
  if (!p) return notFound(c)
  return c.json({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
    phone: p.phone,
    birthDate: p.birth_date,
    goal: p.goal,
    declaredLimitations: p.declared_limitations,
    height: fromCenti(p.height_centi),
    heightUnit: p.height_unit === null ? null : p.height_unit === 1 ? 'cm' : 'in',
    weight: fromCenti(p.weight_centi),
    weightUnit: p.weight_unit === null ? null : p.weight_unit === 1 ? 'kg' : 'lb',
    experience: p.experience_level ? EXPERIENCE[p.experience_level] : null,
    trainingLocation: p.training_location ? LOCATIONS[p.training_location] : null,
    availableDays: dayNames(p.available_days),
    sessionDurationMinutes: p.session_duration_minutes,
    registeredAt: p.created_at,
  })
})

/** Asignaciones del propio cliente: la actual y las anteriores. No ve las canceladas (suelen ser errores de captura). */
portalProfile.get('/assignments', async (c) => {
  const p = await currentClient(c)
  if (!p) return notFound(c)
  const all = await listAssignments(c.env.DB, 'a.client_id = ?', [p.id])
  return c.json(
    all
      .filter((a) => a.status !== 'Cancelled')
      .map((a) => ({ id: a.id, routineName: a.routineName, versionNumber: a.versionNumber, startDate: a.startDate, endDate: a.endDate, status: a.status, statusLabel: a.statusLabel, notes: a.notes })),
  )
})

import type { Context } from 'hono'
import { nowIso } from './http'
import type { AppBindings } from './types'

/** Bitácora de auditoría: quién hizo qué y cuándo. Nunca guarda contraseñas ni datos sensibles. */
export async function audit(c: Context<AppBindings>, action: string, entityType: string, entityId: number | string | null, details?: string) {
  await c.env.DB.prepare('INSERT INTO audit_logs (occurred_at, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(nowIso(), c.get('user')?.id ?? null, action, entityType, entityId === null ? null : String(entityId), details ?? null)
    .run()
}

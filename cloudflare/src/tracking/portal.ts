import { Hono } from 'hono'
import type { Context } from 'hono'
import { notFound } from '../http'
import { serveObject } from '../library/media'
import { currentUser } from '../session'
import type { AppBindings } from '../types'
import { buildCalendar, checkRange } from './calendar'
import { buildProgress, evaluationsOf, photosOf } from './shared'

/** Progreso, evaluaciones, fotos y calendario del propio cliente (solo lectura). Nunca se aceptan ids de cliente. */
export const trackingPortal = new Hono<AppBindings>()

const photoUrl = (id: number) => `/api/portal/photos/${id}/content`

async function clientId(c: Context<AppBindings>) {
  const row = await c.env.DB.prepare('SELECT id FROM clients WHERE user_id = ?').bind(currentUser(c).id).first<{ id: number }>()
  return row?.id ?? null
}

trackingPortal.get('/progress', async (c) => {
  const id = await clientId(c)
  return id === null ? notFound(c) : c.json(await buildProgress(c.env.DB, id))
})

trackingPortal.get('/evaluations', async (c) => {
  const id = await clientId(c)
  return id === null ? notFound(c) : c.json(await evaluationsOf(c.env.DB, id, photoUrl))
})

trackingPortal.get('/photos', async (c) => {
  const id = await clientId(c)
  return id === null ? notFound(c) : c.json(await photosOf(c.env.DB, id, photoUrl))
})

/** Foto privada: solo si es de la propia clienta. */
trackingPortal.get('/photos/:id{[0-9]+}/content', async (c) => {
  const file = await c.env.DB.prepare(
    `SELECT f.storage_key, f.content_type FROM progress_photos p JOIN stored_files f ON f.id = p.stored_file_id JOIN clients c ON c.id = p.client_id
      WHERE p.id = ? AND c.user_id = ? AND f.deleted_at IS NULL`,
  )
    .bind(Number(c.req.param('id')), currentUser(c).id)
    .first<{ storage_key: string; content_type: string }>()
  if (!file) return notFound(c)
  return serveObject(c, file.storage_key, file.content_type)
})

trackingPortal.get('/calendar', async (c) => {
  const from = c.req.query('from')
  const to = c.req.query('to')
  const invalid = checkRange(c, from, to)
  if (invalid) return invalid
  const id = await clientId(c)
  if (id === null) return notFound(c)
  return c.json(await buildCalendar(c.env.DB, from!, to!, { trainerId: null, clientId: id }))
})

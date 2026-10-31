import { Hono } from 'hono'
import type { Context } from 'hono'
import { audit } from '../audit'
import { notFound, nowIso, readJson, validation } from '../http'
import { currentUser } from '../session'
import { cleanOptional } from '../text'
import type { AppBindings } from '../types'
import { exists } from './exercises'

/**
 * Imágenes y videos de los ejercicios. Los archivos se guardan en R2 (privado) con un nombre aleatorio; el tipo se
 * comprueba por su contenido real (no por la extensión) y se limita el tamaño. También se aceptan enlaces https
 * (por ejemplo, un video no listado de YouTube).
 */
export const exerciseMedia = new Hono<AppBindings>()
export const mediaContent = new Hono<AppBindings>()

const SIGNATURES: { contentType: string; extension: string; type: 1 | 2; matches: (b: Uint8Array) => boolean }[] = [
  { contentType: 'image/jpeg', extension: '.jpg', type: 1, matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { contentType: 'image/png', extension: '.png', type: 1, matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { contentType: 'image/webp', extension: '.webp', type: 1, matches: (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP') },
  { contentType: 'video/mp4', extension: '.mp4', type: 2, matches: (b) => ascii(b, 4, 'ftyp') },
  { contentType: 'video/webm', extension: '.webm', type: 2, matches: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]) },
]
const startsWith = (b: Uint8Array, sig: number[]) => b.length >= sig.length && sig.every((x, i) => b[i] === x)
const ascii = (b: Uint8Array, offset: number, text: string) => b.length >= offset + text.length && [...text].every((ch, i) => b[offset + i] === ch.charCodeAt(0))

/** Detecta el tipo real por los primeros bytes. Se comparte con las fotos de progreso (etapa 6). */
export function detect(header: Uint8Array) {
  return SIGNATURES.find((s) => s.matches(header)) ?? null
}

/** Nombre de archivo seguro para mostrar (letras, números, espacios, guiones), con la extensión del tipo real. */
export function safeFileName(name: string, extension: string) {
  const base = (name.split(/[\\/]/).pop() ?? '').replace(/\.[^.]*$/, '')
  let clean = [...base].filter((ch) => /[\p{L}\p{N} _-]/u.test(ch)).join('').trim()
  if (!clean) clean = 'archivo'
  return clean.slice(0, 100) + extension
}

/** Sube una imagen (JPG, PNG, WEBP) o un video (MP4, WEBM). */
exerciseMedia.post('/:id{[0-9]+}/media', async (c) => {
  const id = Number(c.req.param('id'))
  if (!(await exists(c.env.DB, id))) return notFound(c)
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return validation(c, { file: ['Selecciona un archivo.'] })
  }
  const file = form.get('file')
  const title = form.get('title')
  if (!(file instanceof File) || file.size === 0) return validation(c, { file: ['Selecciona un archivo.'] })
  if (typeof title === 'string' && title.length > 150) return validation(c, { title: ['Máximo 150 caracteres.'] })

  const signature = detect(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!signature) return validation(c, { file: ['Formato no permitido. Imágenes: JPG, PNG o WEBP. Videos: MP4 o WEBM.'] })
  const max = Number(signature.type === 1 ? c.env.MAX_IMAGE_BYTES : c.env.MAX_VIDEO_BYTES)
  if (file.size > max)
    return validation(c, { file: [`El archivo supera el máximo de ${Math.floor(max / (1024 * 1024))} MB para ${signature.type === 1 ? 'imágenes' : 'videos'}.`] })

  const fileId = crypto.randomUUID()
  const key = `exercises/${fileId.replace(/-/g, '')}${signature.extension}`
  await c.env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: signature.contentType } })
  const now = nowIso()
  try {
    const [, inserted] = await c.env.DB.batch<{ id: number }>([
      c.env.DB.prepare(
        `INSERT INTO stored_files (id, purpose, uploaded_by_user_id, original_file_name, content_type, size_bytes, storage_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(fileId, signature.type === 1 ? 'ExerciseImage' : 'ExerciseVideo', currentUser(c).id, safeFileName(file.name, signature.extension),
        signature.contentType, file.size, key, now),
      c.env.DB.prepare(
        `INSERT INTO exercise_media (exercise_id, media_type, stored_file_id, title, sort_order)
         VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM exercise_media WHERE exercise_id = ?)) RETURNING id`,
      ).bind(id, signature.type, fileId, cleanOptional(title), id),
    ])
    await audit(c, 'ExerciseMediaUploaded', 'Exercise', id)
    return c.json({ id: inserted.results[0].id }, 201)
  } catch (err) {
    await c.env.MEDIA.delete(key) // no dejar archivos huérfanos
    throw err
  }
})

/** Agrega un enlace externo (por ejemplo, un video de YouTube). Solo se aceptan enlaces https. */
exerciseMedia.post('/:id{[0-9]+}/media/link', async (c) => {
  const id = Number(c.req.param('id'))
  if (!(await exists(c.env.DB, id))) return notFound(c)
  const body = (await readJson(c)) ?? {}
  const type = body.mediaType
  if (type !== 1 && type !== 2) return validation(c, { mediaType: ['Tipo de medio no válido.'] })
  const title = cleanOptional(body.title)
  if (title && title.length > 150) return validation(c, { title: ['Máximo 150 caracteres.'] })
  let url: URL | null = null
  try {
    url = typeof body.url === 'string' && body.url.length <= 1000 ? new URL(body.url.trim()) : null
  } catch {
    url = null
  }
  if (!url || url.protocol !== 'https:') return validation(c, { url: ['Escribe un enlace completo y seguro que empiece con https://'] })

  const row = await c.env.DB.prepare(
    `INSERT INTO exercise_media (exercise_id, media_type, external_url, title, sort_order)
     VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM exercise_media WHERE exercise_id = ?)) RETURNING id`,
  )
    .bind(id, type, url.toString(), title, id)
    .first<{ id: number }>()
  await audit(c, 'ExerciseMediaLinked', 'Exercise', id)
  return c.json({ id: row!.id }, 201)
})

/** Quita el medio del ejercicio y borra el archivo de R2; el registro del archivo queda marcado como borrado. */
exerciseMedia.delete('/:id{[0-9]+}/media/:mediaId{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const mediaId = Number(c.req.param('mediaId'))
  const media = await c.env.DB.prepare(
    `SELECT m.stored_file_id, f.storage_key FROM exercise_media m LEFT JOIN stored_files f ON f.id = m.stored_file_id
      WHERE m.id = ? AND m.exercise_id = ?`,
  )
    .bind(mediaId, id)
    .first<{ stored_file_id: string | null; storage_key: string | null }>()
  if (!media) return notFound(c)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM exercise_media WHERE id = ?').bind(mediaId),
    ...(media.stored_file_id ? [c.env.DB.prepare('UPDATE stored_files SET deleted_at = ? WHERE id = ?').bind(nowIso(), media.stored_file_id)] : []),
  ])
  await audit(c, 'ExerciseMediaDeleted', 'Exercise', id)
  if (media.storage_key) await c.env.MEDIA.delete(media.storage_key)
  return c.body(null, 204)
})

/**
 * Entrega los archivos privados de la biblioteca. No existen direcciones públicas: cada descarga pasa por aquí y
 * exige sesión de entrenadora. Admite Range para adelantar videos sin descargarlos completos.
 */
mediaContent.get('/:mediaId{[0-9]+}/content', async (c) => {
  const file = await c.env.DB.prepare(
    `SELECT f.storage_key, f.content_type FROM exercise_media m JOIN stored_files f ON f.id = m.stored_file_id
      WHERE m.id = ? AND f.deleted_at IS NULL`,
  )
    .bind(Number(c.req.param('mediaId')))
    .first<{ storage_key: string; content_type: string }>()
  if (!file) return notFound(c)
  return serveObject(c, file.storage_key, file.content_type)
})

/** Sirve un objeto privado de R2 con soporte de Range (206) y sin caché. */
export async function serveObject(c: Context<AppBindings>, key: string, contentType: string) {
  let range = parseRange(c.req.header('Range'))
  if (range && 'suffix' in range) {
    // «Los últimos N bytes»: se convierte a inicio y largo con el tamaño real del archivo.
    const head = await c.env.MEDIA.head(key)
    if (!head) return notFound(c)
    const length = Math.min(range.suffix, head.size)
    range = { offset: head.size - length, length }
  }
  const object = range ? await c.env.MEDIA.get(key, { range }) : await c.env.MEDIA.get(key)
  if (!object) return notFound(c)
  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Disposition': 'inline',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
  })
  if (range && object.range && 'offset' in object.range) {
    const offset = object.range.offset ?? 0
    const length = object.range.length ?? object.size - offset
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`)
    headers.set('Content-Length', String(length))
    return new Response(object.body, { status: 206, headers })
  }
  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { status: 200, headers })
}

function parseRange(header: string | undefined): R2Range | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/)
  if (!match || (!match[1] && !match[2])) return null
  if (!match[1]) return { suffix: Number(match[2]) }
  const offset = Number(match[1])
  return match[2] ? { offset, length: Number(match[2]) - offset + 1 } : { offset }
}

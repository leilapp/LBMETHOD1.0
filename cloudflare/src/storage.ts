import type { Env } from './types'

/**
 * Archivos privados (imágenes y videos de ejercicios, fotos de progreso). Nunca tienen dirección pública: solo salen
 * por la API, con permisos.
 *
 * Dónde se guardan:
 *  - FILES (Workers KV): el espacio gratuito, sin medio de pago. Es el que se usa hoy.
 *  - MEDIA (R2): si algún día se activa R2 y se agrega su binding en wrangler.jsonc, se usa R2 en su lugar.
 *
 * En KV cada archivo se guarda en partes de 4 MB (KV admite hasta 25 MB por valor). Así se puede entregar un trozo
 * (Range, para adelantar un video) leyendo solo las partes necesarias. La clave principal guarda un índice pequeño:
 *   <clave>          → {"size":…, "parts":…, "partSize":…, "contentType":…}
 *   <clave>:parte:N  → bytes de la parte N
 */
export const PART_SIZE = 4 * 1024 * 1024

export type FileRange = { offset: number; length?: number } | { suffix: number }

export interface StoredObject {
  body: ReadableStream
  size: number
  /** Solo si se pidió un trozo. */
  range?: { offset: number; length: number }
}

interface KvIndex {
  size: number
  parts: number
  partSize: number
  contentType: string
}

const partKey = (key: string, n: number) => `${key}:parte:${n}`

export async function putFile(env: Env, key: string, file: Blob, contentType: string) {
  if (env.MEDIA) {
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType } })
    return
  }
  const kv = requireKv(env)
  const parts = Math.max(1, Math.ceil(file.size / PART_SIZE))
  try {
    for (let n = 0; n < parts; n++) await kv.put(partKey(key, n), await file.slice(n * PART_SIZE, (n + 1) * PART_SIZE).arrayBuffer())
    const index: KvIndex = { size: file.size, parts, partSize: PART_SIZE, contentType }
    await kv.put(key, JSON.stringify(index))
  } catch (err) {
    await deleteParts(kv, key, parts) // no dejar partes sueltas si algo falló a la mitad
    throw err
  }
}

export async function deleteFile(env: Env, key: string) {
  if (env.MEDIA) {
    await env.MEDIA.delete(key)
    return
  }
  const kv = requireKv(env)
  const index = await kv.get<KvIndex>(key, 'json')
  if (!index) return
  await kv.delete(key)
  await deleteParts(kv, key, index.parts)
}

/** Lee el archivo completo o un trozo. Devuelve null si no existe. */
export async function getFile(env: Env, key: string, range: FileRange | null): Promise<StoredObject | null> {
  if (env.MEDIA) return getFromR2(env.MEDIA, key, range)
  const kv = requireKv(env)
  const index = await kv.get<KvIndex>(key, 'json')
  if (!index) return null
  let start = 0
  let end = index.size // exclusivo
  if (range) {
    if ('suffix' in range) start = Math.max(0, index.size - range.suffix)
    else {
      start = Math.min(range.offset, index.size)
      end = range.length === undefined ? index.size : Math.min(index.size, range.offset + range.length)
    }
  }
  const first = Math.floor(start / index.partSize)
  const last = end > start ? Math.floor((end - 1) / index.partSize) : first - 1
  let n = first
  // Las partes se leen una por una conforme el navegador recibe los datos, para no cargar el video entero en memoria.
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (n > last) return controller.close()
      const data = await kv.get(partKey(key, n), 'arrayBuffer')
      if (!data) return controller.error(new Error(`Falta la parte ${n} de ${key}`))
      const partStart = n * index.partSize
      const from = Math.max(start - partStart, 0)
      const to = Math.min(end - partStart, data.byteLength)
      controller.enqueue(new Uint8Array(data, from, to - from))
      n++
    },
  })
  // Con un largo fijo, el navegador recibe Content-Length (sabe cuánto falta y puede adelantar el video).
  const fixed = new FixedLengthStream(Math.max(0, end - start))
  void body.pipeTo(fixed.writable).catch(() => undefined)
  return { body: fixed.readable, size: index.size, range: range ? { offset: start, length: end - start } : undefined }
}

async function getFromR2(bucket: R2Bucket, key: string, requested: FileRange | null): Promise<StoredObject | null> {
  let range = requested
  if (range && 'suffix' in range) {
    // «Los últimos N bytes»: se convierte a inicio y largo con el tamaño real del archivo.
    const head = await bucket.head(key)
    if (!head) return null
    const length = Math.min(range.suffix, head.size)
    range = { offset: head.size - length, length }
  }
  const object = range ? await bucket.get(key, { range }) : await bucket.get(key)
  if (!object) return null
  if (range && object.range && 'offset' in object.range) {
    const offset = object.range.offset ?? 0
    const length = object.range.length ?? object.size - offset
    return { body: object.body, size: object.size, range: { offset, length } }
  }
  return { body: object.body, size: object.size }
}

async function deleteParts(kv: KVNamespace, key: string, parts: number) {
  for (let n = 0; n < parts; n++) await kv.delete(partKey(key, n)).catch(() => undefined)
}

function requireKv(env: Env) {
  if (!env.FILES) throw new Error('No hay espacio de archivos configurado (binding FILES en wrangler.jsonc).')
  return env.FILES
}

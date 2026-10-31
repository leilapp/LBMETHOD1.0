// Lectura y escritura de archivos privados en Workers KV desde la terminal, con el mismo formato que src/storage.ts:
//   <clave>          → {"size":…, "parts":…, "partSize":…, "contentType":…}
//   <clave>:parte:N  → bytes de la parte N (4 MB cada una)
// Lo usan scripts/backup.mjs y scripts/restore.mjs. `run(...args)` ejecuta wrangler y devuelve su salida como Buffer.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const PART_SIZE = 4 * 1024 * 1024
const partKey = (key, n) => `${key}:parte:${n}`

/** Devuelve los bytes del archivo, o null si no existe. */
export function readKvFile(run, target, key) {
  let index
  try {
    index = JSON.parse(run('kv', 'key', 'get', key, ...target).toString('utf8'))
  } catch {
    return null // wrangler responde «Value not found» si la clave no existe
  }
  if (!index || typeof index.parts !== 'number') return null
  const parts = []
  for (let n = 0; n < index.parts; n++) parts.push(run('kv', 'key', 'get', partKey(key, n), ...target))
  const bytes = Buffer.concat(parts)
  if (bytes.length !== index.size) throw new Error(`El archivo ${key} está incompleto en KV (${bytes.length} de ${index.size} bytes).`)
  return bytes
}

/** Guarda el archivo en partes y al final su índice (si algo falla antes, el archivo no aparece como existente). */
export function writeKvFile(run, target, key, bytes, contentType) {
  const work = mkdtempSync(join(tmpdir(), 'lbmethod-kv-'))
  try {
    const parts = Math.max(1, Math.ceil(bytes.length / PART_SIZE))
    for (let n = 0; n < parts; n++) {
      const file = join(work, `parte-${n}`)
      writeFileSync(file, bytes.subarray(n * PART_SIZE, (n + 1) * PART_SIZE))
      run('kv', 'key', 'put', partKey(key, n), '--path', file, ...target)
    }
    const index = join(work, 'indice.json')
    writeFileSync(index, JSON.stringify({ size: bytes.length, parts, partSize: PART_SIZE, contentType }))
    run('kv', 'key', 'put', key, '--path', index, ...target)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

/** Id del espacio KV de archivos que está en wrangler.jsonc. */
export function kvNamespaceId(root) {
  return readFileSync(join(root, 'wrangler.jsonc'), 'utf8').match(/"binding":\s*"FILES",\s*"id":\s*"([^"]+)"/)[1]
}

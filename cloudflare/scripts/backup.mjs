// Respaldo completo de LB METHOD en Cloudflare: la base D1 (todas las tablas, con su historial) y los archivos privados
// de R2 (imágenes, videos y fotos de progreso). Nada se borra ni se cambia: solo se lee.
//   npm run backup              → respalda la base y los archivos de Cloudflare (requiere «npx wrangler login»)
//   npm run backup -- --local   → respalda la copia local de «wrangler dev» (para probar)
// Resultado: respaldos/AAAA-MM-DD_HHMMSS/ con
//   lbmethod.sql     exportación completa de D1 (esquema, datos, historial y estado de migraciones)
//   archivos/<clave> cada archivo de R2 registrado en la base
//   manifiesto.json  fecha, conteo de filas por tabla y huella SHA-256 de cada archivo (para comprobar la restauración)
// La carpeta respaldos/ está en .gitignore: contiene datos personales de las clientas y nunca debe subirse a Git.
// Guárdala cifrada (por ejemplo, en una unidad con BitLocker) y en un segundo lugar.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const local = args.includes('--local')
const where = local ? '--local' : '--remote'
const outIndex = args.indexOf('--out')
const DATABASE = 'lbmethod'
const BUCKET = 'lbmethod-media'

const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'medium' })
  .format(new Date())
  .replace(' ', '_')
  .replace(/:/g, '')
const dir = outIndex >= 0 ? resolve(args[outIndex + 1]) : join(root, 'respaldos', `${stamp}${local ? '_local' : ''}`)
if (existsSync(dir)) {
  console.error(`La carpeta ${dir} ya existe; no se sobrescribe un respaldo.`)
  process.exit(1)
}
mkdirSync(join(dir, 'archivos'), { recursive: true })

const wrangler = (...a) => execFileSync('npx', ['wrangler', ...a], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 })
const query = (sql) => JSON.parse(wrangler('d1', 'execute', DATABASE, where, '--json', '--command', sql))[0].results

console.log(`Respaldando ${local ? 'la copia local' : 'Cloudflare'} en ${dir}`)

// 1. Base de datos completa.
const tables = query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").map((r) => r.name)
if (tables.every((t) => t === 'd1_migrations')) {
  // Base recién creada (antes de la primera migración): no hay datos ni archivos que respaldar.
  writeFileSync(join(dir, 'manifiesto.json'), JSON.stringify({ createdAt: new Date().toISOString(), source: local ? 'local' : 'cloudflare', empty: true, rows: {}, files: [] }, null, 2))
  console.log('  la base todavía no tiene tablas de LB METHOD; respaldo vacío guardado.')
  process.exit(0)
}
const sqlFile = join(dir, 'lbmethod.sql')
wrangler('d1', 'export', DATABASE, where, '--output', sqlFile, '-y')
const rows = {}
// Una sola fila con un conteo por columna (D1 no admite más de 5 SELECT unidos con UNION).
Object.assign(rows, query(`SELECT ${tables.map((t) => `(SELECT COUNT(*) FROM "${t}") AS "${t}"`).join(', ')}`)[0])
console.log(`  base: ${tables.length} tablas, ${Object.values(rows).reduce((a, b) => a + b, 0)} filas`)

// 2. Archivos de R2. Se respaldan todos los registrados, también los marcados como eliminados si aún existen.
const files = tables.includes('stored_files') ? query('SELECT id, storage_key, content_type, size_bytes, deleted_at FROM stored_files ORDER BY created_at, id') : []
const saved = []
const missing = []
for (const f of files) {
  if (!/^[a-z]+\/[0-9a-f]+\.[a-z0-9]+$/.test(f.storage_key)) throw new Error(`Clave de archivo inesperada: ${f.storage_key}`)
  const target = join(dir, 'archivos', f.storage_key)
  mkdirSync(dirname(target), { recursive: true })
  try {
    wrangler('r2', 'object', 'get', `${BUCKET}/${f.storage_key}`, where, '--file', target)
  } catch {
    missing.push({ key: f.storage_key, deleted: Boolean(f.deleted_at) })
    continue
  }
  const bytes = readFileSync(target)
  saved.push({ key: f.storage_key, contentType: f.content_type, size: statSync(target).size, sha256: createHash('sha256').update(bytes).digest('hex') })
}
console.log(`  archivos: ${saved.length} guardados${missing.length ? `, ${missing.length} no encontrados en R2` : ''}`)

const manifest = {
  createdAt: new Date().toISOString(),
  source: local ? 'local' : 'cloudflare',
  database: DATABASE,
  bucket: BUCKET,
  sqlSha256: createHash('sha256').update(readFileSync(sqlFile)).digest('hex'),
  rows,
  files: saved,
  missingFiles: missing,
}
writeFileSync(join(dir, 'manifiesto.json'), JSON.stringify(manifest, null, 2))
for (const m of missing.filter((m) => !m.deleted)) console.warn(`  AVISO: falta en R2 un archivo activo: ${m.key}`)
console.log('Respaldo terminado.')

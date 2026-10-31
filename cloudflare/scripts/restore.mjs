// Restaura un respaldo hecho con scripts/backup.mjs en una base D1 VACÍA y sube sus archivos al espacio KV «FILES».
// Nunca escribe sobre una base que ya tiene tablas: así un error no puede borrar ni mezclar información.
//   npm run restore -- respaldos/<carpeta> --local [--persist-to <carpeta>]
//        → en una copia local vacía (para comprobar que el respaldo sirve)
//   npm run restore -- respaldos/<carpeta> --remote --database-id <id> [--database-name lbmethod-restaurada] [--kv-id <id del espacio KV>]
//        → en una base nueva de Cloudflare creada antes con «npx wrangler d1 create lbmethod-restaurada»
// Al terminar compara el conteo de filas de cada tabla y la huella SHA-256 de cada archivo con el manifiesto.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { kvNamespaceId, readKvFile, writeKvFile } from './archivos-kv.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = (name) => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : undefined)
const local = args.includes('--local')
const remote = args.includes('--remote')
const backup = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null
if (!backup || local === remote) {
  console.error('Uso: npm run restore -- <carpeta del respaldo> (--local [--persist-to <carpeta>] | --remote --database-id <id>)')
  process.exit(1)
}
const persistTo = option('--persist-to')
const databaseId = option('--database-id')
const databaseName = option('--database-name') ?? (remote ? 'lbmethod-restaurada' : 'lbmethod')
const kvId = option('--kv-id') ?? kvNamespaceId(root)
if (remote && !/^[0-9a-f-]{36}$/.test(databaseId ?? '')) {
  console.error('Con --remote indica el id de la base nueva y vacía: --database-id <id> (lo devuelve «npx wrangler d1 create»).')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(backup, 'manifiesto.json'), 'utf8'))
if (manifest.empty) {
  console.error('Ese respaldo se hizo cuando la base aún estaba vacía: no hay nada que restaurar.')
  process.exit(1)
}
const sqlFile = join(backup, 'lbmethod.sql')
if (createHash('sha256').update(readFileSync(sqlFile)).digest('hex') !== manifest.sqlSha256) {
  console.error('lbmethod.sql no coincide con el manifiesto: el respaldo está dañado o fue modificado.')
  process.exit(1)
}

// En local, el mismo id que wrangler.jsonc: wrangler dev guarda su copia local según ese id.
const localDatabaseId = readFileSync(join(root, 'wrangler.jsonc'), 'utf8').match(/"database_id":\s*"([^"]+)"/)[1]
// Para la base remota se usa una configuración temporal que apunta a la base nueva; wrangler.jsonc no se toca.
const work = mkdtempSync(join(tmpdir(), 'lbmethod-restaurar-'))
const config = join(work, 'wrangler.json')
writeFileSync(
  config,
  JSON.stringify({
    name: 'lbmethod-restaurar',
    main: join(root, 'src/index.ts'),
    compatibility_date: '2026-10-01',
    d1_databases: [{ binding: 'DB', database_name: databaseName, database_id: databaseId ?? localDatabaseId }],
    kv_namespaces: [{ binding: 'FILES', id: kvId }],
  }),
)
// En local, por omisión, la misma carpeta que usa «npm run dev» (solo si está vacía).
const where = local ? ['--local', '--persist-to', resolve(persistTo ?? join(root, '.wrangler', 'state'))] : ['--remote']
const wrangler = (...a) => execFileSync('npx', ['wrangler', ...a, '-c', config], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 })
const wranglerBytes = (...a) => execFileSync('npx', ['wrangler', ...a, '-c', config], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
const kvTarget = ['--binding', 'FILES', ...where]
const query = (sql) => JSON.parse(wrangler('d1', 'execute', databaseName, ...where, '--json', '--command', sql))[0].results

try {
  const existing = query("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")[0].n
  if (existing > 0) {
    console.error(`La base de destino ya tiene ${existing} tablas. Solo se restaura en una base vacía; crea una nueva.`)
    process.exit(1)
  }

  console.log(`Restaurando ${backup} en ${local ? 'una copia local' : `la base ${databaseName}`}…`)
  wrangler('d1', 'execute', databaseName, ...where, '--file', sqlFile, '-y')

  for (const f of manifest.files) {
    const bytes = readFileSync(join(backup, 'archivos', f.key))
    if (createHash('sha256').update(bytes).digest('hex') !== f.sha256) throw new Error(`El archivo ${f.key} no coincide con el manifiesto.`)
    writeKvFile(wranglerBytes, kvTarget, f.key, bytes, f.contentType)
  }

  // Comprobación: mismas filas por tabla y mismos archivos (se vuelven a descargar y se comparan sus huellas).
  const problems = []
  const tables = Object.keys(manifest.rows)
  const counts = query(`SELECT ${tables.map((t) => `(SELECT COUNT(*) FROM "${t}") AS "${t}"`).join(', ')}`)[0]
  for (const t of tables) if (counts[t] !== manifest.rows[t]) problems.push(`tabla ${t}: ${counts[t]} filas, el respaldo tiene ${manifest.rows[t]}`)
  for (const f of manifest.files) {
    const copy = readKvFile(wranglerBytes, kvTarget, f.key)
    if (!copy || createHash('sha256').update(copy).digest('hex') !== f.sha256) problems.push(`archivo ${f.key} distinto o ausente`)
  }
  if (problems.length) {
    console.error('La restauración no coincide con el respaldo:\n  ' + problems.join('\n  '))
    process.exit(1)
  }
  console.log(`Restauración comprobada: ${tables.length} tablas y ${manifest.files.length} archivos idénticos al respaldo.`)
  if (remote) console.log(`Para usarla, pon database_name "${databaseName}" y database_id "${databaseId}" en wrangler.jsonc y publica con «npm run deploy».`)
} finally {
  rmSync(work, { recursive: true, force: true })
}

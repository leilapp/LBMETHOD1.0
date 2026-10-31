// Las tres configuraciones de Wrangler (cloudflare/, raíz y frontend/) deben publicar lo mismo en el mismo Worker:
// la conexión de Git de Cloudflare puede tener como directorio raíz cualquiera de esas carpetas.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (path) => JSON.parse(readFileSync(join(repo, path), 'utf8').replace(/^\s*\/\/.*$/gm, ''))
const essentials = (cfg, prefix) => ({
  name: cfg.name,
  main: cfg.main.replace(prefix, ''),
  compatibility_date: cfg.compatibility_date,
  assets: { ...cfg.assets, directory: cfg.assets.directory.replace(prefix, '') },
  d1: cfg.d1_databases.map((d) => ({ ...d, migrations_dir: d.migrations_dir.replace(prefix, '') })),
  kv: cfg.kv_namespaces,
  r2: cfg.r2_buckets ?? [],
  vars: cfg.vars,
})

test('las configuraciones de la raíz y de frontend/ coinciden con cloudflare/wrangler.jsonc', () => {
  const main = essentials(read('cloudflare/wrangler.jsonc'), /^(\.\/)?/)
  for (const [path, prefix] of [['wrangler.jsonc', 'cloudflare/'], ['frontend/wrangler.jsonc', '../cloudflare/']]) {
    const cfg = read(path)
    assert.deepEqual(essentials(cfg, prefix), main, path)
    assert.match(cfg.build.command, /npm ci && npm run build$/, `${path}: arma las pantallas antes de publicar`)
  }
})

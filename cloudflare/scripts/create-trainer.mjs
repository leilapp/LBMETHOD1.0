// Crea la cuenta de la entrenadora en D1 (no existe registro público).
//   npm run create-trainer -- correo@dominio.com "Nombre visible"            → base local (wrangler dev)
//   npm run create-trainer -- correo@dominio.com "Nombre visible" --remote   → base de Cloudflare
// La contraseña se escribe de forma oculta; nunca se pasa como argumento ni se guarda: solo su hash PBKDF2.
import { execFileSync } from 'node:child_process'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import readline from 'node:readline'

const args = process.argv.slice(2)
const remote = args.includes('--remote')
const [email, displayName] = args.filter((a) => a !== '--remote')
if (!email || !displayName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Uso: npm run create-trainer -- <correo> "<nombre visible>" [--remote]')
  process.exit(1)
}

// Sin terminal (por ejemplo, en una tubería) se leen las líneas de la entrada estándar en orden.
const pipedLines = process.stdin.isTTY ? null : readline.createInterface({ input: process.stdin })[Symbol.asyncIterator]()

function askHidden(prompt) {
  return new Promise((resolve) => {
    if (pipedLines) {
      process.stdout.write(prompt + '\n')
      pipedLines.next().then((r) => resolve(r.done ? '' : r.value))
      return
    }
    process.stdout.write(prompt)
    let value = ''
    process.stdin.setRawMode(true)
    process.stdin.resume()
    const onData = (buf) => {
      for (const ch of buf.toString('utf8')) {
        if (ch === '\r' || ch === '\n') {
          process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', onData)
          process.stdout.write('\n'); resolve(value); return
        }
        if (ch === '\u0003') process.exit(1)
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else value += ch
      }
    }
    process.stdin.on('data', onData)
  })
}

const password = await askHidden('Contraseña (mínimo 10 caracteres, con mayúscula, minúscula y número): ')
const problems = [password.length < 10, !/[A-Z]/.test(password), !/[a-z]/.test(password), !/[0-9]/.test(password)]
if (problems.some(Boolean)) { console.error('La contraseña no cumple las reglas.'); process.exit(1) }
if ((await askHidden('Repite la contraseña: ')) !== password) { console.error('Las contraseñas no coinciden.'); process.exit(1) }

// Mismo formato que src/crypto.ts.
const salt = randomBytes(16)
const hash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
const stored = `pbkdf2-sha256$100000$${salt.toString('base64')}$${hash.toString('base64')}`
const q = (v) => `'${String(v).replace(/'/g, "''")}'`
const now = new Date().toISOString()
const sql = `INSERT INTO users (email, display_name, password_hash, role, must_change_password, created_at)
VALUES (${q(email.trim().toLowerCase())}, ${q(displayName.trim())}, ${q(stored)}, 'TRAINER', 0, ${q(now)});
INSERT INTO audit_logs (occurred_at, user_id, action, entity_type) VALUES (${q(now)}, last_insert_rowid(), 'TrainerCreated', 'User');`

const dir = mkdtempSync(join(tmpdir(), 'lbmethod-'))
const file = join(dir, 'trainer.sql')
writeFileSync(file, sql, { mode: 0o600 })
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'lbmethod', remote ? '--remote' : '--local', '--file', file], { stdio: 'inherit', shell: process.platform === 'win32' })
  console.log('Cuenta de entrenadora creada.')
} catch {
  console.error('No se pudo crear la cuenta (¿ya existe ese correo? ¿se aplicaron las migraciones?).')
  process.exitCode = 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}

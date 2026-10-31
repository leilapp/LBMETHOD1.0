// Compila las pantallas (../frontend) y las copia a ./public, que es lo que publica el Worker.
import { execSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const frontend = join(root, '..', 'frontend')
if (!existsSync(join(frontend, 'node_modules'))) execSync('npm ci', { cwd: frontend, stdio: 'inherit' })
execSync('npm run build', { cwd: frontend, stdio: 'inherit' })
rmSync(join(root, 'public'), { recursive: true, force: true })
cpSync(join(frontend, 'dist'), join(root, 'public'), { recursive: true })
console.log('Pantallas copiadas a cloudflare/public.')

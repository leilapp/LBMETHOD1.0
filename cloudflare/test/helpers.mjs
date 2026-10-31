// Arranque compartido de las pruebas: un Worker real (wrangler dev) con una base D1 y un R2 locales nuevos por
// archivo de pruebas, dos entrenadoras de prueba y una sesión de navegador mínima.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before } from 'node:test'

const PORT = 8800 + Math.floor(Math.random() * 100)
export const BASE = `http://127.0.0.1:${PORT}`
const state = mkdtempSync(join(tmpdir(), 'lbmethod-d1-'))
export const TRAINER = { email: 'entrenadora@prueba.local', password: 'Entrena2026Segura' }
export const OTHER = { email: 'otra@prueba.local', password: 'Otra2026Segura1' }
let server

const wrangler = (...args) => execFileSync('npx', ['wrangler', ...args, '--persist-to', state], { stdio: 'pipe' })
const hash = (password) => {
  const salt = randomBytes(16)
  return `pbkdf2-sha256$100000$${salt.toString('base64')}$${pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('base64')}`
}
export const sql = (statement) => {
  try {
    return JSON.parse(wrangler('d1', 'execute', 'lbmethod', '--local', '--json', '--command', statement).toString())[0].results
  } catch (err) {
    // El motivo del rechazo (por ejemplo, un disparador de la base) viene en la salida del comando.
    throw new Error(`${err.stdout ?? ''}${err.stderr ?? ''}`.trim() || String(err))
  }
}

/** Registra el arranque y el cierre del Worker para el archivo de pruebas que lo importa. */
export function useServer() {
  before(async () => {
    wrangler('d1', 'migrations', 'apply', 'lbmethod', '--local')
    const now = new Date().toISOString()
    const file = join(state, 'seed.sql')
    writeFileSync(
      file,
      [TRAINER, OTHER]
        .map((t) => `INSERT INTO users (email, display_name, password_hash, role, created_at) VALUES ('${t.email}', 'Entrenadora', '${hash(t.password)}', 'TRAINER', '${now}');`)
        .join('\n'),
    )
    wrangler('d1', 'execute', 'lbmethod', '--local', '--file', file)
    server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', state, '--var', 'APP_SECRET:secreto-solo-para-pruebas'], {
      stdio: 'ignore',
      detached: true,
    })
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`${BASE}/api/auth/me`)).status === 401) return
      } catch {
        /* todavía arrancando */
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    throw new Error('wrangler dev no arrancó')
  })

  after(() => {
    try {
      process.kill(-server.pid)
    } catch {
      /* ya terminó */
    }
    rmSync(state, { recursive: true, force: true })
  })
}

/** Sesión de navegador mínima: guarda cookies y envía el token CSRF como lo hacen las pantallas. */
export class Session {
  cookies = new Map()
  csrf = null
  constructor(ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`) {
    this.ip = ip
  }
  /** body puede ser un objeto (se envía como JSON) o un FormData (archivos). */
  async request(method, path, body, { csrf = true, headers: extra = {} } = {}) {
    const headers = { 'CF-Connecting-IP': this.ip, Accept: 'application/json', ...extra }
    const form = body instanceof FormData
    if (method !== 'GET') {
      if (!form) headers['Content-Type'] = 'application/json'
      if (csrf) headers['X-CSRF-TOKEN'] = this.csrf ?? (await this.refreshCsrf())
    }
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    const payload = method === 'GET' ? undefined : form ? body : JSON.stringify(body ?? {})
    const send = () => fetch(BASE + path, { method, headers, body: payload, redirect: 'manual' })
    let res
    try {
      res = await send()
    } catch (err) {
      // Tras una pausa larga, el servidor de pruebas cierra la conexión guardada; la petición no llegó y se repite.
      if (!/other side closed/.test(String(err.cause ?? err))) throw err
      res = await send()
    }
    for (const cookie of res.headers.getSetCookie()) {
      const [pair] = cookie.split(';')
      const [name, value] = pair.split('=')
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(cookie) || value === '') this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
    return res
  }
  async refreshCsrf() {
    this.csrf = (await (await this.request('GET', '/api/auth/csrf')).json()).token
    return this.csrf
  }
  get = (path, opts) => this.request('GET', path, undefined, opts)
  post = (path, body, opts) => this.request('POST', path, body, opts)
  put = (path, body, opts) => this.request('PUT', path, body, opts)
  delete = (path, opts) => this.request('DELETE', path, undefined, opts)
  async login({ email, password }) {
    const res = await this.post('/api/auth/login', { email, password })
    this.csrf = null // el token queda ligado a la identidad: se pide de nuevo, como hacen las pantallas
    return res
  }
}

export const trainer = async (who = TRAINER) => {
  const s = new Session()
  assert.equal((await s.login(who)).status, 200)
  return s
}

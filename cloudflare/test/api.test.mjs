// Pruebas de la etapa 1 contra el Worker real (wrangler dev) y una base D1 local nueva, creada para cada ejecución.
//   npm test
// Requiere haber ejecutado «npm run build» (pantallas en ./public).
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

const PORT = 8800 + Math.floor(Math.random() * 100)
const BASE = `http://127.0.0.1:${PORT}`
const state = mkdtempSync(join(tmpdir(), 'lbmethod-d1-'))
const TRAINER = { email: 'entrenadora@prueba.local', password: 'Entrena2026Segura' }
const OTHER = { email: 'otra@prueba.local', password: 'Otra2026Segura1' }
let server

const wrangler = (...args) => execFileSync('npx', ['wrangler', ...args, '--persist-to', state], { stdio: 'pipe' })
const hash = (password) => {
  const salt = randomBytes(16)
  return `pbkdf2-sha256$100000$${salt.toString('base64')}$${pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('base64')}`
}
const sql = (statement) => JSON.parse(wrangler('d1', 'execute', 'lbmethod', '--local', '--json', '--command', statement).toString())[0].results

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

/** Sesión de navegador mínima: guarda cookies y envía el token CSRF como lo hacen las pantallas. */
class Session {
  cookies = new Map()
  csrf = null
  constructor(ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`) {
    this.ip = ip
  }
  async request(method, path, body, { csrf = true } = {}) {
    const headers = { 'CF-Connecting-IP': this.ip, Accept: 'application/json' }
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json'
      if (csrf) headers['X-CSRF-TOKEN'] = this.csrf ?? (await this.refreshCsrf())
    }
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    const res = await fetch(BASE + path, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}), redirect: 'manual' })
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
  get = (path) => this.request('GET', path)
  post = (path, body, opts) => this.request('POST', path, body, opts)
  async login({ email, password }) {
    const res = await this.post('/api/auth/login', { email, password })
    this.csrf = null // el token queda ligado a la identidad: se pide de nuevo, como hacen las pantallas
    return res
  }
}

const trainer = async (who = TRAINER) => {
  const s = new Session()
  assert.equal((await s.login(who)).status, 200)
  return s
}

describe('inicio de sesión y sesiones', () => {
  test('la entrenadora inicia sesión; la cookie es HttpOnly, Secure y SameSite=Strict; la base guarda solo huellas', async () => {
    const s = new Session()
    const res = await s.login(TRAINER)
    assert.equal(res.status, 200)
    const me = await res.json()
    assert.deepEqual({ role: me.role, email: me.email, mustChangePassword: me.mustChangePassword, clientId: me.clientId }, {
      role: 'TRAINER', email: TRAINER.email, mustChangePassword: false, clientId: null,
    })
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('lb.session='))
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /Secure/i)
    assert.match(cookie, /SameSite=Strict/i)
    assert.equal((await s.get('/api/auth/me')).status, 200)

    const token = s.cookies.get('lb.session')
    assert.equal(sql(`SELECT COUNT(*) AS n FROM sessions WHERE id = '${token}'`)[0].n, 0, 'el token no se guarda tal cual')
    assert.equal(sql(`SELECT COUNT(*) AS n FROM users WHERE password_hash LIKE '%${TRAINER.password}%'`)[0].n, 0)

    assert.equal((await s.post('/api/auth/logout')).status, 204)
    assert.equal((await s.get('/api/auth/me')).status, 401)
  })

  test('correo inexistente y contraseña incorrecta dan el mismo mensaje', async () => {
    const a = await (await new Session().login({ email: 'nadie@prueba.local', password: 'Algo2026Segura' })).json()
    const b = await (await new Session().login({ email: TRAINER.email, password: 'Incorrecta2026' })).json()
    assert.equal(a.detail, b.detail)
    assert.match(a.detail, /Correo o contraseña incorrectos/)
  })

  test('5 intentos fallidos bloquean la cuenta 15 minutos', async () => {
    const s = await trainer()
    const created = await (await s.post('/api/trainer/clients', { firstName: 'Bloqueo', lastName: 'Prueba', email: 'bloqueo@prueba.local' })).json()
    for (let i = 0; i < 5; i++) assert.equal((await new Session().login({ email: 'bloqueo@prueba.local', password: 'Mala2026Clave' })).status, 401)
    assert.equal((await new Session().login({ email: 'bloqueo@prueba.local', password: created.temporaryPassword })).status, 401)
    assert.ok(sql("SELECT lockout_until FROM users WHERE email = 'bloqueo@prueba.local'")[0].lockout_until)
  })

  test('más de 10 intentos por minuto desde la misma IP responden 429', async () => {
    const s = new Session('10.250.250.250')
    const codes = []
    for (let i = 0; i < 11; i++) codes.push((await s.post('/api/auth/login', { email: 'nadie@prueba.local', password: 'x' })).status)
    assert.deepEqual(codes.slice(0, 10).every((c) => c === 401), true)
    assert.equal(codes[10], 429)
  })
})

describe('CSRF', () => {
  test('sin token, con token inventado o con el de otra sesión, se rechaza (400)', async () => {
    const s = await trainer()
    const body = { firstName: 'Sin', lastName: 'Token', email: 'sintoken@prueba.local' }
    assert.equal((await s.post('/api/trainer/clients', body, { csrf: false })).status, 400)
    s.csrf = 'inventado'
    assert.equal((await s.post('/api/trainer/clients', body)).status, 400)
    const other = await trainer(OTHER)
    s.csrf = await other.refreshCsrf()
    const res = await s.post('/api/trainer/clients', body)
    assert.equal(res.status, 400)
    assert.match((await res.json()).detail, /CSRF/)
    // El token anónimo (antes de iniciar sesión) deja de servir después de iniciar sesión.
    const fresh = new Session()
    const anonToken = await fresh.refreshCsrf()
    await fresh.login(TRAINER)
    fresh.csrf = anonToken
    assert.equal((await fresh.post('/api/trainer/clients', body)).status, 400)
  })
})

describe('clientes y separación de datos', () => {
  test('la entrenadora crea un cliente con contraseña temporal y solo ve los suyos', async () => {
    const s = await trainer()
    const res = await s.post('/api/trainer/clients', { firstName: 'Begoña', lastName: 'Núñez', email: 'Begona@Prueba.local', phone: '+52 473 123 4567' })
    assert.equal(res.status, 201)
    const { clientId, temporaryPassword } = await res.json()
    assert.match(temporaryPassword, /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{14}$/)

    const list = await (await s.get('/api/trainer/clients')).json()
    const mine = list.find((c) => c.id === clientId)
    assert.deepEqual({ ...mine, registeredAt: undefined }, {
      id: clientId, firstName: 'Begoña', lastName: 'Núñez', email: 'begona@prueba.local', status: 'Active', hasAccount: true, currentProgram: null, registeredAt: undefined,
    })
    assert.equal((await s.post('/api/trainer/clients', { firstName: 'Otra', lastName: 'Vez', email: 'begona@prueba.local' })).status, 409)

    // Otra entrenadora: no lo ve en su lista y todo lo de ese cliente responde 404.
    const other = await trainer(OTHER)
    assert.equal((await (await other.get('/api/trainer/clients')).json()).some((c) => c.id === clientId), false)
    assert.equal((await other.get(`/api/trainer/clients/${clientId}`)).status, 404)
    assert.equal((await other.post(`/api/trainer/clients/${clientId}/reset-password`)).status, 404)
    assert.equal((await other.post(`/api/trainer/clients/${clientId}/access`, { enabled: false })).status, 404)
    assert.equal(sql(`SELECT status FROM clients WHERE id = ${clientId}`)[0].status, 'Active')
  })

  test('validación de datos con el error en el campo exacto', async () => {
    const s = await trainer()
    const res = await s.post('/api/trainer/clients', { firstName: '', lastName: 'x'.repeat(101), email: 'no-es-correo', phone: 'abc' })
    assert.equal(res.status, 400)
    const { errors } = await res.json()
    assert.deepEqual(Object.keys(errors).sort(), ['email', 'firstName', 'lastName', 'phone'])
    // Un texto con comillas o SQL se guarda como texto, sin efecto en la base.
    const tricky = await s.post('/api/trainer/clients', { firstName: "O'Brien'); DROP TABLE clients;--", lastName: 'Prueba', email: 'obrien@prueba.local' })
    assert.equal(tricky.status, 201)
    assert.ok((await (await s.get('/api/trainer/clients')).json()).some((c) => c.firstName.startsWith("O'Brien")))
  })

  test('el cliente entra con su contraseña temporal, debe cambiarla y no puede usar la API de la entrenadora', async () => {
    const t = await trainer()
    const { clientId, temporaryPassword } = await (await t.post('/api/trainer/clients', { firstName: 'Inés', lastName: 'Prueba', email: 'ines@prueba.local' })).json()
    const c = new Session()
    const me = await (await c.login({ email: 'ines@prueba.local', password: temporaryPassword })).json()
    assert.equal(me.role, 'CLIENT')
    assert.equal(me.clientId, clientId)
    assert.equal(me.mustChangePassword, true)
    assert.equal((await c.get('/api/portal/home')).status, 403, 'con contraseña temporal solo puede cambiarla')
    assert.equal((await c.post('/api/auth/change-password', { currentPassword: temporaryPassword, newPassword: 'corta' })).status, 400)
    assert.equal((await c.post('/api/auth/change-password', { currentPassword: temporaryPassword, newPassword: 'NuevaClave2026' })).status, 204)
    assert.equal((await c.get('/api/trainer/clients')).status, 403)
    assert.equal((await c.get(`/api/trainer/clients/${clientId}`)).status, 403)
    assert.equal((await c.get('/api/portal/home')).status, 501, 'el portal llega en una etapa siguiente')
    assert.equal((await t.get('/api/portal/home')).status, 403)
  })

  test('deshabilitar el acceso cierra la sesión del cliente al instante; restablecer da otra contraseña temporal', async () => {
    const t = await trainer()
    const { clientId, temporaryPassword } = await (await t.post('/api/trainer/clients', { firstName: 'Acceso', lastName: 'Prueba', email: 'acceso@prueba.local' })).json()
    const c = new Session()
    assert.equal((await c.login({ email: 'acceso@prueba.local', password: temporaryPassword })).status, 200)
    assert.equal((await t.post(`/api/trainer/clients/${clientId}/access`, { enabled: false })).status, 204)
    assert.equal((await c.get('/api/auth/me')).status, 401)
    assert.equal((await new Session().login({ email: 'acceso@prueba.local', password: temporaryPassword })).status, 401)
    assert.equal((await (await t.get(`/api/trainer/clients/${clientId}`)).json()).status, 'Inactive')

    assert.equal((await t.post(`/api/trainer/clients/${clientId}/access`, { enabled: true })).status, 204)
    const reset = await (await t.post(`/api/trainer/clients/${clientId}/reset-password`)).json()
    assert.notEqual(reset.temporaryPassword, temporaryPassword)
    assert.equal((await new Session().login({ email: 'acceso@prueba.local', password: temporaryPassword })).status, 401)
    assert.equal((await new Session().login({ email: 'acceso@prueba.local', password: reset.temporaryPassword })).status, 200)
    const actions = sql(`SELECT action FROM audit_logs WHERE entity_id = '${clientId}' ORDER BY id`).map((r) => r.action)
    assert.deepEqual(actions, ['ClientAccountCreated', 'ClientAccessDisabled', 'ClientAccessEnabled', 'ClientPasswordReset'])
  })
})

describe('sitio único y cabeceras', () => {
  test('las rutas de la aplicación devuelven la página con CSP; /api nunca devuelve la página', async () => {
    for (const path of ['/', '/iniciar-sesion', '/entrenadora/clientes', '/portal/progreso']) {
      const res = await fetch(BASE + path)
      assert.equal(res.status, 200, path)
      assert.match(res.headers.get('content-type'), /text\/html/)
      assert.match(await res.text(), /<div id="root">/)
      assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/)
      assert.equal(res.headers.get('x-frame-options'), 'DENY')
    }
    const html = await (await fetch(BASE + '/')).text()
    const asset = html.match(/\/assets\/[^"]+\.js/)[0]
    assert.match((await fetch(BASE + asset)).headers.get('cache-control'), /immutable/)
    for (const path of ['/api', '/api/no-existe', '/api/trainer/clients']) {
      const res = await fetch(BASE + path)
      assert.equal(res.status, 401, path)
      assert.doesNotMatch(res.headers.get('content-type') ?? '', /text\/html/)
    }
  })

  test('sin sesión, los endpoints protegidos responden 401 y los errores no muestran detalles internos', async () => {
    const s = new Session()
    for (const [method, path] of [['GET', '/api/auth/me'], ['POST', '/api/auth/logout'], ['POST', '/api/trainer/clients'], ['GET', '/api/portal/home']]) {
      assert.equal((await s.request(method, path, {})).status, 401, `${method} ${path}`)
    }
    const res = await s.request('POST', '/api/auth/login', '{malformado')
    const text = await res.text()
    assert.equal(res.status, 400)
    assert.doesNotMatch(text, /at |Error:|SQLITE/)
  })
})

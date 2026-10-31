// Pruebas de la etapa 1 (cuentas, sesiones y clientes) contra el Worker real y una base D1 local nueva.
//   npm test
// Requiere haber ejecutado «npm run build» (pantallas en ./public).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { BASE, OTHER, Session, sql, TRAINER, trainer, useServer } from './helpers.mjs'

useServer()

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

// «Olvidé mi contraseña» sin correo: solo la entrenadora, con códigos de recuperación de un solo uso.
//   npm test
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { Session, sql, TRAINER, trainer, useServer } from './helpers.mjs'

useServer()

const NEW_PASSWORD = 'Recuperada2026Ok'

describe('recuperar la contraseña de la entrenadora', () => {
  test('detecta el usuario: la entrenadora usa código; un cliente o un correo desconocido, a su entrenadora', async () => {
    const t = await trainer()
    await t.post('/api/trainer/clients', { firstName: 'Cli', lastName: 'Ente', email: 'cliente.rec@prueba.local' })
    const anon = new Session()
    const check = async (email) => (await (await anon.post('/api/auth/recovery/check', { email })).json()).method
    assert.equal(await check(TRAINER.email), 'recovery-code')
    assert.equal(await check(TRAINER.email.toUpperCase()), 'recovery-code')
    assert.equal(await check('cliente.rec@prueba.local'), 'ask-trainer')
    assert.equal(await check('nadie@prueba.local'), 'ask-trainer')
    assert.equal((await anon.post('/api/auth/recovery/check', { email: 'no-es-correo' })).status, 400)
  })

  test('generar códigos pide la contraseña actual; solo se guardan huellas; un cliente no puede', async () => {
    const t = await trainer()
    assert.equal((await t.post('/api/trainer/recovery-codes', { currentPassword: 'Equivocada123' })).status, 400)
    const res = await t.post('/api/trainer/recovery-codes', { currentPassword: TRAINER.password })
    assert.equal(res.status, 200)
    const { codes } = await res.json()
    assert.equal(codes.length, 10)
    for (const code of codes) assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    assert.equal(sql(`SELECT COUNT(*) AS n FROM recovery_codes WHERE code_hash = '${codes[0]}'`)[0].n, 0, 'el código no se guarda tal cual')
    const status = await (await t.get('/api/trainer/recovery-codes')).json()
    assert.deepEqual({ total: status.total, remaining: status.remaining }, { total: 10, remaining: 10 })
    assert.ok(status.generatedAt)

    const { temporaryPassword } = await (await t.post('/api/trainer/clients', { firstName: 'Otro', lastName: 'Cliente', email: 'cliente.cod@prueba.local' })).json()
    const c = new Session()
    await c.login({ email: 'cliente.cod@prueba.local', password: temporaryPassword })
    await c.post('/api/auth/change-password', { currentPassword: temporaryPassword, newPassword: 'ClienteClave2026' })
    c.csrf = null
    assert.equal((await c.get('/api/trainer/recovery-codes')).status, 403)
    assert.equal((await new Session().get('/api/trainer/recovery-codes')).status, 401)
  })

  test('con un código válido cambia la contraseña, cierra sesiones y el código no se puede reutilizar', async () => {
    const t = await trainer()
    const { codes } = await (await t.post('/api/trainer/recovery-codes', { currentPassword: TRAINER.password })).json()
    const anon = new Session()
    // Contraseña débil: se rechaza sin gastar el código.
    assert.equal((await anon.post('/api/auth/recovery/reset', { email: TRAINER.email, code: codes[0], newPassword: 'corta' })).status, 400)
    // Escrito en minúsculas y sin guiones también sirve.
    const ok = await anon.post('/api/auth/recovery/reset', { email: TRAINER.email, code: codes[0].replace(/-/g, '').toLowerCase(), newPassword: NEW_PASSWORD })
    assert.equal(ok.status, 200)
    assert.deepEqual(await ok.json(), { remainingCodes: 9 })
    assert.equal((await t.get('/api/auth/me')).status, 401, 'las sesiones abiertas se cierran')
    assert.equal((await new Session().login(TRAINER)).status, 401, 'la contraseña anterior ya no sirve')
    assert.equal((await new Session().login({ email: TRAINER.email, password: NEW_PASSWORD })).status, 200)
    assert.equal((await anon.post('/api/auth/recovery/reset', { email: TRAINER.email, code: codes[0], newPassword: 'OtraClave2026Ok' })).status, 400, 'un solo uso')
    assert.ok(sql("SELECT action FROM audit_logs WHERE action = 'PasswordRecoveredWithCode'").length === 1)
    // Se deja como al inicio para las demás pruebas.
    sql(`UPDATE users SET failed_logins = 0, lockout_until = NULL WHERE email = '${TRAINER.email}'`)
    const s = await trainer({ email: TRAINER.email, password: NEW_PASSWORD })
    assert.equal((await s.post('/api/auth/change-password', { currentPassword: NEW_PASSWORD, newPassword: TRAINER.password })).status, 204)
  })

  test('un cliente no puede recuperar con códigos; los códigos equivocados bloquean la cuenta tras 5 intentos', async () => {
    const t = await trainer()
    const { codes } = await (await t.post('/api/trainer/recovery-codes', { currentPassword: TRAINER.password })).json()
    const anon = new Session()
    assert.equal((await anon.post('/api/auth/recovery/reset', { email: 'cliente.rec@prueba.local', code: codes[1], newPassword: NEW_PASSWORD })).status, 400)
    for (let i = 0; i < 5; i++) {
      assert.equal((await new Session().post('/api/auth/recovery/reset', { email: TRAINER.email, code: 'AAAA-BBBB-CCCC', newPassword: NEW_PASSWORD })).status, 400)
    }
    // Bloqueada: ni siquiera un código válido funciona hasta que pase el bloqueo.
    assert.equal((await new Session().post('/api/auth/recovery/reset', { email: TRAINER.email, code: codes[1], newPassword: NEW_PASSWORD })).status, 400)
    assert.equal(sql(`SELECT COUNT(*) AS n FROM recovery_codes WHERE used_at IS NULL`)[0].n, 10)
    sql(`UPDATE users SET failed_logins = 0, lockout_until = NULL WHERE email = '${TRAINER.email}'`)
  })

  test('límite de 10 intentos por minuto por dirección', async () => {
    const s = new Session('10.99.99.99')
    let last
    for (let i = 0; i < 11; i++) last = await s.post('/api/auth/recovery/check', { email: 'x@prueba.local' })
    assert.equal(last.status, 429)
  })
})

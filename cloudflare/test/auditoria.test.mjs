// Auditoría de la etapa 8: recorre TODOS los endpoints de la versión .NET (test/endpoints-dotnet.json, generado con
// scripts/endpoints-dotnet.mjs a partir de los controladores) y comprueba que la versión de Cloudflare los tiene, con la
// misma regla de sesión y rol. Así un endpoint olvidado o sin protección hace fallar la prueba.
//   npm test
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { Session, trainer, useServer } from './helpers.mjs'

useServer()

const ENDPOINTS = JSON.parse(readFileSync(new URL('./endpoints-dotnet.json', import.meta.url), 'utf8')).map((e) => {
  const [method, pattern] = e.split(' ')
  return { method, pattern, key: e }
})
// Los únicos endpoints públicos: obtener el token CSRF e iniciar sesión.
const ANONYMOUS = new Set(['GET /api/auth/csrf', 'POST /api/auth/login'])
// PDF: por decisión de Leilani (31/10/2026) se generan en el navegador con jsPDF a partir de los datos que la API ya
// entrega con permisos; el Worker no tiene estos endpoints y responden 501 (no disponible), sin datos.
const PENDING = new Set(['GET /api/portal/program/{assignmentId}/pdf', 'GET /api/trainer/assignments/{id}/pdf', 'GET /api/trainer/routines/{id}/versions/{versionId}/pdf'])

/** Cambia cada parámetro de ruta por un id que no existe, para pedir la ruta real. */
const concrete = (pattern) => pattern.replace(/\{[^}]+\}/g, '999999')
const send = (s, method, pattern) => s.request(method, concrete(pattern), method === 'GET' || method === 'DELETE' ? undefined : {})

async function clientSession(t) {
  const email = `rol.${Date.now()}@prueba.local`
  const created = await (await t.post('/api/trainer/clients', { firstName: 'Rol', lastName: 'Cliente', email })).json()
  const s = new Session()
  assert.equal((await s.login({ email, password: created.temporaryPassword })).status, 200)
  assert.equal((await s.post('/api/auth/change-password', { currentPassword: created.temporaryPassword, newPassword: 'MiClaveNueva2026' })).status, 204)
  s.csrf = null
  return s
}

describe('auditoría de endpoints', () => {
  test('la lista de .NET está completa (más de 80 endpoints)', () => {
    assert.ok(ENDPOINTS.length > 80, `se encontraron ${ENDPOINTS.length}`)
  })

  test('todo endpoint protegido rechaza peticiones sin sesión (401)', async () => {
    const anon = new Session()
    await anon.refreshCsrf() // con token CSRF válido, para que el rechazo sea por falta de sesión
    for (const { method, pattern, key } of ENDPOINTS.filter((e) => !ANONYMOUS.has(e.key))) {
      const res = await send(anon, method, pattern)
      assert.equal(res.status, 401, `${key} respondió ${res.status} sin sesión`)
    }
  })

  test('cada rol es rechazado en los endpoints del otro (403)', async () => {
    const t = await trainer()
    const client = await clientSession(t)
    for (const { method, pattern, key } of ENDPOINTS) {
      if (pattern.startsWith('/api/trainer/')) assert.equal((await send(client, method, pattern)).status, 403, `un cliente recibió otra respuesta en ${key}`)
      else if (pattern.startsWith('/api/portal/')) assert.equal((await send(t, method, pattern)).status, 403, `la entrenadora recibió otra respuesta en ${key}`)
    }
  })

  test('con el rol correcto, todos los endpoints de .NET existen en Cloudflare (ninguno responde 501)', async () => {
    const t = await trainer()
    const client = await clientSession(t)
    const missing = []
    for (const { method, pattern, key } of ENDPOINTS) {
      if (pattern.startsWith('/api/auth/')) continue // cubiertos en api.test.mjs (cerrar sesión aquí terminaría la sesión de prueba)
      const res = await send(pattern.startsWith('/api/portal/') ? client : t, method, pattern)
      if (PENDING.has(key)) assert.equal(res.status, 501, `${key} debería seguir sin existir (el PDF se genera en el navegador)`)
      else if (res.status === 501) missing.push(key)
      assert.ok(res.status < 500 || res.status === 501, `${key} respondió ${res.status}`)
    }
    assert.deepEqual(missing, [], `faltan en Cloudflare: ${missing.join(', ')}`)
  })
})

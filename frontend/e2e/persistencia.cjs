// Uso: node e2e/persistencia.cjs antes <archivo.json>   → guarda una foto de los datos
//      (reiniciar la API y SQL Server)
//      node e2e/persistencia.cjs despues <archivo.json> → vuelve a leerlos y compara
// Comprueba que clientes, rutinas, evaluaciones, calendario y archivos privados sobreviven a un reinicio completo.
// Requiere LBMETHOD_E2E_EMAIL y LBMETHOD_E2E_PASSWORD (cuenta de PRUEBA). Usa la API directamente (puerto de Vite).
const { request } = require('playwright')
const fs = require('fs')
const crypto = require('crypto')

const BASE = process.env.LBMETHOD_E2E_BASE || 'http://localhost:5173'
const [mode, file] = process.argv.slice(2)
if (!['antes', 'despues'].includes(mode) || !file || !process.env.LBMETHOD_E2E_EMAIL) {
  console.error('Uso: node e2e/persistencia.cjs antes|despues <archivo.json> (con LBMETHOD_E2E_EMAIL y LBMETHOD_E2E_PASSWORD)')
  process.exit(1)
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

;(async () => {
  const r = await request.newContext({ baseURL: BASE })
  const csrf = async () => (await (await r.get('/api/auth/csrf')).json()).token
  const login = await r.post('/api/auth/login', { headers: { 'X-CSRF-TOKEN': await csrf() }, data: { email: process.env.LBMETHOD_E2E_EMAIL, password: process.env.LBMETHOD_E2E_PASSWORD } })
  if (login.status() !== 200) throw new Error(`login ${login.status()}`)
  const get = async (url) => { const res = await r.get(url); if (!res.ok()) throw new Error(`${url}: ${res.status()}`); return res.json() }

  const clients = (await get('/api/trainer/clients')).map((c) => ({ id: c.id, email: c.email, status: c.status })).sort((a, b) => a.id - b.id)
  const withEvals = (await get('/api/trainer/tracking')).filter((c) => c.lastEvaluation).slice(0, 5)
  const evaluations = {}
  const photos = {}
  for (const c of withEvals) {
    evaluations[c.clientId] = await get(`/api/trainer/clients/${c.clientId}/evaluations`)
    for (const p of await get(`/api/trainer/clients/${c.clientId}/photos`)) {
      const res = await r.get(p.url)
      photos[p.id] = crypto.createHash('sha256').update(await res.body()).digest('hex')
    }
  }
  const routines = (await get('/api/trainer/routines?kind=program&status=active')).map((x) => x.id).sort((a, b) => a - b)
  const calendar = await get(`/api/trainer/calendar?from=${addDays(today, -30)}&to=${addDays(today, 30)}`)
  const snapshot = { clients, evaluations, photos, routines, calendar: calendar.length }

  if (mode === 'antes') {
    fs.writeFileSync(file, JSON.stringify(snapshot))
    console.log(`Foto guardada: ${clients.length} clientes, ${Object.keys(evaluations).length} con evaluaciones, ${Object.keys(photos).length} fotos, ${routines.length} rutinas, ${calendar.length} elementos de calendario`)
    return
  }
  const before = JSON.parse(fs.readFileSync(file, 'utf8'))
  const checks = [
    ['los clientes siguen iguales', JSON.stringify(before.clients) === JSON.stringify(snapshot.clients)],
    ['las evaluaciones y medidas siguen iguales', JSON.stringify(before.evaluations) === JSON.stringify(snapshot.evaluations)],
    ['las fotos privadas siguen disponibles y sin cambios', Object.keys(before.photos).length > 0 && JSON.stringify(before.photos) === JSON.stringify(snapshot.photos)],
    ['las rutinas siguen iguales', JSON.stringify(before.routines) === JSON.stringify(snapshot.routines)],
    ['el calendario sigue igual', before.calendar === snapshot.calendar],
  ]
  for (const [name, ok] of checks) { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`); if (!ok) process.exitCode = 1 }
})().catch((e) => { console.error(e); process.exit(1) })

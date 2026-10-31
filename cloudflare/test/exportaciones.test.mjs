// Pruebas de la etapa 7 (exportaciones a Excel) contra el Worker real.
//   npm test
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { strFromU8, unzipSync } from 'fflate'
import { OTHER, Session, sql, trainer, useServer } from './helpers.mjs'

useServer()

const T = '/api/trainer'
let counter = 0

const json = async (res, status) => {
  assert.equal(res.status, status, `respuesta ${res.status}: ${await res.clone().text()}`)
  return res.status === 204 ? null : res.json()
}
const day = (days = 0) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const TODAY = day()
const excelSerial = (iso) => (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000

/** Lee un .xlsx: por hoja, un mapa «B2» → { type: 'n' | 's' | 'd' | 'f', value }. */
async function xlsx(res) {
  assert.equal(res.status, 200, await res.clone().text())
  assert.equal(res.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
  const names = [...strFromU8(files['xl/workbook.xml']).matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1])
  const book = {}
  names.forEach((name, i) => {
    const xml = strFromU8(files[`xl/worksheets/sheet${i + 1}.xml`])
    const cells = {}
    for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, ref, attrs, inner = ''] = m
      if (/<f>/.test(inner)) cells[ref] = { type: 'f', value: inner }
      else if (/t="inlineStr"/.test(attrs)) cells[ref] = { type: 's', value: inner.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') }
      else if (/<v>/.test(inner)) cells[ref] = { type: /s="3"/.test(attrs) ? 'd' : 'n', value: Number(inner.match(/<v>([^<]*)<\/v>/)[1]) }
    }
    const rows = Math.max(0, ...Object.keys(cells).map((r) => Number(r.match(/\d+/)[0])))
    book[name] = { cells, rows, get: (ref) => cells[ref]?.value ?? null, type: (ref) => cells[ref]?.type ?? null }
  })
  return book
}

const newClient = async (t, firstName) => {
  const email = `cli${++counter}.${Date.now()}@prueba.local`
  const created = await json(await t.post(`${T}/clients`, { firstName, lastName: 'Exportación', email }), 201)
  const s = new Session()
  assert.equal((await s.login({ email, password: created.temporaryPassword })).status, 200)
  await json(await s.post('/api/auth/change-password', { currentPassword: created.temporaryPassword, newPassword: 'MiClaveNueva2026' }), 204)
  s.csrf = null
  return { session: s, clientId: created.clientId }
}

/** Rutina publicada con 8 ejercicios en dos días; el primero de cada día con peso y el segundo con series detalladas. */
async function routine(t, title) {
  const ids = []
  for (let i = 0; i < 4; i++)
    ids.push((await json(await t.post(`${T}/library/exercises`, { nameEs: `Ejercicio exp ${++counter} ${Date.now()}`, type: 1, primaryMuscleGroupId: 1 }), 201)).id)
  const exercises = (offset) =>
    ids.map((exerciseId, i) =>
      i === 0
        ? { exerciseId, sets: 4, repsMin: 8, repsMax: 12, suggestedWeight: 42.5, suggestedWeightUnit: 1, restSeconds: 90, rir: 2, setType: 1, notes: offset ? null : '=HYPERLINK("http://malo")' }
        : i === 2
          ? { exerciseId, sets: 2, setType: 1, setDetails: [{ setType: 2, repsMin: 12, repsMax: 12 }, { setType: 1, repsMin: 8, repsMax: 8, suggestedWeight: 45, suggestedWeightUnit: 2, restSeconds: 120 }] }
          : { exerciseId, sets: 3, repsMin: 10, repsMax: 10, setType: 1 },
    )
  const { id: routineId } = await json(await t.post(`${T}/routines`, { kind: 1, title, durationWeeks: 6 }), 201)
  const { id: draftId } = await json(await t.post(`${T}/routines/${routineId}/draft`), 200)
  await json(await t.put(`${T}/routines/${routineId}/draft`, { draftVersionId: draftId, title, durationWeeks: 6, goal: 'Fuerza', days: [{ name: 'Día A', dayOfWeek: 1, exercises: exercises(0) }, { name: 'Día B', exercises: exercises(1) }] }), 204)
  const { id: versionId } = await json(await t.post(`${T}/routines/${routineId}/publish`, { draftVersionId: draftId }), 200)
  return { routineId, versionId }
}

describe('exportaciones a Excel', () => {
  test('contienen datos reales, respetan a quién pertenecen y nunca crean fórmulas', async () => {
    const t = await trainer()
    const other = await trainer(OTHER)
    const { clientId: idA } = await newClient(t, 'Begoña')
    const { clientId: foreignId } = await newClient(other, 'Ajena')
    await json(await t.post(`${T}/clients/${idA}/notes`, { content: 'Nota privada que no se exporta' }), 201)
    await json(await t.post(`${T}/clients/${idA}/evaluations`, { evaluatedOn: day(-7), notes: '=HYPERLINK("http://malo")', measurements: [{ measurementTypeId: 1, value: 64.25 }, { measurementTypeId: 2, value: 72 }] }), 201)
    const title = `Fuerza exportable ${Date.now()}`
    const { versionId } = await routine(t, title)
    await json(await t.post(`${T}/assignments`, { clientIds: [idA], routineVersionId: versionId, startDate: TODAY }), 201)

    // Clientes: perfil y asignaciones; nunca las observaciones privadas.
    const clients = await xlsx(await t.get(`${T}/exports/clients`))
    const sheet = clients.Clientes
    assert.equal(sheet.get('A1'), 'Nombre')
    const row = Object.entries(sheet.cells).find(([ref, c]) => /^A\d+$/.test(ref) && c.value === 'Begoña')[0].slice(1)
    assert.equal(sheet.get(`R${row}`), title, 'programa vigente')
    assert.equal(sheet.get(`E${row}`), 'Activo')
    assert.equal(sheet.type(`S${row}`), 'd', 'fecha de registro como fecha')
    assert.ok(!Object.values(sheet.cells).some((c) => String(c.value).includes('Ajena')), 'sin clientes de otra entrenadora')
    assert.ok(!Object.values(clients).some((s) => Object.values(s.cells).some((c) => String(c.value).includes('Nota privada'))))
    const asg = clients.Asignaciones
    const asgRow = Object.entries(asg.cells).find(([ref, c]) => /^B\d+$/.test(ref) && c.value === title)[0].slice(1)
    assert.deepEqual([asg.get(`F${asgRow}`), asg.type(`D${asgRow}`), asg.get(`D${asgRow}`)], ['Vigente', 'd', excelSerial(TODAY)])

    // Rutinas: resumen y detalle de la versión publicada.
    const routines = await xlsx(await t.get(`${T}/exports/routines`))
    const summary = routines.Rutinas
    const sRow = Object.entries(summary.cells).find(([ref, c]) => /^A\d+$/.test(ref) && c.value === title)[0].slice(1)
    assert.deepEqual([summary.get(`D${sRow}`), summary.get(`I${sRow}`), summary.get(`H${sRow}`), summary.get(`B${sRow}`)], [1, 1, 2, 'Programa'])
    const detail = routines.Detalle
    const rowsOf = Object.entries(detail.cells).filter(([ref, c]) => /^A\d+$/.test(ref) && c.value === title).map(([ref]) => ref.slice(1))
    assert.equal(rowsOf.length, 8, '8 ejercicios')
    const first = rowsOf[0]
    assert.deepEqual([detail.get(`I${first}`), detail.get(`J${first}`), detail.type(`J${first}`), detail.get(`K${first}`), detail.get(`D${first}`)], ['8–12', 42.5, 'n', 'kg', 'Lunes'])
    assert.equal(detail.type(`R${first}`), 's', 'el texto que parece fórmula queda como texto')
    assert.equal(detail.get(`R${first}`), '=HYPERLINK("http://malo")')
    assert.match(detail.get(`Q${rowsOf[2]}`), /S2 Efectiva · 8 reps · 45 lb · 2 min/)

    // Evaluaciones de una clienta: una fila por medida, con fecha y número reales.
    const evaluations = await xlsx(await t.get(`${T}/exports/evaluations?clientId=${idA}`))
    const ev = evaluations.Evaluaciones
    assert.equal(ev.rows, 3)
    assert.deepEqual([ev.get('C2'), ev.get('D2'), ev.type('D2'), ev.get('E2')], ['Peso corporal', 64.25, 'n', 'kg'])
    assert.deepEqual([ev.type('B2'), ev.get('B2')], ['d', excelSerial(day(-7))])
    assert.deepEqual([ev.type('G2'), ev.get('G2')], ['s', '=HYPERLINK("http://malo")'])
    assert.ok(!Object.values(ev.cells).some((c) => c.type === 'f'))

    assert.equal((await t.get(`${T}/exports/evaluations?clientId=${foreignId}`)).status, 404)
    const otherBook = await xlsx(await other.get(`${T}/exports/evaluations`))
    assert.ok(!Object.values(otherBook.Evaluaciones.cells).some((c) => c.value === 'Begoña Exportación'), 'la otra entrenadora no ve evaluaciones ajenas')
    assert.ok(sql("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'ClientsExported'")[0].n >= 1)
    assert.equal(sql(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'EvaluationsExported' AND details = 'Cliente ${idA}'`)[0].n, 1)
  })

  test('un cliente no puede usar las exportaciones de la entrenadora', async () => {
    const t = await trainer()
    const { session: client } = await newClient(t, 'Clara')
    for (const path of ['exports/clients', 'exports/routines', 'exports/evaluations']) assert.equal((await client.get(`${T}/${path}`)).status, 403)
  })
})

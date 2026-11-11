// Mejoras del 11/11/2026 contra el Worker real: «la vez pasada» y mejor peso al registrar, pendientes de la entrenadora
// (sin entrenar, rutinas por terminar, comentarios nuevos) y avisos de la entrenadora al cliente.
//   npm test
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { OTHER, Session, sql, trainer, useServer } from './helpers.mjs'

useServer()

const ROUTINES = '/api/trainer/routines'
const PORTAL = '/api/portal'
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

const newClient = async (t, firstName = 'Ana') => {
  const email = `mej${++counter}.${Date.now()}@prueba.local`
  const created = await json(await t.post('/api/trainer/clients', { firstName, lastName: 'Cliente', email }), 201)
  const s = new Session()
  assert.equal((await s.login({ email, password: created.temporaryPassword })).status, 200)
  await json(await s.post('/api/auth/change-password', { currentPassword: created.temporaryPassword, newPassword: 'MiClaveNueva2026' }), 204)
  s.csrf = null
  return { session: s, clientId: created.clientId }
}
const exercise = async (t, name) => (await json(await t.post('/api/trainer/library/exercises', { nameEs: `${name}-${++counter}-${Date.now()}`, type: 1, primaryMuscleGroupId: 1 }), 201)).id

const routine = async (t) => {
  const hip = await exercise(t, 'Hip thrust')
  const { id: routineId } = await json(await t.post(ROUTINES, { kind: 1, title: 'Glúteo' }), 201)
  const { id: draftId } = await json(await t.post(`${ROUTINES}/${routineId}/draft`), 200)
  await json(
    await t.put(`${ROUTINES}/${routineId}/draft`, {
      draftVersionId: draftId, title: 'Glúteo',
      days: [{ name: 'Día A', exercises: [{ exerciseId: hip, sets: 3, repsMin: 8, repsMax: 12, suggestedWeight: 60, suggestedWeightUnit: 1, restSeconds: 90, setType: 1 }] }],
    }),
    204,
  )
  const { id: versionId } = await json(await t.post(`${ROUTINES}/${routineId}/publish`, { draftVersionId: draftId }), 200)
  return { versionId, hip }
}
const assign = async (t, clientId, versionId, startDate = day()) =>
  (await json(await t.post('/api/trainer/assignments', { clientIds: [clientId], routineVersionId: versionId, startDate }), 201)).ids[0]

/** Registra y finaliza un entrenamiento del Día A con las series indicadas ([reps, peso, unidad]). */
const train = async (client, assignmentId, sets, comment = null) => {
  const dayId = (await json(await client.get(`${PORTAL}/program`), 200))[0].days[0].id
  const { id } = await json(await client.post(`${PORTAL}/sessions`, { assignmentId, routineDayId: dayId }), 200)
  const s = await json(await client.get(`${PORTAL}/sessions/${id}`), 200)
  const ex = s.exercises[0]
  await json(
    await client.put(`${PORTAL}/sessions/${id}`, {
      comment,
      // Las series que indicó la entrenadora siempre van (vacías si no se hicieron); las demás son extra.
      exercises: [{ id: ex.id, isCompleted: true, comment: null, sets: Array.from({ length: Math.max(sets.length, ex.sets.length) }, (_, i) => {
        const [reps = null, weight = null, weightUnit = null] = sets[i] ?? []
        return { setNumber: i + 1, reps, weight, weightUnit, rir: null, rpe: null, isCompleted: sets[i] !== undefined, notes: null }
      }) }],
    }),
    204,
  )
  return id
}
const finish = async (client, id) => json(await client.post(`${PORTAL}/sessions/${id}/finish`), 204)

describe('la vez pasada y mejor peso', () => {
  test('al registrar se ve lo que hizo la última vez (solo finalizados) y su mejor peso, sin llenar nada', async () => {
    const t = await trainer()
    const { session: client, clientId } = await newClient(t)
    const { versionId } = await routine(t)
    const assignmentId = await assign(t, clientId, versionId)

    const first = await train(client, assignmentId, [[10, 60, 1], [10, 60, 1], [8, 62.5, 1]])
    // Mientras el primero está en curso no cuenta como «la vez pasada» de nada.
    const open = await json(await client.get(`${PORTAL}/sessions/${first}`), 200)
    assert.equal(open.exercises[0].previous, null)
    assert.equal(open.exercises[0].best, null)
    await finish(client, first)

    // Un segundo entrenamiento con un peso en libras más alto (150 lb = 68.04 kg).
    const second = await train(client, assignmentId, [[6, 150, 2]])
    await finish(client, second)

    const dayId = (await json(await client.get(`${PORTAL}/program`), 200))[0].days[0].id
    const third = await json(await client.post(`${PORTAL}/sessions`, { assignmentId, routineDayId: dayId }), 200)
    const s = await json(await client.get(`${PORTAL}/sessions/${third.id}`), 200)
    const ex = s.exercises[0]
    // La vez pasada es el segundo entrenamiento; la mejor marca compara en kilos aunque se haya registrado en libras.
    assert.deepEqual(ex.previous.sets, [{ setNumber: 1, reps: 6, weight: 150, weightUnit: 'lb' }])
    assert.deepEqual([ex.best.weight, ex.best.weightUnit, ex.best.reps, ex.best.weightKg], [150, 'lb', 6, 68.04])
    // Nada se llena por el cliente.
    assert.ok(ex.sets.every((x) => x.reps === null && x.weight === null && !x.isCompleted))

    // Ver un entrenamiento viejo usa solo lo anterior a él.
    const old = await json(await client.get(`${PORTAL}/sessions/${second}`), 200)
    assert.equal(old.exercises[0].previous.sets.length, 3)
    assert.equal(old.exercises[0].best.weight, 62.5)
  })
})

describe('pendientes de la entrenadora', () => {
  test('sin entrenar, rutinas por terminar y comentarios nuevos (que se quitan al revisarlos)', async () => {
    const t = await trainer()
    const { versionId } = await routine(t)

    // Cliente con rutina desde hace 10 días y sin entrenar.
    const lazy = await newClient(t, 'Sinentrenar')
    await assign(t, lazy.clientId, versionId, day(-10))
    // Cliente con rutina que empezó hoy: aún no aparece.
    const fresh = await newClient(t, 'Reciente')
    await assign(t, fresh.clientId, versionId)
    // Cliente cuya rutina termina en 3 días y que dejó un comentario.
    const busy = await newClient(t, 'Comenta')
    const busyAssignment = await assign(t, busy.clientId, versionId, day(-2))
    sql(`UPDATE routine_assignments SET end_date = '${day(3)}' WHERE id = ${busyAssignment}`)
    const log = await train(busy.session, busyAssignment, [[10, 60, 1]], 'Me dolió la rodilla')
    await finish(busy.session, log)

    const pending = await json(await t.get('/api/trainer/pending'), 200)
    const lazyRow = pending.inactive.find((r) => r.clientId === lazy.clientId)
    assert.ok(lazyRow, 'el cliente sin entrenar aparece')
    assert.deepEqual([lazyRow.days, lazyRow.neverTrained], [10, true])
    assert.ok(!pending.inactive.some((r) => r.clientId === fresh.clientId))
    assert.ok(!pending.inactive.some((r) => r.clientId === busy.clientId))
    const ending = pending.ending.find((r) => r.assignmentId === busyAssignment)
    assert.deepEqual([ending.daysLeft, ending.endDate], [3, day(3)])
    const comment = pending.comments.find((r) => r.sessionId === log)
    assert.equal(comment.comment, 'Me dolió la rodilla')

    // Otra entrenadora no ve nada de esto ni puede marcarlo.
    const other = await trainer(OTHER)
    const otherPending = await json(await other.get('/api/trainer/pending'), 200)
    assert.ok(!otherPending.comments.some((r) => r.sessionId === log))
    assert.equal((await other.post(`/api/trainer/clients/${busy.clientId}/sessions/${log}/review`)).status, 404)

    await json(await t.post(`/api/trainer/clients/${busy.clientId}/sessions/${log}/review`), 204)
    await json(await t.post(`/api/trainer/clients/${busy.clientId}/sessions/${log}/review`), 204) // dos veces no falla
    const after = await json(await t.get('/api/trainer/pending'), 200)
    assert.ok(!after.comments.some((r) => r.sessionId === log))
  })
})

describe('avisos de la entrenadora', () => {
  test('la entrenadora escribe, el cliente los ve y los marca como vistos; solo se borran sin ver', async () => {
    const t = await trainer()
    const { versionId } = await routine(t)
    const { session: client, clientId } = await newClient(t)
    const assignmentId = await assign(t, clientId, versionId)
    const log = await train(client, assignmentId, [[10, 60, 1]], 'Muy pesado')
    await finish(client, log)

    assert.equal((await t.post(`/api/trainer/clients/${clientId}/messages`, { body: '  ' })).status, 400)
    assert.equal((await t.post(`/api/trainer/clients/${clientId}/messages`, { body: 'x'.repeat(1001) })).status, 400)
    const { id: general } = await json(await t.post(`/api/trainer/clients/${clientId}/messages`, { body: 'Esta semana sube 2.5 kg en hip thrust' }), 201)
    const { id: reply } = await json(await t.post(`/api/trainer/clients/${clientId}/messages`, { body: 'Baja el peso la próxima vez', sessionId: log }), 201)
    // Contestar un entrenamiento lo marca como revisado.
    assert.ok(!(await json(await t.get('/api/trainer/pending'), 200)).comments.some((r) => r.sessionId === log))

    const inbox = await json(await client.get(`${PORTAL}/messages`), 200)
    assert.deepEqual(inbox.map((m) => m.id), [reply, general])
    assert.equal(inbox[0].sessionDayName, 'Día A')
    assert.ok(inbox.every((m) => m.readAt === null))

    // Se puede borrar un aviso que el cliente no ha visto.
    await json(await t.delete(`/api/trainer/clients/${clientId}/messages/${general}`), 204)
    await json(await client.post(`${PORTAL}/messages/read`), 204)
    const seen = await json(await client.get(`${PORTAL}/messages`), 200)
    assert.deepEqual(seen.map((m) => m.id), [reply])
    assert.ok(seen[0].readAt)
    assert.equal((await t.delete(`/api/trainer/clients/${clientId}/messages/${reply}`)).status, 409)
    assert.equal((await json(await t.get(`/api/trainer/clients/${clientId}/messages`), 200))[0].readAt, seen[0].readAt)

    // Aislamiento: otra entrenadora, otro cliente y un entrenamiento ajeno.
    const other = await trainer(OTHER)
    assert.equal((await other.get(`/api/trainer/clients/${clientId}/messages`)).status, 404)
    assert.equal((await other.post(`/api/trainer/clients/${clientId}/messages`, { body: 'Hola' })).status, 404)
    const stranger = await newClient(t, 'Otra')
    assert.deepEqual(await json(await stranger.session.get(`${PORTAL}/messages`), 200), [])
    assert.equal((await t.post(`/api/trainer/clients/${stranger.clientId}/messages`, { body: 'Hola', sessionId: log })).status, 400)
    // Roles: el cliente no entra a lo de la entrenadora ni al revés.
    assert.equal((await client.get('/api/trainer/pending')).status, 403)
    assert.equal((await t.get(`${PORTAL}/messages`)).status, 403)
  })
})

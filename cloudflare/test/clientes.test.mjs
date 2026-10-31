// Pruebas de la etapa 4 (perfil del cliente, observaciones privadas y asignaciones) contra el Worker real.
//   npm test
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { OTHER, Session, sql, trainer, useServer } from './helpers.mjs'

useServer()

const CLIENTS = '/api/trainer/clients'
const ASSIGNMENTS = '/api/trainer/assignments'
const ROUTINES = '/api/trainer/routines'
let counter = 0

const json = async (res, status) => {
  assert.equal(res.status, status, `respuesta ${res.status}: ${await res.clone().text()}`)
  return res.status === 204 ? null : res.json()
}
const errorKeys = async (res) => {
  assert.equal(res.status, 400, await res.clone().text())
  return Object.keys((await res.json()).errors).sort()
}
// Fecha en el centro de México, desplazada «days» días.
const day = (days = 0) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const TODAY = day()

const newClient = async (t, firstName = 'Ana') => {
  const email = `cli${++counter}.${Date.now()}@prueba.local`
  const created = await json(await t.post(CLIENTS, { firstName, lastName: 'Cliente', email }), 201)
  return { ...created, email }
}
const clientSession = async (created, email = created.email) => {
  const s = new Session()
  assert.equal((await s.login({ email, password: created.temporaryPassword })).status, 200)
  await json(await s.post('/api/auth/change-password', { currentPassword: created.temporaryPassword, newPassword: 'MiClaveNueva2026' }), 204)
  s.csrf = null
  return s
}
const publishNext = async (t, routineId, title, exerciseId) => {
  const { id: draftId } = await json(await t.post(`${ROUTINES}/${routineId}/draft`), 200)
  if (exerciseId)
    await json(await t.put(`${ROUTINES}/${routineId}/draft`, { draftVersionId: draftId, title, days: [{ name: 'Día 1', exercises: [{ exerciseId, sets: 4, repsMin: 8, repsMax: 12, setType: 1 }] }] }), 204)
  return (await json(await t.post(`${ROUTINES}/${routineId}/publish`, { draftVersionId: draftId, changeNotes: 'ok' }), 200)).id
}
const publishedRoutine = async (t, title = 'Glúteo 6 semanas', kind = 1) => {
  const exercise = (await json(await t.post('/api/trainer/library/exercises', { nameEs: `Hip thrust ${++counter} ${Date.now()}`, type: 1, primaryMuscleGroupId: 1 }), 201)).id
  const { id: routineId } = await json(await t.post(ROUTINES, { kind, title, durationWeeks: 6 }), 201)
  return { routineId, versionId: await publishNext(t, routineId, title, exercise) }
}
const assign = (t, clientIds, routineVersionId, startDate, endDate = null, notes = null) => t.post(ASSIGNMENTS, { clientIds, routineVersionId, startDate, endDate, notes })
const assignmentsOf = async (t, clientId) => json(await t.get(`${CLIENTS}/${clientId}/assignments`), 200)
const profile = (email, overrides = {}) => ({
  firstName: 'Mariana', lastName: 'López', email, phone: '+52 473 123 4567', birthDate: '1994-05-12',
  height: 165.5, heightUnit: 1, weight: 62.3, weightUnit: 1, experienceLevel: 2, goal: 'Ganar fuerza en glúteo',
  trainingLocation: 1, availableDays: 1 | 4 | 16, sessionDurationMinutes: 60, declaredLimitations: 'Molestia en rodilla izquierda', ...overrides,
})

describe('perfil del cliente', () => {
  test('la entrenadora edita el perfil completo y se recupera de D1; los errores van al campo exacto', async () => {
    const t = await trainer()
    const created = await newClient(t)
    await json(await t.put(`${CLIENTS}/${created.clientId}/profile`, profile(created.email)), 204)

    const p = await json(await t.get(`${CLIENTS}/${created.clientId}/profile`), 200)
    assert.deepEqual([p.firstName, p.lastName, p.phone, p.birthDate], ['Mariana', 'López', '+52 473 123 4567', '1994-05-12'])
    assert.deepEqual([p.height, p.heightUnit, p.weight, p.weightUnit], [165.5, 1, 62.3, 1])
    assert.deepEqual([p.experienceLabel, p.trainingLocationLabel, p.sessionDurationMinutes], ['Intermedio', 'Gimnasio', 60])
    assert.deepEqual(p.availableDayNames, ['Lunes', 'Miércoles', 'Viernes'])
    assert.deepEqual([p.declaredLimitations, p.status, p.hasAccount, p.deactivatedAt], ['Molestia en rodilla izquierda', 'Active', true, null])
    assert.ok(Date.parse(p.registeredAt) > Date.now() - 5 * 60_000)
    assert.equal(sql(`SELECT weight_centi FROM clients WHERE id = ${created.clientId}`)[0].weight_centi, 6230, 'peso en centésimas exactas')

    const bad = await t.put(`${CLIENTS}/${created.clientId}/profile`, {
      firstName: '', lastName: 'López', email: 'no-es-correo', birthDate: day(1), height: 400, heightUnit: 1, weight: 70, sessionDurationMinutes: 5, availableDays: 0,
    })
    assert.deepEqual(await errorKeys(bad), ['birthDate', 'email', 'firstName', 'height', 'sessionDurationMinutes', 'weightUnit'])
    assert.deepEqual(await errorKeys(await t.put(`${CLIENTS}/${created.clientId}/profile`, profile(created.email, { birthDate: '1994-02-30', experienceLevel: 9, trainingLocation: 0, availableDays: 128, phone: 'abc' }))),
      ['availableDays', 'birthDate', 'experienceLevel', 'phone', 'trainingLocation'])
    assert.equal((await json(await t.get(`${CLIENTS}/${created.clientId}/profile`), 200)).firstName, 'Mariana', 'nada se guarda')

    // Los opcionales pueden quedar vacíos; la unidad sin valor no se guarda.
    await json(await t.put(`${CLIENTS}/${created.clientId}/profile`, { firstName: 'Mariana', lastName: 'López', email: created.email, heightUnit: 2 }), 204)
    const empty = await json(await t.get(`${CLIENTS}/${created.clientId}/profile`), 200)
    assert.deepEqual([empty.height, empty.heightUnit, empty.phone, empty.availableDayNames], [null, null, null, []])

    const options = await json(await t.get(`${CLIENTS}/options`), 200)
    assert.deepEqual(options.days.map((d) => d.value), [1, 2, 4, 8, 16, 32, 64])
    assert.deepEqual(options.experienceLevels.map((d) => d.label), ['Principiante', 'Intermedio', 'Avanzado'])
    assert.deepEqual(options.trainingLocations.map((d) => d.label), ['Gimnasio', 'Casa', 'Exterior', 'Mixto'])
    assert.deepEqual(options.lengthUnits, [{ value: 1, label: 'cm' }, { value: 2, label: 'in' }])
  })

  test('cambiar el correo cambia el usuario para entrar y debe seguir siendo único', async () => {
    const t = await trainer()
    const created = await newClient(t)
    const other = await newClient(t, 'Otra')
    assert.equal((await t.put(`${CLIENTS}/${created.clientId}/profile`, profile(other.email.toUpperCase()))).status, 409)
    assert.equal((await t.put(`${CLIENTS}/${created.clientId}/profile`, profile('entrenadora@prueba.local'))).status, 409, 'tampoco el de una entrenadora')

    const newEmail = `nuevo${Date.now()}@prueba.local`
    await json(await t.put(`${CLIENTS}/${created.clientId}/profile`, profile(newEmail.toUpperCase())), 204)
    assert.equal((await new Session().login({ email: created.email, password: created.temporaryPassword })).status, 401)
    const client = await clientSession(created, newEmail)
    const mine = await json(await client.get('/api/portal/profile'), 200)
    assert.equal(mine.email, newEmail)
    assert.deepEqual([mine.heightUnit, mine.weightUnit, mine.experience, mine.trainingLocation, mine.availableDays], ['cm', 'kg', 'Intermedio', 'Gimnasio', ['Lunes', 'Miércoles', 'Viernes']])
    assert.equal((await json(await client.get('/api/auth/me'), 200)).displayName, 'Mariana López')
    const actions = sql(`SELECT action, details FROM audit_logs WHERE entity_type = 'Client' AND entity_id = '${created.clientId}' ORDER BY id`)
    assert.deepEqual(actions.map((a) => a.action), ['ClientAccountCreated', 'ClientEmailChanged', 'ClientProfileUpdated'])
    assert.equal(actions[2].details, 'correo cambiado')
  })

  test('las observaciones privadas son solo para la entrenadora y no se pueden borrar', async () => {
    const t = await trainer()
    const created = await newClient(t)
    const secret = 'Observación privada: revisar técnica de bisagra'
    await json(await t.post(`${CLIENTS}/${created.clientId}/notes`, { content: secret }), 201)
    await json(await t.post(`${CLIENTS}/${created.clientId}/notes`, { content: 'Segunda nota' }), 201)
    assert.deepEqual(await errorKeys(await t.post(`${CLIENTS}/${created.clientId}/notes`, { content: '  ' })), ['content'])
    assert.deepEqual(await errorKeys(await t.post(`${CLIENTS}/${created.clientId}/notes`, { content: 'x'.repeat(4001) })), ['content'])
    const notes = await json(await t.get(`${CLIENTS}/${created.clientId}/notes`), 200)
    assert.deepEqual(notes.map((n) => n.content), ['Segunda nota', secret], 'la más reciente primero')

    const client = await clientSession(created)
    assert.doesNotMatch(await (await client.get('/api/portal/profile')).text(), /revisar técnica/)
    assert.doesNotMatch(await (await client.get('/api/portal/assignments')).text(), /revisar técnica/)
    assert.equal((await client.get(`${CLIENTS}/${created.clientId}/notes`)).status, 403)
    assert.equal((await client.get(`${CLIENTS}/${created.clientId}/profile`)).status, 403)
    assert.throws(() => sql(`DELETE FROM client_notes WHERE client_id = ${created.clientId}`), /history_is_permanent/)
    assert.throws(() => sql(`UPDATE client_notes SET content = 'x' WHERE client_id = ${created.clientId}`), /history_is_permanent/)
  })
})

describe('asignaciones', () => {
  test('una versión se asigna a varios clientes sin copiar sus ejercicios; cada cliente ve solo lo suyo', async () => {
    const t = await trainer()
    const ana = await newClient(t, 'Ana')
    const bea = await newClient(t, 'Bea')
    const { routineId, versionId } = await publishedRoutine(t)
    const daysBefore = sql(`SELECT COUNT(*) AS n FROM routine_days`)[0].n

    const { ids } = await json(await assign(t, [ana.clientId, bea.clientId, ana.clientId], versionId, TODAY, day(41), ' Calienta 10 minutos antes '), 201)
    assert.equal(ids.length, 2, 'un cliente repetido cuenta una vez')
    assert.equal(sql(`SELECT COUNT(*) AS n FROM routine_days`)[0].n, daysBefore)

    for (const c of [ana, bea]) {
      const [a, ...rest] = await assignmentsOf(t, c.clientId)
      assert.equal(rest.length, 0)
      assert.deepEqual([a.routineVersionId, a.versionNumber, a.status, a.statusLabel, a.startDate, a.endDate, a.routineId, a.routineName, a.notes],
        [versionId, 1, 'Active', 'Vigente', TODAY, day(41), routineId, 'Glúteo 6 semanas', 'Calienta 10 minutos antes'])
      assert.deepEqual([a.latestVersionNumber, a.latestVersionId], [1, versionId])
    }
    const byRoutine = await json(await t.get(`${ROUTINES}/${routineId}/assignments`), 200)
    assert.deepEqual(byRoutine.map((a) => a.clientId).sort(), [ana.clientId, bea.clientId].sort())
    const list = await json(await t.get(CLIENTS), 200)
    for (const c of [ana, bea]) assert.equal(list.find((x) => x.id === c.clientId).currentProgram, 'Glúteo 6 semanas')

    const anaSession = await clientSession(ana)
    const mine = await json(await anaSession.get('/api/portal/assignments'), 200)
    assert.deepEqual(mine, [{ id: ids[0], routineName: 'Glúteo 6 semanas', versionNumber: 1, startDate: TODAY, endDate: day(41), status: 'Active', statusLabel: 'Vigente', notes: 'Calienta 10 minutos antes' }])
    assert.equal(sql(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'AssignmentCreated' AND entity_id IN ('${ids[0]}', '${ids[1]}')`)[0].n, 2)
  })

  test('varias rutinas vigentes a la vez se muestran juntas en la lista de clientes', async () => {
    const t = await trainer()
    const c = await newClient(t)
    const gym = await publishedRoutine(t, 'Gimnasio')
    const home = await publishedRoutine(t, 'Casa')
    await json(await assign(t, [c.clientId], gym.versionId, day(-2)), 201)
    await json(await assign(t, [c.clientId], home.versionId, TODAY), 201)
    await json(await assign(t, [c.clientId], home.versionId, day(3)), 201)
    assert.equal((await json(await t.get(CLIENTS), 200)).find((x) => x.id === c.clientId).currentProgram, 'Casa · Gimnasio')
    assert.deepEqual((await assignmentsOf(t, c.clientId)).map((a) => [a.routineName, a.status]), [['Casa', 'Active'], ['Gimnasio', 'Active'], ['Casa', 'Scheduled']])
  })

  test('solo se asignan rutinas publicadas de la entrenadora a clientes activos', async () => {
    const t = await trainer()
    const client = await newClient(t)
    const { routineId, versionId } = await publishedRoutine(t)
    const { id: draftOnly } = await json(await t.post(ROUTINES, { kind: 1, title: 'Solo borrador' }), 201)
    const draftVersion = (await json(await t.get(`${ROUTINES}/${draftOnly}`), 200)).draftVersionId
    assert.deepEqual(await errorKeys(await assign(t, [client.clientId], draftVersion, TODAY)), ['routineVersionId'])
    const template = await publishedRoutine(t, 'Plantilla base', 2)
    assert.deepEqual(await errorKeys(await assign(t, [client.clientId], template.versionId, TODAY)), ['routineVersionId'])
    assert.deepEqual(await errorKeys(await assign(t, [client.clientId], versionId, TODAY, day(-1))), ['endDate'])
    assert.deepEqual(await errorKeys(await assign(t, [], versionId, TODAY)), ['clientIds'])
    assert.deepEqual(await errorKeys(await assign(t, [client.clientId], versionId, '2026-02-30')), ['startDate'])
    assert.deepEqual(await errorKeys(await assign(t, [client.clientId], versionId, null)), ['startDate'])
    assert.deepEqual(await errorKeys(await assign(t, [client.clientId], null, TODAY)), ['routineVersionId'])
    assert.deepEqual(await errorKeys(await assign(t, [client.clientId], versionId, TODAY, null, 'x'.repeat(1001))), ['notes'])

    await json(await t.post(`${ROUTINES}/${routineId}/archive`), 204)
    assert.deepEqual(await errorKeys(await assign(t, [client.clientId], versionId, TODAY)), ['routineVersionId'])
    await json(await t.post(`${ROUTINES}/${routineId}/restore`), 204)

    await json(await t.post(`${CLIENTS}/${client.clientId}/access`, { enabled: false }), 204)
    assert.deepEqual(await errorKeys(await assign(t, [client.clientId], versionId, TODAY)), ['clientIds'])
    assert.deepEqual(await assignmentsOf(t, client.clientId), [])
    // La base misma rechaza una asignación a una versión que no está publicada.
    assert.throws(() => sql(`INSERT INTO routine_assignments (client_id, routine_version_id, assigned_by_user_id, start_date, status, created_at, updated_at)
                             VALUES (${client.clientId}, ${draftVersion}, 1, '${TODAY}', 2, 'x', 'x')`), /assignment_requires_published_version/)
  })

  test('una versión nueva no cambia la asignación; cambiar de programa conserva el historial', async () => {
    const t = await trainer()
    const client = await newClient(t)
    const { routineId, versionId: v1 } = await publishedRoutine(t)
    const [first] = (await json(await assign(t, [client.clientId], v1, day(-14)), 201)).ids
    const v2 = await publishNext(t, routineId, 'Glúteo 6 semanas')
    const [current] = await assignmentsOf(t, client.clientId)
    assert.deepEqual([current.routineVersionId, current.versionNumber, current.latestVersionNumber, current.latestVersionId], [v1, 1, 2, v2])

    await json(await t.post(`${ASSIGNMENTS}/${first}/end-date`, { endDate: day(-1) }), 204)
    await json(await assign(t, [client.clientId], v2, TODAY), 201)
    const history = await assignmentsOf(t, client.clientId)
    assert.deepEqual(history.map((a) => [a.routineVersionId, a.status]), [[v2, 'Active'], [v1, 'Completed']])
    assert.equal(history[1].endDate, day(-1))
    assert.equal((await t.post(`${ASSIGNMENTS}/${first}/cancel`)).status, 409)
    assert.deepEqual(await errorKeys(await t.post(`${ASSIGNMENTS}/${history[0].id}/end-date`, { endDate: day(-30) })), ['endDate'])
    assert.deepEqual(await errorKeys(await t.post(`${ASSIGNMENTS}/${history[0].id}/end-date`, {})), ['endDate'])
    // Extender un programa terminado lo vuelve a dejar vigente.
    await json(await t.post(`${ASSIGNMENTS}/${first}/end-date`, { endDate: day(10) }), 204)
    assert.equal((await assignmentsOf(t, client.clientId)).find((a) => a.id === first).status, 'Active')
    assert.throws(() => sql(`DELETE FROM routine_assignments WHERE id = ${first}`), /history_is_permanent/)
    assert.throws(() => sql(`UPDATE routine_assignments SET routine_version_id = ${v2} WHERE id = ${first}`), /history_is_permanent/)
    const actions = sql(`SELECT action FROM audit_logs WHERE entity_type = 'RoutineAssignment' AND entity_id = '${first}' ORDER BY id`).map((r) => r.action)
    assert.deepEqual(actions, ['AssignmentCreated', 'AssignmentEndDateSet', 'AssignmentEndDateSet'])
  })

  test('una asignación futura se cancela y queda como historial para la entrenadora, no para el cliente', async () => {
    const t = await trainer()
    const created = await newClient(t)
    const { versionId } = await publishedRoutine(t)
    const [id] = (await json(await assign(t, [created.clientId], versionId, day(7)), 201)).ids
    assert.equal((await assignmentsOf(t, created.clientId))[0].status, 'Scheduled')
    await json(await t.post(`${ASSIGNMENTS}/${id}/cancel`), 204)
    const [a] = await assignmentsOf(t, created.clientId)
    assert.deepEqual([a.status, a.statusLabel], ['Cancelled', 'Cancelada'])
    assert.equal((await t.post(`${ASSIGNMENTS}/${id}/end-date`, { endDate: day(10) })).status, 409)
    const client = await clientSession(created)
    assert.deepEqual(await json(await client.get('/api/portal/assignments'), 200), [])
  })

  test('desactivar un cliente conserva asignaciones y observaciones', async () => {
    const t = await trainer()
    const created = await newClient(t)
    const { versionId } = await publishedRoutine(t)
    await json(await assign(t, [created.clientId], versionId, day(-3)), 201)
    await json(await t.post(`${CLIENTS}/${created.clientId}/notes`, { content: 'Nota' }), 201)
    await json(await t.post(`${CLIENTS}/${created.clientId}/access`, { enabled: false }), 204)
    const p = await json(await t.get(`${CLIENTS}/${created.clientId}/profile`), 200)
    assert.equal(p.status, 'Inactive')
    assert.ok(p.deactivatedAt)
    assert.equal((await assignmentsOf(t, created.clientId)).length, 1)
    assert.equal((await json(await t.get(`${CLIENTS}/${created.clientId}/notes`), 200)).length, 1)
    await json(await t.post(`${CLIENTS}/${created.clientId}/access`, { enabled: true }), 204)
    assert.equal((await json(await t.get(`${CLIENTS}/${created.clientId}/profile`), 200)).deactivatedAt, null)
  })

  test('otra entrenadora no ve ni cambia perfiles, observaciones ni asignaciones; un cliente recibe 403', async () => {
    const t1 = await trainer()
    const t2 = await trainer(OTHER)
    const created = await newClient(t1)
    const { routineId, versionId } = await publishedRoutine(t1)
    const [id] = (await json(await assign(t1, [created.clientId], versionId, day(5)), 201)).ids

    assert.equal((await t2.get(`${CLIENTS}/${created.clientId}/profile`)).status, 404)
    assert.equal((await t2.put(`${CLIENTS}/${created.clientId}/profile`, profile(created.email))).status, 404)
    assert.equal((await t2.get(`${CLIENTS}/${created.clientId}/notes`)).status, 404)
    assert.equal((await t2.post(`${CLIENTS}/${created.clientId}/notes`, { content: 'x' })).status, 404)
    assert.equal((await t2.get(`${CLIENTS}/${created.clientId}/assignments`)).status, 404)
    assert.equal((await t2.post(`${ASSIGNMENTS}/${id}/cancel`)).status, 404)
    assert.equal((await t2.post(`${ASSIGNMENTS}/${id}/end-date`, { endDate: day(9) })).status, 404)
    assert.deepEqual(await json(await t2.get(`${ROUTINES}/${routineId}/assignments`), 200), [])

    const other = await publishedRoutine(t2)
    const own = await newClient(t2)
    assert.equal((await assign(t2, [created.clientId], other.versionId, TODAY)).status, 404)
    assert.equal((await assign(t2, [own.clientId], versionId, TODAY)).status, 404)

    const client = await clientSession(created)
    assert.equal((await assign(client, [created.clientId], versionId, TODAY)).status, 403)
    assert.equal((await client.get(`${CLIENTS}/${created.clientId}/assignments`)).status, 403)
    assert.equal((await t1.get('/api/portal/profile')).status, 403)
    assert.equal((await new Session().get('/api/portal/assignments')).status, 401)
  })
})

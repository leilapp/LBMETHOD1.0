// Pruebas de la etapa 3 (constructor manual de rutinas, versiones y plantillas) contra el Worker real.
//   npm test
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { describe, test } from 'node:test'
import { OTHER, Session, sql, trainer, useServer } from './helpers.mjs'

useServer()

const BASE = '/api/trainer/routines'
const LIB = '/api/trainer/library'
let counter = 0

const json = async (res, status) => {
  assert.equal(res.status, status, `respuesta ${res.status}: ${await res.clone().text()}`)
  return res.status === 204 ? null : res.json()
}
const exercise = async (s, name) =>
  (await json(await s.post(`${LIB}/exercises`, { nameEs: `${name} ${++counter}`, type: 1, primaryMuscleGroupId: 1 }), 201)).id
const Ex = (exerciseId, { sets = 3, repsMin = 8, repsMax = 12, superset = null, setType = 1, details = [], weight = null, unit = null, rest = 90, rir = null, rpe = null } = {}) => ({
  exerciseId, supersetGroup: superset, sets, repsMin, repsMax, suggestedWeight: weight, suggestedWeightUnit: unit,
  restSeconds: rest, tempo: '3-1-1-0', rir, rpe, setType, notes: 'Controlar la bajada', setDetails: details,
})
const Draft = (draftVersionId, title, ...days) => ({ draftVersionId, title, description: 'Bloque de fuerza', goal: 'Hipertrofia de glúteo', durationWeeks: 6, days })
const Day = (name, dayOfWeek, ...exercises) => ({ name, dayOfWeek, notes: null, exercises })
const newRoutine = async (s, title = 'Programa', kind = 1) => {
  const { id } = await json(await s.post(BASE, { kind, title, goal: 'Hipertrofia', durationWeeks: 6 }), 201)
  return { routineId: id, draftId: (await json(await s.get(`${BASE}/${id}`), 200)).draftVersionId }
}
const version = async (s, routineId, versionId) => json(await s.get(`${BASE}/${routineId}/versions/${versionId}`), 200)
const save = (s, routineId, body) => s.put(`${BASE}/${routineId}/draft`, body)
const publish = (s, routineId, draftVersionId, changeNotes) => s.post(`${BASE}/${routineId}/publish`, { draftVersionId, changeNotes })

describe('constructor', () => {
  test('arma la rutina por días, la guarda, la recarga desde D1 y respeta el nuevo orden', async () => {
    const t = await trainer()
    const [hip, rdl, abd] = [await exercise(t, 'Hip thrust'), await exercise(t, 'Peso muerto rumano'), await exercise(t, 'Abducción')]
    const { routineId, draftId } = await newRoutine(t, 'Glúteo 6 semanas')
    const masterBefore = await (await t.get(`${LIB}/exercises/${hip}`)).text()

    await json(await save(t, routineId, Draft(draftId, '  Glúteo 6 semanas ',
      Day('Día 1 - Glúteo', 1, Ex(hip, { sets: 4, weight: 60.25, unit: 1, rir: 2 }), Ex(rdl, { sets: 3, repsMin: 10, repsMax: 10, superset: 'a', rpe: 7.5 }), Ex(abd, { repsMin: 15, repsMax: 20, superset: 'A', rest: 60 })),
      Day('Día 2 - Pierna', 3, Ex(hip, { sets: 3, details: [
        { setType: 2, repsMin: 12, repsMax: 12, suggestedWeight: 20, suggestedWeightUnit: 1, restSeconds: 60 },
        { setType: 1, repsMin: 8, repsMax: 10, suggestedWeight: 70, suggestedWeightUnit: 1, restSeconds: 120, rir: 1 },
        { setType: 3, repsMin: null, repsMax: null, restSeconds: 0, notes: 'Bajar 20% y al fallo técnico' },
      ] })),
    )), 204)

    const v = await version(t, routineId, draftId)
    assert.equal(v.status, 'Draft')
    assert.equal(v.title, 'Glúteo 6 semanas')
    assert.equal(v.durationWeeks, 6)
    assert.deepEqual(v.days.map((d) => [d.name, d.dayLabel, d.position]), [['Día 1 - Glúteo', 'Lunes', 1], ['Día 2 - Pierna', 'Miércoles', 2]])
    const day1 = v.days[0].exercises
    assert.deepEqual(day1.map((e) => [e.exerciseId, e.position]), [[hip, 1], [rdl, 2], [abd, 3]])
    assert.deepEqual([day1[0].suggestedWeight, day1[0].suggestedWeightUnit, day1[0].rir, day1[1].rpe], [60.25, 1, 2, 7.5])
    assert.deepEqual([day1[1].supersetGroup, day1[2].supersetGroup], ['A', 'A'], 'la superserie se guarda en mayúscula')
    assert.equal(day1[0].primaryMuscleGroup, 'Glúteos')
    assert.equal(day1[0].tempo, '3-1-1-0')
    assert.equal(day1[0].setTypeLabel, 'Efectiva')
    const detailed = v.days[1].exercises[0]
    assert.equal(detailed.sets, 3, 'el número de series sale del detalle')
    assert.deepEqual(detailed.setDetails.map((s) => s.setTypeLabel), ['Calentamiento', 'Efectiva', 'Dropset'])
    assert.deepEqual(detailed.setDetails[2], { setNumber: 3, setType: 3, setTypeLabel: 'Dropset', repsMin: null, repsMax: null, suggestedWeight: null, suggestedWeightUnit: null, restSeconds: 0, rir: null, rpe: null, notes: 'Bajar 20% y al fallo técnico' })

    assert.equal(await (await t.get(`${LIB}/exercises/${hip}`)).text(), masterBefore, 'el ejercicio de la biblioteca no cambia')

    await json(await save(t, routineId, Draft(draftId, 'Glúteo 6 semanas', Day('Día 2 - Pierna', 3, Ex(abd), Ex(hip)), Day('Día 1 - Glúteo', 1, Ex(rdl), Ex(hip)))), 204)
    const reordered = await version(t, routineId, draftId)
    assert.deepEqual(reordered.days.map((d) => d.name), ['Día 2 - Pierna', 'Día 1 - Glúteo'])
    assert.deepEqual(reordered.days.map((d) => d.exercises.map((e) => e.exerciseId)), [[abd, hip], [rdl, hip]])
    assert.equal(sql(`SELECT COUNT(*) AS n FROM routine_exercise_sets s JOIN routine_exercises e ON e.id = s.routine_exercise_id JOIN routine_days d ON d.id = e.routine_day_id WHERE d.routine_version_id = ${draftId}`)[0].n, 0, 'no quedan series huérfanas')

    const options = await json(await t.get(`${BASE}/options`), 200)
    assert.deepEqual(options.daysOfWeek.map((d) => d.value), [1, 2, 3, 4, 5, 6, 0])
    assert.deepEqual(options.setTypes.map((s) => s.label), ['Efectiva', 'Calentamiento', 'Dropset', 'Al fallo', 'Rest-pause', 'Back-off', 'Otra'])
    assert.deepEqual(options.weightUnits, [{ value: 1, label: 'kg' }, { value: 2, label: 'lb' }])
  })

  test('los parámetros no válidos se rechazan con la ruta exacta del campo', async () => {
    const t = await trainer()
    const hip = await exercise(t, 'Hip thrust')
    const { routineId, draftId } = await newRoutine(t)
    const rejected = async (x) => Object.keys((await json(await save(t, routineId, Draft(draftId, 'Programa', Day('Día 1', null, x))), 400)).errors)

    assert.deepEqual(await rejected(Ex(hip, { repsMin: 12, repsMax: 8 })), ['days[0].exercises[0].repsMax'])
    assert.deepEqual(await rejected(Ex(hip, { sets: 0 })), ['days[0].exercises[0].sets'])
    assert.deepEqual(await rejected(Ex(hip, { weight: 50 })), ['days[0].exercises[0].suggestedWeightUnit'])
    assert.deepEqual(await rejected(Ex(hip, { rir: 11 })), ['days[0].exercises[0].rir'])
    assert.deepEqual(await rejected(Ex(hip, { rpe: 7.3 })), ['days[0].exercises[0].rpe'])
    assert.deepEqual(await rejected(Ex(999999)), ['days[0].exercises[0].exerciseId'])
    assert.deepEqual(await rejected(Ex(hip, { superset: 'Super serie' })), ['days[0].exercises[0].supersetGroup'])
    assert.deepEqual(await rejected({ ...Ex(hip), sets: 'tres' }), ['days[0].exercises[0].sets'])
    assert.deepEqual(await rejected(Ex(hip, { details: [{ setType: 7, repsMin: 5, repsMax: 3 }] })), ['days[0].exercises[0].setDetails[0].setType', 'days[0].exercises[0].setDetails[0].repsMax'])
    assert.deepEqual(await rejected(Ex(hip, { details: Array.from({ length: 31 }, () => ({ setType: 1 })) })), ['days[0].exercises[0].sets'])
    const many = await json(await save(t, routineId, Draft(draftId, 'Programa', ...Array.from({ length: 15 }, (_, i) => Day(`Día ${i}`, null)))), 400)
    assert.deepEqual(many.errors.days, ['Máximo 14 días por rutina.'])

    await json(await save(t, routineId, Draft(draftId, 'Programa', Day('Día 1', null, Ex(hip, { repsMin: null, repsMax: null, rest: null })))), 204)
    const noTitle = await json(await save(t, routineId, { draftVersionId: draftId, title: '', days: [{ name: '' }] }), 400)
    assert.deepEqual(Object.keys(noTitle.errors).sort(), ['days[0].name', 'title'])
    const header = await json(await save(t, routineId, { ...Draft(draftId, 'x'.repeat(151)), durationWeeks: 105, goal: 'g'.repeat(501) }), 400)
    assert.deepEqual(Object.keys(header.errors).sort(), ['durationWeeks', 'goal', 'title'])
    assert.ok((await json(await t.post(BASE, { title: 'Sin tipo' }), 400)).errors.kind)
    assert.ok((await json(await t.post(BASE, { kind: 3, title: 'Tipo raro' }), 400)).errors.kind)
    assert.ok((await json(await save(t, routineId, { title: 'x' }), 400)).errors.draftVersionId)
  })
})

describe('versiones', () => {
  test('publicar deja la versión fija; editar crea la siguiente versión sin tocar la anterior', async () => {
    const t = await trainer()
    const hip = await exercise(t, 'Hip thrust')
    const squat = await exercise(t, 'Sentadilla')
    const { routineId, draftId } = await newRoutine(t)

    assert.ok((await json(await publish(t, routineId, draftId), 400)).errors.days, 'no se publica vacía')
    await save(t, routineId, Draft(draftId, 'Programa', Day('Día 1', 1, Ex(hip, { superset: 'A' }))))
    assert.match(JSON.stringify((await json(await publish(t, routineId, draftId), 400)).errors), /superserie A/)
    await save(t, routineId, Draft(draftId, 'Programa', Day('Día 1', 1, Ex(hip, { sets: 4 })), Day('Día 2', 2)))
    assert.match(JSON.stringify((await json(await publish(t, routineId, draftId), 400)).errors), /«Día 2» no tiene ejercicios/)

    await save(t, routineId, Draft(draftId, 'Programa', Day('Día 1', 1, Ex(hip, { sets: 4 }))))
    const v1 = (await json(await publish(t, routineId, draftId, ' Primera versión '), 200)).id
    assert.equal(v1, draftId)
    assert.equal((await save(t, routineId, Draft(v1, 'Cambiado', Day('Día 1', 1, Ex(squat))))).status, 409)
    assert.equal((await publish(t, routineId, v1)).status, 409)

    const v2 = (await json(await t.post(`${BASE}/${routineId}/draft`), 200)).id
    assert.notEqual(v2, v1)
    assert.equal((await json(await t.post(`${BASE}/${routineId}/draft`), 200)).id, v2, 'un solo borrador')
    const draft2 = await version(t, routineId, v2)
    assert.deepEqual([draft2.versionNumber, draft2.sourceVersionId, draft2.days[0].exercises[0].exerciseId], [2, v1, hip])

    await save(t, routineId, Draft(v2, 'Programa', Day('Día 1', 1, Ex(squat, { sets: 5, repsMin: 5, repsMax: 5 }))))
    await json(await publish(t, routineId, v2, 'Cambio a sentadilla'), 200)

    const first = await version(t, routineId, v1)
    assert.deepEqual([first.status, first.changeNotes, first.days[0].exercises[0].exerciseId, first.days[0].exercises[0].sets], ['Published', 'Primera versión', hip, 4])
    assert.ok(first.publishedAt)
    const detail = await json(await t.get(`${BASE}/${routineId}`), 200)
    assert.deepEqual(detail.versions.map((x) => [x.versionNumber, x.status]), [[2, 'Published'], [1, 'Published']])
    assert.equal(detail.draftVersionId, null)
    assert.equal(detail.latestPublishedVersionId, v2)
    assert.equal(detail.versions[0].changeNotes, 'Cambio a sentadilla')
    assert.equal(sql(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'RoutinePublished' AND entity_id = '${routineId}' AND details = 'v2'`)[0].n, 1)
  })

  test('la base misma impide modificar una versión publicada, aunque se intente directamente', async () => {
    const t = await trainer()
    const hip = await exercise(t, 'Hip thrust')
    const { routineId, draftId } = await newRoutine(t)
    await save(t, routineId, Draft(draftId, 'Programa', Day('Día 1', 1, Ex(hip, { details: [{ setType: 1, repsMin: 5, repsMax: 5 }] }))))
    await json(await publish(t, routineId, draftId), 200)
    const attempts = [
      `UPDATE routine_versions SET title = 'Cambiada' WHERE id = ${draftId}`,
      `DELETE FROM routine_versions WHERE id = ${draftId}`,
      `UPDATE routine_days SET name = 'Otro' WHERE routine_version_id = ${draftId}`,
      `DELETE FROM routine_days WHERE routine_version_id = ${draftId}`,
      `INSERT INTO routine_days (routine_version_id, position, name, created_at, updated_at) VALUES (${draftId}, 9, 'Nuevo', 'x', 'x')`,
      `UPDATE routine_exercises SET sets = 9 WHERE routine_day_id IN (SELECT id FROM routine_days WHERE routine_version_id = ${draftId})`,
      `UPDATE routine_exercise_sets SET reps_min = 1 WHERE routine_exercise_id IN (SELECT e.id FROM routine_exercises e JOIN routine_days d ON d.id = e.routine_day_id WHERE d.routine_version_id = ${draftId})`,
    ]
    for (const statement of attempts) assert.throws(() => sql(statement), /published_version_immutable/, statement)
    const [v] = sql(`SELECT v.title, d.name, e.sets, s.reps_min, (SELECT COUNT(*) FROM routine_days WHERE routine_version_id = v.id) AS days
                       FROM routine_versions v JOIN routine_days d ON d.routine_version_id = v.id JOIN routine_exercises e ON e.routine_day_id = d.id
                       JOIN routine_exercise_sets s ON s.routine_exercise_id = e.id WHERE v.id = ${draftId}`)
    assert.deepEqual(v, { title: 'Programa', name: 'Día 1', sets: 1, reps_min: 5, days: 1 })
  })

  test('un ejercicio desactivado impide publicar, pero las versiones anteriores lo conservan', async () => {
    const t = await trainer()
    const hip = await exercise(t, 'Hip thrust')
    const { routineId, draftId } = await newRoutine(t)
    await save(t, routineId, Draft(draftId, 'Programa', Day('Día 1', 1, Ex(hip))))
    await json(await publish(t, routineId, draftId), 200)
    await json(await t.post(`${LIB}/exercises/${hip}/status`, { active: false }), 204)
    assert.equal((await version(t, routineId, draftId)).days[0].exercises[0].exerciseIsActive, false)
    const v2 = (await json(await t.post(`${BASE}/${routineId}/draft`), 200)).id
    assert.match(JSON.stringify((await json(await publish(t, routineId, v2), 400)).errors['days[0].exercises[0].exerciseId']), /desactivado/)
  })

  test('descartar el borrador conserva las versiones publicadas', async () => {
    const t = await trainer()
    const hip = await exercise(t, 'Hip thrust')
    const { routineId, draftId } = await newRoutine(t)
    assert.equal((await t.delete(`${BASE}/${routineId}/draft`)).status, 409, 'sin versiones publicadas se archiva en lugar de descartar')
    await save(t, routineId, Draft(draftId, 'Programa', Day('Día 1', 1, Ex(hip))))
    await publish(t, routineId, draftId)
    const v2 = (await json(await t.post(`${BASE}/${routineId}/draft`), 200)).id
    // Una copia hecha desde el borrador conserva su contenido aunque el borrador se descarte.
    const copy = (await json(await t.post(`${BASE}/${routineId}/copy`, { kind: 1, title: 'Copia del borrador' }), 201)).id
    await json(await t.delete(`${BASE}/${routineId}/draft`), 204)
    const detail = await json(await t.get(`${BASE}/${routineId}`), 200)
    assert.equal(detail.draftVersionId, null)
    assert.deepEqual(detail.versions.map((x) => x.id), [draftId])
    assert.equal((await t.get(`${BASE}/${routineId}/versions/${v2}`)).status, 404)
    assert.equal((await t.delete(`${BASE}/${routineId}/draft`)).status, 404)
    const copied = await json(await t.get(`${BASE}/${copy}`), 200)
    assert.equal((await version(t, copy, copied.draftVersionId)).days[0].exercises[0].exerciseId, hip)
  })
})

describe('plantillas, copias y archivo', () => {
  test('duplicar, guardar como plantilla y crear desde plantilla copian sin tocar el original', async () => {
    const t = await trainer()
    const hip = await exercise(t, 'Hip thrust')
    const { routineId, draftId } = await newRoutine(t, 'Original')
    await save(t, routineId, Draft(draftId, 'Original', Day('Día 1', 1, Ex(hip, { sets: 4, superset: 'A', weight: 42.5, unit: 2 }), Ex(hip, { sets: 2, superset: 'A', setType: 3, details: [{ setType: 3, repsMin: 10, repsMax: 12 }, { setType: 3 }] }))))
    await publish(t, routineId, draftId)

    const copyId = (await json(await t.post(`${BASE}/${routineId}/copy`, { kind: 1, title: 'Original (copia)' }), 201)).id
    const templateId = (await json(await t.post(`${BASE}/${routineId}/copy`, { kind: 2, title: 'Plantilla glúteo' }), 201)).id
    const fromTemplateId = (await json(await t.post(`${BASE}/${templateId}/copy`, { kind: 1, title: 'Programa de Ana' }), 201)).id
    const sameTitle = (await json(await t.post(`${BASE}/${routineId}/copy`, { kind: 1, title: '  ', versionId: draftId }), 201)).id
    assert.equal((await t.post(`${BASE}/${routineId}/copy`, { kind: 1, versionId: 999999 })).status, 404)

    for (const [rid, kind, title] of [[copyId, 'Program', 'Original (copia)'], [templateId, 'Template', 'Plantilla glúteo'], [fromTemplateId, 'Program', 'Programa de Ana'], [sameTitle, 'Program', 'Original']]) {
      const d = await json(await t.get(`${BASE}/${rid}`), 200)
      assert.equal(d.kind, kind)
      const v = await version(t, rid, d.draftVersionId)
      assert.deepEqual([v.title, v.status, v.routineKind, v.goal, v.durationWeeks], [title, 'Draft', kind, 'Hipertrofia de glúteo', 6])
      assert.deepEqual(v.days[0].exercises.map((e) => e.supersetGroup), ['A', 'A'])
      assert.deepEqual([v.days[0].exercises[0].suggestedWeight, v.days[0].exercises[0].suggestedWeightUnit], [42.5, 2])
      assert.equal(v.days[0].exercises[1].setTypeLabel, 'Dropset')
      assert.deepEqual(v.days[0].exercises[1].setDetails.map((s) => [s.setNumber, s.repsMin]), [[1, 10], [2, null]])
      assert.ok(v.sourceVersionId)
    }

    const copy = await json(await t.get(`${BASE}/${copyId}`), 200)
    await save(t, copyId, Draft(copy.draftVersionId, 'Original (copia)', Day('Otro', 2, Ex(hip, { sets: 1 }))))
    assert.equal((await version(t, routineId, draftId)).days[0].exercises.length, 2, 'el original no cambia')

    const programs = await json(await t.get(BASE), 200)
    const templates = await json(await t.get(`${BASE}?kind=template`), 200)
    for (const rid of [routineId, copyId, fromTemplateId, sameTitle]) assert.ok(programs.some((p) => p.id === rid))
    assert.ok(templates.some((p) => p.id === templateId))
    assert.equal(programs.some((p) => p.id === templateId) || templates.some((p) => p.id === routineId), false, 'cada una en su lista')
    assert.equal(programs[0].id, copyId, 'el más reciente primero')
    const orig = programs.find((p) => p.id === routineId)
    assert.deepEqual([orig.kind, orig.status, orig.publishedVersionNumber, orig.hasDraft, orig.dayCount, orig.exerciseCount, orig.goal], ['Program', 'Active', 1, false, 1, 2, 'Hipertrofia de glúteo'])
    assert.deepEqual((await json(await t.get(`${BASE}?q=DE%20ANA`), 200)).map((p) => p.id), [fromTemplateId], 'búsqueda sin mayúsculas')
    assert.deepEqual((await json(await t.get(`${BASE}?q=gluteo&kind=template`), 200)).map((p) => p.id), [templateId], 'búsqueda sin acentos')
  })

  test('archivar oculta la rutina, conserva las versiones y se puede restaurar', async () => {
    const t = await trainer()
    const { routineId, draftId } = await newRoutine(t, 'Para archivar')
    await json(await t.post(`${BASE}/${routineId}/archive`), 204)
    assert.equal((await json(await t.get(BASE), 200)).some((r) => r.id === routineId), false)
    const archived = (await json(await t.get(`${BASE}?status=archived`), 200)).find((r) => r.id === routineId)
    assert.equal(archived.status, 'Archived')
    assert.ok((await json(await t.get(`${BASE}/${routineId}`), 200)).archivedAt)
    assert.equal((await save(t, routineId, Draft(draftId, 'Cambio'))).status, 409)
    assert.equal((await t.post(`${BASE}/${routineId}/draft`)).status, 409)
    assert.equal((await publish(t, routineId, draftId)).status, 409)
    await version(t, routineId, draftId)

    await json(await t.post(`${BASE}/${routineId}/restore`), 204)
    await json(await save(t, routineId, Draft(draftId, 'Cambio')), 204)
    assert.equal((await json(await t.get(`${BASE}/${routineId}`), 200)).name, 'Cambio')
    const actions = sql(`SELECT action FROM audit_logs WHERE entity_type = 'Routine' AND entity_id = '${routineId}' ORDER BY id`).map((r) => r.action)
    assert.deepEqual(actions, ['RoutineCreated', 'RoutineArchived', 'RoutineRestored', 'RoutineDraftSaved'])
  })

  test('las rutinas son privadas de su entrenadora y un cliente no puede usar el constructor', async () => {
    const owner = await trainer()
    const { routineId, draftId } = await newRoutine(owner, 'Privada')
    const other = await trainer(OTHER)
    assert.equal((await other.get(`${BASE}/${routineId}`)).status, 404)
    assert.equal((await other.get(`${BASE}/${routineId}/versions/${draftId}`)).status, 404)
    assert.equal((await save(other, routineId, Draft(draftId, 'Robada'))).status, 404)
    assert.equal((await other.post(`${BASE}/${routineId}/draft`)).status, 404)
    assert.equal((await other.delete(`${BASE}/${routineId}/draft`)).status, 404)
    assert.equal((await publish(other, routineId, draftId)).status, 404)
    assert.equal((await other.post(`${BASE}/${routineId}/copy`, { kind: 1 })).status, 404)
    assert.equal((await other.post(`${BASE}/${routineId}/archive`)).status, 404)
    assert.equal((await json(await other.get(BASE), 200)).some((r) => r.id === routineId), false)
    // Tampoco puede guardar en su rutina el borrador de otra entrenadora.
    const mine = await newRoutine(other, 'Mía')
    assert.equal((await save(other, mine.routineId, Draft(draftId, 'Robada'))).status, 404)
    assert.equal((await other.get(`${BASE}/${mine.routineId}/versions/${draftId}`)).status, 404)
    assert.equal(sql(`SELECT title FROM routine_versions WHERE id = ${draftId}`)[0].title, 'Privada')

    const { temporaryPassword } = await json(await owner.post('/api/trainer/clients', { firstName: 'Ana', lastName: 'Cliente', email: 'ana.rutinas@prueba.local' }), 201)
    const client = new Session()
    await client.login({ email: 'ana.rutinas@prueba.local', password: temporaryPassword })
    await client.post('/api/auth/change-password', { currentPassword: temporaryPassword, newPassword: 'MiClaveNueva2026' })
    assert.equal((await client.get(BASE)).status, 403)
    assert.equal((await client.get(`${BASE}/${routineId}/versions/${draftId}`)).status, 403)
    assert.equal((await client.post(BASE, { kind: 1, title: 'x' })).status, 403)
    assert.equal((await new Session().get(BASE)).status, 401)
  })
})

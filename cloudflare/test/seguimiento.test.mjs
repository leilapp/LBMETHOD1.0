// Pruebas de la etapa 6 (medidas, evaluaciones, fotos privadas, progreso, calendario y tablero) contra el Worker real.
//   npm test
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { MAX_PHOTO_BYTES, OTHER, Session, sql, trainer, useServer } from './helpers.mjs'

useServer()

const T = '/api/trainer'
const P = '/api/portal'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
// Tipos de medida del catálogo inicial.
const BODY_WEIGHT = 1
const WAIST = 2
const HIPS = 3
let counter = 0

const json = async (res, status) => {
  assert.equal(res.status, status, `respuesta ${res.status}: ${await res.clone().text()}`)
  return res.status === 204 ? null : res.json()
}
const errorsOf = async (res) => {
  assert.equal(res.status, 400, await res.clone().text())
  return (await res.json()).errors
}
const day = (days = 0) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const TODAY = day()
const dow = (date) => new Date(`${date}T12:00:00Z`).getUTCDay()

const newClient = async (t, firstName = 'Ana') => {
  const email = `cli${++counter}.${Date.now()}@prueba.local`
  const created = await json(await t.post(`${T}/clients`, { firstName, lastName: 'Cliente', email }), 201)
  const s = new Session()
  assert.equal((await s.login({ email, password: created.temporaryPassword })).status, 200)
  await json(await s.post('/api/auth/change-password', { currentPassword: created.temporaryPassword, newPassword: 'MiClaveNueva2026' }), 204)
  s.csrf = null
  return { session: s, clientId: created.clientId }
}
const evaluate = (t, clientId, evaluatedOn, notes, ...measurements) => t.post(`${T}/clients/${clientId}/evaluations`, { evaluatedOn, notes, measurements })
const upload = (s, clientId, bytes, name, fields = {}) => {
  const form = new FormData()
  form.append('file', new Blob([bytes]), name)
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v))
  return s.post(`${T}/clients/${clientId}/photos`, form)
}

/** Rutina publicada de dos días con un ejercicio, asignada desde hoy. */
const assignedRoutine = async (t, clientId, dayA = null, dayB = null) => {
  const ex = (await json(await t.post(`${T}/library/exercises`, { nameEs: `Sentadilla ${++counter} ${Date.now()}`, type: 1, primaryMuscleGroupId: 1 }), 201)).id
  const { id: routineId } = await json(await t.post(`${T}/routines`, { kind: 1, title: 'Pierna 4 semanas', durationWeeks: 4 }), 201)
  const { id: draftId } = await json(await t.post(`${T}/routines/${routineId}/draft`), 200)
  await json(
    await t.put(`${T}/routines/${routineId}/draft`, {
      draftVersionId: draftId, title: 'Pierna 4 semanas', durationWeeks: 4,
      days: [
        { name: 'Día A', dayOfWeek: dayA, exercises: [{ exerciseId: ex, sets: 2, repsMin: 8, repsMax: 10, setType: 1 }] },
        { name: 'Día B', dayOfWeek: dayB, exercises: [{ exerciseId: ex, sets: 2, repsMin: 8, repsMax: 10, setType: 1 }] },
      ],
    }),
    204,
  )
  const { id: versionId } = await json(await t.post(`${T}/routines/${routineId}/publish`, { draftVersionId: draftId }), 200)
  const assignmentId = (await json(await t.post(`${T}/assignments`, { clientIds: [clientId], routineVersionId: versionId, startDate: TODAY }), 201)).ids[0]
  const { days } = await json(await t.get(`${T}/routines/${routineId}/versions/${versionId}`), 200)
  return { assignmentId, dayA: days[0].id, dayB: days[1].id, exerciseId: ex }
}

/** El cliente registra un entrenamiento con los pesos indicados (1 = kg, 2 = lb) y lo finaliza si se pide. */
const logSession = async (client, assignmentId, dayId, sets, finish = true) => {
  const { id } = await json(await client.post(`${P}/sessions`, { assignmentId, routineDayId: dayId }), 200)
  const s = await json(await client.get(`${P}/sessions/${id}`), 200)
  const e = s.exercises[0]
  await json(
    await client.put(`${P}/sessions/${id}`, {
      exercises: [{ id: e.id, isCompleted: true, sets: sets.map(([weight, weightUnit, reps], i) => ({ setNumber: i + 1, reps, weight, weightUnit, isCompleted: true })) }],
    }),
    204,
  )
  if (finish) await json(await client.post(`${P}/sessions/${id}/finish`), 204)
  return id
}

describe('medidas y evaluaciones', () => {
  test('los tipos de medida se configuran con unidades coherentes', async () => {
    const t = await trainer()
    const name = `Cuello ${Date.now()}`
    assert.ok((await errorsOf(await t.post(`${T}/measurement-types`, { nameEs: name, kind: 2, unit: 'kg' }))).unit)
    const { id } = await json(await t.post(`${T}/measurement-types`, { nameEs: name, kind: 2, unit: 'cm' }), 201)
    assert.equal((await t.post(`${T}/measurement-types`, { nameEs: name.toUpperCase(), kind: 2, unit: 'cm' })).status, 409)

    // Mientras no tenga medidas puede cambiar de unidad; después ya no, para no mezclar unidades en el historial.
    await json(await t.put(`${T}/measurement-types/${id}`, { nameEs: name, kind: 2, unit: 'in' }), 204)
    const { clientId } = await newClient(t)
    await json(await evaluate(t, clientId, TODAY, null, { measurementTypeId: id, value: 14.5 }), 201)
    assert.ok((await errorsOf(await t.put(`${T}/measurement-types/${id}`, { nameEs: name, kind: 2, unit: 'cm' }))).unit)
    assert.throws(() => sql(`UPDATE measurement_types SET unit = 'cm' WHERE id = ${id}`), /history_is_permanent/)

    // Desactivar lo oculta para registros nuevos, pero conserva el historial.
    await json(await t.put(`${T}/measurement-types/${id}`, { nameEs: name, kind: 2, unit: 'in', isActive: false }), 204)
    const types = await json(await t.get(`${T}/measurement-types`), 200)
    const mine = types.find((x) => x.id === id)
    assert.deepEqual([mine.isActive, mine.measurementCount, mine.unit, mine.kindLabel], [false, 1, 'in', 'Perímetro'])
    assert.ok(types.some((x) => x.nameEs === 'Peso corporal' && x.unit === 'kg' && x.kind === 1))
    assert.ok((await errorsOf(await evaluate(t, clientId, TODAY, null, { measurementTypeId: id, value: 15 })))['measurements[0].measurementTypeId'])
    const history = await json(await t.get(`${T}/clients/${clientId}/evaluations`), 200)
    assert.deepEqual([history[0].measurements[0].value, history[0].measurements[0].unit], [14.5, 'in'])
    const options = await json(await t.get(`${T}/tracking/options`), 200)
    assert.deepEqual(options.kinds[0], { value: 1, label: 'Peso corporal', units: ['kg', 'lb'] })
    assert.deepEqual(options.eventTypes.map((x) => x.label), ['Entrenamiento', 'Descanso', 'Evaluación', 'Otro'])
  })

  test('las evaluaciones validan fechas, valores y unidades; las correcciones quedan en la bitácora', async () => {
    const t = await trainer()
    const { session: client, clientId } = await newClient(t)

    const errors = await errorsOf(
      await evaluate(t, clientId, day(1), null,
        { measurementTypeId: BODY_WEIGHT, value: 625 }, { measurementTypeId: WAIST, value: null },
        { measurementTypeId: BODY_WEIGHT, value: 62.5 }, { measurementTypeId: HIPS, value: 98.123 }),
    )
    assert.ok(errors.evaluatedOn)
    assert.deepEqual(errors['measurements[0].value'], ['Debe estar entre 1 y 500 kg.'])
    assert.ok(errors['measurements[1].value'] && errors['measurements[2].measurementTypeId'] && errors['measurements[3].value'])
    assert.ok((await errorsOf(await evaluate(t, clientId, TODAY, null))).measurements)

    const { id: first } = await json(
      await evaluate(t, clientId, day(-30), 'Inicio del programa', { measurementTypeId: BODY_WEIGHT, value: 64.2 }, { measurementTypeId: WAIST, value: 74, notes: 'Medida sobre el ombligo' }),
      201,
    )
    const { id: second } = await json(await evaluate(t, clientId, TODAY, null, { measurementTypeId: BODY_WEIGHT, value: 62.8 }), 201)

    // Agregar una medida que faltaba y corregir un valor mal capturado.
    await json(await t.put(`${T}/evaluations/${second}`, { evaluatedOn: TODAY, notes: 'Revisión mensual', measurements: [{ measurementTypeId: WAIST, value: 72.5 }] }), 204)
    assert.ok((await errorsOf(await t.put(`${T}/evaluations/${second}`, { evaluatedOn: TODAY, measurements: [{ measurementTypeId: WAIST, value: 71 }] })))['measurements[0].measurementTypeId'])
    const list = await json(await t.get(`${T}/clients/${clientId}/evaluations`), 200)
    assert.deepEqual(list.map((e) => e.id), [second, first])
    assert.equal(list[0].notes, 'Revisión mensual')
    const wrong = list[1].measurements.find((m) => m.measurementTypeId === WAIST)
    assert.deepEqual([list[1].measurements.find((m) => m.measurementTypeId === BODY_WEIGHT).unit, wrong.unit, wrong.notes, wrong.kind], ['kg', 'cm', 'Medida sobre el ombligo', 'Circumference'])
    await json(await t.put(`${T}/measurements/${wrong.id}`, { value: 75, notes: wrong.notes }), 204)
    assert.equal(sql(`SELECT value_centi FROM measurements WHERE id = ${wrong.id}`)[0].value_centi, 7500)
    assert.equal(sql(`SELECT details FROM audit_logs WHERE action = 'MeasurementCorrected' AND entity_id = '${wrong.id}'`)[0].details, '74.00 cm → 75 cm')
    assert.throws(() => sql(`DELETE FROM measurements WHERE id = ${wrong.id}`), /history_is_permanent/)
    assert.throws(() => sql(`DELETE FROM evaluations WHERE id = ${first}`), /history_is_permanent/)

    // El cliente ve sus evaluaciones pero no puede registrarlas ni ver las de otros.
    const mine = await json(await client.get(`${P}/evaluations`), 200)
    assert.deepEqual(mine.map((e) => e.evaluatedOn), [TODAY, day(-30)])
    assert.equal((await evaluate(client, clientId, TODAY, 'x', { measurementTypeId: BODY_WEIGHT, value: 60 })).status, 403)
    assert.equal((await client.get(`${T}/clients/${clientId}/evaluations`)).status, 403)

    const other = await trainer(OTHER)
    assert.equal((await other.get(`${T}/clients/${clientId}/evaluations`)).status, 404)
    assert.equal((await evaluate(other, clientId, TODAY, 'x')).status, 404)
    assert.equal((await other.put(`${T}/measurements/${wrong.id}`, { value: 70 })).status, 404)
    assert.equal((await other.put(`${T}/evaluations/${first}`, { evaluatedOn: TODAY })).status, 404)
  })
})

describe('fotos de progreso', () => {
  test('son privadas, se validan y solo las ven la clienta y su entrenadora', async () => {
    const t = await trainer()
    const { session: client, clientId } = await newClient(t)
    const { session: otherClient } = await newClient(t, 'Bea')
    const { id: evaluation } = await json(await evaluate(t, clientId, TODAY, null, { measurementTypeId: BODY_WEIGHT, value: 60 }), 201)
    const fields = { takenOn: TODAY, category: 1, evaluationId: evaluation }

    assert.ok((await errorsOf(await upload(t, clientId, Buffer.from('no soy una imagen'), 'foto.jpg', fields))).file)
    const big = Buffer.alloc(MAX_PHOTO_BYTES + 1)
    PNG.copy(big)
    assert.ok((await errorsOf(await upload(t, clientId, big, 'grande.png', fields))).file)
    assert.ok((await errorsOf(await upload(t, clientId, PNG, 'f.png', { takenOn: day(2) }))).takenOn)
    const { id: photoId } = await json(await upload(t, clientId, PNG, 'frente.png', fields), 201)

    const [file] = sql(`SELECT f.owner_client_id, f.content_type, f.storage_key FROM progress_photos p JOIN stored_files f ON f.id = p.stored_file_id WHERE p.id = ${photoId}`)
    assert.deepEqual([file.owner_client_id, file.content_type], [clientId, 'image/png'])
    assert.match(file.storage_key, /^progress\/[0-9a-f]{32}\.png$/)

    const photos = await json(await t.get(`${T}/clients/${clientId}/photos`), 200)
    assert.deepEqual([photos[0].categoryLabel, photos[0].evaluationId, photos[0].url], ['Frente', evaluation, `${T}/photos/${photoId}/content`])
    const res = await t.get(`${T}/photos/${photoId}/content`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('cache-control'), /no-store/)
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG)

    // La propia clienta la ve desde su portal; otra clienta, otra entrenadora o sin sesión, no.
    assert.equal((await client.get(`${P}/photos/${photoId}/content`)).status, 200)
    assert.equal((await json(await client.get(`${P}/evaluations`), 200))[0].photos[0].id, photoId)
    assert.equal((await json(await client.get(`${P}/photos`), 200))[0].url, `${P}/photos/${photoId}/content`)
    assert.equal((await otherClient.get(`${P}/photos/${photoId}/content`)).status, 404)
    assert.deepEqual(await json(await otherClient.get(`${P}/photos`), 200), [])
    assert.equal((await client.get(`${T}/photos/${photoId}/content`)).status, 403)
    assert.equal((await upload(client, clientId, PNG, 'f.png', fields)).status, 403)
    const other = await trainer(OTHER)
    assert.equal((await other.get(`${T}/photos/${photoId}/content`)).status, 404)
    assert.equal((await upload(other, clientId, PNG, 'f.png', fields)).status, 404)
    assert.equal((await new Session().get(`${P}/photos/${photoId}/content`)).status, 401)
    assert.throws(() => sql(`DELETE FROM progress_photos WHERE id = ${photoId}`), /history_is_permanent/)
  })
})

describe('progreso y calendario', () => {
  test('el progreso usa solo datos reales, sin mezclar peso corporal y cargas', async () => {
    const t = await trainer()
    const { session: client, clientId } = await newClient(t)
    const { assignmentId, dayA, dayB, exerciseId } = await assignedRoutine(t, clientId)

    // Dos evaluaciones; la segunda no tiene cintura: no se rellena.
    await json(await evaluate(t, clientId, day(-14), null, { measurementTypeId: BODY_WEIGHT, value: 64 }, { measurementTypeId: WAIST, value: 75 }), 201)
    await json(await evaluate(t, clientId, TODAY, null, { measurementTypeId: BODY_WEIGHT, value: 63.2 }), 201)

    // Dos entrenamientos finalizados (uno en lb) y uno sin terminar, que no cuenta para las cargas.
    await logSession(client, assignmentId, dayA, [[60, 1, 10], [70, 1, 8]])
    await logSession(client, assignmentId, dayB, [[150, 2, 8], [160, 2, 6]])
    await logSession(client, assignmentId, dayA, [[200, 1, 5], [200, 1, 5]], false)

    const p = await json(await t.get(`${T}/clients/${clientId}/progress`), 200)
    const weight = p.measurements.find((s) => s.measurementTypeId === BODY_WEIGHT)
    assert.deepEqual([weight.kind, weight.unit], ['BodyWeight', 'kg'])
    assert.deepEqual(weight.points.map((x) => x.value), [64, 63.2])
    assert.deepEqual(weight.points.map((x) => x.date), [day(-14), TODAY])
    assert.equal(p.measurements.find((s) => s.measurementTypeId === WAIST).points.length, 1)

    const loads = p.exercises.find((e) => e.exerciseId === exerciseId)
    assert.equal(loads.points.length, 2)
    assert.equal(loads.hasConvertedValues, true)
    // Empate de unidades (una sesión en kg, otra en lb): se usa kg y el valor en lb se convierte y se marca.
    assert.equal(loads.unit, 'kg')
    assert.deepEqual([loads.points[0].weight, loads.points[0].reps, loads.points[0].converted], [70, 8, false])
    assert.deepEqual(
      [loads.points[1].weight, loads.points[1].reps, loads.points[1].converted, loads.points[1].originalWeight, loads.points[1].originalUnit],
      [72.57, 6, true, 160, 'lb'],
    )
    assert.equal(loads.points[0].volume, 60 * 10 + 70 * 8)
    assert.ok(!loads.points.some((x) => x.weight === 200))

    assert.deepEqual([p.frequency.completed, p.frequency.inProgress, p.frequency.lastSession], [2, 1, TODAY])
    assert.equal(p.frequency.weeks.length, 12)
    assert.equal(p.frequency.weeks.at(-1).completed, 2)
    assert.equal(dow(p.frequency.weeks.at(-1).weekStart), 1)

    // El cliente ve exactamente lo mismo de sí mismo; la entrenadora puede abrir sus entrenamientos.
    const mine = await json(await client.get(`${P}/progress`), 200)
    assert.deepEqual(mine.exercises[0].points.map((x) => x.weight), loads.points.map((x) => x.weight))
    const sessions = await json(await t.get(`${T}/clients/${clientId}/sessions`), 200)
    assert.equal(sessions.length, 3)
    const detail = await json(await t.get(`${T}/clients/${clientId}/sessions/${sessions.at(-1).id}`), 200)
    assert.deepEqual([detail.exercises[0].sets[0].weight, detail.exercises[0].sets[0].weightUnit], [60, 1])

    const other = await trainer(OTHER)
    assert.equal((await other.get(`${T}/clients/${clientId}/progress`)).status, 404)
    assert.equal((await other.get(`${T}/clients/${clientId}/sessions/${sessions[0].id}`)).status, 404)
    assert.equal((await client.get(`${T}/clients/${clientId}/progress`)).status, 403)
  })

  test('el calendario une eventos, programas, entrenamientos y evaluaciones, con permisos', async () => {
    const t = await trainer()
    const { session: client, clientId } = await newClient(t)
    const { session: otherClient, clientId: otherClientId } = await newClient(t, 'Bea')
    const tomorrow = day(1)
    const { assignmentId, dayA } = await assignedRoutine(t, clientId, dow(TODAY), dow(day(2)))

    const { id: planned } = await json(await t.post(`${T}/calendar/events`, { clientId, type: 3, date: TODAY, startTime: '09:00:00', notes: 'Trae ropa ajustada' }), 201)
    const { id: training } = await json(await t.post(`${T}/calendar/events`, { clientId, type: 1, title: 'Sesión presencial', date: tomorrow, startTime: '18:00:00', endTime: '19:00:00' }), 201)
    const { id: general } = await json(await t.post(`${T}/calendar/events`, { type: 99, title: 'Gimnasio cerrado', date: tomorrow }), 201)
    await json(await t.post(`${T}/calendar/events`, { clientId: otherClientId, type: 1, title: 'Sesión de Bea', date: tomorrow }), 201)

    const errors = await errorsOf(await t.post(`${T}/calendar/events`, { type: 3, startTime: '10:00:00', endTime: '09:00:00' }))
    assert.ok(errors.date && errors.endTime && errors.clientId)
    assert.equal((await t.get(`${T}/calendar?from=${TODAY}&to=${day(90)}`)).status, 400)

    // Un entrenamiento hoy y la evaluación registrada hoy: el evento programado queda como hecho.
    await logSession(client, assignmentId, dayA, [[50, 1, 10], [50, 1, 10]])
    const { id: evaluation } = await json(await evaluate(t, clientId, TODAY, null, { measurementTypeId: BODY_WEIGHT, value: 61 }), 201)
    await json(await t.post(`${T}/calendar/events/${training}/status`, { status: 3 }), 204)
    assert.equal((await t.put(`${T}/calendar/events/${training}`, { clientId, type: 1, date: tomorrow })).status, 409)
    assert.throws(() => sql(`DELETE FROM calendar_events WHERE id = ${training}`), /history_is_permanent/)

    const range = `from=${TODAY}&to=${day(6)}`
    const items = await json(await t.get(`${T}/calendar?${range}&clientId=${clientId}`), 200)
    const today = items.filter((i) => i.date === TODAY)
    assert.ok(today.some((i) => i.kind === 'program-start'))
    assert.ok(today.some((i) => i.kind === 'planned' && i.title === 'Día A' && i.status === 'completed'))
    assert.ok(today.some((i) => i.kind === 'session' && i.status === 'completed'))
    const evalItems = today.filter((i) => i.kind === 'evaluation')
    assert.equal(evalItems.length, 1)
    assert.deepEqual([evalItems[0].eventId, evalItems[0].evaluationId, evalItems[0].status, evalItems[0].startTime], [planned, evaluation, 'completed', '09:00:00'])
    assert.ok(items.some((i) => i.date === day(2) && i.kind === 'planned' && i.title === 'Día B' && i.status === 'planned'))
    assert.ok(items.some((i) => i.date === tomorrow && i.kind === 'rest'))
    assert.ok(items.some((i) => i.date === tomorrow && i.kind === 'training' && i.status === 'cancelled'))
    assert.ok(!items.some((i) => i.eventId === general || i.title === 'Sesión de Bea'))

    // Vista general: todos los clientes y eventos generales, sin días de rutina deducidos.
    const all = await json(await t.get(`${T}/calendar?${range}`), 200)
    assert.ok(all.some((i) => i.eventId === general && i.clientId === null))
    assert.ok(all.some((i) => i.title === 'Sesión de Bea' && i.clientName === 'Bea Cliente'))
    assert.ok(!all.some((i) => i.kind === 'planned' || i.kind === 'rest'))

    // La clienta ve lo suyo, sin cancelados, sin eventos generales ni de otras clientas.
    const mine = await json(await client.get(`${P}/calendar?${range}`), 200)
    assert.ok(mine.some((i) => i.kind === 'evaluation' && i.notes === 'Trae ropa ajustada'))
    assert.ok(mine.some((i) => i.kind === 'rest'))
    assert.ok(!mine.some((i) => i.eventId === training || i.eventId === general || i.title === 'Sesión de Bea'))
    assert.ok(mine.every((i) => i.clientName === null))
    assert.ok(!(await json(await otherClient.get(`${P}/calendar?${range}`), 200)).some((i) => i.clientId === clientId))

    // Sin acceso cruzado.
    const other = await trainer(OTHER)
    assert.equal((await other.get(`${T}/calendar?${range}&clientId=${clientId}`)).status, 404)
    assert.equal((await other.post(`${T}/calendar/events`, { clientId, type: 1, date: TODAY })).status, 404)
    assert.equal((await other.post(`${T}/calendar/events/${planned}/status`, { status: 3 })).status, 404)
    assert.ok(!(await json(await other.get(`${T}/calendar?${range}`), 200)).some((i) => i.clientId === clientId))
    assert.equal((await client.get(`${T}/calendar?${range}`)).status, 403)

    // Inicio de la entrenadora: actividad reciente real.
    const dashboard = await json(await t.get(`${T}/dashboard`), 200)
    assert.ok(dashboard.recentActivity.some((a) => a.kind === 'session' && a.clientId === clientId))
    assert.ok(dashboard.recentActivity.some((a) => a.kind === 'evaluation' && a.evaluationId === evaluation))
  })

  test('el resumen de seguimiento y el inicio muestran las próximas evaluaciones', async () => {
    const t = await trainer()
    const { clientId } = await newClient(t)
    await json(await evaluate(t, clientId, day(-7), null, { measurementTypeId: BODY_WEIGHT, value: 61 }), 201)
    const { id: next } = await json(await t.post(`${T}/calendar/events`, { clientId, type: 3, date: day(5) }), 201)
    await json(await t.post(`${T}/calendar/events`, { clientId, type: 3, date: day(30) }), 201)

    const overview = await json(await t.get(`${T}/tracking`), 200)
    const row = overview.find((c) => c.clientId === clientId)
    assert.deepEqual([row.lastEvaluation, row.nextEvaluation, row.sessionsLast30Days, row.name], [day(-7), day(5), 0, 'Ana Cliente'])

    const dashboard = await json(await t.get(`${T}/dashboard`), 200)
    const upcoming = dashboard.upcomingEvaluations.find((u) => u.clientId === clientId)
    assert.deepEqual([upcoming.eventId, upcoming.clientName, upcoming.title], [next, 'Ana Cliente', 'Evaluación'])
    assert.equal(dashboard.upcomingEvaluations.filter((u) => u.clientId === clientId).length, 1, 'solo los próximos 14 días')

    const other = await trainer(OTHER)
    assert.ok(!(await json(await other.get(`${T}/tracking`), 200)).some((c) => c.clientId === clientId))
    assert.ok(!(await json(await other.get(`${T}/dashboard`), 200)).upcomingEvaluations.some((u) => u.clientId === clientId))
  })
})

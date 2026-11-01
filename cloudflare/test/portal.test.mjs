// Pruebas de la etapa 5 (portal del cliente y registro de entrenamientos serie por serie) contra el Worker real.
//   npm test
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { Session, sql, trainer, useServer } from './helpers.mjs'

useServer()

const ROUTINES = '/api/trainer/routines'
const PORTAL = '/api/portal'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
let counter = 0

const json = async (res, status) => {
  assert.equal(res.status, status, `respuesta ${res.status}: ${await res.clone().text()}`)
  return res.status === 204 ? null : res.json()
}
// Fecha en el centro de México, desplazada «days» días.
const day = (days = 0) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const TODAY = day()
const todayDow = new Date(`${TODAY}T12:00:00Z`).getUTCDay()

const newClient = async (t) => {
  const email = `cli${++counter}.${Date.now()}@prueba.local`
  const created = await json(await t.post('/api/trainer/clients', { firstName: 'Ana', lastName: 'Cliente', email }), 201)
  const s = new Session()
  assert.equal((await s.login({ email, password: created.temporaryPassword })).status, 200)
  await json(await s.post('/api/auth/change-password', { currentPassword: created.temporaryPassword, newPassword: 'MiClaveNueva2026' }), 204)
  s.csrf = null
  return { session: s, clientId: created.clientId, email }
}
const exercise = async (t, name) =>
  (await json(await t.post('/api/trainer/library/exercises', { nameEs: `${name}-${++counter}-${Date.now()}`, type: 1, primaryMuscleGroupId: 1, instructions: 'Apoya la espalda alta en el banco' }), 201)).id
const upload = (t, exerciseId, name) => {
  const form = new FormData()
  form.append('file', new Blob([PNG]), name)
  return t.post(`/api/trainer/library/exercises/${exerciseId}/media`, form)
}

/** Rutina de dos días: Día A (hip thrust 3×8–12 a 60 kg y peso muerto con series detalladas) y Día B. */
const routine = async (t, dayA = null, dayB = null) => {
  const hip = await exercise(t, 'Hip thrust')
  const rdl = await exercise(t, 'Peso muerto rumano')
  const { id: routineId } = await json(await t.post(ROUTINES, { kind: 1, title: 'Glúteo 6 semanas', durationWeeks: 6 }), 201)
  const { id: draftId } = await json(await t.post(`${ROUTINES}/${routineId}/draft`), 200)
  await json(
    await t.put(`${ROUTINES}/${routineId}/draft`, {
      draftVersionId: draftId, title: 'Glúteo 6 semanas', durationWeeks: 6,
      days: [
        { name: 'Día A', dayOfWeek: dayA, exercises: [
          { exerciseId: hip, sets: 3, repsMin: 8, repsMax: 12, suggestedWeight: 60, suggestedWeightUnit: 1, restSeconds: 90, tempo: '3-1-1-0', rir: 2, setType: 1, notes: 'Pausa arriba' },
          { exerciseId: rdl, sets: 2, setType: 1, setDetails: [
            { setType: 2, repsMin: 12, repsMax: 12, suggestedWeight: 20, suggestedWeightUnit: 1 },
            { setType: 1, repsMin: 8, repsMax: 10, suggestedWeight: 50, suggestedWeightUnit: 1, rir: 1 },
          ] },
        ] },
        { name: 'Día B', dayOfWeek: dayB, exercises: [{ exerciseId: rdl, sets: 4, repsMin: 6, repsMax: 8, setType: 1 }] },
      ],
    }),
    204,
  )
  const { id: versionId } = await json(await t.post(`${ROUTINES}/${routineId}/publish`, { draftVersionId: draftId }), 200)
  return { routineId, versionId, hip, rdl }
}
const assign = async (t, clientId, versionId, startDate = TODAY) =>
  (await json(await t.post('/api/trainer/assignments', { clientIds: [clientId], routineVersionId: versionId, startDate }), 201)).ids[0]
const program = async (s) => json(await s.get(`${PORTAL}/program`), 200)

describe('portal del cliente', () => {
  test('el cliente ve su rutina en orden, con todos los parámetros y solo los medios autorizados', async () => {
    const t = await trainer()
    const { session: client, clientId } = await newClient(t)
    const { versionId, hip } = await routine(t)
    await json(await upload(t, hip, 'hip.png'), 201)
    const assignmentId = await assign(t, clientId, versionId)

    const programs = await program(client)
    assert.equal(programs.length, 1)
    const p = programs[0]
    assert.deepEqual([p.assignmentId, p.routineName, p.versionNumber, p.statusLabel, p.durationWeeks], [assignmentId, 'Glúteo 6 semanas', 1, 'Vigente', 6])
    assert.deepEqual(p.days.map((d) => d.name), ['Día A', 'Día B'])
    const first = p.days[0].exercises[0]
    assert.deepEqual(
      [first.sets, first.repsMin, first.repsMax, first.suggestedWeight, first.weightUnit, first.restSeconds, first.tempo, first.rir, first.notes, first.setTypeLabel],
      [3, 8, 12, 60, 'kg', 90, '3-1-1-0', 2, 'Pausa arriba', 'Efectiva'],
    )
    assert.equal(first.instructions, 'Apoya la espalda alta en el banco')
    assert.deepEqual(p.days[0].exercises[1].setDetails.map((s) => [s.setTypeLabel, s.suggestedWeight, s.weightUnit]), [['Calentamiento', 20, 'kg'], ['Efectiva', 50, 'kg']])
    // Para «series por músculo a la semana»: músculo principal y tipo de serie (numérico) de cada ejercicio y serie.
    assert.deepEqual([first.primaryMuscleGroup, first.setType], ['Glúteos', 1])
    assert.deepEqual(p.days[0].exercises[1].setDetails.map((s) => s.setType), [2, 1])

    // La imagen del ejercicio asignado se entrega (privada, sin caché); la de un ejercicio no asignado no existe.
    assert.equal(first.media.length, 1)
    assert.equal(first.media[0].url, `${PORTAL}/media/${first.media[0].id}/content`)
    const content = await client.get(first.media[0].url)
    assert.equal(content.status, 200)
    assert.equal(content.headers.get('content-type'), 'image/png')
    assert.match(content.headers.get('cache-control'), /no-store/)
    assert.deepEqual(Buffer.from(await content.arrayBuffer()), PNG)
    const other = await exercise(t, 'Sin asignar')
    const { id: otherMedia } = await json(await upload(t, other, 'otra.png'), 201)
    assert.equal((await client.get(`${PORTAL}/media/${otherMedia}/content`)).status, 404)
  })

  test('un entrenamiento se registra serie por serie, se guarda incompleto, se retoma tras cerrar sesión y se finaliza', async () => {
    const t = await trainer()
    const { session: client, clientId, email } = await newClient(t)
    const { routineId, versionId } = await routine(t)
    const assignmentId = await assign(t, clientId, versionId)
    const dayA = (await program(client))[0].days[0].id
    const routineBefore = await (await t.get(`${ROUTINES}/${routineId}/versions/${versionId}`)).text()

    const { id: sessionId } = await json(await client.post(`${PORTAL}/sessions`, { assignmentId, routineDayId: dayA }), 200)
    const s = await json(await client.get(`${PORTAL}/sessions/${sessionId}`), 200)
    assert.deepEqual([s.status, s.dayName, s.routineTitle, s.versionNumber, s.assignmentId], ['InProgress', 'Día A', 'Glúteo 6 semanas', 1, assignmentId])
    assert.deepEqual(s.exercises.map((e) => e.sets.length), [3, 2])
    const detailed = s.exercises[1].sets
    assert.deepEqual(
      [detailed[0].isPrescribed, detailed[0].setTypeLabel, detailed[0].prescribedRepsMin, detailed[0].prescribedWeight, detailed[0].prescribedWeightUnit],
      [true, 'Calentamiento', 12, 20, 'kg'],
    )
    assert.deepEqual([detailed[1].prescribedRir, detailed[1].reps, detailed[1].isCompleted], [1, null, false])

    // Registrar parte del primer ejercicio y una serie extra; guardar dos veces no duplica nada.
    const hip = s.exercises[0]
    const progress = (extra) => ({
      comment: 'Me sentí bien',
      exercises: [{
        id: hip.id, isCompleted: false, comment: 'Subir peso la próxima',
        sets: [
          ...hip.sets.map((x) => ({ setNumber: x.setNumber, reps: 10, weight: 62.5, weightUnit: 1, rir: 2, rpe: null, isCompleted: x.setNumber <= 2, notes: null })),
          ...(extra ? [{ setNumber: 4, reps: 8, weight: 62.5, weightUnit: 1, rir: null, rpe: 9, isCompleted: true, notes: 'Serie extra' }] : []),
        ],
      }],
    })
    await json(await client.put(`${PORTAL}/sessions/${sessionId}`, progress(true)), 204)
    await json(await client.put(`${PORTAL}/sessions/${sessionId}`, progress(true)), 204)
    assert.equal(sql(`SELECT COUNT(*) AS n FROM training_log_sets WHERE training_log_exercise_id = ${hip.id}`)[0].n, 4, 'sin series duplicadas')
    assert.equal(sql(`SELECT weight_centi FROM training_log_sets WHERE training_log_exercise_id = ${hip.id} AND set_number = 1`)[0].weight_centi, 6250)

    // Cerrar sesión, volver a entrar y retomar: todo sigue ahí, en el mismo entrenamiento.
    await json(await client.post('/api/auth/logout'), 204)
    const again = new Session()
    assert.equal((await again.login({ email, password: 'MiClaveNueva2026' })).status, 200)
    const current = await json(await again.get(`${PORTAL}/sessions/current`), 200)
    assert.equal(current.id, sessionId)
    assert.equal(current.comment, 'Me sentí bien')
    const logged = current.exercises[0]
    assert.equal(logged.comment, 'Subir peso la próxima')
    assert.deepEqual(logged.sets.map((x) => x.setNumber), [1, 2, 3, 4])
    assert.deepEqual(logged.sets.map((x) => x.isCompleted), [true, true, false, true])
    assert.deepEqual([logged.sets[0].weight, logged.sets[0].weightUnit, logged.sets[0].reps], [62.5, 1, 10])
    assert.deepEqual([logged.sets[3].isPrescribed, logged.sets[3].prescribedRepsMin, logged.sets[3].rpe, logged.sets[3].notes], [false, null, 9, 'Serie extra'])
    assert.deepEqual([logged.sets[0].isPrescribed, logged.sets[0].prescribedRepsMin, logged.sets[0].prescribedWeight], [true, 8, 60])

    // Iniciar el mismo día retoma el mismo entrenamiento; otro día pide terminar primero.
    assert.equal((await json(await again.post(`${PORTAL}/sessions`, { assignmentId, routineDayId: dayA }), 200)).id, sessionId)
    const dayB = (await program(again))[0].days[1].id
    const busy = await json(await again.post(`${PORTAL}/sessions`, { assignmentId, routineDayId: dayB }), 409)
    assert.match(busy.detail, /Tienes un entrenamiento en curso \(«Día A»\)/)

    // Quitar la serie extra está permitido; quitar una prescrita no.
    const removePrescribed = await json(await again.put(`${PORTAL}/sessions/${sessionId}`, { exercises: [{ id: hip.id, isCompleted: true, sets: [{ setNumber: 1, isCompleted: true }] }] }), 400)
    assert.deepEqual(removePrescribed.errors['exercises[0].sets'], ['Las series indicadas por tu entrenadora no se pueden quitar.'])
    await json(await again.put(`${PORTAL}/sessions/${sessionId}`, progress(false)), 204)

    await json(await again.post(`${PORTAL}/sessions/${sessionId}/finish`), 204)
    const done = await json(await again.get(`${PORTAL}/sessions/${sessionId}`), 200)
    assert.equal(done.status, 'Completed')
    assert.ok(done.completedAt)
    assert.equal(done.exercises[0].sets.length, 3)
    assert.equal((await again.get(`${PORTAL}/sessions/current`)).status, 204)
    assert.match((await json(await again.put(`${PORTAL}/sessions/${sessionId}`, progress(false)), 409)).detail, /ya se finalizó; queda en tu historial/)
    assert.equal((await again.post(`${PORTAL}/sessions/${sessionId}/finish`)).status, 409)

    // La rutina maestra no cambió.
    assert.equal(await (await t.get(`${ROUTINES}/${routineId}/versions/${versionId}`)).text(), routineBefore)
    const list = await json(await again.get(`${PORTAL}/sessions`), 200)
    assert.equal(list.length, 1)
    assert.deepEqual([list[0].exercisesCompleted, list[0].exercisesTotal, list[0].setsCompleted, list[0].status], [0, 2, 2, 'Completed'])
  })

  test('el historial conserva lo prescrito aunque después cambien la rutina y el ejercicio', async () => {
    const t = await trainer()
    const { session: client, clientId } = await newClient(t)
    const { routineId, versionId, hip } = await routine(t)
    const assignmentId = await assign(t, clientId, versionId)
    const dayA = (await program(client))[0].days[0].id
    const { id: sessionId } = await json(await client.post(`${PORTAL}/sessions`, { assignmentId, routineDayId: dayA }), 200)
    await json(await client.post(`${PORTAL}/sessions/${sessionId}/finish`), 204)

    // La entrenadora publica la versión 2 con otros parámetros y renombra el ejercicio en la biblioteca.
    const { id: draftId } = await json(await t.post(`${ROUTINES}/${routineId}/draft`), 200)
    await json(await t.put(`${ROUTINES}/${routineId}/draft`, { draftVersionId: draftId, title: 'Glúteo 6 semanas', days: [{ name: 'Día A nuevo', exercises: [{ exerciseId: hip, sets: 5, repsMin: 5, repsMax: 5, setType: 1 }] }] }), 204)
    await json(await t.post(`${ROUTINES}/${routineId}/publish`, { draftVersionId: draftId }), 200)
    await json(await t.put(`/api/trainer/library/exercises/${hip}`, { nameEs: `Hip thrust renombrado ${Date.now()}`, type: 1, primaryMuscleGroupId: 1 }), 204)

    const s = await json(await client.get(`${PORTAL}/sessions/${sessionId}`), 200)
    assert.equal(s.dayName, 'Día A')
    assert.match(s.exercises[0].nameEs, /^Hip thrust-/)
    assert.deepEqual([s.exercises[0].prescribedSets, s.exercises[0].prescribedRepsMin, s.exercises[0].prescribedRepsMax, s.exercises[0].prescribedWeight], [3, 8, 12, 60])

    // La propia base de datos impide borrar o cambiar el historial.
    assert.throws(() => sql(`DELETE FROM training_logs WHERE id = ${sessionId}`), /history_is_permanent/)
    assert.throws(() => sql(`UPDATE training_logs SET comment = 'cambio' WHERE id = ${sessionId}`), /history_is_permanent/)
    assert.throws(() => sql(`UPDATE training_log_sets SET reps = 99 WHERE training_log_exercise_id = ${s.exercises[0].id}`), /history_is_permanent/)
    assert.throws(() => sql(`DELETE FROM training_log_exercises WHERE training_log_id = ${sessionId}`), /history_is_permanent/)
  })

  test('el inicio muestra el próximo entrenamiento, la semana y el último entrenamiento con datos reales', async () => {
    const t = await trainer()
    const { session: client, clientId } = await newClient(t)
    const { versionId } = await routine(t, todayDow, (todayDow + 2) % 7)
    const assignmentId = await assign(t, clientId, versionId)

    let home = await json(await client.get(`${PORTAL}/home`), 200)
    assert.equal(home.last, null)
    assert.equal(home.inProgress, null)
    assert.deepEqual(home.next.map((n) => n.dayName), ['Día A'])
    assert.equal(home.week.length, 7)
    assert.equal(new Date(`${home.week[0].date}T12:00:00Z`).getUTCDay(), 1, 'la semana empieza en lunes')
    assert.deepEqual(home.week.find((d) => d.date === TODAY).planned, ['Día A'])

    const dayA = home.next[0].routineDayId
    const { id: sessionId } = await json(await client.post(`${PORTAL}/sessions`, { assignmentId, routineDayId: dayA }), 200)
    home = await json(await client.get(`${PORTAL}/home`), 200)
    assert.equal(home.inProgress.id, sessionId)

    await json(await client.post(`${PORTAL}/sessions/${sessionId}/finish`), 204)
    home = await json(await client.get(`${PORTAL}/home`), 200)
    assert.equal(home.last.id, sessionId)
    assert.equal(home.next[0].dayName, 'Día B')
    assert.equal(home.week.find((d) => d.date === TODAY).sessions.length, 1)
  })

  test('sin días de la semana, el próximo es el que sigue al último entrenado', async () => {
    const t = await trainer()
    const { session: client, clientId } = await newClient(t)
    const { versionId } = await routine(t)
    const assignmentId = await assign(t, clientId, versionId)
    let home = await json(await client.get(`${PORTAL}/home`), 200)
    assert.equal(home.next[0].dayName, 'Día A')
    const { id } = await json(await client.post(`${PORTAL}/sessions`, { assignmentId, routineDayId: home.next[0].routineDayId }), 200)
    await json(await client.post(`${PORTAL}/sessions/${id}/finish`), 204)
    home = await json(await client.get(`${PORTAL}/home`), 200)
    assert.equal(home.next[0].dayName, 'Día B')
    const { id: second } = await json(await client.post(`${PORTAL}/sessions`, { assignmentId, routineDayId: home.next[0].routineDayId }), 200)
    await json(await client.post(`${PORTAL}/sessions/${second}/finish`), 204)
    home = await json(await client.get(`${PORTAL}/home`), 200)
    assert.equal(home.next[0].dayName, 'Día A', 'vuelve al primero')
  })

  test('los entrenamientos siguen las reglas de la asignación y son privados', async () => {
    const t = await trainer()
    const { session: clientA, clientId: idA } = await newClient(t)
    const { session: clientB, clientId: idB } = await newClient(t)
    const { versionId } = await routine(t)
    const future = await assign(t, idA, versionId, day(3))
    const assignmentA = await assign(t, idA, versionId)
    const assignmentB = await assign(t, idB, versionId)
    const programs = await program(clientA)
    assert.deepEqual(programs.map((p) => p.status), ['Active', 'Scheduled'])
    const dayA = programs[0].days[0].id

    // Una rutina que aún no empieza no se entrena; la asignación de otro cliente no existe.
    const scheduled = await json(await clientA.post(`${PORTAL}/sessions`, { assignmentId: future, routineDayId: dayA }), 409)
    assert.equal(scheduled.detail, `Esta rutina empieza el ${day(3).split('-').reverse().join('/')}.`)
    assert.equal((await clientA.post(`${PORTAL}/sessions`, { assignmentId: assignmentB, routineDayId: dayA })).status, 404)
    assert.deepEqual((await json(await clientA.post(`${PORTAL}/sessions`, { assignmentId: assignmentA }), 400)).errors, { routineDayId: ['Elige la rutina y el día.'] })

    const { id: sessionA } = await json(await clientA.post(`${PORTAL}/sessions`, { assignmentId: assignmentA, routineDayId: dayA }), 200)
    assert.equal((await clientB.get(`${PORTAL}/sessions/${sessionA}`)).status, 404)
    assert.equal((await clientB.put(`${PORTAL}/sessions/${sessionA}`, { exercises: [] })).status, 404)
    assert.equal((await clientB.post(`${PORTAL}/sessions/${sessionA}/finish`)).status, 404)
    assert.deepEqual(await json(await clientB.get(`${PORTAL}/sessions`), 200), [])
    assert.equal((await clientB.get(`${PORTAL}/sessions/current`)).status, 204)

    // Valores fuera de rango: errores por campo exacto.
    const s = await json(await clientA.get(`${PORTAL}/sessions/${sessionA}`), 200)
    const e = s.exercises[0]
    const bad = await json(
      await clientA.put(`${PORTAL}/sessions/${sessionA}`, {
        exercises: [{ id: e.id, isCompleted: false, sets: e.sets.map((x) => ({ setNumber: x.setNumber, reps: x.setNumber === 1 ? -1 : null, weight: x.setNumber === 2 ? 50 : null, weightUnit: null, rir: x.setNumber === 3 ? 2.3 : null, isCompleted: false })) }],
      }),
      400,
    )
    assert.deepEqual(Object.keys(bad.errors).sort(), ['exercises[0].sets[0].reps', 'exercises[0].sets[1].weightUnit', 'exercises[0].sets[2].rir'])
    const foreign = await json(await clientA.put(`${PORTAL}/sessions/${sessionA}`, { exercises: [{ id: 999999, isCompleted: true, sets: [] }, { id: e.id, sets: [] }, { id: e.id, sets: [] }] }), 400)
    assert.deepEqual(foreign.errors['exercises[0]'], ['El ejercicio no pertenece a este entrenamiento.'])
    assert.deepEqual(foreign.errors.exercises, ['Ejercicio repetido.'])

    // La entrenadora no usa el portal; el cliente no cambia rutinas ni ve las de otros.
    assert.equal((await t.get(`${PORTAL}/program`)).status, 403)
    assert.equal((await clientA.put(`${ROUTINES}/1/draft`, {})).status, 403)
    assert.deepEqual((await program(clientB)).map((p) => p.assignmentId), [assignmentB])
  })
})

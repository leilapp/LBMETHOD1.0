// Biblioteca base (seeds/ejercicios-base.sql): se carga, se ve en la app, se puede correr dos veces sin duplicar
// y no deshace lo que la entrenadora cambió. No crea rutinas.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { EQUIPMENT, EXERCISES, PATTERNS, statements } from '../scripts/ejercicios-base.mjs'
import { sql, sqlFile, trainer, useServer } from './helpers.mjs'

useServer()

const SEED = new URL('../seeds/ejercicios-base.sql', import.meta.url)
const EX = '/api/trainer/library/exercises'
const count = (table) => sql(`SELECT COUNT(*) AS n FROM ${table}`)[0].n
const apply = () => sqlFile(fileURLToPath(SEED))

describe('Biblioteca base de ejercicios', () => {
  test('el archivo SQL está al día con scripts/ejercicios-base.mjs', () => {
    const body = readFileSync(SEED, 'utf8')
    for (const s of statements()) assert.ok(body.includes(s), 'vuelve a correr: node scripts/ejercicios-base.mjs')
  })

  test('carga ejercicios, equipos y patrones con sus músculos, y no crea rutinas', async () => {
    const s = await trainer()
    // Un ejercicio que la entrenadora ya tenía con el mismo nombre (otra escritura) no se duplica ni se toca.
    const own = (await (await s.post(EX, { nameEs: 'hip THRUST con barra', type: 1, primaryMuscleGroupId: 2, secondaryMuscleGroupIds: [], equipmentIds: [] })).json()).id
    apply()
    assert.equal(count('exercises'), EXERCISES.length)
    assert.equal(count('equipment'), Object.keys(EQUIPMENT).length)
    assert.equal(count('movement_patterns'), Object.keys(PATTERNS).length)
    assert.equal(count('routines'), 0)
    // Cada ejercicio tiene un músculo principal; todos los de la base traen equipo (el suyo no tenía).
    assert.equal(sql('SELECT COUNT(*) AS n FROM exercise_muscles WHERE role = 1')[0].n, EXERCISES.length)
    assert.equal(sql('SELECT COUNT(*) AS n FROM exercises e WHERE NOT EXISTS (SELECT 1 FROM exercise_equipment x WHERE x.exercise_id = e.id)')[0].n, 1)
    const mine = await (await s.get(`${EX}/${own}`)).json()
    assert.equal(mine.nameEs, 'hip THRUST con barra')
    assert.equal(mine.primaryMuscleGroup.nameEs, 'Femoral')

    // Se ve en la app, con búsqueda en ambos idiomas y filtros.
    const found = await (await s.get(`${EX}?q=bulgarian`)).json()
    assert.deepEqual(found.items.map((e) => e.nameEs), ['Sentadilla búlgara'])
    const item = found.items[0]
    assert.equal(item.primaryMuscleGroup, 'Cuádriceps')
    assert.deepEqual(item.equipment, ['Banco', 'Mancuernas'])
    assert.equal(item.movementPattern, 'Zancada')
    assert.equal(item.typeLabel, 'Fuerza')
    const detail = await (await s.get(`${EX}/${item.id}`)).json()
    assert.equal(detail.difficulty, 2)
    assert.deepEqual(detail.secondaryMuscleGroups.map((m) => m.nameEs).sort(), ['Aductores', 'Glúteos'])
  })

  test('correrlo otra vez no duplica ni deshace cambios de la entrenadora', async () => {
    const s = await trainer()
    const [plank] = (await (await s.get(`${EX}?q=front plank`)).json()).items
    // Ella cambia músculos y equipo, y desactiva otro ejercicio.
    const res = await s.put(`${EX}/${plank.id}`, { nameEs: 'Plancha', nameEn: 'Front plank', type: 5, primaryMuscleGroupId: 12, secondaryMuscleGroupIds: [1], equipmentIds: [] })
    assert.equal(res.status, 204)
    const [burpee] = (await (await s.get(`${EX}?q=burpee`)).json()).items
    sql(`UPDATE exercises SET is_active = 0, deactivated_at = '2026-10-31T00:00:00.000Z' WHERE id = ${burpee.id}`)
    const before = ['exercises', 'exercise_muscles', 'exercise_equipment', 'equipment', 'movement_patterns'].map(count)
    apply()
    assert.deepEqual(['exercises', 'exercise_muscles', 'exercise_equipment', 'equipment', 'movement_patterns'].map(count), before)
    const again = await (await s.get(`${EX}/${plank.id}`)).json()
    assert.deepEqual(again.secondaryMuscleGroups.map((m) => m.nameEs), ['Glúteos'])
    assert.equal(sql(`SELECT is_active FROM exercises WHERE id = ${burpee.id}`)[0].is_active, 0)
  })
})

import { nowIso } from '../http'
import { clean, cleanOptional, normalize } from '../text'
import { DIFFICULTIES, TYPES } from './labels'

/** Datos de un ejercicio tal como los decide la entrenadora (sin parámetros de rutina). */
export interface ExerciseInput {
  nameEs: string
  nameEn: string | null
  description: string | null
  instructions: string | null
  commonMistakes: string | null
  technicalTips: string | null
  type: number
  difficulty: number | null
  movementPatternId: number | null
  primaryMuscleGroupId: number
  secondaryMuscleGroupIds: number[]
  equipmentIds: number[]
}

export type Errors = Record<string, string[]>

export type RuleResult = { ok: true } | { ok: false; kind: 'invalid' | 'duplicate'; errors: Errors }

const add = (errors: Errors, field: string, message: string) => (errors[field] ??= []).push(message)

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

/** Convierte el cuerpo JSON del formulario en datos de ejercicio, con errores por campo si el formato no es válido. */
export function parseExerciseBody(body: Record<string, unknown>): { input: ExerciseInput; errors: Errors } {
  const errors: Errors = {}
  const str = (field: string) => {
    const v = body[field]
    if (v !== undefined && v !== null && typeof v !== 'string') add(errors, field, 'Debe ser texto.')
    return typeof v === 'string' ? v : null
  }
  const optInt = (field: string) => {
    const v = body[field]
    if (v === undefined || v === null) return null
    if (!isInt(v)) add(errors, field, 'Valor no válido.')
    return isInt(v) ? v : null
  }
  const intList = (field: string) => {
    const v = body[field]
    if (v === undefined || v === null) return []
    if (!Array.isArray(v) || !v.every(isInt) || v.length > 50) {
      add(errors, field, 'Lista no válida.')
      return []
    }
    return v as number[]
  }
  const input: ExerciseInput = {
    nameEs: str('nameEs') ?? '',
    nameEn: str('nameEn'),
    description: str('description'),
    instructions: str('instructions'),
    commonMistakes: str('commonMistakes'),
    technicalTips: str('technicalTips'),
    type: optInt('type') ?? 0,
    difficulty: optInt('difficulty'),
    movementPatternId: optInt('movementPatternId'),
    primaryMuscleGroupId: optInt('primaryMuscleGroupId') ?? 0,
    secondaryMuscleGroupIds: intList('secondaryMuscleGroupIds'),
    equipmentIds: intList('equipmentIds'),
  }
  if (body.type === undefined || body.type === null) add(errors, 'type', 'El tipo de ejercicio es obligatorio.')
  if (body.primaryMuscleGroupId === undefined || body.primaryMuscleGroupId === null)
    add(errors, 'primaryMuscleGroupId', 'El grupo muscular principal es obligatorio.')
  return { input, errors }
}

/**
 * Reglas del catálogo central (las mismas de la versión .NET): nombre en español obligatorio, nombres únicos sin
 * distinguir mayúsculas ni acentos (también contra ejercicios desactivados), un solo músculo principal y
 * catálogos existentes.
 */
export async function validateExercise(db: D1Database, input: ExerciseInput, exerciseId: number | null): Promise<RuleResult> {
  const errors: Errors = {}
  const nameEs = clean(input.nameEs ?? '')
  const nameEn = cleanOptional(input.nameEn)
  if (!nameEs) add(errors, 'nameEs', 'El nombre en español es obligatorio.')
  if (nameEs.length > 150) add(errors, 'nameEs', 'Máximo 150 caracteres.')
  if (nameEn && nameEn.length > 150) add(errors, 'nameEn', 'Máximo 150 caracteres.')
  if (!(input.type in TYPES)) add(errors, 'type', 'Tipo de ejercicio no válido.')
  if (input.difficulty !== null && !(input.difficulty in DIFFICULTIES)) add(errors, 'difficulty', 'Dificultad no válida.')

  const secondary = [...new Set(input.secondaryMuscleGroupIds)]
  if (secondary.includes(input.primaryMuscleGroupId)) add(errors, 'secondaryMuscleGroupIds', 'El grupo principal no puede repetirse como secundario.')
  const muscleIds = [...new Set([...secondary, input.primaryMuscleGroupId])]
  if ((await countIds(db, 'muscle_groups', muscleIds)) !== muscleIds.length) add(errors, 'primaryMuscleGroupId', 'Algún grupo muscular seleccionado no existe.')
  const equipmentIds = [...new Set(input.equipmentIds)]
  if ((await countIds(db, 'equipment', equipmentIds)) !== equipmentIds.length) add(errors, 'equipmentIds', 'Algún equipamiento seleccionado no existe.')
  if (input.movementPatternId !== null && (await countIds(db, 'movement_patterns', [input.movementPatternId])) !== 1)
    add(errors, 'movementPatternId', 'El patrón de movimiento no existe.')

  for (const [field, max, value] of [
    ['description', 2000, input.description],
    ['instructions', 4000, input.instructions],
    ['commonMistakes', 2000, input.commonMistakes],
    ['technicalTips', 2000, input.technicalTips],
  ] as const) {
    if (value && value.length > max) add(errors, field, `Máximo ${max} caracteres.`)
  }
  if (Object.keys(errors).length) return { ok: false, kind: 'invalid', errors }

  const id = exerciseId ?? 0
  const esKey = normalize(nameEs)
  if (await db.prepare('SELECT 1 FROM exercises WHERE id <> ? AND (name_es_key = ? OR name_en_key = ?)').bind(id, esKey, esKey).first())
    return { ok: false, kind: 'duplicate', errors: { nameEs: ['Ya existe un ejercicio con ese nombre (puede estar desactivado).'] } }
  if (nameEn) {
    const enKey = normalize(nameEn)
    if (await db.prepare('SELECT 1 FROM exercises WHERE id <> ? AND (name_en_key = ? OR name_es_key = ?)').bind(id, enKey, enKey).first())
      return { ok: false, kind: 'duplicate', errors: { nameEn: ['Ya existe un ejercicio con ese nombre en inglés (puede estar desactivado).'] } }
  }
  return { ok: true }
}

async function countIds(db: D1Database, table: string, ids: number[]) {
  if (!ids.length) return 0
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids)
    .first<{ n: number }>()
  return row?.n ?? 0
}

/** Valores limpios tal como se guardan (mismas reglas de limpieza que .NET). */
export function cleaned(input: ExerciseInput) {
  const nameEs = clean(input.nameEs)
  const en = cleanOptional(input.nameEn)
  const nameEn = en ? clean(en) : null
  return {
    nameEs,
    nameEn,
    nameEsKey: normalize(nameEs),
    nameEnKey: nameEn ? normalize(nameEn) : null,
    description: cleanOptional(input.description),
    instructions: cleanOptional(input.instructions),
    commonMistakes: cleanOptional(input.commonMistakes),
    technicalTips: cleanOptional(input.technicalTips),
  }
}

/**
 * Sentencias para crear un ejercicio con sus músculos, equipamiento y registro de auditoría, en un solo batch de D1
 * (una transacción). Las relaciones encuentran el ejercicio por su clave de nombre, que es única.
 */
export function createStatements(db: D1Database, input: ExerciseInput, userId: number): D1PreparedStatement[] {
  const v = cleaned(input)
  const now = nowIso()
  const byKey = '(SELECT id FROM exercises WHERE name_es_key = ?)'
  return [
    db
      .prepare(
        `INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips,
                                type, difficulty, movement_pattern_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(v.nameEs, v.nameEn, v.nameEsKey, v.nameEnKey, v.description, v.instructions, v.commonMistakes, v.technicalTips,
        input.type, input.difficulty, input.movementPatternId, now, now),
    ...muscleStatements(db, input, byKey, v.nameEsKey),
    ...input.equipmentIds
      .filter((x, i, all) => all.indexOf(x) === i)
      .map((eq) => db.prepare(`INSERT INTO exercise_equipment (exercise_id, equipment_id) VALUES (${byKey}, ?)`).bind(v.nameEsKey, eq)),
    db
      .prepare(`INSERT INTO audit_logs (occurred_at, user_id, action, entity_type, entity_id) SELECT ?, ?, 'ExerciseCreated', 'Exercise', id FROM exercises WHERE name_es_key = ?`)
      .bind(now, userId, v.nameEsKey),
  ]
}

function muscleStatements(db: D1Database, input: ExerciseInput, exerciseRef: string, refValue: string | number) {
  const secondary = [...new Set(input.secondaryMuscleGroupIds)].filter((m) => m !== input.primaryMuscleGroupId)
  return [
    db.prepare(`INSERT INTO exercise_muscles (exercise_id, muscle_group_id, role) VALUES (${exerciseRef}, ?, 1)`).bind(refValue, input.primaryMuscleGroupId),
    ...secondary.map((m) => db.prepare(`INSERT INTO exercise_muscles (exercise_id, muscle_group_id, role) VALUES (${exerciseRef}, ?, 2)`).bind(refValue, m)),
  ]
}

/** Sentencias para actualizar un ejercicio existente: datos, músculos y equipamiento se reemplazan juntos. */
export function updateStatements(db: D1Database, id: number, input: ExerciseInput, userId: number): D1PreparedStatement[] {
  const v = cleaned(input)
  const now = nowIso()
  return [
    db
      .prepare(
        `UPDATE exercises SET name_es = ?, name_en = ?, name_es_key = ?, name_en_key = ?, description = ?, instructions = ?, common_mistakes = ?,
                technical_tips = ?, type = ?, difficulty = ?, movement_pattern_id = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(v.nameEs, v.nameEn, v.nameEsKey, v.nameEnKey, v.description, v.instructions, v.commonMistakes, v.technicalTips,
        input.type, input.difficulty, input.movementPatternId, now, id),
    db.prepare('DELETE FROM exercise_muscles WHERE exercise_id = ?').bind(id),
    ...muscleStatements(db, input, '?', id),
    db.prepare('DELETE FROM exercise_equipment WHERE exercise_id = ?').bind(id),
    ...[...new Set(input.equipmentIds)].map((eq) => db.prepare('INSERT INTO exercise_equipment (exercise_id, equipment_id) VALUES (?, ?)').bind(id, eq)),
    db.prepare(`INSERT INTO audit_logs (occurred_at, user_id, action, entity_type, entity_id) VALUES (?, ?, 'ExerciseUpdated', 'Exercise', ?)`).bind(now, userId, String(id)),
  ]
}

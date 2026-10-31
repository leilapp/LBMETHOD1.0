import { Hono } from 'hono'
import type { Context } from 'hono'
import { audit } from '../audit'
import { notFound, nowIso, readJson, validation } from '../http'
import { currentUser } from '../session'
import { cleanOptional, likeTerm, normalize } from '../text'
import type { AppBindings } from '../types'
import { duplicate } from './catalogs'
import { DIFFICULTIES, MEDIA_TYPES, TYPES } from './labels'
import { createStatements, parseExerciseBody, updateStatements, validateExercise, type RuleResult } from './rules'

/** Catálogo central de ejercicios: consulta, alta, edición, desactivación, favoritos y variantes. */
export const exercises = new Hono<AppBindings>()

const MAX_PAGE_SIZE = 100
const intParam = (value: string | undefined) => (value && /^[0-9]+$/.test(value) ? Number(value) : null)

/**
 * Búsqueda en español o inglés (sin distinguir mayúsculas ni acentos) con filtros.
 * status: active (predeterminado), inactive o all.
 */
exercises.get('/', async (c) => {
  const q = c.req.query()
  const page = Math.max(intParam(q.page) ?? 1, 1)
  const pageSize = Math.min(Math.max(intParam(q.pageSize) ?? 50, 1), MAX_PAGE_SIZE)
  const userId = currentUser(c).id

  const where: string[] = []
  const params: unknown[] = []
  if (q.status === 'inactive') where.push('e.is_active = 0')
  else if (q.status !== 'all') where.push('e.is_active = 1')
  const term = normalize(q.q).slice(0, 100)
  if (term) {
    where.push(`(e.name_es_key LIKE ? ESCAPE '\\' OR e.name_en_key LIKE ? ESCAPE '\\')`)
    params.push(likeTerm(term), likeTerm(term))
  }
  const muscle = intParam(q.muscleGroupId)
  if (muscle !== null) {
    where.push('EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id AND x.muscle_group_id = ?)')
    params.push(muscle)
  }
  const equipment = intParam(q.equipmentId)
  if (equipment !== null) {
    where.push('EXISTS (SELECT 1 FROM exercise_equipment x WHERE x.exercise_id = e.id AND x.equipment_id = ?)')
    params.push(equipment)
  }
  const pattern = intParam(q.movementPatternId)
  if (pattern !== null) {
    where.push('e.movement_pattern_id = ?')
    params.push(pattern)
  }
  const type = intParam(q.type)
  if (type !== null) {
    where.push('e.type = ?')
    params.push(type)
  }
  if (q.favorites === 'true') {
    where.push('EXISTS (SELECT 1 FROM exercise_favorites f WHERE f.user_id = ? AND f.exercise_id = e.id)')
    params.push(userId)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM exercises e ${whereSql}`).bind(...params).first<{ n: number }>()
  const { results } = await c.env.DB.prepare(
    `SELECT e.id, e.name_es, e.name_en, e.type, e.is_active, mp.name_es AS pattern,
            (SELECT mg.name_es FROM exercise_muscles em JOIN muscle_groups mg ON mg.id = em.muscle_group_id
              WHERE em.exercise_id = e.id AND em.role = 1) AS primary_muscle,
            (SELECT json_group_array(eq.name_es) FROM exercise_equipment ee JOIN equipment eq ON eq.id = ee.equipment_id
              WHERE ee.exercise_id = e.id) AS equipment,
            EXISTS (SELECT 1 FROM exercise_favorites f WHERE f.user_id = ? AND f.exercise_id = e.id) AS favorite,
            (SELECT m.id FROM exercise_media m WHERE m.exercise_id = e.id AND m.media_type = 1 AND m.stored_file_id IS NOT NULL
              ORDER BY m.sort_order LIMIT 1) AS thumbnail
       FROM exercises e LEFT JOIN movement_patterns mp ON mp.id = e.movement_pattern_id
       ${whereSql}
      ORDER BY e.name_es_key LIMIT ? OFFSET ?`,
  )
    .bind(userId, ...params, pageSize, (page - 1) * pageSize)
    .all<{ id: number; name_es: string; name_en: string | null; type: number; is_active: number; pattern: string | null; primary_muscle: string | null; equipment: string; favorite: number; thumbnail: number | null }>()

  return c.json({
    items: results.map((r) => ({
      id: r.id,
      nameEs: r.name_es,
      nameEn: r.name_en,
      type: r.type,
      typeLabel: TYPES[r.type],
      primaryMuscleGroup: r.primary_muscle,
      equipment: (JSON.parse(r.equipment) as string[]).sort((a, b) => a.localeCompare(b, 'es')),
      movementPattern: r.pattern,
      isActive: r.is_active === 1,
      isFavorite: r.favorite === 1,
      thumbnailMediaId: r.thumbnail,
    })),
    total: total?.n ?? 0,
    page,
    pageSize,
  })
})

exercises.get('/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const db = c.env.DB
  const e = await db
    .prepare(
      `SELECT e.*, mp.name_es AS mp_es, mp.name_en AS mp_en FROM exercises e
         LEFT JOIN movement_patterns mp ON mp.id = e.movement_pattern_id WHERE e.id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown> & { id: number; type: number; difficulty: number | null; movement_pattern_id: number | null; is_active: number }>()
  if (!e) return notFound(c)

  const [muscles, equipment, variants, media, favorite] = await db.batch([
    db.prepare(`SELECT mg.id, mg.name_es, mg.name_en, em.role FROM exercise_muscles em JOIN muscle_groups mg ON mg.id = em.muscle_group_id
                 WHERE em.exercise_id = ? ORDER BY mg.sort_order`).bind(id),
    db.prepare(`SELECT eq.id, eq.name_es, eq.name_en FROM exercise_equipment ee JOIN equipment eq ON eq.id = ee.equipment_id
                 WHERE ee.exercise_id = ? ORDER BY eq.name_es_key`).bind(id),
    // Las variantes se muestran en ambos sentidos: si A es variante de B, B también aparece en A.
    db.prepare(`SELECT x.id, x.name_es, x.name_en, x.is_active, v.note FROM exercise_variants v JOIN exercises x ON x.id = v.variant_exercise_id
                 WHERE v.exercise_id = ?
                UNION ALL
                SELECT x.id, x.name_es, x.name_en, x.is_active, v.note FROM exercise_variants v JOIN exercises x ON x.id = v.exercise_id
                 WHERE v.variant_exercise_id = ?`).bind(id, id),
    db.prepare(`SELECT m.id, m.media_type, m.title, m.external_url, m.stored_file_id, f.original_file_name, f.size_bytes
                  FROM exercise_media m LEFT JOIN stored_files f ON f.id = m.stored_file_id
                 WHERE m.exercise_id = ? ORDER BY m.sort_order`).bind(id),
    db.prepare('SELECT 1 AS yes FROM exercise_favorites WHERE user_id = ? AND exercise_id = ?').bind(currentUser(c).id, id),
  ])
  type Ref = { id: number; name_es: string; name_en: string }
  const ref = (r: Ref) => ({ id: r.id, nameEs: r.name_es, nameEn: r.name_en })
  const muscleRows = muscles.results as (Ref & { role: number })[]
  const primary = muscleRows.find((m) => m.role === 1)
  const variantRows = variants.results as (Ref & { is_active: number; note: string | null })[]

  return c.json({
    id: e.id,
    nameEs: e.name_es,
    nameEn: e.name_en,
    description: e.description,
    instructions: e.instructions,
    commonMistakes: e.common_mistakes,
    technicalTips: e.technical_tips,
    type: e.type,
    typeLabel: TYPES[e.type],
    difficulty: e.difficulty,
    difficultyLabel: e.difficulty ? DIFFICULTIES[e.difficulty] : null,
    movementPattern: e.movement_pattern_id ? { id: e.movement_pattern_id, nameEs: e.mp_es, nameEn: e.mp_en } : null,
    primaryMuscleGroup: primary ? ref(primary) : null,
    secondaryMuscleGroups: muscleRows.filter((m) => m.role === 2).map(ref),
    equipment: (equipment.results as Ref[]).map(ref),
    isActive: e.is_active === 1,
    deactivatedAt: e.deactivated_at,
    isFavorite: favorite.results.length > 0,
    variants: variantRows
      .map((v) => ({ exerciseId: v.id, nameEs: v.name_es, nameEn: v.name_en, isActive: v.is_active === 1, note: v.note }))
      .sort((a, b) => normalize(a.nameEs).localeCompare(normalize(b.nameEs))),
    media: (media.results as { id: number; media_type: number; title: string | null; external_url: string | null; stored_file_id: string | null; original_file_name: string | null; size_bytes: number | null }[]).map((m) => ({
      id: m.id,
      mediaType: MEDIA_TYPES[m.media_type],
      title: m.title,
      externalUrl: m.external_url,
      contentUrl: m.stored_file_id ? `/api/trainer/library/media/${m.id}/content` : null,
      fileName: m.original_file_name,
      sizeBytes: m.size_bytes,
    })),
  })
})

exercises.post('/', async (c) => {
  const body = await readJson(c)
  if (!body) return validation(c, { body: ['Datos no válidos.'] })
  const { input, errors } = parseExerciseBody(body)
  if (Object.keys(errors).length) return validation(c, errors)
  const check = await validateExercise(c.env.DB, input, null)
  if (!check.ok) return ruleError(c, check)
  await c.env.DB.batch(createStatements(c.env.DB, input, currentUser(c).id))
  const row = await c.env.DB.prepare('SELECT id FROM exercises WHERE name_es_key = ?').bind(normalize(input.nameEs)).first<{ id: number }>()
  return c.json({ id: row!.id }, 201, { Location: `/api/trainer/library/exercises/${row!.id}` })
})

exercises.put('/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  if (!(await exists(c.env.DB, id))) return notFound(c)
  const body = await readJson(c)
  if (!body) return validation(c, { body: ['Datos no válidos.'] })
  const { input, errors } = parseExerciseBody(body)
  if (Object.keys(errors).length) return validation(c, errors)
  const check = await validateExercise(c.env.DB, input, id)
  if (!check.ok) return ruleError(c, check)
  await c.env.DB.batch(updateStatements(c.env.DB, id, input, currentUser(c).id))
  return c.body(null, 204)
})

/** Activa o desactiva. Desactivar no modifica rutinas ni historial que ya usan el ejercicio. */
exercises.post('/:id{[0-9]+}/status', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await readJson(c)
  if (!body || typeof body.active !== 'boolean') return validation(c, { active: ['Indica si el ejercicio queda activo.'] })
  const result = await c.env.DB.prepare('UPDATE exercises SET is_active = ?, deactivated_at = ?, updated_at = ? WHERE id = ?')
    .bind(body.active ? 1 : 0, body.active ? null : nowIso(), nowIso(), id)
    .run()
  if (!result.meta.changes) return notFound(c)
  await audit(c, body.active ? 'ExerciseActivated' : 'ExerciseDeactivated', 'Exercise', id)
  return c.body(null, 204)
})

exercises.put('/:id{[0-9]+}/favorite', async (c) => {
  const id = Number(c.req.param('id'))
  if (!(await exists(c.env.DB, id))) return notFound(c)
  await c.env.DB.prepare('INSERT OR IGNORE INTO exercise_favorites (user_id, exercise_id, created_at) VALUES (?, ?, ?)').bind(currentUser(c).id, id, nowIso()).run()
  return c.body(null, 204)
})

exercises.delete('/:id{[0-9]+}/favorite', async (c) => {
  const id = Number(c.req.param('id'))
  if (!(await exists(c.env.DB, id))) return notFound(c)
  await c.env.DB.prepare('DELETE FROM exercise_favorites WHERE user_id = ? AND exercise_id = ?').bind(currentUser(c).id, id).run()
  return c.body(null, 204)
})

/** Vincula dos ejercicios del catálogo como variantes; cada uno conserva su propia identidad. */
exercises.post('/:id{[0-9]+}/variants', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await readJson(c)
  const variantId = body?.variantExerciseId
  if (typeof variantId !== 'number' || !Number.isInteger(variantId)) return validation(c, { variantExerciseId: ['Selecciona el ejercicio variante.'] })
  const note = cleanOptional(body?.note)
  if (note && note.length > 500) return validation(c, { note: ['Máximo 500 caracteres.'] })
  if (id === variantId) return validation(c, { variantExerciseId: ['Un ejercicio no puede ser variante de sí mismo.'] })
  const found = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM exercises WHERE id IN (?, ?)').bind(id, variantId).first<{ n: number }>()
  if ((found?.n ?? 0) < 2) return notFound(c)
  const linked = await c.env.DB.prepare(
    `SELECT 1 FROM exercise_variants WHERE (exercise_id = ? AND variant_exercise_id = ?) OR (exercise_id = ? AND variant_exercise_id = ?)`,
  )
    .bind(id, variantId, variantId, id)
    .first()
  if (linked) return duplicate(c, 'variantExerciseId', 'Estos ejercicios ya están vinculados como variantes.')
  await c.env.DB.prepare('INSERT INTO exercise_variants (exercise_id, variant_exercise_id, note, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, variantId, note, nowIso())
    .run()
  return c.body(null, 204)
})

exercises.delete('/:id{[0-9]+}/variants/:variantId{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'))
  const variantId = Number(c.req.param('variantId'))
  const result = await c.env.DB.prepare(
    `DELETE FROM exercise_variants WHERE (exercise_id = ? AND variant_exercise_id = ?) OR (exercise_id = ? AND variant_exercise_id = ?)`,
  )
    .bind(id, variantId, variantId, id)
    .run()
  return result.meta.changes ? c.body(null, 204) : notFound(c)
})

export const exists = async (db: D1Database, id: number) => !!(await db.prepare('SELECT 1 FROM exercises WHERE id = ?').bind(id).first())

function ruleError(c: Context, check: Exclude<RuleResult, { ok: true }>) {
  if (check.kind === 'duplicate') {
    const [field, messages] = Object.entries(check.errors)[0]
    return duplicate(c, field, messages[0])
  }
  return validation(c, check.errors)
}


import { Hono } from 'hono'
import type { Context } from 'hono'
import { notFound, nowIso, problem, readJson, validation } from '../http'
import { clean, normalize } from '../text'
import type { AppBindings } from '../types'
import { DIFFICULTIES, TYPES } from './labels'

/**
 * Grupos musculares, equipamiento y patrones de movimiento. La entrenadora puede agregarlos, renombrarlos
 * y desactivarlos; nunca se borran porque los ejercicios existentes los siguen usando.
 */
export const catalogs = new Hono<AppBindings>()

interface CatalogDef {
  table: 'muscle_groups' | 'equipment' | 'movement_patterns'
  order: string
  usage: string
}

const DEFS: Record<string, CatalogDef> = {
  'muscle-groups': {
    table: 'muscle_groups',
    order: 'sort_order, name_es',
    usage: '(SELECT COUNT(*) FROM exercise_muscles x WHERE x.muscle_group_id = c.id)',
  },
  equipment: { table: 'equipment', order: 'name_es', usage: '(SELECT COUNT(*) FROM exercise_equipment x WHERE x.equipment_id = c.id)' },
  'movement-patterns': { table: 'movement_patterns', order: 'name_es', usage: '(SELECT COUNT(*) FROM exercises x WHERE x.movement_pattern_id = c.id)' },
}

export async function listCatalog(db: D1Database, def: CatalogDef) {
  const { results } = await db
    .prepare(`SELECT c.id, c.name_es, c.name_en, c.is_active, ${def.usage} AS uses FROM ${def.table} c ORDER BY ${def.order}`)
    .all<{ id: number; name_es: string; name_en: string; is_active: number; uses: number }>()
  return results.map((r) => ({ id: r.id, nameEs: r.name_es, nameEn: r.name_en, isActive: r.is_active === 1, exerciseCount: r.uses }))
}

/** Todo lo necesario para llenar los selectores del formulario y los filtros. */
catalogs.get('/catalogs', async (c) =>
  c.json({
    muscleGroups: await listCatalog(c.env.DB, DEFS['muscle-groups']),
    equipment: await listCatalog(c.env.DB, DEFS.equipment),
    movementPatterns: await listCatalog(c.env.DB, DEFS['movement-patterns']),
    types: Object.entries(TYPES).map(([value, label]) => ({ value: Number(value), label })),
    difficulties: Object.entries(DIFFICULTIES).map(([value, label]) => ({ value: Number(value), label })),
  }),
)

for (const [path, def] of Object.entries(DEFS)) {
  catalogs.get(`/${path}`, async (c) => c.json(await listCatalog(c.env.DB, def)))
  catalogs.post(`/${path}`, (c) => save(c, def, null))
  catalogs.put(`/${path}/:id{[0-9]+}`, (c) => save(c, def, Number(c.req.param('id'))))
}

async function save(c: Context<AppBindings>, def: CatalogDef, id: number | null) {
  const body = (await readJson(c)) ?? {}
  const es = clean(typeof body.nameEs === 'string' ? body.nameEs : '')
  const en = clean(typeof body.nameEn === 'string' ? body.nameEn : '')
  const isActive = body.isActive === undefined ? true : body.isActive === true
  const errors: Record<string, string[]> = {}
  if (!es || es.length > 100) errors.nameEs = ['El nombre en español es obligatorio (máximo 100 caracteres).']
  if (!en || en.length > 100) errors.nameEn = ['El nombre en inglés es obligatorio (máximo 100 caracteres).']
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') errors.isActive = ['Valor no válido.']
  if (Object.keys(errors).length) return validation(c, errors)

  const db = c.env.DB
  const current = id ?? 0
  if (await db.prepare(`SELECT 1 FROM ${def.table} WHERE id <> ? AND name_es_key = ?`).bind(current, normalize(es)).first())
    return duplicate(c, 'nameEs', 'Ya existe un elemento con ese nombre en español.')
  if (await db.prepare(`SELECT 1 FROM ${def.table} WHERE id <> ? AND name_en_key = ?`).bind(current, normalize(en)).first())
    return duplicate(c, 'nameEn', 'Ya existe un elemento con ese nombre en inglés.')

  const now = nowIso()
  if (id === null) {
    // Los nuevos grupos musculares se agregan al final del orden de presentación.
    const sortColumn = def.table === 'muscle_groups' ? ', sort_order' : ''
    const sortValue = def.table === 'muscle_groups' ? `, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM muscle_groups)` : ''
    const row = await db
      .prepare(
        `INSERT INTO ${def.table} (name_es, name_en, name_es_key, name_en_key, is_active, created_at, updated_at${sortColumn})
         VALUES (?, ?, ?, ?, ?, ?, ?${sortValue}) RETURNING id`,
      )
      .bind(es, en, normalize(es), normalize(en), isActive ? 1 : 0, now, now)
      .first<{ id: number }>()
    return c.json({ id: row!.id }, 201)
  }
  const result = await db
    .prepare(`UPDATE ${def.table} SET name_es = ?, name_en = ?, name_es_key = ?, name_en_key = ?, is_active = ?, updated_at = ? WHERE id = ?`)
    .bind(es, en, normalize(es), normalize(en), isActive ? 1 : 0, now, id)
    .run()
  return result.meta.changes ? c.body(null, 204) : notFound(c)
}

/** Registro duplicado: 409 con el error en el campo (mismo formato que .NET). */
export function duplicate(c: Context, field: string, message: string) {
  return problem(c, 409, 'Registro duplicado', message, { [field]: [message] })
}

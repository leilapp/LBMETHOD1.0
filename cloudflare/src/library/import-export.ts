import { Hono } from 'hono'
import type { Context } from 'hono'
import { problem, validation, nowIso } from '../http'
import { currentUser } from '../session'
import { cleanOptional, normalize } from '../text'
import type { AppBindings } from '../types'
import { autoWidths, readSheet, SpreadsheetFormatError, writeWorkbook, type CellValue } from '../xlsx'
import { DIFFICULTIES, parseDifficulty, parseType, TYPES } from './labels'
import { cleaned, type ExerciseInput } from './rules'

/** Plantilla de Excel, importación con vista previa y exportación del catálogo (mismo formato que la versión .NET). */
export const importExport = new Hono<AppBindings>()

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 2000
const SEPARATOR = ';'
const EXERCISES_SHEET = 'Ejercicios'
const CATALOGS_SHEET = 'Catálogos'

// Encabezado, si es obligatorio y nota de ayuda. El orden define las columnas.
const COLUMNS: [header: string, required: boolean, help: string][] = [
  ['NombreES', true, 'Nombre en español. No puede repetirse.'],
  ['NombreEN', false, 'Nombre en inglés (opcional). No puede repetirse.'],
  ['Descripcion', false, 'Descripción breve.'],
  ['GrupoPrincipal', true, 'Un grupo muscular de la hoja Catálogos.'],
  ['MusculosSecundarios', false, 'Varios grupos de la hoja Catálogos separados por punto y coma (;).'],
  ['Equipamiento', false, 'Uno o varios de la hoja Catálogos separados por punto y coma (;).'],
  ['Tipo', true, 'Un tipo de la hoja Catálogos.'],
  ['PatronMovimiento', false, 'Un patrón de la hoja Catálogos (opcional).'],
  ['Dificultad', false, 'Principiante, Intermedio o Avanzado (opcional).'],
  ['Instrucciones', false, 'Pasos de ejecución.'],
  ['ErroresFrecuentes', false, 'Errores comunes.'],
  ['Consejos', false, 'Consejos técnicos.'],
]
const ACTIVE_HEADER = 'Activo'
const REQUIRED = COLUMNS.flatMap(([, required], i) => (required ? [i] : []))

const HELP_LINES = [
  'Cómo llenar la plantilla de ejercicios',
  '1. Escribe un ejercicio por fila en la hoja Ejercicios, a partir de la fila 2. No cambies los encabezados.',
  '2. Las columnas en rojo son obligatorias: NombreES, GrupoPrincipal y Tipo.',
  '3. Los grupos musculares, el equipamiento y los patrones deben existir en la hoja Catálogos (puedes agregarlos antes en la biblioteca).',
  '4. Para varios valores en una celda, sepáralos con punto y coma. Ejemplo: Glúteos; Isquiotibiales',
  '5. Los nombres no pueden repetirse (no importan mayúsculas ni acentos). Las filas repetidas se rechazan y aparecen en el reporte.',
  '6. Las imágenes y videos se agregan después, desde la ficha de cada ejercicio.',
  '',
  'Ayuda por columna',
  ...COLUMNS.map(([h, required, help]) => `${h}${required ? ' (obligatoria)' : ''}: ${help}`),
]

interface CatalogLists {
  muscleGroups: string[]
  equipment: string[]
  movementPatterns: string[]
}

async function catalogLists(db: D1Database): Promise<CatalogLists> {
  const names = async (sql: string) => (await db.prepare(sql).all<{ name_es: string }>()).results.map((r) => r.name_es)
  return {
    muscleGroups: await names('SELECT name_es FROM muscle_groups WHERE is_active = 1 ORDER BY sort_order, name_es_key'),
    equipment: await names('SELECT name_es FROM equipment WHERE is_active = 1 ORDER BY name_es_key'),
    movementPatterns: await names('SELECT name_es FROM movement_patterns WHERE is_active = 1 ORDER BY name_es_key'),
  }
}

function catalogsSheet(lists: CatalogLists) {
  const columns: [string, string[]][] = [
    ['Grupos musculares', lists.muscleGroups],
    ['Equipamiento', lists.equipment],
    ['Patrones de movimiento', lists.movementPatterns],
    ['Tipos', Object.values(TYPES)],
    ['Dificultad', Object.values(DIFFICULTIES)],
  ]
  const height = Math.max(...columns.map(([, v]) => v.length))
  const rows: CellValue[][] = [columns.map(([h]) => h)]
  for (let i = 0; i < height; i++) rows.push(columns.map(([, v]) => v[i] ?? null))
  return { name: CATALOGS_SHEET, rows, header: 'light' as const, widths: autoWidths(rows), counts: columns.map(([, v]) => v.length) }
}

const fileResponse = (bytes: Uint8Array, fileName: string) =>
  new Response(bytes, { headers: { 'Content-Type': XLSX_TYPE, 'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}` } })

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())

importExport.get('/import/template', async (c) => {
  const catalog = catalogsSheet(await catalogLists(c.env.DB))
  const header = COLUMNS.map(([h]) => h)
  // Listas desplegables en las columnas que usan un solo valor del catálogo (la validación real la hace el sistema).
  const drop = (column: string, catalogColumn: number) => {
    const count = catalog.counts[catalogColumn]
    const col = String.fromCharCode(65 + header.indexOf(column))
    const src = String.fromCharCode(65 + catalogColumn)
    return count ? [{ range: `${col}2:${col}2001`, source: `'${CATALOGS_SHEET}'!$${src}$2:$${src}$${count + 1}` }] : []
  }
  const bytes = writeWorkbook([
    {
      name: EXERCISES_SHEET,
      rows: [header],
      header: 'light',
      requiredColumns: REQUIRED,
      freezeHeader: true,
      widths: autoWidths([header]),
      dropDowns: [...drop('GrupoPrincipal', 0), ...drop('Tipo', 3), ...drop('PatronMovimiento', 2), ...drop('Dificultad', 4)],
    },
    catalog,
    { name: 'Instrucciones', rows: HELP_LINES.map((l) => [l]), widths: [120] },
  ])
  return fileResponse(bytes, 'plantilla-ejercicios-lbmethod.xlsx')
})

/** Exporta el catálogo. status: all (predeterminado), active o inactive. Todo se escribe como texto. */
importExport.get('/export', async (c) => {
  const status = c.req.query('status')
  const where = status === 'active' ? 'WHERE e.is_active = 1' : status === 'inactive' ? 'WHERE e.is_active = 0' : ''
  const { results } = await c.env.DB.prepare(
    `SELECT e.name_es, e.name_en, e.description, e.type, e.difficulty, e.instructions, e.common_mistakes, e.technical_tips, e.is_active,
            mp.name_es AS pattern,
            (SELECT mg.name_es FROM exercise_muscles em JOIN muscle_groups mg ON mg.id = em.muscle_group_id WHERE em.exercise_id = e.id AND em.role = 1) AS primary_muscle,
            (SELECT group_concat(name_es, '; ') FROM (SELECT mg.name_es FROM exercise_muscles em JOIN muscle_groups mg ON mg.id = em.muscle_group_id
              WHERE em.exercise_id = e.id AND em.role = 2 ORDER BY mg.sort_order)) AS secondary,
            (SELECT group_concat(name_es, '; ') FROM (SELECT eq.name_es FROM exercise_equipment ee JOIN equipment eq ON eq.id = ee.equipment_id
              WHERE ee.exercise_id = e.id ORDER BY eq.name_es_key)) AS equipment
       FROM exercises e LEFT JOIN movement_patterns mp ON mp.id = e.movement_pattern_id ${where}
      ORDER BY e.name_es_key`,
  ).all<Record<string, string | number | null>>()

  const rows: CellValue[][] = [
    [...COLUMNS.map(([h]) => h), ACTIVE_HEADER],
    ...results.map((e) => [
      e.name_es, e.name_en, e.description, e.primary_muscle, e.secondary ?? '', e.equipment ?? '',
      TYPES[e.type as number], e.pattern, e.difficulty ? DIFFICULTIES[e.difficulty as number] : null,
      e.instructions, e.common_mistakes, e.technical_tips, e.is_active === 1 ? 'Sí' : 'No',
    ].map((v) => (v === null || v === undefined ? '' : String(v)))),
  ]
  const bytes = writeWorkbook([
    { name: EXERCISES_SHEET, rows, header: 'light', requiredColumns: REQUIRED, freezeHeader: true, widths: autoWidths(rows) },
    catalogsSheet(await catalogLists(c.env.DB)),
  ])
  return fileResponse(bytes, `biblioteca-lbmethod-${today()}.xlsx`)
})

/** Revisa el archivo sin guardar nada y devuelve el estado de cada fila. */
importExport.post('/import/preview', (c) =>
  withFile(c, async (rows) => {
    const { results } = await analyze(c.env.DB, rows)
    return c.json({ rows: results, ...summary(results) })
  }),
)

/** Guarda solo las filas válidas (en un solo batch de D1, es decir, una transacción) y devuelve las rechazadas. */
importExport.post('/import/commit', (c) =>
  withFile(c, async (rows) => {
    const { results, inputs } = await analyze(c.env.DB, rows)
    if (inputs.length) {
      try {
        await c.env.DB.batch(importStatements(c.env.DB, inputs.map((i) => i.input), currentUser(c).id))
      } catch (err) {
        console.error('Importación rechazada por la base', err)
        return problem(c, 409, 'Conflicto', 'Otro cambio en la biblioteca impidió guardar la importación. Revisa la vista previa e inténtalo de nuevo.')
      }
    }
    return c.json({ created: inputs.length, rejected: results.filter((r) => r.status !== 1) })
  }),
)

interface SheetRow {
  rowNumber: number
  get: (header: string) => string | null
}

async function withFile(c: Context<AppBindings>, action: (rows: SheetRow[]) => Promise<Response>) {
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return validation(c, { file: ['Selecciona un archivo de Excel (.xlsx).'] })
  }
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return validation(c, { file: ['Selecciona un archivo de Excel (.xlsx).'] })
  if (file.size > MAX_IMPORT_BYTES) return validation(c, { file: ['El archivo supera 10 MB.'] })
  if (!file.name.toLowerCase().endsWith('.xlsx')) return validation(c, { file: ['El archivo debe ser de Excel (.xlsx).'] })
  try {
    return await action(readRows(new Uint8Array(await file.arrayBuffer())))
  } catch (err) {
    if (err instanceof SpreadsheetFormatError) return validation(c, { file: [err.message] })
    throw err
  }
}

const headerKey = (h: string) => normalize(h).replace(/ /g, '').replace(/\*+$/, '')

function readRows(content: Uint8Array): SheetRow[] {
  const sheet = readSheet(content, EXERCISES_SHEET)
  const header = sheet.rows[0] ?? []
  const map = new Map<string, number>()
  header.forEach((h, i) => {
    const key = headerKey(h)
    if (key && !map.has(key)) map.set(key, i)
  })
  const missing = COLUMNS.filter(([h, required]) => required && !map.has(headerKey(h))).map(([h]) => h)
  if (missing.length) throw new SpreadsheetFormatError(`Faltan columnas obligatorias: ${missing.join(', ')}. Usa la plantilla descargable.`)

  const rows: SheetRow[] = []
  sheet.rows.forEach((cells, index) => {
    if (index === 0 || !cells.some((v) => v && v.trim())) return
    if (rows.length >= MAX_ROWS) throw new SpreadsheetFormatError(`El archivo tiene más de ${MAX_ROWS} filas. Divídelo en varios archivos.`)
    rows.push({
      rowNumber: index + 1,
      get: (h) => {
        const col = map.get(headerKey(h))
        const v = col === undefined ? '' : (cells[col] ?? '').trim()
        return v ? v : null
      },
    })
  })
  if (!rows.length) throw new SpreadsheetFormatError('El archivo no tiene ejercicios a partir de la fila 2.')
  return rows
}

interface RowResult {
  rowNumber: number
  nameEs: string | null
  nameEn: string | null
  status: 1 | 2 | 3 // 1 válida, 2 duplicada, 3 con error
  messages: string[]
}

const summary = (rows: RowResult[]) => ({
  valid: rows.filter((r) => r.status === 1).length,
  duplicates: rows.filter((r) => r.status === 2).length,
  errors: rows.filter((r) => r.status === 3).length,
})

type Lookup = Map<string, { id: number; active: boolean }>

async function lookup(db: D1Database, table: string): Promise<Lookup> {
  const { results } = await db.prepare(`SELECT id, name_es_key, name_en_key, is_active FROM ${table}`).all<{ id: number; name_es_key: string; name_en_key: string; is_active: number }>()
  const map: Lookup = new Map()
  for (const r of results) {
    if (!map.has(r.name_es_key)) map.set(r.name_es_key, { id: r.id, active: r.is_active === 1 })
    if (!map.has(r.name_en_key)) map.set(r.name_en_key, { id: r.id, active: r.is_active === 1 })
  }
  return map
}

/**
 * Valida cada fila con las mismas reglas que la versión .NET. Nunca crea grupos musculares, equipamiento ni patrones
 * de forma implícita: si no existen en el catálogo, la fila se rechaza con el motivo.
 */
async function analyze(db: D1Database, rows: SheetRow[]) {
  const [muscles, equipment, patterns] = await Promise.all([lookup(db, 'muscle_groups'), lookup(db, 'equipment'), lookup(db, 'movement_patterns')])
  // Nombres ya registrados (activos o desactivados), comparados sin mayúsculas ni acentos.
  const existing = new Set<string>()
  for (const e of (await db.prepare('SELECT name_es_key, name_en_key FROM exercises').all<{ name_es_key: string; name_en_key: string | null }>()).results) {
    existing.add(e.name_es_key)
    if (e.name_en_key) existing.add(e.name_en_key)
  }
  const inFile = new Map<string, number>()
  const results: RowResult[] = []
  const inputs: { rowNumber: number; input: ExerciseInput }[] = []

  for (const row of rows) {
    const messages: string[] = []
    const nameEs = cleanOptional(row.get('NombreES'))
    const nameEn = cleanOptional(row.get('NombreEN'))
    if (!nameEs) messages.push('Falta el nombre en español.')
    else if (nameEs.length > 150) messages.push('El nombre en español supera 150 caracteres.')
    if (nameEn && nameEn.length > 150) messages.push('El nombre en inglés supera 150 caracteres.')

    const resolve = (map: Lookup, name: string | null, label: string, required: boolean) => {
      if (!name || !name.trim()) {
        if (required) messages.push(`Falta: ${label}.`)
        return null
      }
      const entry = map.get(normalize(name))
      if (!entry) {
        messages.push(`${label} "${name.trim()}" no existe en el catálogo. Agrégalo primero o corrige el nombre.`)
        return null
      }
      if (!entry.active) {
        messages.push(`${label} "${name.trim()}" está desactivado.`)
        return null
      }
      return entry.id
    }
    const split = (value: string | null) => (value ? value.split(SEPARATOR).map((v) => v.trim()).filter(Boolean) : [])

    const primary = resolve(muscles, row.get('GrupoPrincipal'), 'Grupo principal', true)
    const secondary = [...new Set(split(row.get('MusculosSecundarios')).map((n) => resolve(muscles, n, 'Músculo secundario', true)).filter((x): x is number => x !== null))]
    if (primary !== null && secondary.includes(primary)) messages.push('El grupo principal está repetido como secundario.')
    const equipmentIds = [...new Set(split(row.get('Equipamiento')).map((n) => resolve(equipment, n, 'Equipamiento', true)).filter((x): x is number => x !== null))]
    const pattern = resolve(patterns, row.get('PatronMovimiento'), 'Patrón de movimiento', false)

    const typeText = row.get('Tipo')
    const type = parseType(typeText)
    if (!typeText) messages.push('Falta el tipo de ejercicio.')
    else if (type === null) messages.push(`Tipo "${typeText}" no reconocido. Usa uno de la hoja Catálogos.`)
    const difficultyText = row.get('Dificultad')
    const difficulty = parseDifficulty(difficultyText)
    if (difficultyText && difficulty === null) messages.push(`Dificultad "${difficultyText}" no reconocida. Usa uno de la hoja Catálogos.`)

    for (const [label, max, value] of [
      ['La descripción', 2000, row.get('Descripcion')],
      ['Las instrucciones', 4000, row.get('Instrucciones')],
      ['Los errores frecuentes', 2000, row.get('ErroresFrecuentes')],
      ['Los consejos técnicos', 2000, row.get('Consejos')],
    ] as const) {
      if (value && value.length > max) messages.push(`${label} supera ${max} caracteres.`)
    }

    if (messages.length) {
      results.push({ rowNumber: row.rowNumber, nameEs, nameEn, status: 3, messages })
      continue
    }
    const keys = [...new Set([nameEs, nameEn].filter((x): x is string => !!x).map(normalize))]
    if (keys.some((k) => existing.has(k))) {
      results.push({ rowNumber: row.rowNumber, nameEs, nameEn, status: 2, messages: ['Ya existe en la biblioteca un ejercicio con ese nombre (puede estar desactivado).'] })
      continue
    }
    const repeatedIn = keys.map((k) => inFile.get(k)).find((x) => x !== undefined)
    if (repeatedIn !== undefined) {
      results.push({ rowNumber: row.rowNumber, nameEs, nameEn, status: 2, messages: [`El nombre se repite en la fila ${repeatedIn} del archivo.`] })
      continue
    }
    keys.forEach((k) => inFile.set(k, row.rowNumber))
    results.push({ rowNumber: row.rowNumber, nameEs, nameEn, status: 1, messages: [] })
    inputs.push({
      rowNumber: row.rowNumber,
      input: {
        nameEs: nameEs!, nameEn, description: row.get('Descripcion'), instructions: row.get('Instrucciones'),
        commonMistakes: row.get('ErroresFrecuentes'), technicalTips: row.get('Consejos'), type: type!, difficulty,
        movementPatternId: pattern, primaryMuscleGroupId: primary!, secondaryMuscleGroupIds: secondary, equipmentIds,
      },
    })
  }
  return { results, inputs }
}

/** Divide en grupos para respetar el máximo de 100 parámetros por consulta de D1. */
function chunks<T>(items: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Inserciones de varias filas por sentencia (D1 admite hasta 100 parámetros por consulta). Las relaciones encuentran
 * cada ejercicio por su clave de nombre, que es única, así que todo cabe en un solo batch (una transacción).
 */
function importStatements(db: D1Database, inputs: ExerciseInput[], userId: number): D1PreparedStatement[] {
  const now = nowIso()
  const rows = inputs.map((input) => ({ input, v: cleaned(input) }))
  const statements: D1PreparedStatement[] = []
  for (const group of chunks(rows, 7)) {
    statements.push(
      db
        .prepare(
          `INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips,
                                  type, difficulty, movement_pattern_id, created_at, updated_at)
           VALUES ${group.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        )
        .bind(...group.flatMap(({ input, v }) => [v.nameEs, v.nameEn, v.nameEsKey, v.nameEnKey, v.description, v.instructions, v.commonMistakes,
          v.technicalTips, input.type, input.difficulty, input.movementPatternId, now, now])),
    )
  }
  const muscles = rows.flatMap(({ input, v }) => [
    [v.nameEsKey, input.primaryMuscleGroupId, 1],
    ...input.secondaryMuscleGroupIds.filter((m) => m !== input.primaryMuscleGroupId).map((m) => [v.nameEsKey, m, 2]),
  ])
  for (const group of chunks(muscles, 33)) {
    statements.push(
      db
        .prepare(
          `INSERT INTO exercise_muscles (exercise_id, muscle_group_id, role)
           SELECT e.id, v.column2, v.column3 FROM (VALUES ${group.map(() => '(?, ?, ?)').join(', ')}) v JOIN exercises e ON e.name_es_key = v.column1`,
        )
        .bind(...group.flat()),
    )
  }
  const equipment = rows.flatMap(({ input, v }) => input.equipmentIds.map((eq) => [v.nameEsKey, eq]))
  for (const group of chunks(equipment, 50)) {
    statements.push(
      db
        .prepare(
          `INSERT INTO exercise_equipment (exercise_id, equipment_id)
           SELECT e.id, v.column2 FROM (VALUES ${group.map(() => '(?, ?)').join(', ')}) v JOIN exercises e ON e.name_es_key = v.column1`,
        )
        .bind(...group.flat()),
    )
  }
  for (const group of chunks(rows, 95)) {
    statements.push(
      db
        .prepare(
          `INSERT INTO audit_logs (occurred_at, user_id, action, entity_type, entity_id, details)
           SELECT ?, ?, 'ExerciseCreated', 'Exercise', id, 'Importado desde Excel' FROM exercises WHERE name_es_key IN (${group.map(() => '?').join(', ')})`,
        )
        .bind(now, userId, ...group.map(({ v }) => v.nameEsKey)),
    )
  }
  return statements
}

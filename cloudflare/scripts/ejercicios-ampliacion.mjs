// Ampliación de la biblioteca de ejercicios (02/11/2026). Datos en scripts/ejercicios-ampliacion-datos.mjs.
//
// Uso:  node scripts/ejercicios-ampliacion.mjs   → escribe dos archivos y un reporte:
//   seeds/ejercicios-ampliacion.sql           ejercicios que solo usan valores de catálogo que YA existen
//   seeds/ejercicios-ampliacion-catalogo.sql  valores de catálogo nuevos (requieren aprobación) + sus ejercicios
//   seeds/ejercicios-ampliacion-reporte.md    agregados, omitidos y por revisar
//
// Igual que la biblioteca base, el SQL se puede correr varias veces sin duplicar ni sobrescribir:
// - Un ejercicio solo se inserta si su nombre (español o inglés, sin acentos ni mayúsculas) no existe ya en ninguna
//   de las dos columnas, que es la misma regla que aplica la app al guardar.
// - Músculos, equipamiento y vínculo de variante solo se agregan a ejercicios recién creados (todavía sin músculos).
// - Nada se borra ni se actualiza.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EQUIPMENT, EXERCISES as BASE, PATTERNS, normalize } from './ejercicios-base.mjs'
import { NEW_EQUIPMENT, NEW_EXERCISES, NEW_MUSCLES, OMITIDOS, RENOMBRADOS, REVISAR, REVISION_EXERCISES, DECISIONES } from './ejercicios-ampliacion-datos.mjs'

const MUSCLES = ['gluteos', 'femoral', 'cuadriceps', 'abductores', 'aductores', 'pantorrillas', 'espalda', 'pecho', 'hombros', 'biceps', 'triceps', 'abdomen']
const muscleKey = (k) => (MUSCLES.includes(k) ? k : NEW_MUSCLES[k] ? normalize(NEW_MUSCLES[k][0]) : null)
const equipmentKey = (k) => normalize((EQUIPMENT[k] ?? NEW_EQUIPMENT[k])[0])
/** ¿Usa algún valor de catálogo que hoy no existe? */
const needsCatalog = (e) => e.equipment.some((k) => NEW_EQUIPMENT[k]) || [e.primary, ...e.secondary].some((k) => NEW_MUSCLES[k])

const ALL = [...NEW_EXERCISES, ...REVISION_EXERCISES]

export function validate() {
  const problems = []
  const existing = new Set(BASE.flatMap(([es, en]) => [normalize(es), normalize(en)]))
  const seen = new Set()
  const allNames = new Set([...existing])
  for (const e of ALL) for (const n of [e.es, e.en]) allNames.add(normalize(n))
  const groupA = new Set(NEW_EXERCISES.filter((e) => !needsCatalog(e)).map((e) => normalize(e.es)))
  for (const e of ALL) {
    const keys = [normalize(e.es), normalize(e.en)]
    for (const k of new Set(keys)) {
      if (existing.has(k)) problems.push(`${e.es}: el nombre «${k}» ya existe en la biblioteca`)
      if (seen.has(k)) problems.push(`${e.es}: nombre repetido en la lista («${k}»)`)
      seen.add(k)
    }
    if (e.es.length > 150 || e.en.length > 150) problems.push(`${e.es}: nombre de más de 150 caracteres`)
    if (![1, 2, 3, 4, 5, 6].includes(e.type)) problems.push(`${e.es}: tipo inválido`)
    if (![1, 2, 3].includes(e.diff)) problems.push(`${e.es}: dificultad inválida`)
    if (e.pattern !== null && !PATTERNS[e.pattern]) problems.push(`${e.es}: patrón ${e.pattern} no existe`)
    if (!muscleKey(e.primary)) problems.push(`${e.es}: músculo ${e.primary} no existe`)
    for (const m of e.secondary) if (!muscleKey(m) || m === e.primary) problems.push(`${e.es}: secundario ${m} inválido`)
    if (!e.equipment.length) problems.push(`${e.es}: sin equipamiento`)
    for (const k of e.equipment) if (!EQUIPMENT[k] && !NEW_EQUIPMENT[k]) problems.push(`${e.es}: equipo ${k} no existe`)
    if (e.base && !allNames.has(normalize(e.base))) problems.push(`${e.es}: ejercicio base «${e.base}» no existe`)
    if (e.base && groupA.has(normalize(e.es)) && !existing.has(normalize(e.base)) && !groupA.has(normalize(e.base)))
      problems.push(`${e.es}: su base «${e.base}» depende del catálogo nuevo`)
    for (const [field, max] of [['description', 2000], ['instructions', 4000], ['mistakes', 2000], ['tips', 2000]])
      if (!e[field] || e[field].length > max) problems.push(`${e.es}: ${field} vacío o de más de ${max} caracteres`)
  }
  if (DECISIONES.length !== REVISAR.length) problems.push('Falta decidir algún caso de REVISAR')
  for (const e of REVISION_EXERCISES) if (needsCatalog(e)) problems.push(`${e.es}: la revisión no debe requerir catálogo nuevo`)
  for (const [name] of [...OMITIDOS, ...REVISAR]) if (seen.has(normalize(name))) problems.push(`${name}: está agregado y también omitido`)
  if (problems.length) throw new Error(problems.join('\n'))
}

const q = (text) => (text === null || text === undefined ? 'NULL' : `'${String(text).replace(/'/g, "''")}'`)
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
const values = (rows) => rows.map((r) => `  (${r.join(', ')})`).join(',\n')
const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))
// Solo ejercicios recién creados por este archivo: en la app todo ejercicio guardado tiene músculo principal.
const ONLY_NEW = 'NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id)'

function exerciseStatements(list) {
  const out = []
  // D1 limita el tamaño de cada sentencia; se insertan en grupos de 15.
  for (const group of chunks(list, 15)) {
    out.push(`INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN ${NOW} END, ${NOW}, ${NOW}
FROM (VALUES
${values(group.map((e) => [q(e.es), q(e.en), q(normalize(e.es)), q(normalize(e.en)), q(e.description), q(e.instructions), q(e.mistakes), q(e.tips), e.type, e.diff, e.pattern === null ? 'NULL' : q(normalize(PATTERNS[e.pattern][0])), e.active ? 1 : 0]))}
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4))`)
  }
  out.push(`INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment_id)
SELECT e.id, q.id FROM (VALUES
${values(list.flatMap((e) => e.equipment.map((k) => [q(normalize(e.es)), q(equipmentKey(k))])))}
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN equipment q ON q.name_es_key = v.column2
WHERE ${ONLY_NEW}`)
  const variants = list.filter((e) => e.base)
  if (variants.length)
    out.push(`INSERT OR IGNORE INTO exercise_variants (exercise_id, variant_exercise_id, note, created_at)
SELECT b.id, e.id, v.column3, ${NOW} FROM (VALUES
${values(variants.map((e) => [q(normalize(e.base)), q(normalize(e.es)), q(e.variantNote)]))}
) v
JOIN exercises b ON b.name_es_key = v.column1
JOIN exercises e ON e.name_es_key = v.column2
WHERE ${ONLY_NEW} AND b.id <> e.id
  AND NOT EXISTS (SELECT 1 FROM exercise_variants y WHERE y.exercise_id = e.id AND y.variant_exercise_id = b.id)`)
  // Los músculos van al final porque marcan al ejercicio como «ya completo».
  out.push(`INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_group_id, role)
SELECT e.id, m.id, v.column3 FROM (VALUES
${values(list.flatMap((e) => [[q(normalize(e.es)), q(muscleKey(e.primary)), 1], ...e.secondary.map((s) => [q(normalize(e.es)), q(muscleKey(s)), 2])]))}
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN muscle_groups m ON m.name_es_key = v.column2
WHERE ${ONLY_NEW}`)
  return out
}

function catalogStatements() {
  const used = new Set(NEW_EXERCISES.flatMap((e) => [...e.equipment, e.primary, ...e.secondary]))
  const out = []
  const equipment = Object.entries(NEW_EQUIPMENT).filter(([k]) => used.has(k))
  out.push(`INSERT OR IGNORE INTO equipment (name_es, name_en, name_es_key, name_en_key, created_at, updated_at)
SELECT column1, column2, column3, column4, ${NOW}, ${NOW} FROM (VALUES
${values(equipment.map(([, [es, en]]) => [q(es), q(en), q(normalize(es)), q(normalize(en))]))}
)`)
  // Un músculo por sentencia para que cada uno tome el siguiente orden disponible.
  for (const [k, [es, en]] of Object.entries(NEW_MUSCLES).filter(([k]) => used.has(k)))
    out.push(`INSERT OR IGNORE INTO muscle_groups (name_es, name_en, name_es_key, name_en_key, sort_order, created_at, updated_at)
SELECT ${q(es)}, ${q(en)}, ${q(normalize(es))}, ${q(normalize(en))}, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM muscle_groups), ${NOW}, ${NOW}`)
  return out
}

export function build() {
  validate()
  const a = NEW_EXERCISES.filter((e) => !needsCatalog(e))
  const b = NEW_EXERCISES.filter(needsCatalog)
  return { a, b, c: REVISION_EXERCISES, sqlA: exerciseStatements(a), sqlB: [...catalogStatements(), ...exerciseStatements(b)], sqlC: exerciseStatements(REVISION_EXERCISES) }
}

const TYPES = { 1: 'Fuerza', 2: 'Movilidad', 3: 'Cardio', 4: 'Pliométrico', 5: 'Isométrico', 6: 'Estiramiento' }
const DIFF = { 1: 'Principiante', 2: 'Intermedio', 3: 'Avanzado' }
const muscleName = (k) => (NEW_MUSCLES[k] ? `${NEW_MUSCLES[k][0]} (nuevo)` : { gluteos: 'Glúteos', femoral: 'Femoral', cuadriceps: 'Cuádriceps', abductores: 'Abductores', aductores: 'Aductores', pantorrillas: 'Pantorrillas', espalda: 'Espalda', pecho: 'Pecho', hombros: 'Hombros', biceps: 'Bíceps', triceps: 'Tríceps', abdomen: 'Abdomen' }[k])
const equipName = (k) => (NEW_EQUIPMENT[k] ? `${NEW_EQUIPMENT[k][0]} (nuevo)` : EQUIPMENT[k][0])

function report({ a, b, c }) {
  const row = (e) => `| ${e.es}${e.active ? '' : ' *(inactivo)*'} | ${e.en} | ${muscleName(e.primary)} | ${e.secondary.map(muscleName).join(', ') || '—'} | ${e.equipment.map(equipName).join(', ')} | ${TYPES[e.type]} | ${e.pattern ? PATTERNS[e.pattern][0] : '—'} | ${DIFF[e.diff]} | ${e.base ?? '—'} |`
  const head = '| Nombre | Inglés | Principal | Secundarios | Equipamiento | Tipo | Patrón | Dificultad | Variante de |\n|---|---|---|---|---|---|---|---|---|'
  return `# Ampliación de la biblioteca de ejercicios

Generado por \`scripts/ejercicios-ampliacion.mjs\`. Biblioteca actual: ${BASE.length} ejercicios.

- **Parte 1 — solo catálogos existentes:** ${a.length} ejercicios (\`seeds/ejercicios-ampliacion.sql\`).
- **Parte 2 — necesita valores de catálogo nuevos:** ${b.length} ejercicios (\`seeds/ejercicios-ampliacion-catalogo.sql\`).
- **Parte 3 — casos revisados el 03/11:** ${c.length} ejercicios (\`seeds/ejercicios-ampliacion-revision.sql\`).
- **Omitidos por duplicado:** ${OMITIDOS.length}.  **Casos revisados:** ${REVISAR.length} (${c.length} agregados).

## Valores de catálogo nuevos (parte 2, requieren aprobación)

Equipamiento: ${Object.values(NEW_EQUIPMENT).map(([es, en]) => `${es} (${en})`).join(', ')}.

Grupos musculares: ${Object.values(NEW_MUSCLES).map(([es, en]) => `${es} (${en})`).join(', ')}.

## Parte 1 (${a.length})

${head}
${a.map(row).join('\n')}

## Parte 2 (${b.length})

${head}
${b.map(row).join('\n')}

## Agregados con el nombre de la biblioteca (${RENOMBRADOS.length})

| Propuesto | Nombre usado |
|---|---|
${RENOMBRADOS.map(([n, m]) => `| ${n} | ${m} |`).join('\n')}

## Omitidos por duplicado (${OMITIDOS.length})

| Propuesto | Ya existe como / motivo |
|---|---|
${OMITIDOS.map(([n, m]) => `| ${n} | ${m} |`).join('\n')}

## Parte 3: casos revisados agregados (${c.length})

${head}
${c.map(row).join('\n')}

## Casos revisados (${REVISAR.length}) — Leilani pidió decidir lo que mejor convenga (03/11/2026)

| Propuesto | Decisión |
|---|---|
${DECISIONES.map(([n, m]) => `| ${n} | ${m} |`).join('\n')}
`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'seeds')
  mkdirSync(dir, { recursive: true })
  const built = build()
  const header = (what) => `-- Generado por scripts/ejercicios-ampliacion.mjs (no editar a mano). ${what}
-- Se puede correr varias veces: no duplica, no borra y no cambia ejercicios existentes.\n\n`
  writeFileSync(join(dir, 'ejercicios-ampliacion.sql'), header(`Parte 1: ${built.a.length} ejercicios con catálogos existentes.`) + built.sqlA.map((s) => `${s};\n`).join('\n'))
  writeFileSync(join(dir, 'ejercicios-ampliacion-catalogo.sql'), header(`Parte 2: catálogo nuevo + ${built.b.length} ejercicios. Correr DESPUÉS de la parte 1.`) + built.sqlB.map((s) => `${s};\n`).join('\n'))
  writeFileSync(join(dir, 'ejercicios-ampliacion-revision.sql'), header(`Parte 3: ${built.c.length} ejercicios de los casos revisados.`) + built.sqlC.map((s) => `${s};\n`).join('\n'))
  writeFileSync(join(dir, 'ejercicios-ampliacion-reporte.md'), report(built))
  console.log(`Listo: parte 1 = ${built.a.length}, parte 2 = ${built.b.length}, omitidos = ${OMITIDOS.length}, revisión = ${built.c.length}`)
}

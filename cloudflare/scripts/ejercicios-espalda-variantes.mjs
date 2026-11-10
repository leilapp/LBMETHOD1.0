// Variantes de espalda para la biblioteca (10/11/2026), pedidas por Leilani a partir del
// «Pullover en polea con barra, agarre abierto» que ella dio de alta el 09/11.
//
// Uso:  node scripts/ejercicios-espalda-variantes.mjs   → escribe seeds/ejercicios-espalda-variantes.sql
//
// Mismas reglas que la ampliación del 02/11 (scripts/ejercicios-ampliacion.mjs):
// - Un ejercicio solo se inserta si su nombre (español o inglés, sin acentos ni mayúsculas) no existe ya.
// - Músculos, equipamiento y vínculo con su ejercicio base solo se agregan a ejercicios recién creados.
// - VINCULOS agrega vínculos de variante entre ejercicios que ya existen, solo si no hay vínculo en ninguna dirección.
// - Nada se borra ni se actualiza. Se puede correr varias veces.
// Criterio de duplicado (el mismo del 02/11): unilateral, pausa o tempo en el mismo equipo = mismo ejercicio;
// cambio de implemento, de agarre o de montaje = ejercicio aparte.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EQUIPMENT, PATTERNS, normalize } from './ejercicios-base.mjs'

const MUSCLES = { espalda: 'espalda', biceps: 'biceps', triceps: 'triceps', pecho: 'pecho', hombros: 'hombros', abdomen: 'abdomen', femoral: 'femoral' }

const x = (es, en, diff, pattern, secondary, equipment, base, description, instructions, mistakes, tips) => ({
  es, en, type: 1, diff, pattern, primary: 'espalda', secondary, equipment, base,
  description,
  instructions: instructions.map((s, i) => `${i + 1}. ${s}`).join('\n'),
  mistakes: mistakes.join('\n'),
  tips: tips.join('\n'),
})

export const EXERCISES = [
  // Familia pullover / brazos rectos (base: Jalón con brazos rectos)
  x('Pullover en polea con barra corta, agarre abierto', 'Wide-grip cable straight-arm pulldown (short bar)', 1, 'traccv', [], ['polea'], 'Jalón con brazos rectos',
    'Pullover de pie en polea alta con una barra corta, tomándola por los extremos para abrir el agarre lo más posible.',
    ['Pon la polea en lo más alto y toma la barra corta por los extremos, palmas hacia abajo.', 'Da 1 o 2 pasos atrás e inclina el torso unos 30°, rodillas suaves y codos un poco flexionados y fijos.', 'Baja la barra en arco hasta los muslos, llevando los hombros hacia abajo y atrás.', 'Aprieta la espalda 1 segundo y sube despacio hasta sentir el estiramiento.'],
    ['Doblar los codos y convertirlo en un jalón.', 'Subir los hombros hacia las orejas.', 'Balancear el torso para mover el peso.'],
    ['Con la barra corta el agarre queda menos abierto que con la barra larga; úsala si la barra larga incomoda los hombros.', 'Imagina que empujas la barra con los meñiques.']),
  x('Pullover en polea con cuerda', 'Rope cable straight-arm pulldown', 1, 'traccv', [], ['polea'], 'Jalón con brazos rectos',
    'Pullover de pie en polea alta con cuerda; permite separar las manos al final y alargar el recorrido.',
    ['Pon la polea en lo más alto y toma la cuerda con las palmas enfrentadas.', 'Da 1 o 2 pasos atrás e inclina el torso unos 30°, codos un poco flexionados y fijos.', 'Baja la cuerda en arco hasta los muslos y separa un poco las manos al final.', 'Aprieta la espalda 1 segundo y sube despacio.'],
    ['Doblar los codos y convertirlo en un jalón.', 'Arquear la zona lumbar al bajar.'],
    ['Abre la cuerda al final para sentir más el dorsal.', 'Usa un peso moderado y controla la subida.']),
  x('Pullover con banda elástica', 'Band straight-arm pulldown', 1, 'traccv', [], ['banda'], 'Jalón con brazos rectos',
    'Pullover de pie con una banda anclada en alto; útil en casa o como calentamiento de espalda.',
    ['Ancla la banda en alto y tómala con las manos al ancho de los hombros.', 'Da un paso atrás hasta que la banda tenga tensión e inclina un poco el torso.', 'Baja los brazos casi extendidos en arco hasta los muslos.', 'Regresa despacio sin perder la tensión.'],
    ['Doblar los codos.', 'Soltar la banda de golpe al regresar.'],
    ['Aléjate más del anclaje para aumentar la resistencia.']),
  x('Pullover con barra', 'Barbell pullover', 2, 'traccv', ['pecho', 'triceps'], ['barra', 'banco'], 'Pullover con mancuerna',
    'Pullover acostado en banco con barra, llevándola detrás de la cabeza con los brazos casi extendidos.',
    ['Acuéstate en el banco y sujeta la barra sobre el pecho con las manos al ancho de los hombros.', 'Con los codos ligeramente flexionados, llévala en arco detrás de la cabeza.', 'Baja hasta donde mantengas las costillas abajo.', 'Regresa sobre el pecho con la misma trayectoria.'],
    ['Arquear la espalda baja al bajar.', 'Doblar los codos y convertirlo en un press de tríceps.'],
    ['Empieza con poco peso: la barra es menos estable que la mancuerna.', 'Puede hacerse con barra EZ si se indica en la rutina.']),

  // Familia jalón (base: Jalón al pecho)
  x('Jalón al pecho con agarre neutro abierto', 'Wide neutral-grip lat pulldown', 1, 'traccv', ['biceps'], ['polea'], 'Jalón al pecho',
    'Jalón al pecho con una barra de agarres paralelos abiertos (palmas enfrentadas, manos más separadas que los hombros).',
    ['Ajusta el soporte de los muslos y toma los agarres paralelos abiertos.', 'Inclina un poco el torso atrás y saca el pecho.', 'Jala llevando los codos hacia abajo y a los costados hasta la parte alta del pecho.', 'Sube controlado hasta estirar los brazos.'],
    ['Jalar con los brazos en lugar de llevar los codos abajo.', 'Echarse muy atrás para mover más peso.'],
    ['El agarre neutro suele ser más cómodo para hombros y codos.']),
  x('Jalón en máquina', 'Machine lat pulldown', 1, 'traccv', ['biceps'], ['maquina'], 'Jalón al pecho',
    'Jalón en máquina de palancas o de discos, con trayectoria guiada; puede hacerse con ambos brazos o uno a la vez.',
    ['Ajusta el asiento y el soporte de los muslos.', 'Toma los agarres con el pecho alto.', 'Jala llevando los codos hacia abajo y atrás.', 'Regresa controlado hasta estirar los brazos.'],
    ['Usar impulso con el torso.', 'Acortar el recorrido al subir.'],
    ['Si se hace a un brazo, anótalo en la rutina.']),
  x('Jalón con banda elástica', 'Band lat pulldown', 1, 'traccv', ['biceps'], ['banda'], 'Jalón al pecho',
    'Jalón con una banda anclada en alto, de rodillas o sentado; útil en casa o para aprender el movimiento.',
    ['Ancla la banda en alto y colócate de rodillas o sentado debajo.', 'Toma la banda con los brazos estirados.', 'Jala llevando los codos hacia abajo hasta los costados.', 'Regresa despacio sin perder la tensión.'],
    ['Encoger los hombros.', 'Soltar la banda de golpe.'],
    ['Usa una banda más gruesa o acércate al anclaje para cambiar la resistencia.']),

  // Familia remo
  x('Remo Pendlay', 'Pendlay row', 2, 'tracch', ['biceps'], ['barra'], 'Remo con barra',
    'Remo con barra desde el piso con el torso casi paralelo al suelo; cada repetición inicia con la barra apoyada.',
    ['Coloca la barra en el piso, pies al ancho de la cadera y tómala un poco más abierto que los hombros.', 'Bisagra de cadera hasta dejar el torso casi paralelo al piso, espalda neutra.', 'Jala la barra explosivamente hasta la parte baja del pecho.', 'Regrésala al piso controlada y reacomoda antes de la siguiente.'],
    ['Levantar el torso para subir la barra.', 'Redondear la espalda baja.'],
    ['Pide más técnica que el remo con barra: empieza con carga ligera.']),
  x('Remo en Smith', 'Smith machine row', 1, 'tracch', ['biceps'], ['smith'], 'Remo con barra',
    'Remo inclinado con la barra guiada de la máquina Smith.',
    ['Ajusta los seguros a la altura de las rodillas y toma la barra un poco más abierto que los hombros.', 'Bisagra de cadera con la espalda neutra.', 'Jala la barra hacia el abdomen llevando los codos atrás.', 'Baja controlado.'],
    ['Redondear la espalda.', 'Usar impulso con la cadera.'],
    ['La trayectoria fija ayuda a aprender la posición antes del remo con barra libre.']),
  x('Remo inclinado con mancuernas', 'Bent-over dumbbell row', 1, 'tracch', ['biceps'], ['mancuernas'], 'Remo con mancuerna a una mano',
    'Remo inclinado con una mancuerna en cada mano, sin apoyo, ambos brazos a la vez.',
    ['De pie con una mancuerna en cada mano, haz bisagra de cadera hasta inclinar el torso unos 45°.', 'Deja los brazos colgando con las palmas enfrentadas.', 'Jala las mancuernas hacia la cadera llevando los codos atrás.', 'Baja controlado.'],
    ['Redondear la espalda.', 'Subir el torso en cada repetición.'],
    ['Si la espalda baja se cansa antes que la espalda alta, usa el remo con pecho apoyado.']),
  x('Remo Seal con barra', 'Barbell seal row', 2, 'tracch', ['biceps'], ['barra', 'banco'], 'Remo con pecho apoyado',
    'Remo acostado boca abajo sobre un banco alto, jalando una barra desde abajo; elimina el impulso del torso.',
    ['Acuéstate boca abajo sobre un banco alto (o un banco sobre cajones) con la barra debajo.', 'Toma la barra un poco más abierto que los hombros con los brazos estirados.', 'Jala hasta que la barra toque el banco.', 'Baja controlado hasta estirar los brazos.'],
    ['Despegar el pecho del banco.', 'Usar un banco tan bajo que la barra toque el piso.'],
    ['Se puede hacer con mancuernas si no hay banco alto con barra.']),
  x('Remo con banda elástica', 'Band seated row', 1, 'tracch', ['biceps'], ['banda'], 'Remo sentado en polea',
    'Remo sentado o de pie con banda elástica; útil en casa o como calentamiento.',
    ['Siéntate con las piernas estiradas y pasa la banda por las plantas, o ánclala a la altura del pecho.', 'Toma los extremos con los brazos estirados y el pecho alto.', 'Jala llevando los codos atrás y juntando los omóplatos.', 'Regresa despacio sin perder la tensión.'],
    ['Encorvar la espalda al regresar.', 'Jalar solo con los brazos.'],
    ['Acorta la banda para aumentar la resistencia.']),
  x('Remo renegado', 'Renegade row', 2, 'tracch', ['abdomen', 'hombros'], ['mancuernas'], 'Remo con mancuerna a una mano',
    'Remo alternado desde posición de plancha con las manos sobre mancuernas; trabaja espalda y control del tronco.',
    ['En plancha alta con las manos sobre dos mancuernas y los pies más abiertos que la cadera.', 'Aprieta abdomen y glúteos.', 'Jala una mancuerna hacia la cadera sin girar el tronco.', 'Bájala controlada y alterna el lado.'],
    ['Girar la cadera al subir la mancuerna.', 'Dejar caer la cadera.'],
    ['Usa mancuernas hexagonales para que no rueden.', 'Abre más los pies para ganar estabilidad.']),
]

/** Vínculos de variante entre ejercicios que ya existen (o que crea este archivo). [base, variante, nota]. */
export const VINCULOS = [
  ['Jalón con brazos rectos', 'Pullover en polea con barra, agarre abierto', null],
  ['Pullover en polea con barra, agarre abierto', 'Pullover en polea con barra corta, agarre abierto', 'Misma técnica con barra corta'],
]

export function validate() {
  const problems = []
  const seen = new Set()
  for (const e of EXERCISES) {
    for (const k of new Set([normalize(e.es), normalize(e.en)])) {
      if (seen.has(k)) problems.push(`${e.es}: nombre repetido («${k}»)`)
      seen.add(k)
    }
    if (e.es.length > 150 || e.en.length > 150) problems.push(`${e.es}: nombre largo`)
    if (!PATTERNS[e.pattern]) problems.push(`${e.es}: patrón ${e.pattern}`)
    for (const m of e.secondary) if (!MUSCLES[m] || m === e.primary) problems.push(`${e.es}: secundario ${m}`)
    for (const k of e.equipment) if (!EQUIPMENT[k]) problems.push(`${e.es}: equipo ${k}`)
    for (const [f, max] of [['description', 2000], ['instructions', 4000], ['mistakes', 2000], ['tips', 2000]])
      if (!e[f] || e[f].length > max) problems.push(`${e.es}: ${f}`)
  }
  if (problems.length) throw new Error(problems.join('\n'))
}

const q = (t) => (t === null || t === undefined ? 'NULL' : `'${String(t).replace(/'/g, "''")}'`)
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
const values = (rows) => rows.map((r) => `  (${r.join(', ')})`).join(',\n')
const ONLY_NEW = 'NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id)'

export function statements() {
  validate()
  const out = []
  out.push(`INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), 1, NULL, ${NOW}, ${NOW}
FROM (VALUES
${values(EXERCISES.map((e) => [q(e.es), q(e.en), q(normalize(e.es)), q(normalize(e.en)), q(e.description), q(e.instructions), q(e.mistakes), q(e.tips), e.type, e.diff, q(normalize(PATTERNS[e.pattern][0]))]))}
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4))`)
  out.push(`INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment_id)
SELECT e.id, q.id FROM (VALUES
${values(EXERCISES.flatMap((e) => e.equipment.map((k) => [q(normalize(e.es)), q(normalize(EQUIPMENT[k][0]))])))}
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN equipment q ON q.name_es_key = v.column2
WHERE ${ONLY_NEW}`)
  out.push(`INSERT OR IGNORE INTO exercise_variants (exercise_id, variant_exercise_id, note, created_at)
SELECT b.id, e.id, NULL, ${NOW} FROM (VALUES
${values(EXERCISES.map((e) => [q(normalize(e.base)), q(normalize(e.es))]))}
) v
JOIN exercises b ON b.name_es_key = v.column1
JOIN exercises e ON e.name_es_key = v.column2
WHERE ${ONLY_NEW} AND b.id <> e.id
  AND NOT EXISTS (SELECT 1 FROM exercise_variants y WHERE y.exercise_id = e.id AND y.variant_exercise_id = b.id)`)
  out.push(`INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_group_id, role)
SELECT e.id, m.id, v.column3 FROM (VALUES
${values(EXERCISES.flatMap((e) => [[q(normalize(e.es)), q(MUSCLES[e.primary]), 1], ...e.secondary.map((s) => [q(normalize(e.es)), q(MUSCLES[s]), 2])]))}
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN muscle_groups m ON m.name_es_key = v.column2
WHERE ${ONLY_NEW}`)
  out.push(`INSERT OR IGNORE INTO exercise_variants (exercise_id, variant_exercise_id, note, created_at)
SELECT b.id, e.id, v.column3, ${NOW} FROM (VALUES
${values(VINCULOS.map(([b, e, n]) => [q(normalize(b)), q(normalize(e)), q(n)]))}
) v
JOIN exercises b ON b.name_es_key = v.column1
JOIN exercises e ON e.name_es_key = v.column2
WHERE b.id <> e.id
  AND NOT EXISTS (SELECT 1 FROM exercise_variants y WHERE (y.exercise_id = b.id AND y.variant_exercise_id = e.id) OR (y.exercise_id = e.id AND y.variant_exercise_id = b.id))`)
  return out
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'seeds', 'ejercicios-espalda-variantes.sql')
  writeFileSync(file, `-- Generado por scripts/ejercicios-espalda-variantes.mjs (no editar a mano). ${EXERCISES.length} variantes de espalda.
-- Se puede correr varias veces: no duplica, no borra y no cambia ejercicios existentes.

${statements().join(';\n\n')};\n`)
  console.log(`${file}: ${EXERCISES.length} ejercicios, ${VINCULOS.length} vínculos extra`)
}

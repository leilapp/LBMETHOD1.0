// Biblioteca base de ejercicios (pedida por Leilani el 31/10/2026): ejercicios reales y comunes, con su nombre en
// español e inglés, músculo principal y secundarios, equipamiento, tipo, dificultad y patrón de movimiento.
// No crea rutinas ni asigna nada: la entrenadora elige cada ejercicio y parámetro, y puede editar o desactivar todo.
//
// Uso:  node scripts/ejercicios-base.mjs          → escribe seeds/ejercicios-base.sql
//       npm run db:seed:ejercicios:local | :remote → lo aplica (el remoto hace respaldo antes)
//
// El SQL se puede correr varias veces sin duplicar nada:
// - Un ejercicio, equipo o patrón que ya existe (mismo nombre sin importar acentos ni mayúsculas) no se toca.
// - Los músculos y el equipamiento solo se agregan a ejercicios recién creados por este archivo, para no deshacer
//   lo que la entrenadora haya cambiado (por ejemplo, si le quita el equipo a un ejercicio).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Igual que normalize() de src/text.ts. */
export const normalize = (value) => value.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

export const EQUIPMENT = {
  barra: ['Barra', 'Barbell'],
  mancuernas: ['Mancuernas', 'Dumbbells'],
  kettlebell: ['Kettlebell', 'Kettlebell'],
  maquina: ['Máquina', 'Machine'],
  polea: ['Polea', 'Cable machine'],
  smith: ['Máquina Smith', 'Smith machine'],
  banda: ['Banda elástica', 'Resistance band'],
  miniband: ['Mini banda', 'Mini band'],
  corporal: ['Peso corporal', 'Bodyweight'],
  banco: ['Banco', 'Bench'],
  balon: ['Balón medicinal', 'Medicine ball'],
  dominadas: ['Barra de dominadas', 'Pull-up bar'],
  trx: ['Suspensión (TRX)', 'Suspension trainer'],
  cajon: ['Cajón', 'Plyo box'],
  fitball: ['Pelota de estabilidad', 'Stability ball'],
  tapete: ['Tapete', 'Mat'],
  caminadora: ['Caminadora', 'Treadmill'],
  bicicleta: ['Bicicleta fija', 'Stationary bike'],
  eliptica: ['Elíptica', 'Elliptical'],
  remo: ['Remadora', 'Rowing machine'],
  cuerda: ['Cuerda para saltar', 'Jump rope'],
  paralelas: ['Paralelas', 'Dip bars'],
  rueda: ['Rueda abdominal', 'Ab wheel'],
}

export const PATTERNS = {
  bisagra: ['Bisagra de cadera', 'Hip hinge'],
  sentadilla: ['Sentadilla', 'Squat'],
  zancada: ['Zancada', 'Lunge'],
  extcadera: ['Extensión de cadera', 'Hip extension'],
  abduccion: ['Abducción de cadera', 'Hip abduction'],
  aduccion: ['Aducción de cadera', 'Hip adduction'],
  flexrodilla: ['Flexión de rodilla', 'Knee flexion'],
  extrodilla: ['Extensión de rodilla', 'Knee extension'],
  tobillo: ['Flexión plantar', 'Plantar flexion'],
  empujeh: ['Empuje horizontal', 'Horizontal push'],
  empujev: ['Empuje vertical', 'Vertical push'],
  tracch: ['Tracción horizontal', 'Horizontal pull'],
  traccv: ['Tracción vertical', 'Vertical pull'],
  hombro: ['Aislamiento de hombro', 'Shoulder isolation'],
  flexcodo: ['Flexión de codo', 'Elbow flexion'],
  extcodo: ['Extensión de codo', 'Elbow extension'],
  estabilidad: ['Estabilidad del tronco', 'Core stability'],
  flextronco: ['Flexión de tronco', 'Trunk flexion'],
  rotacion: ['Rotación', 'Rotation'],
  acarreo: ['Acarreo', 'Carry'],
  locomocion: ['Locomoción', 'Locomotion'],
  salto: ['Salto', 'Jump'],
}

/** Claves de los 12 grupos musculares de la migración 0002. */
const MUSCLES = ['gluteos', 'femoral', 'cuadriceps', 'abductores', 'aductores', 'pantorrillas', 'espalda', 'pecho', 'hombros', 'biceps', 'triceps', 'abdomen']

// Tipo: 1 Fuerza, 2 Movilidad, 3 Cardio, 4 Pliométrico, 5 Isométrico, 6 Estiramiento.
// Dificultad: 1 Principiante, 2 Intermedio, 3 Avanzado.
// [español, inglés, tipo, dificultad, patrón | null, músculo principal, [secundarios], [equipamiento]]
export const EXERCISES = [
  // Glúteo y cadera
  ['Hip thrust con barra', 'Barbell hip thrust', 1, 2, 'extcadera', 'gluteos', ['femoral'], ['barra', 'banco']],
  ['Hip thrust en máquina', 'Machine hip thrust', 1, 1, 'extcadera', 'gluteos', ['femoral'], ['maquina']],
  ['Hip thrust con mancuerna', 'Dumbbell hip thrust', 1, 1, 'extcadera', 'gluteos', ['femoral'], ['mancuernas', 'banco']],
  ['Hip thrust a una pierna', 'Single-leg hip thrust', 1, 2, 'extcadera', 'gluteos', ['femoral'], ['corporal', 'banco']],
  ['Puente de glúteo', 'Glute bridge', 1, 1, 'extcadera', 'gluteos', ['femoral'], ['corporal', 'tapete']],
  ['Puente de glúteo con barra', 'Barbell glute bridge', 1, 1, 'extcadera', 'gluteos', ['femoral'], ['barra', 'tapete']],
  ['Puente de glúteo a una pierna', 'Single-leg glute bridge', 1, 1, 'extcadera', 'gluteos', ['femoral'], ['corporal', 'tapete']],
  ['Puente de glúteo con mini banda', 'Banded glute bridge', 1, 1, 'extcadera', 'gluteos', ['abductores'], ['miniband', 'tapete']],
  ['Patada de glúteo en polea', 'Cable glute kickback', 1, 1, 'extcadera', 'gluteos', ['femoral'], ['polea']],
  ['Patada de glúteo en máquina', 'Machine glute kickback', 1, 1, 'extcadera', 'gluteos', ['femoral'], ['maquina']],
  ['Patada de glúteo en cuadrupedia', 'Quadruped glute kickback', 1, 1, 'extcadera', 'gluteos', ['femoral'], ['corporal', 'tapete']],
  ['Patada de glúteo con banda', 'Banded glute kickback', 1, 1, 'extcadera', 'gluteos', ['femoral'], ['banda', 'tapete']],
  ['Hiperextensión a 45°', '45-degree back extension', 1, 1, 'extcadera', 'gluteos', ['femoral', 'espalda'], ['maquina']],
  ['Pull through en polea', 'Cable pull-through', 1, 1, 'bisagra', 'gluteos', ['femoral'], ['polea']],
  ['Peso muerto rumano con barra', 'Barbell Romanian deadlift', 1, 2, 'bisagra', 'femoral', ['gluteos', 'espalda'], ['barra']],
  ['Peso muerto rumano con mancuernas', 'Dumbbell Romanian deadlift', 1, 1, 'bisagra', 'femoral', ['gluteos', 'espalda'], ['mancuernas']],
  ['Peso muerto rumano a una pierna', 'Single-leg Romanian deadlift', 1, 2, 'bisagra', 'femoral', ['gluteos', 'abdomen'], ['mancuernas']],
  ['Peso muerto convencional', 'Conventional deadlift', 1, 3, 'bisagra', 'gluteos', ['femoral', 'cuadriceps', 'espalda'], ['barra']],
  ['Peso muerto sumo', 'Sumo deadlift', 1, 3, 'bisagra', 'gluteos', ['aductores', 'cuadriceps', 'femoral', 'espalda'], ['barra']],
  ['Peso muerto con kettlebell', 'Kettlebell deadlift', 1, 1, 'bisagra', 'gluteos', ['femoral'], ['kettlebell']],
  ['Swing con kettlebell', 'Kettlebell swing', 1, 2, 'bisagra', 'gluteos', ['femoral', 'abdomen'], ['kettlebell']],
  ['Buenos días con barra', 'Barbell good morning', 1, 2, 'bisagra', 'femoral', ['gluteos', 'espalda'], ['barra']],
  ['Abducción de cadera en máquina', 'Machine hip abduction', 1, 1, 'abduccion', 'abductores', ['gluteos'], ['maquina']],
  ['Abducción de cadera en polea', 'Cable hip abduction', 1, 1, 'abduccion', 'abductores', ['gluteos'], ['polea']],
  ['Abducción sentada con mini banda', 'Seated banded hip abduction', 1, 1, 'abduccion', 'abductores', ['gluteos'], ['miniband']],
  ['Caminata lateral con mini banda', 'Banded lateral walk', 1, 1, 'abduccion', 'abductores', ['gluteos'], ['miniband']],
  ['Almeja con mini banda', 'Banded clamshell', 1, 1, 'abduccion', 'abductores', ['gluteos'], ['miniband', 'tapete']],
  ['Abducción de cadera acostada', 'Side-lying hip abduction', 1, 1, 'abduccion', 'abductores', ['gluteos'], ['corporal', 'tapete']],
  ['Aducción de cadera en máquina', 'Machine hip adduction', 1, 1, 'aduccion', 'aductores', [], ['maquina']],
  ['Aducción de cadera en polea', 'Cable hip adduction', 1, 1, 'aduccion', 'aductores', [], ['polea']],
  ['Plancha Copenhague', 'Copenhagen plank', 5, 3, 'aduccion', 'aductores', ['abdomen'], ['banco']],

  // Pierna
  ['Sentadilla con barra', 'Barbell back squat', 1, 2, 'sentadilla', 'cuadriceps', ['gluteos', 'aductores', 'abdomen'], ['barra']],
  ['Sentadilla frontal', 'Front squat', 1, 3, 'sentadilla', 'cuadriceps', ['gluteos', 'abdomen'], ['barra']],
  ['Sentadilla goblet', 'Goblet squat', 1, 1, 'sentadilla', 'cuadriceps', ['gluteos'], ['mancuernas', 'kettlebell']],
  ['Sentadilla sumo con mancuerna', 'Dumbbell sumo squat', 1, 1, 'sentadilla', 'gluteos', ['aductores', 'cuadriceps'], ['mancuernas']],
  ['Sentadilla en Smith', 'Smith machine squat', 1, 1, 'sentadilla', 'cuadriceps', ['gluteos'], ['smith']],
  ['Sentadilla hack', 'Hack squat', 1, 2, 'sentadilla', 'cuadriceps', ['gluteos'], ['maquina']],
  ['Sentadilla con peso corporal', 'Bodyweight squat', 1, 1, 'sentadilla', 'cuadriceps', ['gluteos'], ['corporal']],
  ['Sentadilla isométrica en pared', 'Wall sit', 5, 1, 'sentadilla', 'cuadriceps', ['gluteos'], ['corporal']],
  ['Prensa de piernas', 'Leg press', 1, 1, 'sentadilla', 'cuadriceps', ['gluteos', 'aductores'], ['maquina']],
  ['Prensa a una pierna', 'Single-leg leg press', 1, 2, 'sentadilla', 'cuadriceps', ['gluteos'], ['maquina']],
  ['Sentadilla búlgara', 'Bulgarian split squat', 1, 2, 'zancada', 'cuadriceps', ['gluteos', 'aductores'], ['mancuernas', 'banco']],
  ['Zancada hacia atrás', 'Reverse lunge', 1, 1, 'zancada', 'cuadriceps', ['gluteos'], ['mancuernas']],
  ['Zancada caminando', 'Walking lunge', 1, 2, 'zancada', 'cuadriceps', ['gluteos'], ['mancuernas']],
  ['Zancada lateral', 'Lateral lunge', 1, 2, 'zancada', 'cuadriceps', ['gluteos', 'aductores'], ['mancuernas']],
  ['Zancada cruzada', 'Curtsy lunge', 1, 2, 'zancada', 'gluteos', ['cuadriceps', 'abductores'], ['mancuernas']],
  ['Subida al cajón', 'Box step-up', 1, 1, 'zancada', 'cuadriceps', ['gluteos'], ['cajon', 'mancuernas']],
  ['Extensión de cuádriceps', 'Leg extension', 1, 1, 'extrodilla', 'cuadriceps', [], ['maquina']],
  ['Curl femoral acostado', 'Lying leg curl', 1, 1, 'flexrodilla', 'femoral', ['pantorrillas'], ['maquina']],
  ['Curl femoral sentado', 'Seated leg curl', 1, 1, 'flexrodilla', 'femoral', [], ['maquina']],
  ['Curl femoral con pelota', 'Stability ball hamstring curl', 1, 2, 'flexrodilla', 'femoral', ['gluteos'], ['fitball', 'tapete']],
  ['Curl nórdico', 'Nordic hamstring curl', 1, 3, 'flexrodilla', 'femoral', [], ['corporal', 'tapete']],
  ['Elevación de talones de pie', 'Standing calf raise', 1, 1, 'tobillo', 'pantorrillas', [], ['maquina', 'mancuernas']],
  ['Elevación de talones sentado', 'Seated calf raise', 1, 1, 'tobillo', 'pantorrillas', [], ['maquina']],

  // Espalda
  ['Jalón al pecho', 'Lat pulldown', 1, 1, 'traccv', 'espalda', ['biceps'], ['polea']],
  ['Jalón con agarre cerrado', 'Close-grip lat pulldown', 1, 1, 'traccv', 'espalda', ['biceps'], ['polea']],
  ['Jalón con brazos rectos', 'Straight-arm pulldown', 1, 1, 'traccv', 'espalda', [], ['polea']],
  ['Dominadas', 'Pull-up', 1, 3, 'traccv', 'espalda', ['biceps'], ['dominadas']],
  ['Dominadas asistidas', 'Assisted pull-up', 1, 1, 'traccv', 'espalda', ['biceps'], ['maquina', 'banda']],
  ['Remo con barra', 'Barbell bent-over row', 1, 2, 'tracch', 'espalda', ['biceps'], ['barra']],
  ['Remo con mancuerna a una mano', 'Single-arm dumbbell row', 1, 1, 'tracch', 'espalda', ['biceps'], ['mancuernas', 'banco']],
  ['Remo sentado en polea', 'Seated cable row', 1, 1, 'tracch', 'espalda', ['biceps'], ['polea']],
  ['Remo en máquina', 'Machine row', 1, 1, 'tracch', 'espalda', ['biceps'], ['maquina']],
  ['Remo invertido', 'Inverted row', 1, 1, 'tracch', 'espalda', ['biceps'], ['trx']],
  ['Face pull en polea', 'Cable face pull', 1, 1, 'tracch', 'hombros', ['espalda'], ['polea']],
  ['Encogimiento de hombros con mancuernas', 'Dumbbell shrug', 1, 1, null, 'espalda', [], ['mancuernas']],
  ['Superman', 'Superman hold', 5, 1, 'estabilidad', 'espalda', ['gluteos'], ['tapete']],

  // Pecho
  ['Press de banca con barra', 'Barbell bench press', 1, 2, 'empujeh', 'pecho', ['triceps', 'hombros'], ['barra', 'banco']],
  ['Press de banca con mancuernas', 'Dumbbell bench press', 1, 1, 'empujeh', 'pecho', ['triceps', 'hombros'], ['mancuernas', 'banco']],
  ['Press inclinado con mancuernas', 'Incline dumbbell press', 1, 2, 'empujeh', 'pecho', ['triceps', 'hombros'], ['mancuernas', 'banco']],
  ['Press de pecho en máquina', 'Machine chest press', 1, 1, 'empujeh', 'pecho', ['triceps', 'hombros'], ['maquina']],
  ['Aperturas con mancuernas', 'Dumbbell chest fly', 1, 1, 'empujeh', 'pecho', ['hombros'], ['mancuernas', 'banco']],
  ['Cruce de poleas', 'Cable crossover', 1, 1, 'empujeh', 'pecho', ['hombros'], ['polea']],
  ['Lagartijas', 'Push-up', 1, 1, 'empujeh', 'pecho', ['triceps', 'hombros', 'abdomen'], ['corporal']],
  ['Lagartijas con rodillas apoyadas', 'Kneeling push-up', 1, 1, 'empujeh', 'pecho', ['triceps', 'hombros'], ['corporal', 'tapete']],
  ['Fondos en paralelas', 'Parallel bar dip', 1, 3, 'empujev', 'triceps', ['pecho', 'hombros'], ['paralelas']],

  // Hombro
  ['Press militar con barra', 'Barbell overhead press', 1, 2, 'empujev', 'hombros', ['triceps'], ['barra']],
  ['Press de hombro con mancuernas', 'Dumbbell shoulder press', 1, 1, 'empujev', 'hombros', ['triceps'], ['mancuernas', 'banco']],
  ['Press de hombro en máquina', 'Machine shoulder press', 1, 1, 'empujev', 'hombros', ['triceps'], ['maquina']],
  ['Elevaciones laterales con mancuernas', 'Dumbbell lateral raise', 1, 1, 'hombro', 'hombros', [], ['mancuernas']],
  ['Elevación lateral en polea', 'Cable lateral raise', 1, 1, 'hombro', 'hombros', [], ['polea']],
  ['Elevaciones frontales con mancuernas', 'Dumbbell front raise', 1, 1, 'hombro', 'hombros', [], ['mancuernas']],
  ['Aperturas invertidas con mancuernas', 'Dumbbell reverse fly', 1, 1, 'hombro', 'hombros', ['espalda'], ['mancuernas']],

  // Brazo
  ['Curl de bíceps con barra', 'Barbell biceps curl', 1, 1, 'flexcodo', 'biceps', [], ['barra']],
  ['Curl de bíceps con mancuernas', 'Dumbbell biceps curl', 1, 1, 'flexcodo', 'biceps', [], ['mancuernas']],
  ['Curl martillo', 'Hammer curl', 1, 1, 'flexcodo', 'biceps', [], ['mancuernas']],
  ['Curl de bíceps en polea', 'Cable biceps curl', 1, 1, 'flexcodo', 'biceps', [], ['polea']],
  ['Curl concentrado', 'Concentration curl', 1, 1, 'flexcodo', 'biceps', [], ['mancuernas', 'banco']],
  ['Extensión de tríceps en polea', 'Cable triceps pushdown', 1, 1, 'extcodo', 'triceps', [], ['polea']],
  ['Extensión de tríceps sobre la cabeza', 'Overhead triceps extension', 1, 1, 'extcodo', 'triceps', [], ['mancuernas']],
  ['Press francés', 'Skull crusher', 1, 2, 'extcodo', 'triceps', [], ['barra', 'banco']],
  ['Patada de tríceps', 'Triceps kickback', 1, 1, 'extcodo', 'triceps', [], ['mancuernas']],
  ['Fondos en banco', 'Bench dip', 1, 1, 'extcodo', 'triceps', ['pecho', 'hombros'], ['banco']],

  // Abdomen y tronco
  ['Plancha', 'Front plank', 5, 1, 'estabilidad', 'abdomen', ['hombros'], ['tapete']],
  ['Plancha lateral', 'Side plank', 5, 1, 'estabilidad', 'abdomen', ['abductores'], ['tapete']],
  ['Bicho muerto', 'Dead bug', 1, 1, 'estabilidad', 'abdomen', [], ['tapete']],
  ['Bird dog', 'Bird dog', 1, 1, 'estabilidad', 'abdomen', ['gluteos', 'espalda'], ['tapete']],
  ['Rueda abdominal', 'Ab wheel rollout', 1, 3, 'estabilidad', 'abdomen', ['espalda', 'hombros'], ['rueda']],
  ['Press Pallof', 'Pallof press', 5, 1, 'rotacion', 'abdomen', [], ['polea', 'banda']],
  ['Leñador en polea', 'Cable woodchopper', 1, 2, 'rotacion', 'abdomen', ['hombros'], ['polea']],
  ['Giro ruso', 'Russian twist', 1, 1, 'rotacion', 'abdomen', [], ['balon', 'tapete']],
  ['Crunch abdominal', 'Crunch', 1, 1, 'flextronco', 'abdomen', [], ['tapete']],
  ['Crunch en polea', 'Cable crunch', 1, 1, 'flextronco', 'abdomen', [], ['polea']],
  ['Elevación de piernas acostada', 'Lying leg raise', 1, 1, 'flextronco', 'abdomen', [], ['tapete']],
  ['Elevación de rodillas colgado', 'Hanging knee raise', 1, 2, 'flextronco', 'abdomen', [], ['dominadas']],
  ['Escaladores', 'Mountain climber', 3, 1, 'estabilidad', 'abdomen', ['hombros', 'cuadriceps'], ['corporal']],
  ['Paseo del granjero', "Farmer's carry", 1, 1, 'acarreo', 'espalda', ['abdomen', 'hombros'], ['mancuernas', 'kettlebell']],

  // Cardio y pliometría
  ['Caminata inclinada en caminadora', 'Incline treadmill walk', 3, 1, 'locomocion', 'gluteos', ['femoral', 'pantorrillas'], ['caminadora']],
  ['Bicicleta fija', 'Stationary cycling', 3, 1, 'locomocion', 'cuadriceps', ['gluteos', 'pantorrillas'], ['bicicleta']],
  ['Elíptica', 'Elliptical trainer', 3, 1, 'locomocion', 'cuadriceps', ['gluteos'], ['eliptica']],
  ['Remo en remadora', 'Indoor rowing', 3, 2, 'locomocion', 'espalda', ['cuadriceps', 'gluteos', 'biceps'], ['remo']],
  ['Saltar la cuerda', 'Jump rope', 3, 1, 'salto', 'pantorrillas', ['cuadriceps'], ['cuerda']],
  ['Saltos de tijera', 'Jumping jacks', 3, 1, 'salto', 'pantorrillas', ['hombros', 'abductores'], ['corporal']],
  ['Burpees', 'Burpee', 3, 2, 'salto', 'cuadriceps', ['pecho', 'hombros', 'abdomen'], ['corporal']],
  ['Sentadilla con salto', 'Jump squat', 4, 2, 'salto', 'cuadriceps', ['gluteos', 'pantorrillas'], ['corporal']],
  ['Salto al cajón', 'Box jump', 4, 2, 'salto', 'cuadriceps', ['gluteos', 'pantorrillas'], ['cajon']],
  ['Zancadas con salto', 'Jumping lunge', 4, 3, 'salto', 'cuadriceps', ['gluteos'], ['corporal']],
  ['Lanzamiento de balón medicinal al piso', 'Medicine ball slam', 4, 2, null, 'abdomen', ['hombros', 'espalda'], ['balon']],

  // Movilidad y estiramientos
  ['Rotaciones de cadera 90/90', '90/90 hip switch', 2, 1, null, 'gluteos', ['aductores'], ['tapete']],
  ['Gato-camello', 'Cat-cow', 2, 1, null, 'espalda', ['abdomen'], ['tapete']],
  ['Rotación torácica en cuadrupedia', 'Quadruped thoracic rotation', 2, 1, 'rotacion', 'espalda', ['hombros'], ['tapete']],
  ['Movilidad de tobillo en pared', 'Knee-to-wall ankle mobilization', 2, 1, null, 'pantorrillas', [], ['corporal']],
  ['Estiramiento de flexor de cadera en rodilla', 'Half-kneeling hip flexor stretch', 6, 1, null, 'cuadriceps', [], ['tapete']],
  ['Estiramiento de femoral acostado', 'Supine hamstring stretch', 6, 1, null, 'femoral', [], ['tapete', 'banda']],
  ['Estiramiento de glúteo en figura 4', 'Figure-four glute stretch', 6, 1, null, 'gluteos', [], ['tapete']],
  ['Estiramiento de cuádriceps de pie', 'Standing quad stretch', 6, 1, null, 'cuadriceps', [], ['corporal']],
  ['Estiramiento de pantorrilla en pared', 'Wall calf stretch', 6, 1, null, 'pantorrillas', [], ['corporal']],
  ['Estiramiento de pecho en pared', 'Wall chest stretch', 6, 1, null, 'pecho', ['hombros'], ['corporal']],
  ['Postura del niño', "Child's pose", 6, 1, null, 'espalda', ['gluteos'], ['tapete']],
]

/** Revisa que los datos sean coherentes antes de escribir el SQL (los nombres no se repiten, las claves existen). */
export function validate() {
  const problems = []
  const seen = new Set()
  for (const [es, en, type, difficulty, pattern, primary, secondary, equipment] of EXERCISES) {
    for (const key of [`es:${normalize(es)}`, `en:${normalize(en)}`]) {
      if (seen.has(key)) problems.push(`Nombre repetido: ${key}`)
      seen.add(key)
    }
    if (![1, 2, 3, 4, 5, 6].includes(type)) problems.push(`${es}: tipo inválido`)
    if (![1, 2, 3].includes(difficulty)) problems.push(`${es}: dificultad inválida`)
    if (pattern !== null && !PATTERNS[pattern]) problems.push(`${es}: patrón ${pattern} no existe`)
    if (!MUSCLES.includes(primary)) problems.push(`${es}: músculo ${primary} no existe`)
    for (const m of secondary) if (!MUSCLES.includes(m) || m === primary) problems.push(`${es}: secundario ${m} inválido`)
    if (equipment.length === 0) problems.push(`${es}: sin equipamiento`)
    for (const e of equipment) if (!EQUIPMENT[e]) problems.push(`${es}: equipo ${e} no existe`)
  }
  if (problems.length) throw new Error(problems.join('\n'))
}

const q = (text) => (text === null ? 'NULL' : `'${String(text).replace(/'/g, "''")}'`)
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
const values = (rows) => rows.map((r) => `  (${r.join(', ')})`).join(',\n')

/** Sentencias SQL (una por elemento) para D1. */
export function statements() {
  validate()
  const catalog = (table, entries) =>
    `INSERT OR IGNORE INTO ${table} (name_es, name_en, name_es_key, name_en_key, created_at, updated_at)
SELECT column1, column2, column3, column4, ${NOW}, ${NOW} FROM (VALUES
${values(Object.values(entries).map(([es, en]) => [q(es), q(en), q(normalize(es)), q(normalize(en))]))}
)`
  const patternKey = (p) => (p === null ? 'NULL' : q(normalize(PATTERNS[p][0])))
  const exercises = `INSERT OR IGNORE INTO exercises (name_es, name_en, name_es_key, name_en_key, type, difficulty, movement_pattern_id, created_at, updated_at)
SELECT column1, column2, column3, column4, column5, column6, (SELECT id FROM movement_patterns WHERE name_es_key = column7), ${NOW}, ${NOW} FROM (VALUES
${values(EXERCISES.map(([es, en, type, diff, pattern]) => [q(es), q(en), q(normalize(es)), q(normalize(en)), type, diff, patternKey(pattern)]))}
)`
  // SQLite calcula todo el SELECT antes de insertar cuando lee la misma tabla, así que el NOT EXISTS ve el estado previo.
  const muscles = `INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_group_id, role)
SELECT e.id, m.id, v.column3 FROM (VALUES
${values(EXERCISES.flatMap(([es, , , , , primary, secondary]) => [[q(normalize(es)), q(primary), 1], ...secondary.map((s) => [q(normalize(es)), q(s), 2])]))}
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN muscle_groups m ON m.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id)`
  const equipment = `INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment_id)
SELECT e.id, q.id FROM (VALUES
${values(EXERCISES.flatMap(([es, , , , , , , eq]) => eq.map((k) => [q(normalize(es)), q(normalize(EQUIPMENT[k][0]))])))}
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN equipment q ON q.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id)`
  // El equipo va antes que los músculos: los dos solo se agregan a ejercicios sin músculos, es decir, recién creados aquí
  // (en la app, todo ejercicio tiene músculo principal). Así no se deshace nada que la entrenadora haya cambiado.
  return [catalog('equipment', EQUIPMENT), catalog('movement_patterns', PATTERNS), exercises, equipment, muscles]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'seeds', 'ejercicios-base.sql')
  mkdirSync(dirname(out), { recursive: true })
  const header = `-- Generado por scripts/ejercicios-base.mjs (no editar a mano). Biblioteca base: ${EXERCISES.length} ejercicios,
-- ${Object.keys(EQUIPMENT).length} equipos y ${Object.keys(PATTERNS).length} patrones de movimiento. Se puede correr varias veces sin duplicar.
-- No crea rutinas: la entrenadora elige cada ejercicio y parámetro, y puede editar o desactivar cualquiera.\n\n`
  writeFileSync(out, header + statements().map((s) => `${s};\n`).join('\n'))
  console.log(`Listo: ${out} (${EXERCISES.length} ejercicios)`)
}

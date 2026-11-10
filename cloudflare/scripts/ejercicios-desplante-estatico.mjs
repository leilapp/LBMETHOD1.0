// Desplante estático con mancuernas, en Smith y con barra (10/11/2026), pedidos por Leilani.
// Uso:  node scripts/ejercicios-desplante-estatico.mjs   → escribe seeds/ejercicios-desplante-estatico.sql
// Mismas reglas que scripts/ejercicios-espalda-variantes.mjs: no duplica, no borra, no cambia lo existente.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ficha, statements } from './ejercicios-espalda-variantes.mjs'

const x = ficha('cuadriceps')

export const EXERCISES = [
  x('Desplante estático con mancuernas', 'Dumbbell split squat', 1, 'zancada', ['gluteos', 'aductores'], ['mancuernas'], 'Sentadilla búlgara',
    'Desplante sin mover los pies: con una pierna adelante y otra atrás, se baja y se sube en el mismo lugar, con una mancuerna en cada mano.',
    ['De pie con una mancuerna en cada mano, da un paso largo hacia adelante y apoya la punta del pie de atrás.', 'Con el tronco erguido, baja en vertical hasta que la rodilla de atrás casi toque el piso.', 'Empuja con el pie de adelante para subir sin mover los pies.', 'Completa las repeticiones y cambia de pierna.'],
    ['Pasos muy cortos que llevan la rodilla delantera muy adelante.', 'Dejar que la rodilla delantera se vaya hacia adentro.', 'Inclinar el tronco hacia adelante sin indicación.'],
    ['Separa los pies al ancho de la cadera, como sobre dos rieles, para no perder el equilibrio.', 'Inclinar un poco el tronco carga más el glúteo; erguido, más el cuádriceps.']),
  x('Desplante estático en Smith', 'Smith machine split squat', 1, 'zancada', ['gluteos', 'aductores'], ['smith'], 'Desplante estático con mancuernas',
    'Desplante estático con la barra guiada de la Smith sobre la espalda alta; la máquina da estabilidad para cargar más.',
    ['Coloca la barra sobre la espalda alta y desbloquéala.', 'Da un paso largo hacia adelante y apoya la punta del pie de atrás.', 'Baja en vertical hasta que la rodilla de atrás casi toque el piso.', 'Empuja con el pie de adelante para subir, completa las repeticiones y cambia de pierna.'],
    ['Colocar el pie delantero justo debajo de la barra, lo que manda la rodilla muy adelante.', 'Rebotar abajo.'],
    ['Ajusta la posición de los pies sin peso antes de empezar.', 'Deja los seguros a una altura que te permita salir.']),
  x('Desplante estático con barra', 'Barbell split squat', 2, 'zancada', ['gluteos', 'aductores'], ['barra'], 'Desplante estático con mancuernas',
    'Desplante estático con barra libre sobre la espalda alta; pide más equilibrio que con mancuernas o en Smith.',
    ['Saca la barra del rack sobre la espalda alta.', 'Da un paso largo hacia adelante y apoya la punta del pie de atrás, pies al ancho de la cadera.', 'Baja en vertical hasta que la rodilla de atrás casi toque el piso.', 'Empuja con el pie de adelante para subir, completa las repeticiones y cambia de pierna.'],
    ['Perder el equilibrio por tener los pies en línea.', 'Dejar caer el pecho hacia adelante.'],
    ['Empieza con poca carga hasta dominar el equilibrio.', 'Trabaja dentro del rack con los seguros puestos.']),
]

export const VINCULOS = [
  ['Desplante hacia delante en Smith', 'Desplante estático en Smith', 'Sin dar el paso: los pies quedan fijos'],
]

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'seeds', 'ejercicios-desplante-estatico.sql')
  writeFileSync(file, `-- Generado por scripts/ejercicios-desplante-estatico.mjs (no editar a mano). ${EXERCISES.length} ejercicios.
-- Se puede correr varias veces: no duplica, no borra y no cambia ejercicios existentes.

${statements(EXERCISES, VINCULOS).join(';\n\n')};\n`)
  console.log(`${file}: ${EXERCISES.length} ejercicios`)
}

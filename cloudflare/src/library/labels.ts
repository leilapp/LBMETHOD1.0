import { normalize } from '../text'

/** Textos en español usados en la interfaz, la plantilla de Excel y las exportaciones (mismos valores que .NET). */
export const TYPES: Record<number, string> = {
  1: 'Fuerza',
  2: 'Movilidad',
  3: 'Cardio',
  4: 'Pliométrico',
  5: 'Isométrico',
  6: 'Estiramiento',
  99: 'Otro',
}
const TYPE_CODES: Record<number, string> = { 1: 'Strength', 2: 'Mobility', 3: 'Cardio', 4: 'Plyometric', 5: 'Isometric', 6: 'Stretching', 99: 'Other' }

export const DIFFICULTIES: Record<number, string> = { 1: 'Principiante', 2: 'Intermedio', 3: 'Avanzado' }
const DIFFICULTY_CODES: Record<number, string> = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' }

export const MEDIA_TYPES: Record<number, 'Image' | 'Video'> = { 1: 'Image', 2: 'Video' }

const find = (labels: Record<number, string>, codes: Record<number, string>, text: string | null | undefined) => {
  const key = normalize(text)
  if (!key) return null
  for (const value of Object.keys(labels).map(Number)) {
    if (normalize(labels[value]) === key || normalize(codes[value]) === key) return value
  }
  return null
}

export const parseType = (text: string | null | undefined) => find(TYPES, TYPE_CODES, text)
export const parseDifficulty = (text: string | null | undefined) => find(DIFFICULTIES, DIFFICULTY_CODES, text)

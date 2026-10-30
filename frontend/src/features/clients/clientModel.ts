import type { ClientDetail, ProfilePayload } from '../../api/clients'

/** Claves de caché de los datos de clientes. */
export const clientKeys = {
  all: ['trainer', 'clients'] as const,
  options: ['trainer', 'clients', 'options'] as const,
  profile: (id: number) => ['trainer', 'clients', id, 'profile'] as const,
  notes: (id: number) => ['trainer', 'clients', id, 'notes'] as const,
  assignments: (id: number) => ['trainer', 'clients', id, 'assignments'] as const,
}

/** Estado del formulario de perfil: los números se editan como texto. */
export type FormState = Record<
  'firstName' | 'lastName' | 'email' | 'phone' | 'birthDate' | 'height' | 'heightUnit' | 'weight' | 'weightUnit' | 'experienceLevel' | 'goal' | 'trainingLocation' | 'sessionDurationMinutes' | 'declaredLimitations',
  string
> & { availableDays: number }

const str = (v: number | string | null) => (v === null ? '' : String(v))

export function formFrom(c: ClientDetail): FormState {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: str(c.phone),
    birthDate: str(c.birthDate),
    height: str(c.height),
    heightUnit: str(c.heightUnit ?? 1),
    weight: str(c.weight),
    weightUnit: str(c.weightUnit ?? 1),
    experienceLevel: str(c.experienceLevel),
    goal: str(c.goal),
    trainingLocation: str(c.trainingLocation),
    sessionDurationMinutes: str(c.sessionDurationMinutes),
    declaredLimitations: str(c.declaredLimitations),
    availableDays: c.availableDays,
  }
}

const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
const opt = (s: string) => (s.trim() === '' ? null : s.trim())

export function toProfilePayload(f: FormState): ProfilePayload {
  const height = num(f.height)
  const weight = num(f.weight)
  return {
    firstName: f.firstName.trim(),
    lastName: f.lastName.trim(),
    email: f.email.trim(),
    phone: opt(f.phone),
    birthDate: opt(f.birthDate),
    height,
    heightUnit: height === null ? null : Number(f.heightUnit),
    weight,
    weightUnit: weight === null ? null : Number(f.weightUnit),
    experienceLevel: num(f.experienceLevel),
    goal: opt(f.goal),
    trainingLocation: num(f.trainingLocation),
    availableDays: f.availableDays,
    sessionDurationMinutes: num(f.sessionDurationMinutes),
    declaredLimitations: opt(f.declaredLimitations),
  }
}


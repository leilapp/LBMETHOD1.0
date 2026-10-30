/** Reglas de la API: mínimo 10 caracteres, con mayúscula, minúscula y número. */
export function passwordProblems(pw: string): string | null {
  if (pw.length < 10) return 'Debe tener al menos 10 caracteres.'
  if (!/[A-Z]/.test(pw)) return 'Debe incluir al menos una letra mayúscula.'
  if (!/[a-z]/.test(pw)) return 'Debe incluir al menos una letra minúscula.'
  if (!/[0-9]/.test(pw)) return 'Debe incluir al menos un número.'
  return null
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

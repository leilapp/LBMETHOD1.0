import type { SessionDetail } from '../api/portal'
import type { ExerciseDraft } from '../features/portal/portalModel'

/**
 * Copia del entrenamiento en curso guardada en el teléfono, para seguir registrando sin señal.
 * Solo guarda lo que el cliente ya ve en pantalla (su entrenamiento y lo que anotó); nunca contraseñas ni tokens.
 * Al volver la conexión, la pantalla de registro sube lo pendiente; al finalizar, la copia se borra.
 */
export interface LocalSession {
  session: SessionDetail
  draft: { comment: string; exercises: ExerciseDraft[] }
  /** true: hay cambios que todavía no llegan al servidor. */
  pending: boolean
  savedAt: string
}

const PREFIX = 'lb.entrenamiento.'
const keyOf = (id: number) => `${PREFIX}${id}`

export function readLocalSession(id: number): LocalSession | null {
  try {
    const raw = localStorage.getItem(keyOf(id))
    return raw ? (JSON.parse(raw) as LocalSession) : null
  } catch {
    return null
  }
}

export function writeLocalSession(id: number, value: Omit<LocalSession, 'savedAt'>) {
  try {
    localStorage.setItem(keyOf(id), JSON.stringify({ ...value, savedAt: new Date().toISOString() }))
  } catch {
    /* sin espacio o almacenamiento bloqueado: se sigue guardando en línea como siempre */
  }
}

export function removeLocalSession(id: number) {
  try {
    localStorage.removeItem(keyOf(id))
  } catch {
    /* nada que borrar */
  }
}

/** Entrenamientos en curso guardados en este teléfono (para retomarlos sin señal desde el inicio). */
export function localSessionsInProgress(): LocalSession[] {
  const out: LocalSession[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const item = readLocalSession(Number(key.slice(PREFIX.length)))
      if (item && item.session.status === 'InProgress') out.push(item)
    }
  } catch {
    /* almacenamiento no disponible */
  }
  return out
}

/** Borra todas las copias (al cerrar sesión, para que otra persona en el mismo teléfono no las vea). */
export function clearLocalSessions() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) keys.push(key)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* almacenamiento no disponible */
  }
}

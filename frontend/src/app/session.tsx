import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { authApi, type Session } from '../api/endpoints'
import { clearLocalSessions } from '../lib/offlineSession'

export const sessionKey = ['session'] as const

/** Sesión actual leída del servidor. null = sin sesión. */
export function useSession() {
  const query = useQuery<Session | null>({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        const me = await authApi.me()
        rememberSession(me)
        return me
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          rememberSession(null)
          return null
        }
        // Sin señal: se usa el último perfil conocido para poder abrir las pantallas guardadas en el teléfono
        // (por ejemplo, el entrenamiento en curso). La API sigue revisando la sesión en cada petición.
        const known = e instanceof ApiError && e.status === 0 ? lastKnownSession() : null
        if (known) return known
        throw e
      }
    },
    staleTime: 60_000,
    retry: false,
  })
  // La sesión también llega del inicio de sesión (sin pasar por la consulta): se recuerda en ambos casos.
  const data = query.data
  useEffect(() => {
    if (data !== undefined) rememberSession(data)
  }, [data])
  return query
}

export function useSignOut() {
  const qc = useQueryClient()
  return async () => {
    try {
      await authApi.logout()
    } finally {
      rememberSession(null)
      clearLocalSessions()
      qc.clear()
      qc.setQueryData(sessionKey, null)
    }
  }
}

export function homeFor(session: Session) {
  if (session.mustChangePassword) return '/cambiar-contrasena'
  return session.role === 'TRAINER' ? '/entrenadora' : '/portal'
}

const LAST_KEY = 'lb.ultimaSesion'

/** Solo datos de presentación (nombre y rol); nunca contraseñas ni tokens: la cookie de sesión es HttpOnly. */
function rememberSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(LAST_KEY, JSON.stringify(s))
    else localStorage.removeItem(LAST_KEY)
  } catch {
    /* almacenamiento no disponible */
  }
}

function lastKnownSession(): Session | null {
  try {
    const raw = localStorage.getItem(LAST_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

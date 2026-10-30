import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { authApi, type Session } from '../api/endpoints'

export const sessionKey = ['session'] as const

/** Sesión actual leída del servidor. null = sin sesión. */
export function useSession() {
  return useQuery<Session | null>({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        return await authApi.me()
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 60_000,
    retry: false,
  })
}

export function useSignOut() {
  const qc = useQueryClient()
  return async () => {
    try {
      await authApi.logout()
    } finally {
      qc.clear()
      qc.setQueryData(sessionKey, null)
    }
  }
}

export function homeFor(session: Session) {
  if (session.mustChangePassword) return '/cambiar-contrasena'
  return session.role === 'TRAINER' ? '/entrenadora' : '/portal'
}

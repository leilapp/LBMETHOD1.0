import { Navigate, Outlet } from 'react-router-dom'
import type { Role } from '../api/endpoints'
import { ErrorState, LoadingState } from '../components/ui'
import { homeFor, useSession } from './session'

/**
 * Guarda de rutas por rol. Solo organiza la experiencia: la seguridad real
 * (roles y propiedad de los datos) la verifica la API en cada solicitud.
 */
export function RequireRole({ role }: { role: Role }) {
  const { data: session, isPending, error, refetch } = useSession()
  if (isPending) return <LoadingState label="Verificando sesión…" />
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />
  if (!session) return <Navigate to="/iniciar-sesion" replace />
  if (session.mustChangePassword) return <Navigate to="/cambiar-contrasena" replace />
  if (session.role !== role) return <Navigate to={homeFor(session)} replace />
  return <Outlet />
}

export function RedirectHome() {
  const { data: session, isPending } = useSession()
  if (isPending) return <LoadingState label="Verificando sesión…" />
  return <Navigate to={session ? homeFor(session) : '/iniciar-sesion'} replace />
}

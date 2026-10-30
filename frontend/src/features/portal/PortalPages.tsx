import { useQuery } from '@tanstack/react-query'
import { portalApi } from '../../api/endpoints'
import { ErrorState, LoadingState, PageHeader } from '../../components/ui'
import { useSession } from '../../app/session'
import { ChangePasswordForm } from '../auth/AuthPages'
import { formatDate } from '../../lib/format'

const profileKey = ['portal', 'profile'] as const

export function PortalHomePage() {
  const { data: session } = useSession()
  return (
    <>
      <PageHeader title={`Hola, ${session?.displayName ?? ''}`} subtitle="Te damos la bienvenida a tu espacio de entrenamiento" />
      <div className="grid-cards">
        <PendingCard title="Rutina vigente" text="Aquí verás el programa que te asigne tu entrenadora." phase={8} />
        <PendingCard title="Próximo entrenamiento" text="Tu siguiente sesión programada." phase={8} />
        <PendingCard title="Último entrenamiento" text="Resumen de tu sesión más reciente." phase={8} />
        <PendingCard title="Semana" text="Calendario semanal de entrenamientos y descansos." phase={9} />
      </div>
    </>
  )
}

function PendingCard({ title, text, phase }: { title: string; text: string; phase: number }) {
  return (
    <section className="card">
      <h2 className="card__title">{title}</h2>
      <p className="muted">{text}</p>
      <span className="badge badge--pending" style={{ marginTop: 'var(--lb-space-3)' }}>
        Pendiente · Fase {phase}
      </span>
    </section>
  )
}

export function PortalProfilePage() {
  const { data: profile, isPending, error, refetch } = useQuery({ queryKey: profileKey, queryFn: portalApi.profile })

  return (
    <>
      <PageHeader title="Mi perfil" />
      <div className="stack" style={{ maxWidth: 640 }}>
        <section className="card" aria-labelledby="datos">
          <h2 className="card__title" id="datos">
            Mis datos
          </h2>
          {isPending ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : (
            <dl className="profile-list">
              <Row label="Nombre" value={`${profile!.firstName} ${profile!.lastName}`} />
              <Row label="Correo" value={profile!.email} />
              <Row label="Teléfono" value={profile!.phone} />
              <Row label="Fecha de nacimiento" value={profile!.birthDate && formatDate(profile!.birthDate)} />
              <Row label="Objetivo" value={profile!.goal} />
              <Row label="Limitaciones declaradas" value={profile!.declaredLimitations} />
            </dl>
          )}
          <p className="muted" style={{ marginTop: 'var(--lb-space-4)', fontSize: 'var(--lb-text-sm)' }}>
            Si algún dato es incorrecto, avísale a tu entrenadora.
          </p>
        </section>
        <section className="card">
          <h2 className="card__title">Cambiar contraseña</h2>
          <ChangePasswordForm />
        </section>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="profile-row">
      <dt>{label}</dt>
      <dd>{value || <span className="muted">Sin registrar</span>}</dd>
    </div>
  )
}

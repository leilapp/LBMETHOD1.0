import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { portalApi, type PortalAssignment } from '../../api/endpoints'
import { ErrorState, LoadingState, PageHeader } from '../../components/ui'
import { useSession } from '../../app/session'
import { ThemeSwitch } from '../../layouts/AppShell'
import { ChangePasswordForm } from '../auth/AuthPages'
import { formatDate, initials, todayLong } from '../../lib/format'
import { CalendarDays, Dumbbell, History, TrendingUp } from 'lucide-react'
import { TrainingHomeCards } from './TrainingPages'

const profileKey = ['portal', 'profile'] as const
const QUICK = [
  { to: '/portal/rutina', label: 'Mi rutina', icon: Dumbbell },
  { to: '/portal/entrenamientos', label: 'Historial', icon: History },
  { to: '/portal/progreso', label: 'Progreso', icon: TrendingUp },
  { to: '/portal/calendario', label: 'Calendario', icon: CalendarDays },
]
const assignmentsKey = ['portal', 'assignments'] as const

export function PortalHomePage() {
  const { data: session } = useSession()
  return (
    <>
      <section className="hero lb-dark" aria-labelledby="saludo">
        <div className="hero__top">
          <span className="avatar avatar--gold avatar--lg" aria-hidden="true">
            {initials(session?.displayName)}
          </span>
          <div>
            <h1 className="hero__hello" id="saludo">
              Hola, {session?.displayName ?? ''}
            </h1>
            <p className="hero__date">{todayLong()}</p>
          </div>
        </div>
        <p className="hero__label">Te damos la bienvenida a tu espacio de entrenamiento</p>
        <div className="quick-actions" role="group" aria-label="Accesos rápidos de inicio">
          {QUICK.map(({ to, label, icon: Icon }) => (
            <Link key={to} className="quick-action" to={to}>
              <span className="quick-action__icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </section>
      <div className="grid-cards portal-home__cards">
        <TrainingHomeCards />
        <CurrentProgramCard />
      </div>
    </>
  )
}

function period(a: PortalAssignment) {
  return a.endDate ? `Del ${formatDate(a.startDate)} al ${formatDate(a.endDate)}` : `Desde el ${formatDate(a.startDate)}`
}

/** Programa vigente (o el próximo, si aún no empieza). El detalle de días y ejercicios está en «Mi rutina». */
function CurrentProgramCard() {
  const { data, isPending, error, refetch } = useQuery({ queryKey: assignmentsKey, queryFn: portalApi.assignments })
  const current = data?.filter((a) => a.status === 'Active' || a.status === 'Scheduled') ?? []
  return (
    <section className="card" aria-labelledby="programa-actual">
      <h2 className="card__title" id="programa-actual">
        Rutina vigente
      </h2>
      {isPending ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : current.length === 0 ? (
        <p className="muted">Tu entrenadora aún no te ha asignado una rutina.</p>
      ) : (
        <div className="stack">
          {current.map((a) => (
            <div key={a.id}>
              <p className="portal-program__name">
                {a.routineName} <span className={`badge ${a.status === 'Active' ? 'badge--success' : 'badge--pending'}`}>{a.statusLabel}</span>
              </p>
              <p className="muted">{period(a)}</p>
              {a.notes && <p className="portal-program__notes">{a.notes}</p>}
            </div>
          ))}
          <Link to="/portal/rutina">Ver días y ejercicios</Link>
        </div>
      )}
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
              <Row label="Estatura" value={profile!.height !== null ? `${profile!.height} ${profile!.heightUnit}` : null} />
              <Row label="Peso" value={profile!.weight !== null ? `${profile!.weight} ${profile!.weightUnit}` : null} />
              <Row label="Experiencia" value={profile!.experience} />
              <Row label="Objetivo" value={profile!.goal} />
              <Row label="Lugar de entrenamiento" value={profile!.trainingLocation} />
              <Row label="Días disponibles" value={profile!.availableDays.join(', ')} />
              <Row label="Duración de sesión" value={profile!.sessionDurationMinutes ? `${profile!.sessionDurationMinutes} min` : null} />
              <Row label="Limitaciones declaradas" value={profile!.declaredLimitations} />
            </dl>
          )}
          <p className="muted" style={{ marginTop: 'var(--lb-space-4)', fontSize: 'var(--lb-text-sm)' }}>
            Si algún dato es incorrecto, avísale a tu entrenadora.
          </p>
        </section>
        <ProgramsHistory />
        <section className="card" aria-labelledby="apariencia">
          <h2 className="card__title" id="apariencia">
            Apariencia
          </h2>
          <p className="muted" style={{ marginBottom: 'var(--lb-space-3)' }}>
            «Automático» usa el mismo tema que tu teléfono o computadora.
          </p>
          <ThemeSwitch />
        </section>
        <section className="card">
          <h2 className="card__title">Cambiar contraseña</h2>
          <ChangePasswordForm />
        </section>
      </div>
    </>
  )
}

function ProgramsHistory() {
  const { data, isPending, error, refetch } = useQuery({ queryKey: assignmentsKey, queryFn: portalApi.assignments })
  return (
    <section className="card" aria-labelledby="mis-programas">
      <h2 className="card__title" id="mis-programas">
        Mis programas
      </h2>
      {isPending ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <p className="muted">Aún no tienes programas asignados.</p>
      ) : (
        <ul className="list" aria-label="Mis programas">
          {data.map((a) => (
            <li key={a.id} className="list-item">
              <div className="list-item__main">
                <span className="list-item__title">
                  {a.routineName} <span className={`badge ${a.status === 'Active' ? 'badge--success' : a.status === 'Scheduled' ? 'badge--pending' : 'badge--muted'}`}>{a.statusLabel}</span>
                </span>
                <span className="list-item__meta">{period(a)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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

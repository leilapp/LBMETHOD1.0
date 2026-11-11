import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { portalApi, type PortalAssignment } from '../../api/endpoints'
import { ErrorState, LoadingState, PageHeader } from '../../components/ui'
import { useSession } from '../../app/session'
import { ThemeSwitch } from '../../layouts/AppShell'
import { ChangePasswordForm } from '../auth/AuthPages'
import { formatDate, initials, todayLong } from '../../lib/format'
import { ChevronRight } from 'lucide-react'
import { TodayWorkout, TrainingHomeCards } from './TrainingPages'

const profileKey = ['portal', 'profile'] as const
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
        <TodayWorkout />
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
        Mi rutina
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
            <Link key={a.id} className="list-item list-item--link list-item--flat" to="/portal/rutina">
              <span className="list-item__main">
                <span className="list-item__title">
                  {a.routineName} <span className={`badge ${a.status === 'Active' ? 'badge--success' : 'badge--pending'}`}>{a.statusLabel}</span>
                </span>
                <span className="list-item__meta">{period(a)} · ver días y ejercicios</span>
                {a.notes && <span className="portal-program__notes">{a.notes}</span>}
              </span>
              <ChevronRight className="list-item__chev" size={20} aria-hidden="true" />
            </Link>
          ))}
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

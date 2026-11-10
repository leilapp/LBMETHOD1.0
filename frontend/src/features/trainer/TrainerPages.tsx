import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { Activity, CalendarCheck, CalendarDays, ClipboardPlus, Dumbbell, Ruler, UserPlus, Users, type LucideIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { trainerApi, type ClientSummary, type TemporaryPassword } from '../../api/endpoints'
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  TextField,
} from '../../components/ui'
import { DownloadButton } from '../../components/DownloadButton'
import { useSession } from '../../app/session'
import { ThemeSwitch } from '../../layouts/AppShell'
import { ChangePasswordForm } from '../auth/AuthPages'
import { isEmail } from '../../lib/validation'
import { formatDate, formatDateTime, initials, todayLong } from '../../lib/format'
import '../clients/clients.css'
import { trackingApi, type TrainerDashboard } from '../../api/tracking'
import { useExercises } from '../library/libraryQueries'
import { MeasurementTypesSection } from '../tracking/TrackingPages'
import { trackingKeys } from '../tracking/trackingModel'

const clientsKey = ['trainer', 'clients'] as const

function useClients() {
  return useQuery({ queryKey: clientsKey, queryFn: trainerApi.clients })
}

/* ---------- Inicio ---------- */
export function TrainerDashboardPage() {
  const { data: session } = useSession()
  const { data: clients, isPending, error, refetch } = useClients()
  const tracking = useQuery({ queryKey: trackingKeys.dashboard, queryFn: trackingApi.dashboard })
  const library = useExercises({})
  const active = clients?.filter((c) => c.status === 'Active') ?? []
  const withProgram = active.filter((c) => c.currentProgram).length

  return (
    <div className="stack">
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
        {isPending ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : (
          <div className="hero__main">
            <div>
              <p className="hero__number">{active.length}</p>
              <p className="hero__label">Clientes activos</p>
            </div>
            <div className="hero__mini">
              <span className="hero__pill">
                <strong>{clients!.length}</strong> en total
              </span>
              <span className="hero__pill">
                <strong>{clients!.length - active.length}</strong> inactivos
              </span>
            </div>
          </div>
        )}
        <div className="quick-actions" role="group" aria-label="Accesos rápidos de inicio">
          <QuickAction to="/entrenadora/clientes" icon={UserPlus} label="Clientes" />
          <QuickAction to="/entrenadora/rutinas" icon={ClipboardPlus} label="Rutinas" />
          <QuickAction to="/entrenadora/biblioteca" icon={Dumbbell} label="Ejercicios" />
          <QuickAction to="/entrenadora/calendario" icon={CalendarDays} label="Calendario" />
        </div>
      </section>

      <div className="tiles">
        <Link className="tile" to="/entrenadora/clientes">
          <span className="icon-chip">
            <Users size={22} aria-hidden="true" />
          </span>
          <p className="tile__value">{clients ? withProgram : '—'}</p>
          <p className="tile__label">Clientes con programa vigente</p>
          {clients && <p className="tile__label">{active.length - withProgram} activos sin rutina asignada</p>}
        </Link>
        <Link className="tile" to="/entrenadora/biblioteca">
          <span className="icon-chip icon-chip--gold">
            <Dumbbell size={22} aria-hidden="true" />
          </span>
          <p className="tile__value">{library.data ? library.data.total : '—'}</p>
          <p className="tile__label">Ejercicios en tu biblioteca</p>
        </Link>
        <Link className="tile" to="/entrenadora/calendario">
          <span className="icon-chip icon-chip--rose">
            <CalendarCheck size={22} aria-hidden="true" />
          </span>
          <p className="tile__value">{tracking.data ? tracking.data.upcomingEvaluations.length : '—'}</p>
          <p className="tile__label">Evaluaciones en los próximos 14 días</p>
        </Link>
        <Link className="tile" to="/entrenadora/seguimiento">
          <span className="icon-chip icon-chip--mint">
            <Activity size={22} aria-hidden="true" />
          </span>
          <p className="tile__value">{tracking.data ? tracking.data.recentActivity.length : '—'}</p>
          <p className="tile__label">Registros recientes</p>
        </Link>
      </div>

      <div className="grid-cards">
        <DashboardTracking query={tracking} />
      </div>
    </div>
  )
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link className="quick-action" to={to}>
      <span className="quick-action__icon" aria-hidden="true">
        <Icon size={22} />
      </span>
      {label}
    </Link>
  )
}

/** Próximas evaluaciones y actividad reciente de los clientes (datos reales del calendario y los registros). */
function DashboardTracking({ query }: { query: UseQueryResult<TrainerDashboard> }) {
  const { data, isPending, error, refetch } = query
  if (isPending)
    return (
      <section className="card">
        <LoadingState />
      </section>
    )
  if (error)
    return (
      <section className="card">
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </section>
    )
  return (
    <>
      <section className="card" aria-labelledby="proximas-evaluaciones">
        <div className="section-head">
          <h2 className="card__title" id="proximas-evaluaciones">
            Próximas evaluaciones
          </h2>
          <Link to="/entrenadora/calendario">Calendario</Link>
        </div>
        {data.upcomingEvaluations.length === 0 ? (
          <p className="muted">
            Nada en los próximos 14 días. Prográmalas en el <Link to="/entrenadora/calendario">calendario</Link>.
          </p>
        ) : (
          <ul className="person-list">
            {data.upcomingEvaluations.map((e) => (
              <li key={e.eventId} className="person-row">
                <span className="avatar" aria-hidden="true">
                  {initials(e.clientName)}
                </span>
                <span className="person-row__main">
                  <Link to={`/entrenadora/clientes/${e.clientId}/seguimiento`}>{e.clientName}</Link>
                  <span className="person-row__meta">
                    {formatDate(e.date)}
                    {e.startTime ? ` · ${e.startTime.slice(0, 5)}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card" aria-labelledby="actividad-reciente">
        <div className="section-head">
          <h2 className="card__title" id="actividad-reciente">
            Actividad reciente
          </h2>
          <Link to="/entrenadora/seguimiento">Seguimiento</Link>
        </div>
        {data.recentActivity.length === 0 ? (
          <p className="muted">Aún no hay entrenamientos finalizados ni evaluaciones.</p>
        ) : (
          <ul className="person-list">
            {data.recentActivity.map((a, i) => (
              <li key={i} className="person-row">
                <span className={`icon-chip icon-chip--sm${a.kind === 'session' ? ' icon-chip--mint' : ' icon-chip--sky'}`} aria-hidden="true">
                  {a.kind === 'session' ? <Dumbbell size={18} /> : <Ruler size={18} />}
                </span>
                <span className="person-row__main">
                  <span>
                    <Link to={a.sessionId ? `/entrenadora/clientes/${a.clientId}/entrenamientos/${a.sessionId}` : `/entrenadora/clientes/${a.clientId}/seguimiento`}>{a.clientName}</Link>
                    {a.kind === 'session' ? ` terminó «${a.title}»` : ` · evaluación (${a.detail})`}
                  </span>
                  <span className="person-row__meta">{formatDateTime(a.occurredAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

/* ---------- Clientes ---------- */
type PendingAction = { kind: 'reset' | 'disable' | 'enable'; client: ClientSummary }

export function ClientsPage() {
  const qc = useQueryClient()
  const { data: clients, isPending, error, refetch } = useClients()
  const [creating, setCreating] = useState(false)
  const [action, setAction] = useState<PendingAction | null>(null)
  const [secret, setSecret] = useState<{ name: string; password: TemporaryPassword; isNew?: boolean } | null>(null)
  const navigate = useNavigate()
  const [notice, setNotice] = useState<string | null>(null)
  const [filter, setFilter] = useState<'Active' | 'Inactive' | 'all'>('Active')
  const [search, setSearch] = useState('')
  const term = search.trim().toLocaleLowerCase('es-MX')
  const shown = (clients ?? []).filter(
    (c) =>
      (filter === 'all' || c.status === filter) &&
      (!term || `${c.firstName} ${c.lastName} ${c.email}`.toLocaleLowerCase('es-MX').includes(term)),
  )

  const run = useMutation({
    mutationFn: async ({ kind, client }: PendingAction) => {
      if (kind === 'reset') return trainerApi.resetPassword(client.id)
      await trainerApi.setAccess(client.id, kind === 'enable')
      return null
    },
    onSuccess: async (result, { kind, client }) => {
      setAction(null)
      const name = `${client.firstName} ${client.lastName}`
      if (result) setSecret({ name, password: result })
      else setNotice(kind === 'enable' ? `Se reactivó el acceso de ${name}.` : `Se desactivó el acceso de ${name}. Sus datos se conservan.`)
      await qc.invalidateQueries({ queryKey: clientsKey })
    },
  })

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Perfiles, cuentas de acceso y programas de tus clientes"
        actions={
          <div className="page-actions">
            <DownloadButton path="/api/trainer/exports/clients" fileName="clientes-lbmethod.xlsx" label="Exportar clientes a Excel">
              Exportar a Excel
            </DownloadButton>
            <Button onClick={() => setCreating(true)}>Nuevo cliente</Button>
          </div>
        }
      />
      <div className="stack">
        {notice && <Alert kind="success">{notice}</Alert>}

        {isPending ? (
          <LoadingState label="Cargando clientes…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : clients!.length === 0 ? (
          <div className="card">
            <EmptyState
              title="Aún no tienes clientes"
              description="Crea la cuenta de tu primer cliente para que pueda entrar a su portal."
              action={<Button onClick={() => setCreating(true)}>Crear primer cliente</Button>}
            />
          </div>
        ) : (
          <>
          <div className="client-filters">
            <div className="tabs" role="tablist" aria-label="Estado">
              {([
                ['Active', 'Activos'],
                ['Inactive', 'Inactivos'],
                ['all', 'Todos'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={filter === value} className={`tabs__tab${filter === value ? ' tabs__tab--active' : ''}`} onClick={() => setFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
            <input className="input client-filters__search" type="search" aria-label="Buscar cliente" placeholder="Buscar por nombre o correo" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {shown.length === 0 && <p className="muted">No hay clientes con ese filtro.</p>}
          <ul className="list" aria-label="Lista de clientes">
            {shown.map((c) => (
              <li key={c.id} className="list-item">
                <div className="list-item__main">
                  <span className="list-item__title">
                    <Link to={`/entrenadora/clientes/${c.id}`}>
                      {c.firstName} {c.lastName}
                    </Link>{' '}
                    <span className={`badge ${c.status === 'Active' ? 'badge--success' : 'badge--muted'}`}>
                      {c.status === 'Active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </span>
                  <span className="list-item__meta">{c.email}</span>
                  <span className="list-item__meta">
                    {c.currentProgram ? (
                      <>
                        Programa: <span className="client-list__program">{c.currentProgram}</span>
                      </>
                    ) : (
                      'Sin rutina vigente'
                    )}
                  </span>
                </div>
                {c.hasAccount && (
                  <div className="list-item__actions">
                    <Button variant="secondary" onClick={() => setAction({ kind: 'reset', client: c })}>
                      Restablecer contraseña
                    </Button>
                    {c.status === 'Active' ? (
                      <Button variant="danger" onClick={() => setAction({ kind: 'disable', client: c })}>
                        Desactivar
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => setAction({ kind: 'enable', client: c })}>
                        Reactivar
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          </>
        )}
      </div>

      {creating && (
        <CreateClientModal
          onClose={() => setCreating(false)}
          onCreated={async (name, password) => {
            setCreating(false)
            setSecret({ name, password, isNew: true })
            await qc.invalidateQueries({ queryKey: clientsKey })
          }}
        />
      )}

      {action && (
        <ConfirmDialog
          title={
            action.kind === 'reset'
              ? 'Restablecer contraseña'
              : action.kind === 'disable'
                ? 'Desactivar cliente'
                : 'Reactivar cliente'
          }
          message={
            <>
              {action.kind === 'reset' &&
                `Se generará una nueva contraseña temporal para ${action.client.firstName} y se cerrarán sus sesiones abiertas.`}
              {action.kind === 'disable' &&
                `${action.client.firstName} ya no podrá entrar y se cerrarán sus sesiones. No se borra ningún dato: entrenamientos, medidas y asignaciones se conservan.`}
              {action.kind === 'enable' && `${action.client.firstName} podrá volver a entrar con su contraseña actual.`}
              {run.error && (
                <div style={{ marginTop: 'var(--lb-space-3)' }}>
                  <Alert kind="error">{run.error.message}</Alert>
                </div>
              )}
            </>
          }
          confirmLabel={action.kind === 'reset' ? 'Restablecer' : action.kind === 'disable' ? 'Desactivar' : 'Reactivar'}
          danger={action.kind === 'disable'}
          loading={run.isPending}
          onConfirm={() => run.mutate(action)}
          onCancel={() => {
            run.reset()
            setAction(null)
          }}
        />
      )}

      {secret && (
        <TemporaryPasswordModal
          name={secret.name}
          password={secret.password.temporaryPassword}
          onClose={() => setSecret(null)}
          // Cliente recién creado: puede pasar directo a armarle su rutina personalizada.
          onCreateRoutine={secret.isNew ? () => navigate(`/entrenadora/clientes/${secret.password.clientId}?crearRutina=1`) : undefined}
        />
      )}
    </>
  )
}

function CreateClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (name: string, password: TemporaryPassword) => void
}) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found: Record<string, string> = {}
    if (!form.firstName.trim()) found.firstName = 'Escribe el nombre.'
    if (!form.lastName.trim()) found.lastName = 'Escribe los apellidos.'
    if (!isEmail(form.email)) found.email = 'Escribe un correo válido.'
    setErrors(found)
    if (Object.keys(found).length) return

    setSubmitting(true)
    setFormError(null)
    try {
      const result = await trainerApi.createClient({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
      })
      onCreated(`${form.firstName.trim()} ${form.lastName.trim()}`, result)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ email: 'Ya existe una cuenta con ese correo.' })
      else setFormError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Nuevo cliente" onClose={onClose}>
      <form className="form" onSubmit={onSubmit} noValidate>
        {formError && <Alert kind="error">{formError}</Alert>}
        <TextField label="Nombre" value={form.firstName} onChange={set('firstName')} error={errors.firstName} required autoComplete="off" />
        <TextField label="Apellidos" value={form.lastName} onChange={set('lastName')} error={errors.lastName} required autoComplete="off" />
        <TextField label="Correo electrónico" type="email" value={form.email} onChange={set('email')} error={errors.email} required autoComplete="off" hint="Será su usuario para entrar." />
        <TextField label="Teléfono" type="tel" value={form.phone} onChange={set('phone')} autoComplete="off" />
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Crear cuenta
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function TemporaryPasswordModal({
  name,
  password,
  onClose,
  onCreateRoutine,
}: {
  name: string
  password: string
  onClose: () => void
  onCreateRoutine?: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Modal title="Contraseña temporal" onClose={onClose}>
      <div className="stack">
        <p className="muted">
          Comparte esta contraseña con <strong style={{ color: 'var(--lb-text)' }}>{name}</strong>. Se muestra solo esta vez;
          al entrar deberá crear una propia.
        </p>
        <div className="secret" data-testid="temporary-password">
          {password}
        </div>
        {copied && <Alert kind="success">Copiada al portapapeles.</Alert>}
        <div className="form__actions">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(password)
                setCopied(true)
              } catch {
                setCopied(false)
              }
            }}
          >
            Copiar
          </Button>
          {onCreateRoutine ? (
            <>
              <Button variant="secondary" onClick={onClose}>
                Listo
              </Button>
              <Button onClick={onCreateRoutine}>Crear su rutina</Button>
            </>
          ) : (
            <Button onClick={onClose}>Listo</Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Configuración ---------- */
export function TrainerSettingsPage() {
  return (
    <>
      <PageHeader title="Configuración" />
      <div className="stack" style={{ maxWidth: 640 }}>
        <section className="card" aria-labelledby="apariencia">
          <h2 className="card__title" id="apariencia">
            Apariencia
          </h2>
          <p className="muted" style={{ marginBottom: 'var(--lb-space-3)' }}>
            «Automático» usa el mismo tema que tu teléfono o computadora.
          </p>
          <ThemeSwitch />
        </section>
        <MeasurementTypesSection />
        <section className="card">
          <h2 className="card__title">Cambiar contraseña</h2>
          <ChangePasswordForm />
        </section>
        <RecoveryCodesSection />
      </div>
    </>
  )
}

/**
 * Códigos de recuperación de la entrenadora: con uno de ellos puede crear una contraseña nueva desde
 * «¿Olvidaste tu contraseña?» en la pantalla de inicio, sin correo. Cada código sirve una sola vez.
 */
function RecoveryCodesSection() {
  const qc = useQueryClient()
  const status = useQuery({ queryKey: ['trainer', 'recovery-codes'], queryFn: trainerApi.recoveryCodes })
  const [password, setPassword] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const generate = useMutation({
    mutationFn: () => trainerApi.generateRecoveryCodes(password),
    onSuccess: (result) => {
      setCodes(result.codes)
      setPassword('')
      setError(null)
      void qc.invalidateQueries({ queryKey: ['trainer', 'recovery-codes'] })
    },
    onError: (err) => setError((err as Error).message),
  })

  async function copy() {
    if (!codes) return
    try {
      await navigator.clipboard.writeText(`Códigos de recuperación de LB METHOD (cada uno sirve una vez):\n${codes.join('\n')}`)
      setCopied(true)
    } catch {
      setError('No se pudieron copiar. Anótalos a mano.')
    }
  }

  return (
    <section className="card" aria-labelledby="codigos-recuperacion">
      <h2 className="card__title" id="codigos-recuperacion">
        Códigos de recuperación
      </h2>
      <p className="muted" style={{ marginBottom: 'var(--lb-space-3)' }}>
        Si olvidas tu contraseña, en la pantalla de inicio toca «¿Olvidaste tu contraseña?», escribe tu correo y uno de
        estos códigos. Cada código sirve una sola vez. Guárdalos fuera de la app (en una nota de tu teléfono, una foto o en papel).
      </p>
      {status.data && (
        <p style={{ marginBottom: 'var(--lb-space-3)' }}>
          {status.data.total === 0
            ? 'Todavía no tienes códigos. Genera tus códigos ahora para no quedarte sin acceso.'
            : `Te quedan ${status.data.remaining} de ${status.data.total} códigos sin usar${status.data.generatedAt ? ` (generados el ${formatDateTime(status.data.generatedAt)})` : ''}.`}
        </p>
      )}
      {codes && (
        <>
          <Alert kind="warning">Anota o copia estos códigos ahora: no se volverán a mostrar. Los códigos anteriores ya no sirven.</Alert>
          <ul className="recovery-codes">
            {codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <div className="form__actions" style={{ marginBottom: 'var(--lb-space-4)' }}>
            <Button variant="secondary" onClick={() => void copy()}>
              {copied ? 'Copiados' : 'Copiar códigos'}
            </Button>
            <Button variant="ghost" onClick={() => setCodes(null)}>
              Ya los guardé
            </Button>
          </div>
        </>
      )}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!password) {
            setError('Escribe tu contraseña actual.')
            return
          }
          generate.mutate()
        }}
        noValidate
      >
        {error && <Alert kind="error">{error}</Alert>}
        <TextField
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          hint="Se pide para confirmar que eres tú."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="form__actions">
          <Button type="submit" loading={generate.isPending}>
            {status.data?.total ? 'Generar códigos nuevos' : 'Generar mis códigos'}
          </Button>
        </div>
      </form>
    </section>
  )
}

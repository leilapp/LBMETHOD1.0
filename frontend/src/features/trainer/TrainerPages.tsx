import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { Activity, CalendarCheck, ChevronRight, ClipboardPlus, Dumbbell, FileSpreadsheet, Ruler, TriangleAlert, UserPlus, Users, type LucideIcon } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import { useTask } from '../../components/useTask'
import { trainerApi, type TemporaryPassword } from '../../api/endpoints'
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  MoreMenu,
  PageHeader,
  Tabs,
  TextField,
} from '../../components/ui'
import { useSession } from '../../app/session'
import { ThemeSwitch } from '../../layouts/AppShell'
import { ChangePasswordForm } from '../auth/AuthPages'
import { isEmail } from '../../lib/validation'
import { formatDate, formatDateTime, initials, todayLong } from '../../lib/format'
import '../clients/clients.css'
import { trackingApi, type TrainerDashboard } from '../../api/tracking'
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
        <div className="quick-actions quick-actions--two" role="group" aria-label="Acciones rápidas">
          <QuickAction to="/entrenadora/clientes?nuevo=1" icon={UserPlus} label="Nuevo cliente" />
          <QuickAction to="/entrenadora/rutinas?nueva=1" icon={ClipboardPlus} label="Nueva rutina" />
        </div>
      </section>

      <div className="tiles">
        <Link className={`tile${clients && active.length - withProgram > 0 ? ' tile--attention' : ''}`} to="/entrenadora/clientes?filtro=sin-rutina">
          <span className="icon-chip icon-chip--gold">
            <TriangleAlert size={22} aria-hidden="true" />
          </span>
          <p className="tile__value">{clients ? active.length - withProgram : '—'}</p>
          <p className="tile__label">Clientes activos sin rutina</p>
          <span className="tile__go">Ver quiénes <ChevronRight size={16} aria-hidden="true" /></span>
        </Link>
        <Link className="tile" to="/entrenadora/clientes">
          <span className="icon-chip">
            <Users size={22} aria-hidden="true" />
          </span>
          <p className="tile__value">{clients ? withProgram : '—'}</p>
          <p className="tile__label">Clientes con programa vigente</p>
          <span className="tile__go">Ver clientes <ChevronRight size={16} aria-hidden="true" /></span>
        </Link>
        <Link className="tile" to="/entrenadora/calendario">
          <span className="icon-chip icon-chip--rose">
            <CalendarCheck size={22} aria-hidden="true" />
          </span>
          <p className="tile__value">{tracking.data ? tracking.data.upcomingEvaluations.length : '—'}</p>
          <p className="tile__label">Evaluaciones en los próximos 14 días</p>
          <span className="tile__go">Abrir calendario <ChevronRight size={16} aria-hidden="true" /></span>
        </Link>
        <Link className="tile" to="/entrenadora/seguimiento">
          <span className="icon-chip icon-chip--mint">
            <Activity size={22} aria-hidden="true" />
          </span>
          <p className="tile__value">{tracking.data ? tracking.data.recentActivity.length : '—'}</p>
          <p className="tile__label">Registros recientes</p>
          <span className="tile__go">Ver seguimiento <ChevronRight size={16} aria-hidden="true" /></span>
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
export type AccessAction = { kind: 'reset' | 'disable' | 'enable'; client: { id: number; firstName: string; lastName: string } }

/**
 * Confirmación y resultado de restablecer contraseña, desactivar o reactivar un cliente.
 * Viven en el menú ⋮ de la ficha del cliente (no en la lista), para que no se toquen por error.
 */
export function AccessDialogs({ action, onClose, onNotice }: { action: AccessAction | null; onClose: () => void; onNotice: (message: string) => void }) {
  const qc = useQueryClient()
  const [secret, setSecret] = useState<{ name: string; password: TemporaryPassword } | null>(null)
  const run = useMutation({
    mutationFn: async ({ kind, client }: AccessAction) => {
      if (kind === 'reset') return trainerApi.resetPassword(client.id)
      await trainerApi.setAccess(client.id, kind === 'enable')
      return null
    },
    onSuccess: async (result, { kind, client }) => {
      onClose()
      const name = `${client.firstName} ${client.lastName}`
      if (result) setSecret({ name, password: result })
      else onNotice(kind === 'enable' ? `Se reactivó el acceso de ${name}.` : `Se desactivó el acceso de ${name}. Sus datos se conservan.`)
      await qc.invalidateQueries({ queryKey: clientsKey })
      await qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
  return (
    <>
      {action && (
        <ConfirmDialog
          title={action.kind === 'reset' ? 'Restablecer contraseña' : action.kind === 'disable' ? 'Desactivar cliente' : 'Reactivar cliente'}
          message={
            <>
              {action.kind === 'reset' && `Se generará una nueva contraseña temporal para ${action.client.firstName} y se cerrarán sus sesiones abiertas.`}
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
            onClose()
          }}
        />
      )}
      {secret && <TemporaryPasswordModal name={secret.name} password={secret.password.temporaryPassword} onClose={() => setSecret(null)} />}
    </>
  )
}

export function ClientsPage() {
  const qc = useQueryClient()
  const { data: clients, isPending, error, refetch } = useClients()
  const [secret, setSecret] = useState<{ name: string; password: TemporaryPassword } | null>(null)
  const navigate = useNavigate()
  const exporting = useTask('No se pudo descargar el archivo.')
  const [filter, setFilter] = useState<'Active' | 'Inactive' | 'all'>('Active')
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(() => params.get('nuevo') === '1')
  // ?filtro=sin-rutina viene del inicio («Sin rutina asignada»); ?nuevo=1, del botón «Nuevo cliente» del inicio.
  const [onlyWithout, setOnlyWithout] = useState(() => params.get('filtro') === 'sin-rutina')
  const [search, setSearch] = useState('')
  const term = search.trim().toLocaleLowerCase('es-MX')
  const shown = (clients ?? []).filter(
    (c) =>
      (filter === 'all' || c.status === filter) &&
      (!onlyWithout || (c.status === 'Active' && !c.currentProgram)) &&
      (!term || `${c.firstName} ${c.lastName} ${c.email}`.toLocaleLowerCase('es-MX').includes(term)),
  )
  const count = (f: typeof filter) => (clients ?? []).filter((c) => f === 'all' || c.status === f).length

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Toca un cliente para ver su ficha, su rutina y su progreso."
        actions={
          <div className="head-actions">
            <Button onClick={() => setCreating(true)}>
              <UserPlus size={18} aria-hidden="true" />
              Nuevo cliente
            </Button>
            <MoreMenu
              items={[
                {
                  label: exporting.pending ? 'Descargando…' : 'Exportar clientes a Excel',
                  icon: FileSpreadsheet,
                  disabled: exporting.pending,
                  onSelect: () => exporting.run(() => api.download('/api/trainer/exports/clients', 'clientes-lbmethod.xlsx')),
                },
              ]}
            />
          </div>
        }
      />
      <div className="stack">
        {exporting.error && <Alert kind="error">{exporting.error}</Alert>}

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
              <input className="input client-filters__search" type="search" aria-label="Buscar cliente" placeholder="Buscar por nombre o correo" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Tabs
                label="Estado"
                value={filter}
                options={[
                  ['Active', `Activos · ${count('Active')}`],
                  ['Inactive', `Inactivos · ${count('Inactive')}`],
                  ['all', 'Todos'],
                ]}
                onChange={(v) => {
                  setFilter(v)
                  setOnlyWithout(false)
                }}
              />
            </div>
            {onlyWithout && (
              <div className="filter-note">
                <span>Mostrando solo clientes activos sin rutina.</span>
                <button type="button" className="link-button" onClick={() => setOnlyWithout(false)}>
                  Ver todos
                </button>
              </div>
            )}
            {shown.length === 0 && <p className="muted">No hay clientes con ese filtro.</p>}
            <ul className="list list-tight" aria-label="Lista de clientes">
              {shown.map((c) => (
                <li key={c.id}>
                  <Link className="list-item list-item--link" to={`/entrenadora/clientes/${c.id}`}>
                    <span className="list-item__lead">
                      <span className="avatar" aria-hidden="true">
                        {initials(`${c.firstName} ${c.lastName}`)}
                      </span>
                      <span className="list-item__main">
                        <span className="list-item__title">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="client-row__status">
                          {c.status !== 'Active' ? (
                            <span className="badge badge--muted">Inactivo</span>
                          ) : c.currentProgram ? (
                            <span className="list-item__meta">{c.currentProgram}</span>
                          ) : (
                            <span className="badge badge--warning">Sin rutina</span>
                          )}
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="list-item__chev" size={20} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {creating && (
        <CreateClientModal
          onClose={() => {
            setCreating(false)
            if (params.has('nuevo')) setParams({}, { replace: true })
          }}
          onCreated={async (name, password) => {
            setCreating(false)
            if (params.has('nuevo')) setParams({}, { replace: true })
            setSecret({ name, password })
            await qc.invalidateQueries({ queryKey: clientsKey })
          }}
        />
      )}

      {secret && (
        <TemporaryPasswordModal
          name={secret.name}
          password={secret.password.temporaryPassword}
          onClose={() => setSecret(null)}
          // Cliente recién creado: puede pasar directo a armarle su rutina personalizada.
          onCreateRoutine={() => navigate(`/entrenadora/clientes/${secret.password.clientId}?crearRutina=1`)}
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
      </div>
    </>
  )
}

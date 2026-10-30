import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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
import { useSession } from '../../app/session'
import { ChangePasswordForm } from '../auth/AuthPages'
import { isEmail } from '../../lib/validation'
import '../clients/clients.css'

const clientsKey = ['trainer', 'clients'] as const

function useClients() {
  return useQuery({ queryKey: clientsKey, queryFn: trainerApi.clients })
}

/* ---------- Inicio ---------- */
export function TrainerDashboardPage() {
  const { data: session } = useSession()
  const { data: clients, isPending, error, refetch } = useClients()
  const active = clients?.filter((c) => c.status === 'Active').length ?? 0

  return (
    <>
      <PageHeader title={`Hola, ${session?.displayName ?? ''}`} subtitle="Resumen de tu trabajo en LB METHOD" />
      <div className="grid-cards">
        <section className="card" aria-labelledby="stat-active">
          {isPending ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : (
            <>
              <p className="stat__value">{active}</p>
              <p className="stat__label" id="stat-active">
                Clientes activos
              </p>
              <p className="muted" style={{ marginTop: 'var(--lb-space-3)', fontSize: 'var(--lb-text-sm)' }}>
                {clients!.length} en total · <Link to="/entrenadora/clientes">Ver clientes</Link>
              </p>
            </>
          )}
        </section>
        <section className="card" aria-labelledby="stat-programs">
          {isPending || error ? (
            <LoadingState />
          ) : (
            <>
              <p className="stat__value">{clients!.filter((c) => c.status === 'Active' && c.currentProgram).length}</p>
              <p className="stat__label" id="stat-programs">
                Clientes con programa vigente
              </p>
              <p className="muted" style={{ marginTop: 'var(--lb-space-3)', fontSize: 'var(--lb-text-sm)' }}>
                {clients!.filter((c) => c.status === 'Active' && !c.currentProgram).length} activos sin rutina asignada
              </p>
            </>
          )}
        </section>
        <PendingStat label="Próximas evaluaciones" phase={9} />
        <PendingStat label="Actividad reciente" phase={8} />
      </div>
    </>
  )
}

/** Indicador cuyo dato todavía no existe: se marca como pendiente en lugar de inventar un número. */
function PendingStat({ label, phase }: { label: string; phase: number }) {
  return (
    <section className="card">
      <p className="stat__value muted" aria-hidden="true">
        —
      </p>
      <p className="stat__label">{label}</p>
      <span className="badge badge--pending" style={{ marginTop: 'var(--lb-space-3)' }}>
        Pendiente · Fase {phase}
      </span>
    </section>
  )
}

/* ---------- Clientes ---------- */
type PendingAction = { kind: 'reset' | 'disable' | 'enable'; client: ClientSummary }

export function ClientsPage() {
  const qc = useQueryClient()
  const { data: clients, isPending, error, refetch } = useClients()
  const [creating, setCreating] = useState(false)
  const [action, setAction] = useState<PendingAction | null>(null)
  const [secret, setSecret] = useState<{ name: string; password: TemporaryPassword } | null>(null)
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
        actions={<Button onClick={() => setCreating(true)}>Nuevo cliente</Button>}
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
            setSecret({ name, password })
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

      {secret && <TemporaryPasswordModal name={secret.name} password={secret.password.temporaryPassword} onClose={() => setSecret(null)} />}
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

function TemporaryPasswordModal({ name, password, onClose }: { name: string; password: string; onClose: () => void }) {
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
          <Button onClick={onClose}>Listo</Button>
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
      <section className="card" style={{ maxWidth: 520 }}>
        <h2 className="card__title">Cambiar contraseña</h2>
        <ChangePasswordForm />
      </section>
    </>
  )
}

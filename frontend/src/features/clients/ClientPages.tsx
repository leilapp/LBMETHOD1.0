import { ClientMessagesCard } from '../notices/Notices'
import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { clientsApi, isCurrent, type Assignment, type ClientDetail, type ClientOptions } from '../../api/clients'
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  SelectField,
  TextAreaField,
  TextField,
} from '../../components/ui'
import { PdfButton } from '../../components/PdfButton'
import { routinesApi } from '../../api/routines'
import { fromRoutineVersion } from '../../lib/routinePdf'
import { formatDate, formatDateTime, todayInMexico } from '../../lib/format'
import { isEmail } from '../../lib/validation'
import { AssignModal } from './AssignModal'
import { CreateRoutineModal } from '../routines/RoutinesPages'
import { clientKeys, formFrom, toProfilePayload, type FormState } from './clientModel'
import '../library/library.css'
import './clients.css'

const useClientOptions = () => useQuery({ queryKey: clientKeys.options, queryFn: clientsApi.options, staleTime: Infinity })

/* ---------- Ficha del cliente ---------- */
export function ClientDetailPage() {
  const id = Number(useParams().id)
  const qc = useQueryClient()
  const profile = useQuery({ queryKey: clientKeys.profile(id), queryFn: () => clientsApi.profile(id) })
  const assignments = useQuery({ queryKey: clientKeys.assignments(id), queryFn: () => clientsApi.assignments(id) })
  const [assigning, setAssigning] = useState<{ routineId?: number; versionId?: number } | null>(null)
  const [params, setParams] = useSearchParams()
  // ?crearRutina=1: viene de «Crear su rutina» justo después de crear el cliente.
  const [creatingRoutine, setCreatingRoutine] = useState(() => params.get('crearRutina') === '1')
  const [notice, setNotice] = useState<string | null>(null)

  if (profile.isPending) return <LoadingState label="Cargando cliente…" />
  if (profile.error) return <ErrorState message={profile.error.message} onRetry={() => profile.refetch()} />
  const c = profile.data
  const name = `${c.firstName} ${c.lastName}`
  const active = c.status === 'Active'

  return (
    <>
      <p className="breadcrumb">
        <Link to="/entrenadora/clientes">← Clientes</Link>
      </p>
      <PageHeader
        title={name}
        subtitle={c.email}
        actions={
          <div className="page-actions">
            <Link className="btn btn--secondary" to={`/entrenadora/clientes/${id}/seguimiento`}>
              Seguimiento
            </Link>
            <Link className="btn btn--secondary" to={`/entrenadora/clientes/${id}/editar`}>
              Editar perfil
            </Link>
            {active && (
              <Button variant="secondary" onClick={() => setAssigning({})}>
                Asignar rutina existente
              </Button>
            )}
            {active && <Button onClick={() => setCreatingRoutine(true)}>Crear rutina para {c.firstName}</Button>}
          </div>
        }
      />
      <div className="stack">
        {notice && <Alert kind="success">{notice}</Alert>}
        {!active && <Alert kind="warning">Cliente inactivo: no puede entrar ni recibir rutinas nuevas. Su historial se conserva completo.</Alert>}

        <div className="client-layout">
          <div className="stack">
            <AssignmentsCard
              clientActive={active}
              query={assignments}
              onChangeVersion={(a) => setAssigning({ routineId: a.routineId, versionId: a.latestVersionId ?? undefined })}
              onChanged={(message) => {
                setNotice(message)
                qc.invalidateQueries({ queryKey: clientKeys.all })
              }}
            />
            <ClientMessagesCard clientId={id} firstName={c.firstName} canWrite={active} />
            <NotesCard clientId={id} />
          </div>
          <ProfileCard client={c} />
        </div>
      </div>

      {creatingRoutine && (
        <CreateRoutineModal
          section="rutinas"
          forClient={{ id, firstName: c.firstName, lastName: c.lastName }}
          onClose={() => {
            setCreatingRoutine(false)
            if (params.has('crearRutina')) setParams({}, { replace: true })
          }}
        />
      )}
      {assigning && (
        <AssignModal
          clientId={id}
          clientName={c.firstName}
          routineId={assigning.routineId}
          versionId={assigning.versionId}
          onClose={() => setAssigning(null)}
          onAssigned={async () => {
            setAssigning(null)
            setNotice(`Rutina asignada a ${c.firstName}.`)
            await qc.invalidateQueries({ queryKey: clientKeys.all })
            await qc.invalidateQueries({ queryKey: ['routines'] })
          }}
        />
      )}
    </>
  )
}

function ProfileCard({ client: c }: { client: ClientDetail }) {
  const units = (v: number | null, u: number | null, labels: [string, string]) => (v === null ? null : `${v} ${u === 2 ? labels[1] : labels[0]}`)
  return (
    <section className="card" aria-labelledby="perfil-title">
      <h2 className="card__title" id="perfil-title">
        Perfil
      </h2>
      <dl className="profile-list">
        <Row label="Estado" value={c.status === 'Active' ? 'Activo' : `Inactivo${c.deactivatedAt ? ` desde ${formatDateTime(c.deactivatedAt)}` : ''}`} />
        <Row label="Registro" value={formatDateTime(c.registeredAt)} />
        <Row label="Teléfono" value={c.phone} />
        <Row label="Fecha de nacimiento" value={c.birthDate && formatDate(c.birthDate)} />
        <Row label="Estatura" value={units(c.height, c.heightUnit, ['cm', 'in'])} />
        <Row label="Peso" value={units(c.weight, c.weightUnit, ['kg', 'lb'])} />
        <Row label="Experiencia" value={c.experienceLabel} />
        <Row label="Objetivo" value={c.goal} />
        <Row label="Lugar de entrenamiento" value={c.trainingLocationLabel} />
        <Row label="Días disponibles" value={c.availableDayNames.join(', ')} />
        <Row label="Duración de sesión" value={c.sessionDurationMinutes && `${c.sessionDurationMinutes} min`} />
        <Row label="Limitaciones declaradas" value={c.declaredLimitations} />
      </dl>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="profile-row">
      <dt>{label}</dt>
      <dd>{value || <span className="muted">Sin registrar</span>}</dd>
    </div>
  )
}

/* ---------- Asignaciones ---------- */
function period(a: { startDate: string; endDate: string | null }) {
  return a.endDate ? `Del ${formatDate(a.startDate)} al ${formatDate(a.endDate)}` : `Desde el ${formatDate(a.startDate)}, sin fecha de fin`
}

const statusBadge: Record<Assignment['status'], string> = {
  Active: 'badge--success',
  Scheduled: 'badge--pending',
  Completed: 'badge--muted',
  Cancelled: 'badge--muted',
  Replaced: 'badge--muted',
}

function AssignmentsCard({
  clientActive,
  query,
  onChangeVersion,
  onChanged,
}: {
  clientActive: boolean
  query: ReturnType<typeof useQuery<Assignment[]>>
  onChangeVersion: (a: Assignment) => void
  onChanged: (message: string) => void
}) {
  const [ending, setEnding] = useState<Assignment | null>(null)
  const [cancelling, setCancelling] = useState<Assignment | null>(null)
  const qc = useQueryClient()
  const cancel = useMutation({
    mutationFn: (a: Assignment) => clientsApi.cancel(a.id),
    onSuccess: async (_, a) => {
      setCancelling(null)
      onChanged(`Se canceló «${a.routineName}». Queda en el historial.`)
      await qc.invalidateQueries({ queryKey: clientKeys.assignments(a.clientId) })
    },
  })

  const current = query.data?.filter(isCurrent) ?? []
  const past = query.data?.filter((a) => !isCurrent(a)) ?? []

  return (
    <section className="card stack" aria-labelledby="programa-title">
      <h2 className="card__title" id="programa-title">
        Programa
      </h2>
      {query.isPending ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : (
        <>
          {current.length === 0 ? (
            <EmptyState title="Sin rutina asignada" description={clientActive ? 'Usa «Crear rutina» para armarle una personalizada, o «Asignar rutina existente».' : undefined} />
          ) : (
            <ul className="assignments" aria-label="Programa actual">
              {current.map((a) => (
                <li key={a.id} className="assignment">
                  <div className="assignment__main">
                    <span className="assignment__title">
                      <Link to={`/entrenadora/rutinas/${a.routineId}`}>{a.routineName}</Link> <span className="muted">· versión {a.versionNumber}</span>{' '}
                      <span className={`badge ${statusBadge[a.status]}`}>{a.statusLabel}</span>
                    </span>
                    <span className="list-item__meta">{period(a)}</span>
                    {a.notes && <span className="list-item__meta">Indicaciones: {a.notes}</span>}
                    {a.latestVersionNumber !== null && a.latestVersionNumber > a.versionNumber && (
                      <span className="assignment__newer">
                        Hay una versión más nueva (versión {a.latestVersionNumber}). Esta asignación sigue en la versión {a.versionNumber}.
                      </span>
                    )}
                  </div>
                  <div className="list-item__actions">
                    <PdfButton getData={async () => fromRoutineVersion(await routinesApi.version(a.routineId, a.routineVersionId), a)} label={`Descargar en PDF: ${a.routineName}`}>
                      PDF
                    </PdfButton>
                    {a.latestVersionNumber !== null && a.latestVersionNumber > a.versionNumber && clientActive && (
                      <Button variant="secondary" onClick={() => onChangeVersion(a)}>
                        Cambiar a versión {a.latestVersionNumber}
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => setEnding(a)}>
                      {a.endDate ? 'Cambiar fecha de fin' : 'Terminar'}
                    </Button>
                    {a.status === 'Scheduled' && (
                      <Button variant="ghost" onClick={() => setCancelling(a)}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div>
            <h3 className="assignments__subtitle">Historial</h3>
            {past.length === 0 ? (
              <p className="muted">Aún no hay programas anteriores.</p>
            ) : (
              <ul className="assignments" aria-label="Programas anteriores">
                {past.map((a) => (
                  <li key={a.id} className="assignment assignment--past">
                    <div className="assignment__main">
                      <span className="assignment__title">
                        <Link to={`/entrenadora/rutinas/${a.routineId}`}>{a.routineName}</Link> <span className="muted">· versión {a.versionNumber}</span>{' '}
                        <span className={`badge ${statusBadge[a.status]}`}>{a.statusLabel}</span>
                      </span>
                      <span className="list-item__meta">{period(a)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {ending && (
        <EndDateDialog
          assignment={ending}
          onClose={() => setEnding(null)}
          onSaved={async (date) => {
            const a = ending
            setEnding(null)
            onChanged(date <= todayInMexico() ? `Se terminó «${a.routineName}». Queda en el historial.` : `Nueva fecha de fin de «${a.routineName}»: ${formatDate(date)}.`)
            await qc.invalidateQueries({ queryKey: clientKeys.assignments(a.clientId) })
          }}
        />
      )}
      {cancelling && (
        <ConfirmDialog
          title="Cancelar asignación"
          message={
            <>
              «{cancelling.routineName}» aún no empieza. Al cancelarla no se borra: queda en el historial como cancelada.
              {cancel.error && <Alert kind="error">{cancel.error.message}</Alert>}
            </>
          }
          confirmLabel="Cancelar asignación"
          danger
          loading={cancel.isPending}
          onConfirm={() => cancel.mutate(cancelling)}
          onCancel={() => {
            cancel.reset()
            setCancelling(null)
          }}
        />
      )}
    </section>
  )
}

function EndDateDialog({ assignment, onClose, onSaved }: { assignment: Assignment; onClose: () => void; onSaved: (date: string) => void }) {
  const today = todayInMexico()
  const [date, setDate] = useState(assignment.endDate ?? (assignment.startDate > today ? assignment.startDate : today))
  const save = useMutation({ mutationFn: () => clientsApi.setEndDate(assignment.id, date), onSuccess: () => onSaved(date) })
  const fieldError = save.error instanceof ApiError ? save.error.fieldErrors.endDate?.[0] : undefined

  return (
    <Modal title={assignment.endDate ? 'Cambiar fecha de fin' : 'Terminar programa'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <p className="muted">
          Elige el último día de «{assignment.routineName}». Si es hoy o antes, el programa queda terminado. No se borra nada: queda en el historial.
        </p>
        {save.error && !fieldError && <Alert kind="error">{save.error.message}</Alert>}
        <TextField label="Último día" type="date" required min={assignment.startDate} value={date} error={fieldError} onChange={(e) => setDate(e.target.value)} />
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Volver
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!date}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Observaciones privadas ---------- */
function NotesCard({ clientId }: { clientId: number }) {
  const qc = useQueryClient()
  const notes = useQuery({ queryKey: clientKeys.notes(clientId), queryFn: () => clientsApi.notes(clientId) })
  const [text, setText] = useState('')
  const add = useMutation({
    mutationFn: () => clientsApi.addNote(clientId, text.trim()),
    onSuccess: async () => {
      setText('')
      await qc.invalidateQueries({ queryKey: clientKeys.notes(clientId) })
    },
  })

  return (
    <section className="card stack" aria-labelledby="notas-title">
      <div>
        <h2 className="card__title" id="notas-title">
          Observaciones privadas
        </h2>
        <p className="field__hint">Solo tú las ves. El cliente nunca tiene acceso a ellas.</p>
      </div>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) add.mutate()
        }}
      >
        <TextAreaField label="Nueva observación" rows={3} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} error={add.error?.message} />
        <div className="form__actions">
          <Button type="submit" variant="secondary" loading={add.isPending} disabled={!text.trim()}>
            Guardar observación
          </Button>
        </div>
      </form>
      {notes.isPending ? (
        <LoadingState />
      ) : notes.error ? (
        <ErrorState message={notes.error.message} onRetry={() => notes.refetch()} />
      ) : notes.data.length === 0 ? (
        <p className="muted">Aún no hay observaciones.</p>
      ) : (
        <ul className="notes" aria-label="Observaciones">
          {notes.data.map((n) => (
            <li key={n.id} className="note">
              <span className="note__date">{formatDateTime(n.createdAt)}</span>
              <p className="note__text">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ---------- Editar perfil ---------- */
export function ClientProfileFormPage() {
  const id = Number(useParams().id)
  const profile = useQuery({ queryKey: clientKeys.profile(id), queryFn: () => clientsApi.profile(id), gcTime: 0 })
  const options = useClientOptions()
  if (profile.isPending || options.isPending) return <LoadingState />
  if (profile.error || options.error) return <ErrorState message={(profile.error ?? options.error)!.message} />
  return <ProfileForm client={profile.data} options={options.data} />
}

function ProfileForm({ client, options }: { client: ClientDetail; options: ClientOptions }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [f, setF] = useState(() => formFrom(client))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const field = (k: Exclude<keyof FormState, 'availableDays'>) => ({
    value: f[k],
    error: errors[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const v = e.target.value
      setF((s) => ({ ...s, [k]: v }))
      setErrors((s) => {
        const { [k]: _removed, ...rest } = s
        return rest
      })
    },
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found: Record<string, string> = {}
    if (!f.firstName.trim()) found.firstName = 'Escribe el nombre.'
    if (!f.lastName.trim()) found.lastName = 'Escribe los apellidos.'
    if (!isEmail(f.email)) found.email = 'Escribe un correo válido.'
    if (f.height.trim() && Number.isNaN(Number(f.height.replace(',', '.')))) found.height = 'Escribe un número.'
    if (f.weight.trim() && Number.isNaN(Number(f.weight.replace(',', '.')))) found.weight = 'Escribe un número.'
    if (f.sessionDurationMinutes.trim() && !/^\d+$/.test(f.sessionDurationMinutes.trim())) found.sessionDurationMinutes = 'Escribe los minutos.'
    if (f.birthDate && f.birthDate > todayInMexico()) found.birthDate = 'Fecha de nacimiento no válida.'
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    setProblem(null)
    try {
      await clientsApi.updateProfile(client.id, toProfilePayload(f))
      await qc.invalidateQueries({ queryKey: clientKeys.all })
      navigate(`/entrenadora/clientes/${client.id}`)
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k, v[0]])))
      else setProblem((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const emailChanged = f.email.trim().toLowerCase() !== client.email.toLowerCase()

  return (
    <>
      <p className="breadcrumb">
        <Link to={`/entrenadora/clientes/${client.id}`}>← Volver a la ficha</Link>
      </p>
      <PageHeader title={`Editar perfil de ${client.firstName}`} subtitle="Solo nombre, apellidos y correo son obligatorios." />
      <form className="card form" onSubmit={submit} noValidate>
        {problem && <Alert kind="error">{problem}</Alert>}
        <h2 className="card__title">Datos personales</h2>
        <div className="form-grid">
          <TextField label="Nombre" required maxLength={100} {...field('firstName')} />
          <TextField label="Apellidos" required maxLength={100} {...field('lastName')} />
          <TextField label="Correo electrónico" type="email" required maxLength={256} {...field('email')} hint={emailChanged && client.hasAccount ? 'También cambia el correo con el que entra a su portal.' : 'Es su usuario para entrar.'} />
          <TextField label="Teléfono" type="tel" maxLength={30} {...field('phone')} />
          <TextField label="Fecha de nacimiento" type="date" max={todayInMexico()} {...field('birthDate')} />
        </div>

        <h2 className="card__title">Medidas básicas</h2>
        <div className="form-grid form-grid--units">
          <TextField label="Estatura" inputMode="decimal" {...field('height')} hint="Opcional" />
          <SelectField label="Unidad de estatura" {...field('heightUnit')}>
            {options.lengthUnits.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <TextField label="Peso" inputMode="decimal" {...field('weight')} hint="Opcional" />
          <SelectField label="Unidad de peso" {...field('weightUnit')}>
            {options.weightUnits.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
        </div>

        <h2 className="card__title">Entrenamiento</h2>
        <div className="form-grid">
          <SelectField label="Experiencia" {...field('experienceLevel')}>
            <option value="">Sin indicar</option>
            {options.experienceLevels.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Lugar de entrenamiento" {...field('trainingLocation')}>
            <option value="">Sin indicar</option>
            {options.trainingLocations.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <TextField label="Duración de sesión (min)" inputMode="numeric" {...field('sessionDurationMinutes')} />
        </div>
        <fieldset className="days-field">
          <legend className="field__label">Días disponibles</legend>
          <div className="days-field__grid">
            {options.days.map((d) => (
              <label key={d.value} className="check">
                <input
                  type="checkbox"
                  checked={(f.availableDays & d.value) !== 0}
                  onChange={(e) => setF((s) => ({ ...s, availableDays: e.target.checked ? s.availableDays | d.value : s.availableDays & ~d.value }))}
                />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
        <TextAreaField label="Objetivo" maxLength={500} rows={2} {...field('goal')} />
        <TextAreaField label="Limitaciones declaradas" maxLength={2000} rows={3} {...field('declaredLimitations')} hint="Lesiones o condiciones que el cliente te comunicó. El cliente puede verlas en su perfil." />

        <div className="form__actions">
          <Link className="btn btn--secondary" to={`/entrenadora/clientes/${client.id}`}>
            Cancelar
          </Link>
          <Button type="submit" loading={saving}>
            Guardar perfil
          </Button>
        </div>
      </form>
    </>
  )
}

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { clientsApi, isCurrent, type Assignment, type ClientDetail, type ClientOptions } from '../../api/clients'
import {
  BackLink,
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
  SelectField,
  TextAreaField,
  TextField,
} from '../../components/ui'
import { PdfButton } from '../../components/PdfButton'
import { routinesApi } from '../../api/routines'
import { fromRoutineVersion } from '../../lib/routinePdf'
import { formatDate, formatDateTime, initials, todayInMexico } from '../../lib/format'
import { Activity, ClipboardList, ClipboardPlus, KeyRound, Pencil, UserCheck, UserX } from 'lucide-react'
import { AccessDialogs, type AccessAction } from '../trainer/TrainerPages'
import { SessionsCard } from '../tracking/TrackingPages'
import { isEmail } from '../../lib/validation'
import { AssignModal } from './AssignModal'
import { CreateRoutineModal } from '../routines/RoutinesPages'
import { clientKeys, formFrom, toProfilePayload, type FormState } from './clientModel'
import '../library/library.css'
import './clients.css'

const useClientOptions = () => useQuery({ queryKey: clientKeys.options, queryFn: clientsApi.options, staleTime: Infinity })

/* ---------- Ficha del cliente ---------- */
type ClientTab = 'resumen' | 'rutina' | 'progreso' | 'perfil'
const CLIENT_TABS = [
  ['resumen', 'Resumen'],
  ['rutina', 'Rutina'],
  ['progreso', 'Progreso'],
  ['perfil', 'Perfil'],
] as const

export function ClientDetailPage() {
  const id = Number(useParams().id)
  const qc = useQueryClient()
  const profile = useQuery({ queryKey: clientKeys.profile(id), queryFn: () => clientsApi.profile(id) })
  const assignments = useQuery({ queryKey: clientKeys.assignments(id), queryFn: () => clientsApi.assignments(id) })
  const [assigning, setAssigning] = useState<{ routineId?: number; versionId?: number } | null>(null)
  const [params, setParams] = useSearchParams()
  // ?crearRutina=1: viene de «Crear su rutina» justo después de crear el cliente.
  const [creatingRoutine, setCreatingRoutine] = useState(() => params.get('crearRutina') === '1')
  const [choosing, setChoosing] = useState(false)
  const [access, setAccess] = useState<AccessAction | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const tabParam = params.get('ver')
  const tab: ClientTab = CLIENT_TABS.some(([v]) => v === tabParam) ? (tabParam as ClientTab) : 'resumen'
  const setTab = (v: ClientTab) => setParams(v === 'resumen' ? {} : { ver: v }, { replace: true })

  if (profile.isPending) return <LoadingState label="Cargando cliente…" />
  if (profile.error) return <ErrorState message={profile.error.message} onRetry={() => profile.refetch()} />
  const c = profile.data
  const name = `${c.firstName} ${c.lastName}`
  const active = c.status === 'Active'
  const current = assignments.data?.filter(isCurrent) ?? []
  const who = { id, firstName: c.firstName, lastName: c.lastName }

  return (
    <>
      <BackLink to="/entrenadora/clientes" label="Clientes" />
      <header className="client-head">
        <span className="avatar avatar--gold avatar--lg" aria-hidden="true">
          {initials(name)}
        </span>
        <div className="client-head__text">
          <h1 className="page-header__title">{name}</h1>
          <p className="page-header__subtitle">{c.email}</p>
        </div>
        <MoreMenu
          label={`Más acciones para ${c.firstName}`}
          items={[
            { label: 'Editar perfil', icon: Pencil, to: `/entrenadora/clientes/${id}/editar` },
            { label: 'Seguimiento completo', icon: Activity, to: `/entrenadora/clientes/${id}/seguimiento` },
            c.hasAccount && { label: 'Restablecer contraseña', icon: KeyRound, onSelect: () => setAccess({ kind: 'reset', client: who }) },
            c.hasAccount && active && { label: 'Desactivar cliente', icon: UserX, danger: true, onSelect: () => setAccess({ kind: 'disable', client: who }) },
            c.hasAccount && !active && { label: 'Reactivar cliente', icon: UserCheck, onSelect: () => setAccess({ kind: 'enable', client: who }) },
          ]}
        />
      </header>
      <Tabs fill label="Secciones de la ficha" value={tab} options={CLIENT_TABS} onChange={setTab} />
      <div className="stack">
        {notice && <Alert kind="success">{notice}</Alert>}
        {!active && <Alert kind="warning">Cliente inactivo: no puede entrar ni recibir rutinas nuevas. Su historial se conserva completo.</Alert>}

        {tab === 'resumen' && (
          <div className="client-layout">
            <div className="stack">
              {assignments.isPending ? (
                <section className="card">
                  <LoadingState />
                </section>
              ) : assignments.error ? (
                <section className="card">
                  <ErrorState message={assignments.error.message} onRetry={() => assignments.refetch()} />
                </section>
              ) : current.length === 0 ? (
                <section className="card card--attention stack" aria-labelledby="sin-rutina">
                  <span className="badge badge--warning">Sin rutina</span>
                  <h2 className="card__title" id="sin-rutina">
                    {c.firstName} todavía no tiene rutina
                  </h2>
                  {active ? (
                    <>
                      <p className="muted">Ármale una nueva, solo para {c.firstName}, o usa una que ya tengas.</p>
                      <div>
                        <Button onClick={() => setChoosing(true)}>Darle una rutina</Button>
                      </div>
                    </>
                  ) : (
                    <p className="muted">Reactívalo desde el menú ⋮ para poder asignarle una.</p>
                  )}
                </section>
              ) : (
                <section className="card stack" aria-labelledby="rutina-actual">
                  <div className="section-head">
                    <h2 className="card__title" id="rutina-actual">
                      {current.length === 1 ? 'Rutina actual' : 'Rutinas actuales'}
                    </h2>
                    <button type="button" className="link-button" onClick={() => setTab('rutina')}>
                      Ver detalle
                    </button>
                  </div>
                  <ul className="assignments" aria-label="Programa actual">
                    {current.map((a) => (
                      <li key={a.id} className="assignment">
                        <div className="assignment__main">
                          <span className="assignment__title">
                            <Link to={`/entrenadora/rutinas/${a.routineId}`}>{a.routineName}</Link>{' '}
                            <span className={`badge ${statusBadge[a.status]}`}>{a.statusLabel}</span>
                          </span>
                          <span className="list-item__meta">{period(a)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <NotesCard clientId={id} />
            </div>
            <ProfileProgress client={c} onOpen={() => setTab('perfil')} />
          </div>
        )}

        {tab === 'rutina' && (
          <AssignmentsCard
            clientActive={active}
            clientName={c.firstName}
            query={assignments}
            onAdd={() => setChoosing(true)}
            onChangeVersion={(a) => setAssigning({ routineId: a.routineId, versionId: a.latestVersionId ?? undefined })}
            onChanged={(message) => {
              setNotice(message)
              qc.invalidateQueries({ queryKey: clientKeys.all })
            }}
          />
        )}

        {tab === 'progreso' && (
          <>
            <section className="card stack" aria-labelledby="progreso-title">
              <h2 className="card__title" id="progreso-title">
                Medidas, fotos y evaluaciones
              </h2>
              <p className="muted">Gráficas de progreso, evaluaciones y fotos privadas de {c.firstName}.</p>
              <div>
                <Link className="btn btn--primary" to={`/entrenadora/clientes/${id}/seguimiento`}>
                  Abrir seguimiento
                </Link>
              </div>
            </section>
            <SessionsCard clientId={id} limit={10} />
          </>
        )}

        {tab === 'perfil' && <ProfileCard client={c} />}
      </div>

      {choosing && (
        <Modal title={`Darle una rutina a ${c.firstName}`} onClose={() => setChoosing(false)}>
          <div className="choice-list">
            <button
              type="button"
              className="choice"
              onClick={() => {
                setChoosing(false)
                setCreatingRoutine(true)
              }}
            >
              <span className="icon-chip" aria-hidden="true">
                <ClipboardPlus size={22} />
              </span>
              <span className="choice__text">
                <span className="choice__title">Crear una nueva para {c.firstName}</span>
                <span className="choice__hint">La armas ejercicio por ejercicio; al publicarla se le asigna.</span>
              </span>
            </button>
            <button
              type="button"
              className="choice"
              onClick={() => {
                setChoosing(false)
                setAssigning({})
              }}
            >
              <span className="icon-chip icon-chip--gold" aria-hidden="true">
                <ClipboardList size={22} />
              </span>
              <span className="choice__text">
                <span className="choice__title">Usar una rutina que ya tengo</span>
                <span className="choice__hint">Eliges una rutina publicada y desde qué fecha.</span>
              </span>
            </button>
          </div>
          <div className="form__actions">
            <Button variant="secondary" onClick={() => setChoosing(false)}>
              Cancelar
            </Button>
          </div>
        </Modal>
      )}
      {creatingRoutine && (
        <CreateRoutineModal
          section="rutinas"
          forClient={who}
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
      <AccessDialogs
        action={access}
        onClose={() => setAccess(null)}
        onNotice={async (message) => {
          setNotice(message)
          await qc.invalidateQueries({ queryKey: clientKeys.profile(id) })
        }}
      />
    </>
  )
}

/** Datos del perfil que se pueden llenar (sin contar nombre y correo, que son obligatorios). */
function profileFields(c: ClientDetail) {
  const units = (v: number | null, u: number | null, labels: [string, string]) => (v === null ? null : `${v} ${u === 2 ? labels[1] : labels[0]}`)
  return [
    ['Teléfono', c.phone],
    ['Fecha de nacimiento', c.birthDate && formatDate(c.birthDate)],
    ['Estatura', units(c.height, c.heightUnit, ['cm', 'in'])],
    ['Peso', units(c.weight, c.weightUnit, ['kg', 'lb'])],
    ['Experiencia', c.experienceLabel],
    ['Objetivo', c.goal],
    ['Lugar de entrenamiento', c.trainingLocationLabel],
    ['Días disponibles', c.availableDayNames.join(', ')],
    ['Duración de sesión', c.sessionDurationMinutes && `${c.sessionDurationMinutes} min`],
    ['Limitaciones declaradas', c.declaredLimitations],
  ] as const
}

/** Resumen del perfil: cuántos datos tiene y lo más útil para entrenar (objetivo, experiencia, limitaciones). */
function ProfileProgress({ client: c, onOpen }: { client: ClientDetail; onOpen: () => void }) {
  const fields = profileFields(c)
  const filled = fields.filter(([, v]) => v).length
  const key = fields.filter(([label, v]) => v && ['Objetivo', 'Experiencia', 'Limitaciones declaradas'].includes(label))
  return (
    <section className="card stack" aria-labelledby="perfil-resumen">
      <div className="section-head">
        <h2 className="card__title" id="perfil-resumen">
          Perfil
        </h2>
        <span className="muted">
          {filled} de {fields.length} datos
        </span>
      </div>
      <div className="meter" role="progressbar" aria-label="Perfil completo" aria-valuemin={0} aria-valuemax={fields.length} aria-valuenow={filled}>
        <span style={{ width: `${(filled / fields.length) * 100}%` }} />
      </div>
      {key.length > 0 && (
        <dl className="profile-list">
          {key.map(([label, value]) => (
            <Row key={label} label={label} value={value} />
          ))}
        </dl>
      )}
      <div className="head-actions">
        {filled < fields.length && (
          <Link className="btn btn--secondary" to={`/entrenadora/clientes/${c.id}/editar`}>
            Completar perfil
          </Link>
        )}
        <button type="button" className="link-button" onClick={onOpen}>
          Ver perfil completo
        </button>
      </div>
    </section>
  )
}

function ProfileCard({ client: c }: { client: ClientDetail }) {
  const fields = profileFields(c)
  const empty = fields.filter(([, v]) => !v)
  return (
    <section className="card stack" aria-labelledby="perfil-title">
      <div className="section-head">
        <h2 className="card__title" id="perfil-title">
          Perfil
        </h2>
        <Link className="btn btn--secondary" to={`/entrenadora/clientes/${c.id}/editar`}>
          Editar perfil
        </Link>
      </div>
      <dl className="profile-list">
        <Row label="Estado" value={c.status === 'Active' ? 'Activo' : `Inactivo${c.deactivatedAt ? ` desde ${formatDateTime(c.deactivatedAt)}` : ''}`} />
        <Row label="Registro" value={formatDateTime(c.registeredAt)} />
        {fields
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <Row key={label} label={label} value={value} />
          ))}
      </dl>
      {empty.length > 0 && (
        <p className="muted">
          Sin registrar: {empty.map(([label]) => label.toLowerCase()).join(', ')}.
        </p>
      )}
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
  clientName,
  query,
  onAdd,
  onChangeVersion,
  onChanged,
}: {
  clientActive: boolean
  clientName: string
  query: ReturnType<typeof useQuery<Assignment[]>>
  onAdd: () => void
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
      <div className="section-head">
        <h2 className="card__title" id="programa-title">
          Programa
        </h2>
        {clientActive && current.length > 0 && (
          <Button variant="secondary" onClick={onAdd}>
            Agregar otra rutina
          </Button>
        )}
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : (
        <>
          {current.length === 0 ? (
            <EmptyState
              title="Sin rutina asignada"
              description={clientActive ? `Ármale una nueva a ${clientName} o usa una que ya tengas.` : undefined}
              action={clientActive ? <Button onClick={onAdd}>Darle una rutina</Button> : undefined}
            />
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
      <BackLink to={`/entrenadora/clientes/${client.id}`} label={`Ficha de ${client.firstName}`} />
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

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { clientsApi } from '../../api/clients'
import { portalTrackingApi, trackingApi, type Evaluation, type Measurement, type MeasurementType } from '../../api/tracking'
import { Alert, Button, EmptyState, ErrorState, LoadingState, Modal, PageHeader, SelectField, TextAreaField, TextField } from '../../components/ui'
import { DownloadButton } from '../../components/DownloadButton'
import { formatDate, formatDateTime, todayInMexico } from '../../lib/format'
import { clientKeys } from '../clients/clientModel'
import { ProgressView } from './ProgressView'
import { fieldErrors, fmt, toNumber, trackingKeys } from './trackingModel'
import '../library/library.css'
import '../clients/clients.css'
import './tracking.css'

/* ---------- Seguimiento: resumen de clientes ---------- */
export function TrackingOverviewPage() {
  const overview = useQuery({ queryKey: trackingKeys.overview, queryFn: trackingApi.overview })
  const [showInactive, setShowInactive] = useState(false)
  const rows = overview.data?.filter((c) => showInactive || c.status === 'Active') ?? []
  return (
    <>
      <PageHeader
        title="Seguimiento"
        subtitle="Evaluaciones, medidas, fotos y entrenamientos de cada cliente."
        actions={
          <DownloadButton path="/api/trainer/exports/evaluations" fileName="evaluaciones-lbmethod.xlsx" label="Exportar evaluaciones de todos los clientes a Excel">
            Exportar evaluaciones a Excel
          </DownloadButton>
        }
      />
      <div className="stack">
        <label className="check">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar clientes inactivos
        </label>
        {overview.isPending ? (
          <LoadingState />
        ) : overview.error ? (
          <ErrorState message={overview.error.message} onRetry={() => overview.refetch()} />
        ) : rows.length === 0 ? (
          <div className="card">
            <EmptyState title="Aún no hay clientes" description="Cuando registres clientes, aquí verás su seguimiento." />
          </div>
        ) : (
          <ul className="list" aria-label="Seguimiento por cliente">
            {rows.map((c) => (
              <li key={c.clientId} className="list-item">
                <div className="list-item__main">
                  <span className="list-item__title">
                    <Link to={`/entrenadora/clientes/${c.clientId}/seguimiento`}>{c.name}</Link>
                    {c.status !== 'Active' && <span className="badge badge--muted"> Inactivo</span>}
                  </span>
                  <span className="list-item__meta">{c.currentProgram ?? 'Sin rutina vigente'}</span>
                  <span className="list-item__meta">
                    {c.sessionsLast30Days} {c.sessionsLast30Days === 1 ? 'entrenamiento' : 'entrenamientos'} en 30 días
                    {c.lastSession ? ` · último ${formatDateTime(c.lastSession)}` : ''}
                    {c.sessionsInProgress ? ' · 1 sin terminar' : ''}
                  </span>
                  <span className="list-item__meta">
                    Última evaluación: {c.lastEvaluation ? formatDate(c.lastEvaluation) : 'ninguna'}
                    {c.nextEvaluation ? ` · próxima ${formatDate(c.nextEvaluation)}` : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/* ---------- Seguimiento de un cliente ---------- */
export function ClientTrackingPage() {
  const id = Number(useParams().id)
  const profile = useQuery({ queryKey: clientKeys.profile(id), queryFn: () => clientsApi.profile(id) })
  const progress = useQuery({ queryKey: trackingKeys.progress(id), queryFn: () => trackingApi.progress(id) })
  const evaluations = useQuery({ queryKey: trackingKeys.evaluations(id), queryFn: () => trackingApi.evaluations(id) })
  const photos = useQuery({ queryKey: trackingKeys.photos(id), queryFn: () => trackingApi.photos(id) })
  const [modal, setModal] = useState<'evaluation' | 'photo' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (profile.isPending) return <LoadingState label="Cargando seguimiento…" />
  if (profile.error) return <ErrorState message={profile.error.message} onRetry={() => profile.refetch()} />
  const c = profile.data
  const name = `${c.firstName} ${c.lastName}`
  const loading = progress.isPending || evaluations.isPending || photos.isPending
  const error = progress.error ?? evaluations.error ?? photos.error

  return (
    <>
      <p className="breadcrumb">
        <Link to="/entrenadora/seguimiento">← Seguimiento</Link> · <Link to={`/entrenadora/clientes/${id}`}>Ficha de {c.firstName}</Link>
      </p>
      <PageHeader
        title={`Seguimiento de ${name}`}
        actions={
          <div className="page-actions">
            <DownloadButton path={`/api/trainer/exports/evaluations?clientId=${id}`} fileName="evaluaciones-lbmethod.xlsx" label={`Exportar evaluaciones de ${name} a Excel`}>
              Exportar a Excel
            </DownloadButton>
            <Button variant="secondary" onClick={() => setModal('photo')}>
              Subir foto
            </Button>
            <Button onClick={() => setModal('evaluation')}>Nueva evaluación</Button>
          </div>
        }
      />
      <div className="stack">
        {notice && <Alert kind="success">{notice}</Alert>}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => [progress, evaluations, photos].forEach((q) => q.refetch())} />
        ) : (
          <div className="tracking-layout">
            <ProgressView progress={progress.data!} evaluations={evaluations.data!} photos={photos.data!} />
            <div className="stack">
              <EvaluationsCard clientId={id} evaluations={evaluations.data!} onSaved={setNotice} />
              <SessionsCard clientId={id} />
            </div>
          </div>
        )}
      </div>

      {modal === 'evaluation' && (
        <EvaluationModal
          clientId={id}
          clientName={c.firstName}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            setNotice('Evaluación guardada.')
          }}
        />
      )}
      {modal === 'photo' && (
        <PhotoModal
          clientId={id}
          evaluations={evaluations.data ?? []}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            setNotice('Foto guardada de forma privada.')
          }}
        />
      )}
    </>
  )
}

function useInvalidateClient(clientId: number) {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: trackingKeys.client(clientId) }),
      qc.invalidateQueries({ queryKey: trackingKeys.overview }),
      qc.invalidateQueries({ queryKey: trackingKeys.dashboard }),
      qc.invalidateQueries({ queryKey: trackingKeys.calendar }),
      qc.invalidateQueries({ queryKey: trackingKeys.types }),
    ])
}

function EvaluationsCard({ clientId, evaluations, onSaved }: { clientId: number; evaluations: Evaluation[]; onSaved: (m: string) => void }) {
  const [editing, setEditing] = useState<Evaluation | null>(null)
  const [correcting, setCorrecting] = useState<Measurement | null>(null)
  return (
    <section className="card" aria-labelledby="evaluaciones">
      <h2 className="card__title" id="evaluaciones">
        Evaluaciones
      </h2>
      {evaluations.length === 0 ? (
        <p className="muted">Sin evaluaciones registradas.</p>
      ) : (
        <ul className="list" aria-label="Evaluaciones">
          {evaluations.map((e) => (
            <li key={e.id} className="list-item eval-item">
              <div className="list-item__main">
                <span className="list-item__title">{formatDate(e.evaluatedOn)}</span>
                {e.notes && <span className="list-item__meta pre-line">{e.notes}</span>}
                <ul className="eval-measures">
                  {e.measurements.map((m) => (
                    <li key={m.id}>
                      <span>
                        {m.name}: <strong>{fmt(m.value)} {m.unit}</strong>
                        {m.notes && <span className="muted"> · {m.notes}</span>}
                      </span>
                      <button type="button" className="link-button" onClick={() => setCorrecting(m)} aria-label={`Corregir ${m.name} del ${formatDate(e.evaluatedOn)}`}>
                        Corregir
                      </button>
                    </li>
                  ))}
                </ul>
                {e.photos.length > 0 && <span className="list-item__meta">{e.photos.length} {e.photos.length === 1 ? 'foto' : 'fotos'}</span>}
              </div>
              <Button variant="ghost" onClick={() => setEditing(e)}>
                Editar
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <EvaluationModal
          clientId={clientId}
          evaluation={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onSaved('Evaluación actualizada.')
          }}
        />
      )}
      {correcting && (
        <CorrectModal
          clientId={clientId}
          measurement={correcting}
          onClose={() => setCorrecting(null)}
          onSaved={() => {
            setCorrecting(null)
            onSaved('Medida corregida. El valor anterior queda en la bitácora.')
          }}
        />
      )}
    </section>
  )
}

/** Nueva evaluación, o cambiar fecha/notas y agregar medidas que faltaron a una existente. */
function EvaluationModal({
  clientId,
  clientName,
  evaluation,
  onClose,
  onSaved,
}: {
  clientId: number
  clientName?: string
  evaluation?: Evaluation
  onClose: () => void
  onSaved: () => void
}) {
  const types = useQuery({ queryKey: trackingKeys.types, queryFn: trackingApi.types })
  const invalidate = useInvalidateClient(clientId)
  const [date, setDate] = useState(evaluation?.evaluatedOn ?? todayInMexico())
  const [notes, setNotes] = useState(evaluation?.notes ?? '')
  const [values, setValues] = useState<Record<number, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const existing = new Set(evaluation?.measurements.map((m) => m.measurementTypeId))
  const available: MeasurementType[] = types.data?.filter((t) => t.isActive && !existing.has(t.id)) ?? []
  const filled = available.filter((t) => (values[t.id] ?? '').trim() !== '')

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        evaluatedOn: date,
        notes: notes.trim() || null,
        measurements: filled.map((t) => ({ measurementTypeId: t.id, value: toNumber(values[t.id]), notes: null })),
      }
      if (evaluation) await trackingApi.updateEvaluation(evaluation.id, payload)
      else await trackingApi.createEvaluation(clientId, payload)
    },
    onSuccess: async () => {
      await invalidate()
      onSaved()
    },
    onError: (e) => setErrors(fieldErrors(e)),
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    save.mutate()
  }
  const errorFor = (typeId: number) => {
    const i = filled.findIndex((t) => t.id === typeId)
    return i < 0 ? undefined : (errors[`measurements[${i}].value`] ?? errors[`measurements[${i}].measurementTypeId`])
  }

  return (
    <Modal title={evaluation ? `Evaluación del ${formatDate(evaluation.evaluatedOn)}` : `Nueva evaluación de ${clientName}`} onClose={onClose} wide>
      <form className="stack" onSubmit={submit} noValidate>
        {save.error && Object.keys(errors).length === 0 && <Alert kind="error">{save.error.message}</Alert>}
        {errors.measurements && <Alert kind="error">{errors.measurements}</Alert>}
        <div className="form-grid">
          <TextField label="Fecha" type="date" required max={todayInMexico()} value={date} onChange={(e) => setDate(e.target.value)} error={errors.evaluatedOn} />
        </div>
        {types.isPending ? (
          <LoadingState />
        ) : types.error ? (
          <ErrorState message={types.error.message} />
        ) : (
          <fieldset className="measure-fieldset">
            <legend className="field__label">{evaluation ? 'Agregar medidas que faltaron' : 'Medidas'} (deja vacías las que no tomaste)</legend>
            {available.length === 0 ? (
              <p className="muted">Ya están todas las medidas activas en esta evaluación.</p>
            ) : (
              <div className="measure-grid">
                {available.map((t) => (
                  <TextField
                    key={t.id}
                    label={`${t.nameEs} (${t.unit})`}
                    inputMode="decimal"
                    value={values[t.id] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.,]/g, '')
                      setValues((s) => ({ ...s, [t.id]: v }))
                    }}
                    error={errorFor(t.id)}
                  />
                ))}
              </div>
            )}
            {evaluation && <p className="field__hint">Para cambiar un valor ya registrado usa «Corregir» en la lista; así queda constancia del cambio.</p>}
          </fieldset>
        )}
        <TextAreaField
          label="Notas de la evaluación"
          hint="El cliente las verá en su progreso. Para observaciones privadas usa las notas de su ficha."
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          error={errors.notes}
        />
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            Guardar evaluación
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function CorrectModal({ clientId, measurement, onClose, onSaved }: { clientId: number; measurement: Measurement; onClose: () => void; onSaved: () => void }) {
  const invalidate = useInvalidateClient(clientId)
  const [value, setValue] = useState(String(measurement.value))
  const [notes, setNotes] = useState(measurement.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () => trackingApi.correctMeasurement(measurement.id, toNumber(value), notes.trim() || null),
    onSuccess: async () => {
      await invalidate()
      onSaved()
    },
    onError: (e) => setErrors(fieldErrors(e)),
  })
  return (
    <Modal title={`Corregir ${measurement.name}`} onClose={onClose}>
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setErrors({})
          save.mutate()
        }}
      >
        {save.error && Object.keys(errors).length === 0 && <Alert kind="error">{save.error.message}</Alert>}
        <TextField label={`Valor (${measurement.unit})`} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))} error={errors.value} />
        <TextField label="Nota" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} error={errors.notes} />
        <p className="field__hint">
          Valor actual: {fmt(measurement.value)} {measurement.unit}. El cambio queda registrado en la bitácora.
        </p>
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            Guardar corrección
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function PhotoModal({ clientId, evaluations, onClose, onSaved }: { clientId: number; evaluations: Evaluation[]; onClose: () => void; onSaved: () => void }) {
  const options = useQuery({ queryKey: trackingKeys.options, queryFn: trackingApi.options })
  const invalidate = useInvalidateClient(clientId)
  const [file, setFile] = useState<File | null>(null)
  const [takenOn, setTakenOn] = useState(todayInMexico())
  const [category, setCategory] = useState('')
  const [evaluationId, setEvaluationId] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Selecciona una foto.')
      return trackingApi.uploadPhoto(clientId, file, { takenOn, category, evaluationId, notes: notes.trim() })
    },
    onSuccess: async () => {
      await invalidate()
      onSaved()
    },
    onError: (e) => setErrors(fieldErrors(e)),
  })
  return (
    <Modal title="Subir foto de progreso" onClose={onClose}>
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setErrors({})
          save.mutate()
        }}
      >
        {save.error && Object.keys(errors).length === 0 && <Alert kind="error">{save.error.message}</Alert>}
        <TextField
          label="Foto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hint="JPG, PNG o WEBP, máximo 10 MB. Se guarda en almacenamiento privado."
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          error={errors.file}
        />
        <TextField label="Fecha de la foto" type="date" required max={todayInMexico()} value={takenOn} onChange={(e) => setTakenOn(e.target.value)} error={errors.takenOn} />
        <SelectField label="Categoría (opcional)" value={category} onChange={(e) => setCategory(e.target.value)} error={errors.category}>
          <option value="">Sin categoría</option>
          {options.data?.photoCategories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Evaluación (opcional)" value={evaluationId} onChange={(e) => setEvaluationId(e.target.value)} error={errors.evaluationId}>
          <option value="">Ninguna</option>
          {evaluations.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {formatDate(ev.evaluatedOn)}
            </option>
          ))}
        </SelectField>
        <TextField label="Nota (opcional)" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} error={errors.notes} />
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            Subir foto
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function SessionsCard({ clientId }: { clientId: number }) {
  const sessions = useQuery({ queryKey: trackingKeys.sessions(clientId), queryFn: () => trackingApi.sessions(clientId) })
  return (
    <section className="card" aria-labelledby="entrenamientos">
      <h2 className="card__title" id="entrenamientos">
        Entrenamientos registrados
      </h2>
      {sessions.isPending ? (
        <LoadingState />
      ) : sessions.error ? (
        <ErrorState message={sessions.error.message} onRetry={() => sessions.refetch()} />
      ) : sessions.data.length === 0 ? (
        <p className="muted">Aún no registra entrenamientos.</p>
      ) : (
        <ul className="list" aria-label="Entrenamientos registrados">
          {sessions.data.slice(0, 30).map((s) => (
            <li key={s.id} className="list-item">
              <div className="list-item__main">
                <span className="list-item__title">
                  <Link to={`/entrenadora/clientes/${clientId}/entrenamientos/${s.id}`}>{s.dayName}</Link>{' '}
                  <span className={`badge ${s.status === 'Completed' ? 'badge--success' : 'badge--pending'}`}>{s.status === 'Completed' ? 'Finalizado' : 'En curso'}</span>
                </span>
                <span className="list-item__meta">
                  {formatDateTime(s.startedAt)} · {s.exercisesCompleted} de {s.exercisesTotal} ejercicios · {s.setsCompleted} series
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ---------- Detalle de un entrenamiento (solo lectura) ---------- */
const unitLabel = (u: number | null) => (u === 2 ? 'lb' : 'kg')

export function TrainerSessionPage() {
  const params = useParams()
  const clientId = Number(params.id)
  const id = Number(params.sid)
  const session = useQuery({ queryKey: [...trackingKeys.sessions(clientId), id], queryFn: () => trackingApi.session(clientId, id) })
  if (session.isPending) return <LoadingState />
  if (session.error) return <ErrorState message={session.error.message} onRetry={() => session.refetch()} />
  const s = session.data
  return (
    <>
      <p className="breadcrumb">
        <Link to={`/entrenadora/clientes/${clientId}/seguimiento`}>← Seguimiento</Link>
      </p>
      <PageHeader
        title={s.dayName ?? 'Entrenamiento'}
        subtitle={`${s.routineTitle ?? ''}${s.versionNumber ? ` · versión ${s.versionNumber}` : ''} · ${s.status === 'Completed' ? `Finalizado ${formatDateTime(s.completedAt ?? s.startedAt)}` : `En curso desde ${formatDateTime(s.startedAt)}`}`}
      />
      <div className="stack tracking-narrow">
        {s.comment && <Alert kind="info">Comentario del cliente: {s.comment}</Alert>}
        {s.exercises.map((e) => (
          <section key={e.id} className="card" aria-label={e.nameEs}>
            <h2 className="card__title">
              {e.position}. {e.nameEs} {e.isCompleted ? <span className="badge badge--success">Completado</span> : <span className="badge badge--muted">Sin completar</span>}
            </h2>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Serie</th>
                    <th scope="col">Indicado</th>
                    <th scope="col">Hecho</th>
                  </tr>
                </thead>
                <tbody>
                  {e.sets.map((x) => (
                    <tr key={x.setNumber}>
                      <th scope="row">
                        {x.setNumber}
                        {x.isCompleted ? ' ✓' : ''}
                      </th>
                      <td>
                        {x.isPrescribed
                          ? [
                              x.prescribedRepsMin !== null && (x.prescribedRepsMax !== null && x.prescribedRepsMax !== x.prescribedRepsMin ? `${x.prescribedRepsMin}–${x.prescribedRepsMax} reps` : `${x.prescribedRepsMin} reps`),
                              x.prescribedWeight !== null && `${fmt(x.prescribedWeight)} ${x.prescribedWeightUnit ?? 'kg'}`,
                              x.setTypeLabel !== 'Efectiva' && x.setTypeLabel,
                            ]
                              .filter(Boolean)
                              .join(' · ') || '—'
                          : 'Serie extra'}
                      </td>
                      <td>{[x.reps !== null && `${x.reps} reps`, x.weight !== null && `${fmt(x.weight)} ${unitLabel(x.weightUnit)}`].filter(Boolean).join(' · ') || <span className="muted">Sin registrar</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {e.comment && <p className="muted">Comentario: {e.comment}</p>}
          </section>
        ))}
      </div>
    </>
  )
}

/* ---------- Cliente: Mi progreso ---------- */
export function PortalProgressPage() {
  const progress = useQuery({ queryKey: [...trackingKeys.portal, 'progress'], queryFn: portalTrackingApi.progress })
  const evaluations = useQuery({ queryKey: [...trackingKeys.portal, 'evaluations'], queryFn: portalTrackingApi.evaluations })
  const photos = useQuery({ queryKey: [...trackingKeys.portal, 'photos'], queryFn: portalTrackingApi.photos })
  const error = progress.error ?? evaluations.error ?? photos.error
  return (
    <>
      <PageHeader title="Mi progreso" subtitle="Tus medidas, evaluaciones, cargas y constancia, con las fechas de cada registro." />
      {progress.isPending || evaluations.isPending || photos.isPending ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => [progress, evaluations, photos].forEach((q) => q.refetch())} />
      ) : (
        <div className="tracking-narrow">
          <ProgressView progress={progress.data!} evaluations={evaluations.data!} photos={photos.data!} />
          {evaluations.data!.some((e) => e.notes) && (
            <section className="card" aria-labelledby="notas-evaluacion" style={{ marginTop: 'var(--lb-space-4)' }}>
              <h2 className="card__title" id="notas-evaluacion">
                Notas de tus evaluaciones
              </h2>
              <ul className="list">
                {evaluations.data!.filter((e) => e.notes).map((e) => (
                  <li key={e.id} className="list-item">
                    <div className="list-item__main">
                      <span className="list-item__title">{formatDate(e.evaluatedOn)}</span>
                      <span className="list-item__meta pre-line">{e.notes}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  )
}

/* ---------- Configuración: tipos de medida ---------- */
export function MeasurementTypesSection() {
  const qc = useQueryClient()
  const types = useQuery({ queryKey: trackingKeys.types, queryFn: trackingApi.types })
  const options = useQuery({ queryKey: trackingKeys.options, queryFn: trackingApi.options })
  const [editing, setEditing] = useState<MeasurementType | 'new' | null>(null)
  const [form, setForm] = useState({ nameEs: '', nameEn: '', kind: '2', unit: 'cm', isActive: true })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const kind = options.data?.kinds.find((k) => String(k.value) === form.kind)
  const open = (t: MeasurementType | 'new') => {
    setErrors({})
    setForm(t === 'new' ? { nameEs: '', nameEn: '', kind: '2', unit: 'cm', isActive: true } : { nameEs: t.nameEs, nameEn: t.nameEn === t.nameEs ? '' : t.nameEn, kind: String(t.kind), unit: t.unit, isActive: t.isActive })
    setEditing(t)
  }
  const save = useMutation({
    mutationFn: async () => {
      const data = { nameEs: form.nameEs, nameEn: form.nameEn.trim() || null, kind: Number(form.kind), unit: form.unit, isActive: form.isActive }
      if (editing === 'new') await trackingApi.createType(data)
      else await trackingApi.updateType((editing as MeasurementType).id, data)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: trackingKeys.types })
      setEditing(null)
    },
    onError: (e) => setErrors(fieldErrors(e)),
  })
  const locked = editing !== null && editing !== 'new' && editing.measurementCount > 0

  return (
    <section className="card" aria-labelledby="tipos-medida">
      <div className="card__head">
        <h2 className="card__title" id="tipos-medida">
          Tipos de medida
        </h2>
        <Button variant="secondary" onClick={() => open('new')}>
          Nuevo tipo
        </Button>
      </div>
      <p className="field__hint">Las medidas que registras en las evaluaciones. Desactivar un tipo lo oculta para registros nuevos y conserva su historial.</p>
      {types.isPending ? (
        <LoadingState />
      ) : types.error ? (
        <ErrorState message={types.error.message} onRetry={() => types.refetch()} />
      ) : (
        <ul className="list" aria-label="Tipos de medida">
          {types.data.map((t) => (
            <li key={t.id} className="list-item">
              <div className="list-item__main">
                <span className="list-item__title">
                  {t.nameEs} ({t.unit}) {!t.isActive && <span className="badge badge--muted">Inactivo</span>}
                </span>
                <span className="list-item__meta">
                  {t.kindLabel} · {t.measurementCount} {t.measurementCount === 1 ? 'registro' : 'registros'}
                </span>
              </div>
              <Button variant="ghost" onClick={() => open(t)} aria-label={`Editar ${t.nameEs}`}>
                Editar
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <Modal title={editing === 'new' ? 'Nuevo tipo de medida' : `Editar ${editing.nameEs}`} onClose={() => setEditing(null)}>
          <form
            className="stack"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              setErrors({})
              save.mutate()
            }}
          >
            {save.error && Object.keys(errors).length === 0 && <Alert kind="error">{save.error.message}</Alert>}
            <TextField label="Nombre" required maxLength={100} value={form.nameEs} onChange={(e) => setForm({ ...form, nameEs: e.target.value })} error={errors.nameEs} />
            <TextField label="Nombre en inglés (opcional)" maxLength={100} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} error={errors.nameEn} />
            <SelectField
              label="Tipo"
              value={form.kind}
              disabled={locked}
              onChange={(e) => {
                const k = options.data?.kinds.find((x) => String(x.value) === e.target.value)
                setForm({ ...form, kind: e.target.value, unit: k?.units.includes(form.unit) ? form.unit : (k?.units[0] ?? '') })
              }}
              error={errors.kind}
            >
              {options.data?.kinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Unidad"
              value={form.unit}
              disabled={locked}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              error={errors.unit}
              hint={locked ? 'Ya tiene registros: la unidad no cambia para no mezclar el historial. Crea un tipo nuevo si necesitas otra.' : undefined}
            >
              {kind?.units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </SelectField>
            <label className="check">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Activo
            </label>
            <div className="form__actions">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={save.isPending}>
                Cancelar
              </Button>
              <Button type="submit" loading={save.isPending}>
                Guardar
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

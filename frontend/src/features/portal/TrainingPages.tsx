import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  portalTrainingApi,
  type PortalExercise,
  type PortalMedia,
  type PortalProgram,
  type SessionDetail,
  type SessionSummary,
} from '../../api/portal'
import { Alert, Button, ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui'
import { PdfButton } from '../../components/PdfButton'
import { useSession } from '../../app/session'
import { fromPortalProgram } from '../../lib/routinePdf'
import { formatDate, formatDateTime, todayInMexico } from '../../lib/format'
import { summarize } from '../routines/routineModel'
import '../library/library.css'
import '../clients/clients.css'
import './training.css'
import { portalKeys, setTarget, toDraft, toSessionPayload, type SetDraft, type ExerciseDraft } from './portalModel'

/** Inicia (o retoma) un entrenamiento y abre la pantalla de registro. */
function useStartWorkout() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assignmentId, dayId }: { assignmentId: number; dayId: number }) => portalTrainingApi.start(assignmentId, dayId),
    onSuccess: async ({ id }) => {
      await qc.invalidateQueries({ queryKey: portalKeys.home })
      navigate(`/portal/entrenamiento/${id}`)
    },
  })
}

const progress = (s: SessionSummary) => `${s.exercisesCompleted} de ${s.exercisesTotal} ejercicios · ${s.setsCompleted} ${s.setsCompleted === 1 ? 'serie' : 'series'}`

/* ---------- Inicio ---------- */

/** Entrenamiento en curso, próximo entrenamiento, semana y último entrenamiento (datos reales). */
export function TrainingHomeCards() {
  const home = useQuery({ queryKey: portalKeys.home, queryFn: portalTrainingApi.home })
  const start = useStartWorkout()
  if (home.isPending) return <LoadingState />
  if (home.error) return <ErrorState message={home.error.message} onRetry={() => home.refetch()} />
  const { inProgress, next, week, last } = home.data
  const today = todayInMexico()

  return (
    <>
      {inProgress && (
        <section className="card in-progress" aria-labelledby="en-curso">
          <h2 className="card__title" id="en-curso">
            Entrenamiento en curso
          </h2>
          <p>
            <strong>{inProgress.dayName}</strong> · {inProgress.routineTitle}
          </p>
          <p className="muted">{progress(inProgress)}</p>
          <Link className="btn btn--primary btn--block" to={`/portal/entrenamiento/${inProgress.id}`}>
            Retomar entrenamiento
          </Link>
        </section>
      )}

      <section className="card" aria-labelledby="proximo">
        <h2 className="card__title" id="proximo">
          Próximo entrenamiento
        </h2>
        {start.error && <Alert kind="error">{start.error.message}</Alert>}
        {next.length === 0 ? (
          <p className="muted">Cuando tu entrenadora te asigne una rutina, aquí verás tu siguiente día.</p>
        ) : (
          <div className="stack">
            {next.map((n) => (
              <div key={n.assignmentId} className="next-workout">
                <p className="portal-program__name">{n.dayName}</p>
                <p className="muted">
                  {n.routineName}
                  {n.dayLabel ? ` · ${n.dayLabel}` : ''}
                </p>
                {!inProgress && (
                  <Button block loading={start.isPending} onClick={() => start.mutate({ assignmentId: n.assignmentId, dayId: n.routineDayId })}>
                    Empezar {n.dayName}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="semana">
        <h2 className="card__title" id="semana">
          Esta semana
        </h2>
        <ol className="week" aria-labelledby="semana">
          {week.map((d) => (
            <li key={d.date} className={`week__day${d.date === today ? ' week__day--today' : ''}`} aria-current={d.date === today ? 'date' : undefined}>
              <span className="week__label">{d.label.slice(0, 3)}</span>
              <span className="week__date">{Number(d.date.slice(8))}</span>
              {d.sessions.some((s) => s.status === 'Completed') ? (
                <span className="week__mark week__mark--done" title="Entrenado">
                  ✓<span className="sr-only"> entrenado</span>
                </span>
              ) : d.sessions.length > 0 ? (
                <span className="week__mark week__mark--progress" title="En curso">
                  •<span className="sr-only"> en curso</span>
                </span>
              ) : d.planned.length > 0 ? (
                <span className="week__mark" title={d.planned.join(', ')}>
                  ○<span className="sr-only"> {d.planned.join(', ')}</span>
                </span>
              ) : (
                <span className="week__mark week__mark--rest" aria-hidden="true">
                  ·
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="field__hint">○ día de rutina · ✓ entrenado. Los días de tu rutina aparecen si tu entrenadora les asignó día de la semana.</p>
      </section>

      <section className="card" aria-labelledby="ultimo">
        <h2 className="card__title" id="ultimo">
          Último entrenamiento
        </h2>
        {last ? (
          <>
            <p>
              <strong>{last.dayName}</strong> · {last.routineTitle}
            </p>
            <p className="muted">
              {formatDateTime(last.completedAt ?? last.startedAt)} · {progress(last)}
            </p>
            <Link to={`/portal/entrenamiento/${last.id}`}>Ver detalle</Link>
          </>
        ) : (
          <p className="muted">Aún no has registrado entrenamientos.</p>
        )}
      </section>
    </>
  )
}

/* ---------- Mi rutina ---------- */

function MediaList({ media }: { media: PortalMedia[] }) {
  if (media.length === 0) return null
  return (
    <div className="media-strip">
      {media.map((m) =>
        m.isExternal ? (
          <a key={m.id} className="btn btn--secondary" href={m.url} target="_blank" rel="noopener noreferrer">
            {m.type === 'Video' ? '▶ Ver video' : 'Ver imagen'}
            {m.title ? `: ${m.title}` : ''}
          </a>
        ) : m.type === 'Video' ? (
          <video key={m.id} className="media-strip__video" src={m.url} controls preload="none" aria-label={m.title ?? 'Video del ejercicio'} />
        ) : (
          <img key={m.id} className="media-strip__image" src={m.url} alt={m.title ?? 'Imagen del ejercicio'} loading="lazy" />
        ),
      )}
    </div>
  )
}

function ExerciseInfo({ e }: { e: PortalExercise }) {
  const [open, setOpen] = useState(false)
  const prescription = summarize({
    sets: e.sets,
    repsMin: e.repsMin,
    repsMax: e.repsMax,
    weight: e.suggestedWeight,
    unitLabel: e.weightUnit ?? undefined,
    rest: e.restSeconds,
    tempo: e.tempo,
    rir: e.rir,
    rpe: e.rpe,
  })
  const hasMore = !!(e.instructions || e.technicalTips || e.media.length)
  return (
    <li className={`program-ex${e.supersetGroup ? ' program-ex--superset' : ''}`}>
      <div className="program-ex__head">
        <span className="program-ex__pos">{e.position}</span>
        <div className="program-ex__main">
          <span className="program-ex__name">
            {e.nameEs}
            {e.supersetGroup && <span className="badge badge--superset">Superserie {e.supersetGroup}</span>}
            {e.setTypeLabel !== 'Efectiva' && e.setDetails.length === 0 && <span className="badge badge--pending">{e.setTypeLabel}</span>}
          </span>
          {e.setDetails.length === 0 ? (
            <span className="program-ex__rx">{prescription}</span>
          ) : (
            <ul className="program-ex__sets">
              {e.setDetails.map((s) => (
                <li key={s.setNumber}>
                  Serie {s.setNumber} · {s.setTypeLabel} ·{' '}
                  {setTarget({ repsMin: s.repsMin, repsMax: s.repsMax, weight: s.suggestedWeight, unit: s.weightUnit, rest: s.restSeconds, rir: s.rir, rpe: s.rpe }) || 'sin indicaciones'}
                </li>
              ))}
              {e.tempo && <li>Tempo {e.tempo}</li>}
            </ul>
          )}
          {e.notes && <span className="program-ex__notes">{e.notes}</span>}
        </div>
      </div>
      {hasMore && (
        <>
          <button type="button" className="link-button" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Ocultar técnica' : 'Cómo hacerlo'}
          </button>
          {open && (
            <div className="program-ex__more">
              {e.instructions && <p>{e.instructions}</p>}
              {e.technicalTips && <p className="muted">Consejo: {e.technicalTips}</p>}
              <MediaList media={e.media} />
            </div>
          )}
        </>
      )}
    </li>
  )
}

function ProgramView({ program, canStart }: { program: PortalProgram; canStart: boolean }) {
  const start = useStartWorkout()
  const { data: session } = useSession()
  const active = program.status === 'Active'
  return (
    <section className="card stack" aria-label={program.routineName}>
      <div>
        <h2 className="portal-program__name">
          {program.routineName} <span className={`badge ${active ? 'badge--success' : 'badge--pending'}`}>{program.statusLabel}</span>
        </h2>
        <p className="muted">
          {program.endDate ? `Del ${formatDate(program.startDate)} al ${formatDate(program.endDate)}` : `Desde el ${formatDate(program.startDate)}`}
          {program.goal ? ` · Objetivo: ${program.goal}` : ''}
        </p>
        {program.notes && <p className="portal-program__notes">{program.notes}</p>}
      </div>
      <PdfButton getData={() => fromPortalProgram(program, session?.displayName ?? null)} label={`Descargar en PDF: ${program.routineName}`}>
        Descargar en PDF
      </PdfButton>
      {start.error && <Alert kind="error">{start.error.message}</Alert>}
      {program.days.map((d) => (
        <details key={d.id} className="program-day" open={program.days.length <= 2}>
          <summary className="program-day__summary">
            <span>
              {d.name}
              {d.dayLabel && <span className="muted"> · {d.dayLabel}</span>}
            </span>
            <span className="muted">{d.exercises.length} {d.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
          </summary>
          {d.notes && <p className="muted">{d.notes}</p>}
          <ol className="program-ex-list">
            {d.exercises.map((e) => (
              <ExerciseInfo key={e.id} e={e} />
            ))}
          </ol>
          {active && canStart && (
            <Button block loading={start.isPending} onClick={() => start.mutate({ assignmentId: program.assignmentId, dayId: d.id })}>
              Empezar {d.name}
            </Button>
          )}
        </details>
      ))}
    </section>
  )
}

export function PortalRoutinePage() {
  const program = useQuery({ queryKey: portalKeys.program, queryFn: portalTrainingApi.program })
  const home = useQuery({ queryKey: portalKeys.home, queryFn: portalTrainingApi.home })
  const inProgress = home.data?.inProgress
  return (
    <>
      <PageHeader title="Mi rutina" subtitle="Los días y ejercicios en el orden que indicó tu entrenadora." />
      <div className="stack portal-narrow">
        {inProgress && (
          <Alert kind="info">
            Tienes un entrenamiento en curso («{inProgress.dayName}»). <Link to={`/portal/entrenamiento/${inProgress.id}`}>Retomarlo</Link>
          </Alert>
        )}
        {program.isPending ? (
          <LoadingState />
        ) : program.error ? (
          <ErrorState message={program.error.message} onRetry={() => program.refetch()} />
        ) : program.data.length === 0 ? (
          <div className="card">
            <EmptyState title="Aún no tienes una rutina asignada" description="Cuando tu entrenadora te asigne una, aparecerá aquí." />
          </div>
        ) : (
          program.data.map((p) => <ProgramView key={p.assignmentId} program={p} canStart={!inProgress} />)
        )}
      </div>
    </>
  )
}

/* ---------- Registro de la sesión ---------- */

function target(s: SetDraft) {
  if (!s.isPrescribed) return 'Serie extra'
  return (
    setTarget({ repsMin: s.prescribedRepsMin, repsMax: s.prescribedRepsMax, weight: s.prescribedWeight, unit: s.prescribedWeightUnit, rest: s.prescribedRestSeconds, rir: s.prescribedRir, rpe: s.prescribedRpe }) ||
    'Sin objetivo indicado'
  )
}

export function SessionPage() {
  const id = Number(useParams().id)
  const session = useQuery({ queryKey: portalKeys.session(id), queryFn: () => portalTrainingApi.session(id), gcTime: 0, refetchOnWindowFocus: false })
  if (session.isPending) return <LoadingState label="Abriendo entrenamiento…" />
  if (session.error) return <ErrorState message={session.error.message} onRetry={() => session.refetch()} />
  return <SessionLogger session={session.data} />
}

function SessionLogger({ session }: { session: SessionDetail }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const readOnly = session.status === 'Completed'
  const [draft, setDraft] = useState(() => toDraft(session))
  const [saveState, setSaveState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const [problem, setProblem] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const latest = useRef(draft)
  const timer = useRef<number | undefined>(undefined)
  const dirty = useRef(false)

  const persist = useCallback(async () => {
    window.clearTimeout(timer.current)
    if (!dirty.current) return true
    dirty.current = false
    setSaveState('saving')
    try {
      await portalTrainingApi.save(session.id, toSessionPayload(latest.current))
      setSaveState(dirty.current ? 'pending' : 'saved')
      setProblem(null)
      return true
    } catch (e) {
      dirty.current = true
      setSaveState('error')
      setProblem(e instanceof ApiError && Object.keys(e.fieldErrors).length ? 'Revisa los valores: hay un número fuera de rango.' : (e as Error).message)
      return false
    }
  }, [session.id])

  // Guardado automático: poco después de cada cambio y al salir de la pantalla o cambiar de app.
  const change = (fn: (d: typeof draft) => typeof draft) => {
    if (readOnly) return
    setDraft((d) => {
      const next = fn(d)
      latest.current = next
      return next
    })
    dirty.current = true
    setSaveState('pending')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void persist(), 1200)
  }
  useEffect(() => {
    const flush = () => document.visibilityState === 'hidden' && void persist()
    document.addEventListener('visibilitychange', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      void persist()
    }
  }, [persist])

  const setEx = (exId: number, fn: (e: ExerciseDraft) => ExerciseDraft) => change((d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === exId ? fn(e) : e)) }))
  const setSet = (exId: number, n: number, patch: Partial<SetDraft>) => setEx(exId, (e) => ({ ...e, sets: e.sets.map((s) => (s.setNumber === n ? { ...s, ...patch } : s)) }))

  const finish = useMutation({
    mutationFn: async () => {
      if (!(await persist())) throw new Error('No se pudo guardar el avance. Revisa los valores e inténtalo de nuevo.')
      await portalTrainingApi.finish(session.id)
    },
    onSuccess: async () => {
      setFinishing(false)
      await qc.invalidateQueries({ queryKey: ['portal'] })
      navigate('/portal', { replace: true })
    },
  })

  const total = draft.exercises.length
  const done = draft.exercises.filter((e) => e.isCompleted).length

  return (
    <>
      <p className="breadcrumb">
        <Link to={readOnly ? '/portal/entrenamientos' : '/portal'}>← {readOnly ? 'Mis entrenamientos' : 'Inicio'}</Link>
      </p>
      <PageHeader
        title={session.dayName ?? 'Entrenamiento'}
        subtitle={`${session.routineTitle ?? ''}${session.versionNumber ? ` · versión ${session.versionNumber}` : ''} · ${readOnly ? `Finalizado ${formatDateTime(session.completedAt ?? session.startedAt)}` : `Iniciado ${formatDateTime(session.startedAt)}`}`}
      />
      <div className="stack portal-narrow session">
        {readOnly && <Alert kind="info">Entrenamiento finalizado. Queda guardado tal como lo registraste.</Alert>}
        {problem && <Alert kind="error">{problem}</Alert>}

        {draft.exercises.map((e) => (
          <section key={e.id} className={`card log-ex${e.isCompleted ? ' log-ex--done' : ''}`} aria-label={e.nameEs}>
            <div className="log-ex__head">
              <span className="program-ex__pos">{e.position}</span>
              <div>
                <h2 className="log-ex__name">
                  {e.nameEs}
                  {e.supersetGroup && <span className="badge badge--superset">Superserie {e.supersetGroup}</span>}
                </h2>
                <p className="muted log-ex__rx">
                  {summarize({ sets: e.prescribedSets ?? '', repsMin: e.prescribedRepsMin, repsMax: e.prescribedRepsMax, weight: e.prescribedWeight, unitLabel: e.prescribedWeightUnit ?? undefined, rest: e.prescribedRestSeconds, tempo: e.prescribedTempo, rir: e.prescribedRir, rpe: e.prescribedRpe })}
                </p>
                {e.prescribedNotes && <p className="program-ex__notes">{e.prescribedNotes}</p>}
              </div>
            </div>
            {e.media.length > 0 && (
              <details className="log-ex__media">
                <summary>Ver técnica</summary>
                <MediaList media={e.media} />
              </details>
            )}

            <ol className="log-sets" aria-label={`Series de ${e.nameEs}`}>
              {e.sets.map((s) => (
                <li key={s.setNumber} className={`log-set${s.isCompleted ? ' log-set--done' : ''}`}>
                  <div className="log-set__info">
                    <span className="log-set__title">
                      Serie {s.setNumber}
                      {s.setTypeLabel !== 'Efectiva' && s.isPrescribed && <span className="badge badge--pending">{s.setTypeLabel}</span>}
                    </span>
                    <span className="log-set__target">Objetivo: {target(s)}</span>
                  </div>
                  <label className="log-set__field">
                    <span>Reps</span>
                    <input
                      className="input log-input"
                      inputMode="numeric"
                      aria-label={`Repeticiones de la serie ${s.setNumber} de ${e.nameEs}`}
                      placeholder={s.prescribedRepsMax !== null ? String(s.prescribedRepsMax) : '—'}
                      value={s.reps}
                      disabled={readOnly}
                      onChange={(ev) => setSet(e.id, s.setNumber, { reps: ev.target.value.replace(/[^\d]/g, '') })}
                    />
                  </label>
                  <label className="log-set__field">
                    <span>Peso</span>
                    <span className="log-weight">
                      <input
                        className="input log-input"
                        inputMode="decimal"
                        aria-label={`Peso de la serie ${s.setNumber} de ${e.nameEs}`}
                        placeholder={s.prescribedWeight !== null ? String(s.prescribedWeight) : '—'}
                        value={s.weight}
                        disabled={readOnly}
                        onChange={(ev) => setSet(e.id, s.setNumber, { weight: ev.target.value.replace(/[^\d.,]/g, '') })}
                      />
                      <button
                        type="button"
                        className="unit-toggle"
                        disabled={readOnly}
                        aria-label={`Unidad de la serie ${s.setNumber} de ${e.nameEs}: ${s.unit === 2 ? 'lb' : 'kg'}. Toca para cambiar.`}
                        onClick={() => setSet(e.id, s.setNumber, { unit: s.unit === 2 ? 1 : 2 })}
                      >
                        {s.unit === 2 ? 'lb' : 'kg'}
                      </button>
                    </span>
                  </label>
                  <button
                    type="button"
                    className={`set-check${s.isCompleted ? ' set-check--on' : ''}`}
                    aria-pressed={s.isCompleted}
                    aria-label={`Serie ${s.setNumber} de ${e.nameEs} hecha`}
                    disabled={readOnly}
                    onClick={() => setSet(e.id, s.setNumber, { isCompleted: !s.isCompleted })}
                  >
                    ✓
                  </button>
                  {!s.isPrescribed && !readOnly && (
                    <button type="button" className="link-button log-set__remove" onClick={() => setEx(e.id, (x) => ({ ...x, sets: x.sets.filter((y) => y.setNumber !== s.setNumber) }))}>
                      Quitar serie extra
                    </button>
                  )}
                </li>
              ))}
            </ol>

            {!readOnly && (
              <Button
                variant="ghost"
                onClick={() =>
                  setEx(e.id, (x) => {
                    const n = Math.max(0, ...x.sets.map((y) => y.setNumber)) + 1
                    const unit = x.sets.at(-1)?.unit ?? 1
                    const extra: SetDraft = {
                      setNumber: n, setTypeLabel: 'Efectiva', isPrescribed: false, prescribedRepsMin: null, prescribedRepsMax: null, prescribedWeight: null,
                      prescribedWeightUnit: null, prescribedRestSeconds: null, prescribedRir: null, prescribedRpe: null, prescribedNotes: null,
                      reps: '', weight: '', weightUnit: null, rir: '', rpe: '', unit, isCompleted: false, notes: null,
                    }
                    return { ...x, sets: [...x.sets, extra] }
                  })
                }
              >
                + Serie extra
              </Button>
            )}
            <label className="check log-ex__complete">
              <input type="checkbox" checked={e.isCompleted} disabled={readOnly} onChange={(ev) => setEx(e.id, (x) => ({ ...x, isCompleted: ev.target.checked }))} />
              Ejercicio completado
            </label>
            {(!readOnly || e.comment) && (
              <label className="log-ex__comment">
                <span className="field__label">Comentario del ejercicio</span>
                <textarea
                  className="input input--area"
                  rows={2}
                  maxLength={1000}
                  value={e.comment}
                  disabled={readOnly}
                  onChange={(ev) => {
                    const v = ev.target.value
                    setEx(e.id, (x) => ({ ...x, comment: v }))
                  }}
                />
              </label>
            )}
          </section>
        ))}

        <section className="card stack">
          <label>
            <span className="field__label">Comentario del entrenamiento</span>
            <textarea
              className="input input--area"
              rows={3}
              maxLength={2000}
              value={draft.comment}
              disabled={readOnly}
              placeholder="¿Cómo te sentiste? ¿Alguna molestia?"
              onChange={(ev) => {
                const v = ev.target.value
                change((d) => ({ ...d, comment: v }))
              }}
            />
          </label>
        </section>
      </div>

      {!readOnly && (
        <div className="session-bar" role="region" aria-label="Acciones del entrenamiento">
          <span className="muted session-bar__status" aria-live="polite">
            {done} de {total} ejercicios ·{' '}
            {saveState === 'saving' ? 'Guardando…' : saveState === 'pending' ? 'Cambios por guardar' : saveState === 'error' ? 'Sin guardar' : saveState === 'saved' ? 'Guardado' : 'Al día'}
          </span>
          <div className="session-bar__actions">
            <Button variant="secondary" onClick={() => void persist()} disabled={saveState === 'saving'}>
              Guardar
            </Button>
            <Button onClick={() => setFinishing(true)}>Finalizar</Button>
          </div>
        </div>
      )}

      {finishing && (
        <ConfirmDialog
          title="Finalizar entrenamiento"
          message={
            <>
              {done < total
                ? `Llevas ${done} de ${total} ejercicios completados. Puedes finalizar así; lo que registraste queda guardado.`
                : '¡Completaste todos los ejercicios!'}{' '}
              Después de finalizar ya no se puede editar.
              {finish.error && <Alert kind="error">{finish.error.message}</Alert>}
            </>
          }
          confirmLabel="Finalizar"
          loading={finish.isPending}
          onConfirm={() => finish.mutate()}
          onCancel={() => {
            finish.reset()
            setFinishing(false)
          }}
        />
      )}
    </>
  )
}

/* ---------- Historial ---------- */
export function PortalSessionsPage() {
  const sessions = useQuery({ queryKey: portalKeys.sessions, queryFn: portalTrainingApi.sessions })
  return (
    <>
      <PageHeader title="Mis entrenamientos" subtitle="Lo que has registrado, del más reciente al más antiguo." />
      <div className="stack portal-narrow">
        {sessions.isPending ? (
          <LoadingState />
        ) : sessions.error ? (
          <ErrorState message={sessions.error.message} onRetry={() => sessions.refetch()} />
        ) : sessions.data.length === 0 ? (
          <div className="card">
            <EmptyState title="Aún no tienes entrenamientos" description="Empieza uno desde el inicio o desde Mi rutina." />
          </div>
        ) : (
          <ul className="list" aria-label="Entrenamientos">
            {sessions.data.map((s) => (
              <li key={s.id} className="list-item">
                <div className="list-item__main">
                  <span className="list-item__title">
                    <Link to={`/portal/entrenamiento/${s.id}`}>{s.dayName}</Link>{' '}
                    <span className={`badge ${s.status === 'Completed' ? 'badge--success' : 'badge--pending'}`}>{s.status === 'Completed' ? 'Finalizado' : 'En curso'}</span>
                  </span>
                  <span className="list-item__meta">
                    {s.routineTitle} · {formatDateTime(s.startedAt)}
                  </span>
                  <span className="list-item__meta">{progress(s)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

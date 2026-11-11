import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { ArrowDown, ArrowUp, Copy, Eye, Save, Trash2 } from 'lucide-react'
import { useFocusMode } from '../../layouts/focusMode'
import { routinesApi, type RoutineOptions } from '../../api/routines'
import { clientsApi } from '../../api/clients'
import { clientKeys } from '../clients/clientModel'
import {
  BackLink,
  Alert,
  Button,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  MoreMenu,
  SelectField,
  TextAreaField,
  TextField,
} from '../../components/ui'
import { useCatalogs, useExercises } from '../library/libraryQueries'
import { RoutinePreview } from './RoutinePreview'
import { WeeklyVolume } from './WeeklyVolume'
import { mainMuscleFromBuilderDay, volumeFromBuilder } from '../../lib/weeklyVolume'
import { DayMainMuscle } from './DayMainMuscle'
import {
  cloneDay,
  cloneExercise,
  emptyExercise,
  emptySet,
  newKey,
  previewFromState,
  stateFromVersion,
  summarize,
  toPayload,
  validate,
  type BuilderState,
  type DayRow,
  type ExerciseRow,
  type FieldErrors,
  type SetRow,
} from './routineModel'
import { routineKeys, useRoutineOptions, type Section } from './routineQueries'
import '../library/library.css'
import './routines.css'

/** Constructor manual: abre (o crea) el borrador de la rutina y lo carga para editar. */
export function RoutineBuilderPage({ section }: { section: Section }) {
  const id = Number(useParams().id)
  const options = useRoutineOptions()
  const draft = useQuery({
    // Clave fuera de 'routines': abrir el borrador crea una versión nueva si no hay, así que nunca debe
    // volver a pedirse sola al refrescar las listas (por ejemplo, justo después de publicar).
    queryKey: ['routine-builder', id],
    queryFn: async () => {
      const { id: draftId } = await routinesApi.openDraft(id)
      const [version, detail] = await Promise.all([routinesApi.version(id, draftId), routinesApi.get(id)])
      return { version, detail }
    },
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })

  if (draft.isPending || options.isPending) return <LoadingState label="Abriendo el constructor…" />
  if (draft.error || options.error)
    return (
      <>
        <BackLink to={`/entrenadora/${section}/${id}`} label="Volver" />
        <ErrorState message={(draft.error ?? options.error)!.message} onRetry={() => draft.refetch()} />
      </>
    )
  return (
    <Builder
      key={draft.data!.version.id}
      routineId={id}
      section={section}
      options={options.data!}
      initial={stateFromVersion(draft.data!.version)}
      versionNumber={draft.data!.version.versionNumber}
      hasPublished={draft.data!.detail.latestPublishedVersionId !== null}
    />
  )
}

type DragItem = { type: 'exercise'; dayKey: string; exKey: string } | { type: 'day'; dayKey: string }

function move<T>(list: T[], from: number, to: number) {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function Builder({
  routineId,
  section,
  options,
  initial,
  versionNumber,
  hasPublished,
}: {
  routineId: number
  section: Section
  options: RoutineOptions
  initial: BuilderState
  versionNumber: number
  hasPublished: boolean
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  // Rutina personalizada creada desde la ficha de un cliente: al publicarla se ofrece asignársela.
  const forClient = Number(useSearchParams()[0].get('cliente')) || null
  const client = useQuery({ queryKey: clientKeys.profile(forClient ?? 0), queryFn: () => clientsApi.profile(forClient!), enabled: forClient !== null })
  const [state, setState] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string[] | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [picker, setPicker] = useState<string | null>(null)
  const [removing, setRemoving] = useState<DayRow | null>(null)
  const [preview, setPreview] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const drag = useRef<DragItem | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const labels = useMemo(
    () => ({
      setTypes: new Map(options.setTypes.map((o) => [o.value, o.label])),
      days: new Map(options.daysOfWeek.map((o) => [o.value, o.label])),
      units: new Map(options.weightUnits.map((o) => [o.value, o.label])),
    }),
    [options],
  )

  // Avisar antes de salir con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useFocusMode()
  // Guardado automático del borrador: unos segundos después del último cambio, si no hay campos por corregir.
  const edits = useRef(0)
  const saving = useRef(false)
  const [autoState, setAutoState] = useState<'idle' | 'saving' | 'error' | 'invalid'>('idle')
  const [retryTick, setRetryTick] = useState(0)

  /** Cambio de contenido. Los cambios de estructura (orden, altas, bajas) limpian los avisos por posición. */
  const update = (fn: (s: BuilderState) => BuilderState, structural = false) => {
    setState(fn)
    edits.current += 1
    setDirty(true)
    setNotice(null)
    if (structural) setErrors({})
  }
  const clearError = (path: string) =>
    setErrors((e) => {
      if (!(path in e)) return e
      const next = { ...e }
      delete next[path]
      return next
    })

  const setDay = (dayKey: string, fn: (d: DayRow) => DayRow, structural = false) =>
    update((s) => ({ ...s, days: s.days.map((d) => (d.key === dayKey ? fn(d) : d)) }), structural)
  const setExercise = (dayKey: string, exKey: string, fn: (e: ExerciseRow) => ExerciseRow, structural = false) =>
    setDay(dayKey, (d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === exKey ? fn(e) : e)) }), structural)

  const toggle = (key: string, open?: boolean) =>
    setExpanded((s) => {
      const next = new Set(s)
      if (open ?? !next.has(key)) next.add(key)
      else next.delete(key)
      return next
    })

  /** Abre las tarjetas que tienen errores para que se vean. */
  const revealErrors = (errs: FieldErrors, from: BuilderState) => {
    const keys = new Set(expanded)
    for (const path of Object.keys(errs)) {
      const m = /^days\[(\d+)\]\.exercises\[(\d+)\]/.exec(path)
      if (m) {
        const ex = from.days[Number(m[1])]?.exercises[Number(m[2])]
        if (ex) keys.add(ex.key)
      }
    }
    setExpanded(keys)
  }

  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(async () => {
      if (saving.current) return
      if (Object.keys(validate(state)).length > 0) {
        setAutoState('invalid')
        return
      }
      const at = edits.current
      saving.current = true
      setAutoState('saving')
      try {
        await routinesApi.saveDraft(routineId, toPayload(state))
        if (edits.current === at) setDirty(false)
        setAutoState('idle')
        void qc.invalidateQueries({ queryKey: routineKeys.all })
      } catch {
        setAutoState('error')
      } finally {
        saving.current = false
        // Si hubo cambios mientras se guardaba, se vuelve a intentar con lo más nuevo.
        if (edits.current !== at) setRetryTick((n) => n + 1)
      }
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [state, dirty, retryTick, routineId, qc])

  const save = useMutation({
    mutationFn: () => routinesApi.saveDraft(routineId, toPayload(state)),
    onSuccess: async () => {
      setDirty(false)
      setAutoState('idle')
      setProblem(null)
      setNotice('Borrador guardado.')
      await qc.invalidateQueries({ queryKey: routineKeys.all })
    },
    onError: (e) => handleServerErrors(e),
  })

  const publish = useMutation({
    mutationFn: async (changeNotes: string) => {
      await routinesApi.saveDraft(routineId, toPayload(state))
      setDirty(false)
      return routinesApi.publish(routineId, state.draftVersionId, changeNotes.trim() || null)
    },
    onSuccess: async () => {
      setPublishing(false)
      await qc.invalidateQueries({ queryKey: routineKeys.all })
      navigate(`/entrenadora/${section}/${routineId}${forClient ? `?asignar=${forClient}` : ''}`)
    },
    onError: (e) => {
      setPublishing(false)
      handleServerErrors(e)
    },
  })

  const discard = useMutation({
    mutationFn: () => routinesApi.discardDraft(routineId),
    onSuccess: async () => {
      setDirty(false)
      await qc.invalidateQueries({ queryKey: routineKeys.all })
      navigate(`/entrenadora/${section}/${routineId}`)
    },
  })

  function handleServerErrors(e: Error) {
    if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
      const errs = Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v[0]]))
      setErrors(errs)
      revealErrors(errs, state)
      // Mensajes que no corresponden a un campo visible (por ejemplo "el día no tiene ejercicios").
      setProblem(Object.entries(errs).filter(([k]) => k === '' || k === 'days' || k.endsWith('.exercises') || k.endsWith('.exerciseId')).map(([, v]) => v))
    } else setProblem([e.message])
  }

  const trySave = () => {
    const errs = validate(state)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      revealErrors(errs, state)
      setProblem([`Revisa ${Object.keys(errs).length === 1 ? 'el campo marcado' : `los ${Object.keys(errs).length} campos marcados`}.`])
      return false
    }
    setProblem(null)
    return true
  }

  /* ----- Arrastrar y soltar ----- */
  const onDragStart = (item: DragItem) => (e: DragEvent) => {
    drag.current = item
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.type)
  }
  const onDragEnd = () => {
    drag.current = null
    setDropTarget(null)
  }
  const allowDrop = (target: string, accepts: DragItem['type']) => (e: DragEvent) => {
    if (drag.current?.type !== accepts) return
    e.preventDefault()
    e.stopPropagation()
    if (dropTarget !== target) setDropTarget(target)
  }
  /** Suelta un ejercicio antes de otro (o al final del día si beforeKey es null). */
  const dropExercise = (dayKey: string, beforeKey: string | null) => (e: DragEvent) => {
    const item = drag.current
    if (item?.type !== 'exercise') return
    e.preventDefault()
    e.stopPropagation()
    moveExercise(item.dayKey, item.exKey, dayKey, beforeKey)
    onDragEnd()
  }
  const dropDay = (beforeKey: string) => (e: DragEvent) => {
    const item = drag.current
    if (item?.type !== 'day') return
    e.preventDefault()
    update((s) => {
      const from = s.days.findIndex((d) => d.key === item.dayKey)
      let to = s.days.findIndex((d) => d.key === beforeKey)
      if (from < to) to -= 1
      return { ...s, days: move(s.days, from, to) }
    }, true)
    onDragEnd()
  }

  function moveExercise(fromDay: string, exKey: string, toDay: string, beforeKey: string | null) {
    update((s) => {
      const source = s.days.find((d) => d.key === fromDay)!
      const ex = source.exercises.find((x) => x.key === exKey)!
      const days = s.days.map((d) => (d.key === fromDay ? { ...d, exercises: d.exercises.filter((x) => x.key !== exKey) } : d))
      return {
        ...s,
        days: days.map((d) => {
          if (d.key !== toDay) return d
          const list = [...d.exercises]
          const index = beforeKey ? list.findIndex((x) => x.key === beforeKey) : -1
          list.splice(index < 0 ? list.length : index, 0, ex)
          return { ...d, exercises: list }
        }),
      }
    }, true)
  }

  const shift = (dayKey: string, exKey: string, delta: number) =>
    setDay(
      dayKey,
      (d) => {
        const i = d.exercises.findIndex((x) => x.key === exKey)
        const j = i + delta
        return j < 0 || j >= d.exercises.length ? d : { ...d, exercises: move(d.exercises, i, j) }
      },
      true,
    )
  const shiftDay = (dayKey: string, delta: number) =>
    update((s) => {
      const i = s.days.findIndex((d) => d.key === dayKey)
      const j = i + delta
      return j < 0 || j >= s.days.length ? s : { ...s, days: move(s.days, i, j) }
    }, true)

  const addDay = () =>
    update((s) => ({ ...s, days: [...s.days, { key: newKey(), name: `Día ${s.days.length + 1}`, dayOfWeek: '', notes: '', exercises: [] }] }), true)
  const duplicateDay = (day: DayRow) =>
    update((s) => {
      const i = s.days.findIndex((d) => d.key === day.key)
      const days = [...s.days]
      days.splice(i + 1, 0, cloneDay(day, `${day.name} (copia)`))
      return { ...s, days }
    }, true)
  const removeDay = (dayKey: string) => update((s) => ({ ...s, days: s.days.filter((d) => d.key !== dayKey) }), true)

  const err = (path: string) => errors[path]
  const totalExercises = state.days.reduce((n, d) => n + d.exercises.length, 0)

  return (
    <>
      <BackLink to={`/entrenadora/${section}/${routineId}`} label="Ficha de la rutina" />
      <PageHeader
        title={state.title || 'Sin nombre'}
        subtitle={`Borrador · versión ${versionNumber}. Tú eliges cada ejercicio, el orden y todos los parámetros.`}
      />

      <div className="stack builder">
        {forClient && client.data && (
          <Alert kind="info">
            Rutina personalizada para {client.data.firstName} {client.data.lastName}. Al publicarla te pido confirmar las fechas para asignársela.
          </Alert>
        )}
        {notice && <Alert kind="success">{notice}</Alert>}
        {problem && problem.length > 0 && (
          <Alert kind="error">
            <div>
              {problem.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </Alert>
        )}

        <WeeklyVolume rows={volumeFromBuilder(state)} />

        <section className="card stack" aria-labelledby="general-title">
          <h2 className="card__title" id="general-title">
            Datos generales
          </h2>
          <div className="form-grid">
            <TextField
              label="Nombre"
              required
              maxLength={150}
              value={state.title}
              error={err('title')}
              onChange={(e) => {
                const v = e.target.value
                update((s) => ({ ...s, title: v }))
                clearError('title')
              }}
            />
            <TextField label="Objetivo" maxLength={500} value={state.goal} onChange={(e) => { const v = e.target.value; update((s) => ({ ...s, goal: v })) }} />
            <TextField
              label="Duración (semanas)"
              inputMode="numeric"
              value={state.durationWeeks}
              error={err('durationWeeks')}
              onChange={(e) => {
                const v = e.target.value
                update((s) => ({ ...s, durationWeeks: v }))
                clearError('durationWeeks')
              }}
            />
          </div>
          <TextAreaField label="Descripción" maxLength={2000} rows={2} value={state.description} onChange={(e) => { const v = e.target.value; update((s) => ({ ...s, description: v })) }} />
        </section>

        {state.days.length === 0 && (
          <div className="card">
            <p className="muted">Agrega el primer día de entrenamiento para empezar.</p>
          </div>
        )}

        {state.days.map((day, di) => (
          <section
            key={day.key}
            className={`card day${dropTarget === `day:${day.key}` ? ' day--drop' : ''}`}
            aria-label={`Día ${di + 1}: ${day.name}`}
            onDragOver={allowDrop(`day:${day.key}`, 'day')}
            onDrop={dropDay(day.key)}
          >
            <div className="day__top">
              <DayMainMuscle main={mainMuscleFromBuilderDay(day)} />
              <MoreMenu
                className="day__menu"
                label={`Acciones de ${day.name || `día ${di + 1}`}`}
                items={[
                  di > 0 && { label: 'Subir día', icon: ArrowUp, onSelect: () => shiftDay(day.key, -1) },
                  di < state.days.length - 1 && { label: 'Bajar día', icon: ArrowDown, onSelect: () => shiftDay(day.key, 1) },
                  { label: 'Duplicar día', icon: Copy, onSelect: () => duplicateDay(day) },
                  { label: 'Quitar día', icon: Trash2, danger: true, onSelect: () => (day.exercises.length ? setRemoving(day) : removeDay(day.key)) },
                ]}
              />
            </div>
            <div className="day__head">
              <span
                className="handle"
                draggable
                onDragStart={onDragStart({ type: 'day', dayKey: day.key })}
                onDragEnd={onDragEnd}
                title="Arrastra para mover el día"
                aria-hidden="true"
              >
                ⠿
              </span>
              <div className="day__fields">
                <TextField
                  label={`Nombre del día ${di + 1}`}
                  required
                  maxLength={100}
                  value={day.name}
                  error={err(`days[${di}].name`)}
                  onChange={(e) => {
                    const v = e.target.value
                    setDay(day.key, (d) => ({ ...d, name: v }))
                    clearError(`days[${di}].name`)
                  }}
                />
                <SelectField label="Día de la semana" value={day.dayOfWeek} onChange={(e) => { const v = e.target.value; setDay(day.key, (d) => ({ ...d, dayOfWeek: v })) }}>
                  <option value="">Sin día fijo</option>
                  {options.daysOfWeek.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
            <TextField label="Notas del día" maxLength={1000} value={day.notes} onChange={(e) => { const v = e.target.value; setDay(day.key, (d) => ({ ...d, notes: v })) }} />
            {err(`days[${di}].exercises`) && <Alert kind="error">{err(`days[${di}].exercises`)}</Alert>}

            <ol className="ex-list" aria-label={`Ejercicios de ${day.name}`}>
              {day.exercises.map((ex, xi) => (
                <ExerciseCard
                  key={ex.key}
                  ex={ex}
                  index={xi}
                  path={`days[${di}].exercises[${xi}]`}
                  count={day.exercises.length}
                  open={expanded.has(ex.key)}
                  options={options}
                  errors={errors}
                  supersetSiblings={ex.supersetGroup.trim() ? day.exercises.filter((x) => x.supersetGroup.trim().toUpperCase() === ex.supersetGroup.trim().toUpperCase()).length : 0}
                  dropping={dropTarget === `ex:${ex.key}`}
                  onToggle={() => toggle(ex.key)}
                  onChange={(fn, path) => {
                    setExercise(day.key, ex.key, fn)
                    if (path) clearError(path)
                  }}
                  onStructure={(fn) => setExercise(day.key, ex.key, fn, true)}
                  onMove={(delta) => shift(day.key, ex.key, delta)}
                  onDuplicate={() =>
                    setDay(
                      day.key,
                      (d) => {
                        const list = [...d.exercises]
                        list.splice(xi + 1, 0, cloneExercise(ex))
                        return { ...d, exercises: list }
                      },
                      true,
                    )
                  }
                  onRemove={() => setDay(day.key, (d) => ({ ...d, exercises: d.exercises.filter((x) => x.key !== ex.key) }), true)}
                  dragProps={{
                    draggable: true,
                    onDragStart: onDragStart({ type: 'exercise', dayKey: day.key, exKey: ex.key }),
                    onDragEnd,
                  }}
                  dropProps={{ onDragOver: allowDrop(`ex:${ex.key}`, 'exercise'), onDrop: dropExercise(day.key, ex.key) }}
                />
              ))}
            </ol>
            <div
              className={`ex-drop${dropTarget === `end:${day.key}` ? ' ex-drop--on' : ''}`}
              onDragOver={allowDrop(`end:${day.key}`, 'exercise')}
              onDrop={dropExercise(day.key, null)}
            >
              <Button variant="secondary" onClick={() => setPicker(day.key)}>
                + Agregar ejercicio
              </Button>
              <span className="field__hint">Arrastra ejercicios para ordenarlos o pasarlos a otro día; en el celular usa ↑ ↓.</span>
            </div>
          </section>
        ))}

        <Button variant="secondary" onClick={addDay} disabled={state.days.length >= 14}>
          + Agregar día
        </Button>
      </div>

      <div className="builder-bar" role="region" aria-label="Acciones del borrador">
        <span className="muted builder-bar__status" aria-live="polite">
          <strong className={`builder-bar__save${autoState === 'invalid' || autoState === 'error' ? ' builder-bar__save--warn' : ''}`}>
            {save.isPending || autoState === 'saving'
              ? 'Guardando…'
              : !dirty
                ? '✓ Borrador guardado'
                : autoState === 'invalid'
                  ? 'Hay campos por revisar'
                  : autoState === 'error'
                    ? 'No se pudo guardar'
                    : 'Guardando en un momento…'}
          </strong>{' '}
          · {state.days.length} {state.days.length === 1 ? 'día' : 'días'} · {totalExercises} {totalExercises === 1 ? 'ejercicio' : 'ejercicios'}
        </span>
        <div className="head-actions builder-bar__actions">
          <MoreMenu
            className="more-menu--up"
            label="Más acciones del borrador"
            items={[
              { label: 'Vista previa', icon: Eye, onSelect: () => setPreview(true) },
              dirty && { label: 'Guardar ahora', icon: Save, onSelect: () => trySave() && save.mutate() },
              hasPublished && { label: 'Descartar borrador', icon: Trash2, danger: true, onSelect: () => setDiscarding(true) },
            ]}
          />
          <Button onClick={() => trySave() && setPublishing(true)}>Publicar</Button>
        </div>
      </div>

      {picker && (
        <ExercisePicker
          dayName={state.days.find((d) => d.key === picker)?.name ?? ''}
          onClose={() => setPicker(null)}
          onAdd={(ex) => {
            const row = emptyExercise(ex)
            setDay(picker, (d) => ({ ...d, exercises: [...d.exercises, row] }), true)
            toggle(row.key, true)
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Quitar día"
          message={`Se quitará «${removing.name}» con sus ${removing.exercises.length} ejercicios de este borrador. Las versiones publicadas no cambian.`}
          confirmLabel="Quitar día"
          danger
          onConfirm={() => {
            removeDay(removing.key)
            setRemoving(null)
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
      {preview && (
        <Modal title="Vista previa" wide onClose={() => setPreview(false)}>
          <div className="preview-modal">
            <RoutinePreview version={previewFromState(state, labels)} />
          </div>
          <div className="form__actions">
            <Button onClick={() => setPreview(false)}>Cerrar</Button>
          </div>
        </Modal>
      )}
      {publishing && <PublishDialog versionNumber={versionNumber} loading={publish.isPending} onCancel={() => setPublishing(false)} onConfirm={(notes) => publish.mutate(notes)} />}
      {discarding && (
        <ConfirmDialog
          title="Descartar borrador"
          message="Se perderán los cambios de este borrador. Las versiones publicadas se conservan tal cual."
          confirmLabel="Descartar"
          danger
          loading={discard.isPending}
          onConfirm={() => discard.mutate()}
          onCancel={() => setDiscarding(false)}
        />
      )}
    </>
  )
}

function PublishDialog({ versionNumber, loading, onCancel, onConfirm }: { versionNumber: number; loading: boolean; onCancel: () => void; onConfirm: (notes: string) => void }) {
  const [notes, setNotes] = useState('')
  return (
    <Modal title={`Publicar versión ${versionNumber}`} onClose={onCancel}>
      <div className="form">
        <p className="muted">
          La versión publicada queda fija: ya no se modifica. Si después cambias algo, se crea la versión {versionNumber + 1} y esta se conserva.
          La asignación a clientes se hace en el módulo de clientes (Fase 7).
        </p>
        <TextAreaField label="Notas del cambio" hint="Opcional. Ejemplo: más volumen en el día 2" maxLength={1000} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="form__actions">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(notes)} loading={loading}>
            Publicar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Tarjeta de ejercicio ---------- */
type DragProps = { draggable: boolean; onDragStart: (e: DragEvent) => void; onDragEnd: () => void }
type DropProps = { onDragOver: (e: DragEvent) => void; onDrop: (e: DragEvent) => void }

function ExerciseCard({
  ex,
  index,
  path,
  count,
  open,
  options,
  errors,
  supersetSiblings,
  dropping,
  onToggle,
  onChange,
  onStructure,
  onMove,
  onDuplicate,
  onRemove,
  dragProps,
  dropProps,
}: {
  ex: ExerciseRow
  index: number
  path: string
  count: number
  open: boolean
  options: RoutineOptions
  errors: FieldErrors
  supersetSiblings: number
  dropping: boolean
  onToggle: () => void
  onChange: (fn: (e: ExerciseRow) => ExerciseRow, path?: string) => void
  onStructure: (fn: (e: ExerciseRow) => ExerciseRow) => void
  onMove: (delta: number) => void
  onDuplicate: () => void
  onRemove: () => void
  dragProps: DragProps
  dropProps: DropProps
}) {
  const hasErrors = Object.keys(errors).some((k) => k.startsWith(path))
  const summary = ex.details
    ? `${ex.details.length} series detalladas`
    : summarize({ sets: ex.sets, repsMin: ex.repsMin, repsMax: ex.repsMax, weight: ex.weight, unitLabel: ex.unit === '2' ? 'lb' : 'kg', rest: ex.rest, tempo: ex.tempo, rir: ex.rir, rpe: ex.rpe })
  const field = (name: keyof ExerciseRow, apiName: string) => ({
    value: String(ex[name] ?? ''),
    error: errors[`${path}.${apiName}`],
    onChange: (e: { target: { value: string } }) => {
      const v = e.target.value
      onChange((x) => ({ ...x, [name]: v }), `${path}.${apiName}`)
    },
  })
  const superset = ex.supersetGroup.trim().toUpperCase()

  return (
    <li className={`ex-card${superset ? ' ex-card--superset' : ''}${dropping ? ' ex-card--drop' : ''}${hasErrors ? ' ex-card--error' : ''}`} {...dropProps}>
      <div className="ex-card__head">
        <span className="handle" {...dragProps} title="Arrastra para mover" aria-hidden="true">
          ⠿
        </span>
        <span className="ex-card__index">{index + 1}</span>
        <div className="ex-card__main">
          <span className="ex-card__name">
            {ex.nameEs}
            {superset && <span className="badge badge--lilac">Superserie {superset}</span>}
            {ex.setType !== '1' && !ex.details && <span className="badge badge--pending">{options.setTypes.find((o) => String(o.value) === ex.setType)?.label}</span>}
            {!ex.isActive && <span className="badge badge--danger">Desactivado en la biblioteca</span>}
          </span>
          <span className={`list-item__meta${summary ? '' : ' ex-card__missing'}`}>{summary || 'Faltan los parámetros'}</span>
          {superset && supersetSiblings < 2 && <span className="field__hint">Agrega otro ejercicio con la etiqueta {superset} para completar la superserie.</span>}
        </div>
        <div className="ex-card__actions">
          <Button variant="secondary" aria-expanded={open} onClick={onToggle}>
            {open ? 'Cerrar' : 'Parámetros'}
          </Button>
          <Button variant="ghost" aria-label={`Subir ${ex.nameEs}`} disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </Button>
          <Button variant="ghost" aria-label={`Bajar ${ex.nameEs}`} disabled={index === count - 1} onClick={() => onMove(1)}>
            ↓
          </Button>
          <Button variant="ghost" aria-label={`Duplicar ${ex.nameEs}`} onClick={onDuplicate}>
            Duplicar
          </Button>
          <Button variant="ghost" aria-label={`Quitar ${ex.nameEs}`} onClick={onRemove}>
            Quitar
          </Button>
        </div>
      </div>

      {open && (
        <div className="ex-card__body" role="group" aria-label={`Parámetros de ${ex.nameEs}`}>
          <div className="params">
            {!ex.details && <TextField label="Series" required inputMode="numeric" {...field('sets', 'sets')} />}
            {ex.details && errors[`${path}.sets`] && <span className="field__error">{errors[`${path}.sets`]}</span>}
            <TextField label="Reps mín." inputMode="numeric" {...field('repsMin', 'repsMin')} />
            <TextField label="Reps máx." inputMode="numeric" {...field('repsMax', 'repsMax')} />
            <TextField label="Peso sugerido" inputMode="decimal" hint="Opcional" {...field('weight', 'suggestedWeight')} />
            <SelectField label="Unidad" {...field('unit', 'suggestedWeightUnit')}>
              {options.weightUnits.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectField>
            <TextField label="Descanso (s)" inputMode="numeric" {...field('rest', 'restSeconds')} />
            <TextField label="Tempo" maxLength={20} placeholder="3-1-1-0" {...field('tempo', 'tempo')} />
            <TextField label="RIR" inputMode="decimal" hint="Opcional, 0–10" {...field('rir', 'rir')} />
            <TextField label="RPE" inputMode="decimal" hint="Opcional, 1–10" {...field('rpe', 'rpe')} />
            <SelectField label="Tipo de serie" {...field('setType', 'setType')}>
              {options.setTypes.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectField>
            <TextField label="Superserie" maxLength={3} placeholder="A" hint="Misma letra = se hacen juntos" {...field('supersetGroup', 'supersetGroup')} />
          </div>
          <TextAreaField label="Notas técnicas" maxLength={1000} rows={2} {...field('notes', 'notes')} />

          <div className="sets-detail">
            <label className="check">
              <input
                type="checkbox"
                checked={!!ex.details}
                onChange={(e) => {
                  const on = e.target.checked
                  onStructure((x) => ({
                    ...x,
                    details: on
                      ? Array.from({ length: Math.max(1, Number(x.sets) || 1) }, () =>
                          emptySet({ setType: x.setType, repsMin: x.repsMin, repsMax: x.repsMax, weight: x.weight, unit: x.unit, rest: x.rest, rir: x.rir, rpe: x.rpe }),
                        )
                      : null,
                    sets: on ? x.sets : String(x.details?.length ?? x.sets),
                  }))
                }}
              />
              Detallar serie por serie (calentamiento, efectivas, dropset…)
            </label>
            {ex.details && (
              <SetTable
                sets={ex.details}
                options={options}
                path={path}
                errors={errors}
                onChange={(details, fieldPath) => onChange((x) => ({ ...x, details }), fieldPath)}
                onStructure={(details) => onStructure((x) => ({ ...x, details }))}
              />
            )}
          </div>
        </div>
      )}
    </li>
  )
}

function SetTable({
  sets,
  options,
  path,
  errors,
  onChange,
  onStructure,
}: {
  sets: SetRow[]
  options: RoutineOptions
  path: string
  errors: FieldErrors
  onChange: (sets: SetRow[], fieldPath: string) => void
  onStructure: (sets: SetRow[]) => void
}) {
  const set = (i: number, key: keyof SetRow, apiName: string) => ({
    value: sets[i][key],
    'aria-invalid': errors[`${path}.setDetails[${i}].${apiName}`] ? true : undefined,
    title: errors[`${path}.setDetails[${i}].${apiName}`],
    onChange: (e: { target: { value: string } }) => {
      const v = e.target.value
      onChange(sets.map((s, j) => (j === i ? { ...s, [key]: v } : s)), `${path}.setDetails[${i}].${apiName}`)
    },
  })
  const rowErrors = (i: number) => Object.entries(errors).filter(([k]) => k.startsWith(`${path}.setDetails[${i}].`)).map(([, v]) => v)

  return (
    <div className="table-wrap">
      <table className="table set-table">
        <thead>
          <tr>
            <th scope="col">Serie</th>
            <th scope="col">Tipo</th>
            <th scope="col">Reps mín.</th>
            <th scope="col">Reps máx.</th>
            <th scope="col">Peso</th>
            <th scope="col">Descanso (s)</th>
            <th scope="col">RIR</th>
            <th scope="col">RPE</th>
            <th scope="col">Notas</th>
            <th scope="col">
              <span className="visually-hidden">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s, i) => (
            <tr key={s.key}>
              <td>{i + 1}</td>
              <td>
                <select className="input input--sm" aria-label={`Tipo de la serie ${i + 1}`} {...set(i, 'setType', 'setType')}>
                  {options.setTypes.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input className="input input--sm" inputMode="numeric" aria-label={`Reps mínimas de la serie ${i + 1}`} {...set(i, 'repsMin', 'repsMin')} />
              </td>
              <td>
                <input className="input input--sm" inputMode="numeric" aria-label={`Reps máximas de la serie ${i + 1}`} {...set(i, 'repsMax', 'repsMax')} />
              </td>
              <td>
                <span className="weight-cell">
                  <input className="input input--sm" inputMode="decimal" aria-label={`Peso de la serie ${i + 1}`} {...set(i, 'weight', 'suggestedWeight')} />
                  <select className="input input--sm" aria-label={`Unidad de la serie ${i + 1}`} {...set(i, 'unit', 'suggestedWeightUnit')}>
                    {options.weightUnits.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </span>
              </td>
              <td>
                <input className="input input--sm" inputMode="numeric" aria-label={`Descanso de la serie ${i + 1}`} {...set(i, 'rest', 'restSeconds')} />
              </td>
              <td>
                <input className="input input--sm" inputMode="decimal" aria-label={`RIR de la serie ${i + 1}`} {...set(i, 'rir', 'rir')} />
              </td>
              <td>
                <input className="input input--sm" inputMode="decimal" aria-label={`RPE de la serie ${i + 1}`} {...set(i, 'rpe', 'rpe')} />
              </td>
              <td>
                <input className="input input--sm" maxLength={500} aria-label={`Notas de la serie ${i + 1}`} {...set(i, 'notes', 'notes')} />
                {rowErrors(i).length > 0 && <span className="field__error">{rowErrors(i).join(' ')}</span>}
              </td>
              <td>
                <Button variant="ghost" aria-label={`Quitar serie ${i + 1}`} disabled={sets.length === 1} onClick={() => onStructure(sets.filter((_, j) => j !== i))}>
                  ✕
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="set-table__foot">
        <Button variant="secondary" disabled={sets.length >= 30} onClick={() => onStructure([...sets, { ...sets[sets.length - 1], key: newKey() }])}>
          + Agregar serie
        </Button>
      </div>
    </div>
  )
}

/* ---------- Buscar en la biblioteca ---------- */
function ExercisePicker({
  dayName,
  onClose,
  onAdd,
}: {
  dayName: string
  onClose: () => void
  onAdd: (ex: { id: number; nameEs: string; nameEn: string | null; primaryMuscleGroup: string | null }) => void
}) {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [added, setAdded] = useState<Record<number, number>>({})
  const catalogs = useCatalogs()
  const results = useExercises({ q: q || undefined, muscleGroupId: muscle ? Number(muscle) : undefined, status: 'active', page: 1 })

  return (
    <Modal title={`Agregar ejercicios a «${dayName}»`} wide onClose={onClose}>
      <div className="form">
        <form
          className="filters__search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            setQ(search.trim())
          }}
        >
          <TextField label="Buscar en la biblioteca" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Español o inglés" />
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
        <SelectField label="Grupo muscular" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">Todos</option>
          {catalogs.data?.muscleGroups
            .filter((m) => m.isActive)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameEs}
              </option>
            ))}
        </SelectField>
        {results.isPending ? (
          <LoadingState />
        ) : results.error ? (
          <Alert kind="error">{results.error.message}</Alert>
        ) : results.data!.items.length === 0 ? (
          <p className="muted">
            No hay ejercicios activos con esa búsqueda. Puedes crearlos en la <Link to="/entrenadora/biblioteca">Biblioteca</Link>.
          </p>
        ) : (
          <ul className="picker" aria-label="Resultados">
            {results.data!.items.map((ex) => (
              <li key={ex.id} className="picker__item">
                <span>
                  <span className="picker__name">{ex.nameEs}</span>
                  <span className="list-item__meta">{[ex.nameEn, ex.primaryMuscleGroup, ...ex.equipment].filter(Boolean).join(' · ')}</span>
                </span>
                <Button
                  variant={added[ex.id] ? 'ghost' : 'secondary'}
                  aria-label={`Agregar ${ex.nameEs}`}
                  onClick={() => {
                    onAdd(ex)
                    setAdded((a) => ({ ...a, [ex.id]: (a[ex.id] ?? 0) + 1 }))
                  }}
                >
                  {added[ex.id] ? `Agregado ✓${added[ex.id] > 1 ? ` ×${added[ex.id]}` : ''}` : 'Agregar'}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="form__actions">
          <Button onClick={onClose}>Listo</Button>
        </div>
      </div>
    </Modal>
  )
}


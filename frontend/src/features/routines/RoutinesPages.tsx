import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { routinesApi, type RoutineDetail } from '../../api/routines'
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  TextAreaField,
  TextField,
} from '../../components/ui'
import { DownloadButton } from '../../components/DownloadButton'
import { PdfButton } from '../../components/PdfButton'
import { fromRoutineVersion } from '../../lib/routinePdf'
import { formatDate, formatDateTime } from '../../lib/format'
import { clientsApi, isCurrent } from '../../api/clients'
import { AssignModal } from '../clients/AssignModal'
import '../clients/clients.css'
import { RoutinePreview } from './RoutinePreview'
import { routineKeys, sectionFor, type Section } from './routineQueries'
import '../library/library.css'
import './routines.css'

const copyText: Record<Section, { title: string; singular: string; subtitle: string; empty: string }> = {
  rutinas: {
    title: 'Rutinas',
    singular: 'rutina',
    subtitle: 'Programas que construyes a mano, día por día. Cada publicación queda como una versión fija.',
    empty: 'Crea tu primera rutina desde cero o a partir de una plantilla.',
  },
  plantillas: {
    title: 'Plantillas',
    singular: 'plantilla',
    subtitle: 'Rutinas base reutilizables. Se copian para crear programas nuevos; no se asignan directamente.',
    empty: 'Guarda una rutina como plantilla o crea una desde cero.',
  },
}

/* ---------- Lista ---------- */
export function RoutineListPage({ section }: { section: Section }) {
  const text = copyText[section]
  const kind = section === 'rutinas' ? 'program' : 'template'
  const [status, setStatus] = useState<'active' | 'archived'>('active')
  const [creating, setCreating] = useState(false)
  const { data, isPending, error, refetch } = useQuery({
    queryKey: routineKeys.list(kind, status),
    queryFn: () => routinesApi.list(kind, status),
  })

  return (
    <>
      <PageHeader
        title={text.title}
        subtitle={text.subtitle}
        actions={
          <div className="page-actions">
            <DownloadButton path="/api/trainer/exports/routines" fileName="rutinas-lbmethod.xlsx" label="Exportar rutinas y plantillas a Excel">
              Exportar a Excel
            </DownloadButton>
            <Button onClick={() => setCreating(true)}>Nueva {text.singular}</Button>
          </div>
        }
      />
      <div className="tabs" role="tablist" aria-label="Estado">
        {(['active', 'archived'] as const).map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={status === s}
            className={`tabs__tab${status === s ? ' tabs__tab--active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s === 'active' ? 'Activas' : 'Archivadas'}
          </button>
        ))}
      </div>
      {isPending ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data!.length === 0 ? (
        <div className="card">
          {status === 'active' ? (
            <EmptyState
              title={`Aún no tienes ${text.title.toLowerCase()}`}
              description={text.empty}
              action={<Button onClick={() => setCreating(true)}>Nueva {text.singular}</Button>}
            />
          ) : (
            <EmptyState title="No hay elementos archivados" />
          )}
        </div>
      ) : (
        <ul className="list" aria-label={text.title}>
          {data!.map((r) => (
            <li key={r.id} className="list-item">
              <div className="list-item__main">
                <Link className="list-item__title exercise-item__link" to={`/entrenadora/${section}/${r.id}`}>
                  {r.name}
                </Link>
                <span className="list-item__meta">
                  {[r.goal, `${r.dayCount} ${r.dayCount === 1 ? 'día' : 'días'}`, `${r.exerciseCount} ${r.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className="exercise-item__tags">
                  {r.publishedVersionNumber ? (
                    <span className="badge badge--success">Publicada · v{r.publishedVersionNumber}</span>
                  ) : (
                    <span className="badge badge--muted">Sin publicar</span>
                  )}
                  {r.hasDraft && <span className="badge badge--pending">Borrador en edición</span>}
                </span>
              </div>
              <span className="list-item__meta">Actualizada {formatDateTime(r.updatedAt)}</span>
            </li>
          ))}
        </ul>
      )}
      {creating && <CreateRoutineModal section={section} onClose={() => setCreating(false)} />}
    </>
  )
}

function CreateRoutineModal({ section, onClose }: { section: Section; onClose: () => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const kind = section === 'rutinas' ? 1 : 2
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [weeks, setWeeks] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const templates = useQuery({
    queryKey: routineKeys.list('template', 'active'),
    queryFn: () => routinesApi.list('template', 'active'),
    enabled: section === 'rutinas',
  })
  const [templateId, setTemplateId] = useState('')

  const create = useMutation({
    mutationFn: async () => {
      if (templateId) return routinesApi.copy(Number(templateId), 1, title.trim())
      return routinesApi.create({ kind, title: title.trim(), goal: goal.trim() || null, description: description.trim() || null, durationWeeks: weeks ? Number(weeks) : null })
    },
    onSuccess: async ({ id }) => {
      await qc.invalidateQueries({ queryKey: routineKeys.all })
      navigate(`/entrenadora/${section}/${id}/editar`)
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k.charAt(0).toLowerCase() + k.slice(1), v[0]])))
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!title.trim()) next.title = 'Escribe el nombre.'
    if (weeks && !(Number.isInteger(Number(weeks)) && Number(weeks) >= 1 && Number(weeks) <= 104)) next.durationWeeks = 'De 1 a 104 semanas.'
    setErrors(next)
    if (Object.keys(next).length === 0) create.mutate()
  }

  return (
    <Modal title={section === 'rutinas' ? 'Nueva rutina' : 'Nueva plantilla'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {create.error && !Object.keys(errors).length && <Alert kind="error">{create.error.message}</Alert>}
        {section === 'rutinas' && (templates.data?.length ?? 0) > 0 && (
          <div className="field">
            <label className="field__label" htmlFor="from-template">
              Punto de partida
            </label>
            <select id="from-template" className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Desde cero</option>
              {templates.data!.map((t) => (
                <option key={t.id} value={t.id}>
                  Plantilla: {t.name}
                </option>
              ))}
            </select>
            <span className="field__hint">Con una plantilla se copia su contenido; después puedes cambiar todo.</span>
          </div>
        )}
        <TextField label="Nombre" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
        {!templateId && (
          <>
            <TextField label="Objetivo" maxLength={500} value={goal} onChange={(e) => setGoal(e.target.value)} hint="Ejemplo: hipertrofia de glúteo" />
            <TextField label="Duración (semanas)" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} error={errors.durationWeeks} />
            <TextAreaField label="Descripción" maxLength={2000} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </>
        )}
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Crear y abrir constructor
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Ficha de rutina ---------- */
export function RoutinePage({ section }: { section: Section }) {
  const id = Number(useParams().id)
  const { data, isPending, error, refetch } = useQuery({ queryKey: routineKeys.detail(id), queryFn: () => routinesApi.get(id) })
  if (isPending) return <LoadingState />
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />
  // Si se abrió desde la sección equivocada, se muestra igual pero con los textos correctos.
  return <RoutineOverview routine={data!} section={sectionFor(data!.kind) ?? section} />
}

type Pending = 'archive' | 'restore' | 'duplicate' | 'template' | 'use-template' | null

function RoutineOverview({ routine, section }: { routine: RoutineDetail; section: Section }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [pending, setPending] = useState<Pending>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)
  const latestId = routine.draftVersionId ?? routine.latestPublishedVersionId ?? routine.versions[0]?.id
  const [viewing, setViewing] = useState<number | undefined>(routine.latestPublishedVersionId ?? latestId)
  const version = useQuery({
    queryKey: routineKeys.version(routine.id, viewing ?? 0),
    queryFn: () => routinesApi.version(routine.id, viewing!),
    enabled: viewing !== undefined,
  })
  const archived = routine.status === 'Archived'
  const isTemplate = routine.kind === 'Template'

  const act = useMutation({
    mutationFn: async ({ kind, title }: { kind: Exclude<Pending, null>; title?: string }) => {
      if (kind === 'archive') return routinesApi.archive(routine.id)
      if (kind === 'restore') return routinesApi.restore(routine.id)
      const target = kind === 'template' ? 2 : kind === 'use-template' ? 1 : isTemplate ? 2 : 1
      return routinesApi.copy(routine.id, target, title ?? null)
    },
    onSuccess: async (result, { kind }) => {
      setPending(null)
      await qc.invalidateQueries({ queryKey: routineKeys.all })
      if (result && 'id' in result) {
        const target = kind === 'template' ? 'plantillas' : kind === 'use-template' ? 'rutinas' : section
        navigate(`/entrenadora/${target}/${result.id}/editar`)
      } else setNotice(kind === 'archive' ? 'Se archivó. Sus versiones se conservan.' : 'Se restauró.')
    },
  })

  return (
    <>
      <p className="breadcrumb">
        <Link to={`/entrenadora/${section}`}>← {copyText[section].title}</Link>
      </p>
      <PageHeader
        title={routine.name}
        subtitle={isTemplate ? 'Plantilla' : 'Rutina'}
        actions={
          <div className="page-actions">
            {!archived && (
              <Link className="btn btn--primary" to={`/entrenadora/${section}/${routine.id}/editar`}>
                {routine.draftVersionId ? 'Seguir editando' : 'Editar'}
              </Link>
            )}
            {!isTemplate && !archived && routine.latestPublishedVersionId && (
              <Button variant="secondary" onClick={() => setAssigning(true)}>
                Asignar a clientes
              </Button>
            )}
            {isTemplate && !archived && (
              <Button variant="secondary" onClick={() => setPending('use-template')}>
                Usar plantilla
              </Button>
            )}
            <Button variant="secondary" onClick={() => setPending('duplicate')}>
              Duplicar
            </Button>
            {!isTemplate && (
              <Button variant="secondary" onClick={() => setPending('template')}>
                Guardar como plantilla
              </Button>
            )}
            <Button variant={archived ? 'secondary' : 'ghost'} onClick={() => setPending(archived ? 'restore' : 'archive')}>
              {archived ? 'Restaurar' : 'Archivar'}
            </Button>
          </div>
        }
      />
      <div className="stack">
        {notice && <Alert kind="success">{notice}</Alert>}
        {archived && <Alert kind="warning">Archivada: no aparece en la lista principal ni se puede editar. Sus versiones se conservan.</Alert>}
        {act.error && <Alert kind="error">{act.error.message}</Alert>}

        <div className="routine-overview">
          <section className="card stack" aria-labelledby="versions-title">
            <h2 className="card__title" id="versions-title">
              Versiones
            </h2>
            <p className="field__hint">Cada publicación queda fija. Editar algo publicado crea una versión nueva; las anteriores no cambian.</p>
            <ul className="versions">
              {routine.versions.map((v) => (
                <li key={v.id}>
                  <button type="button" className={`version${viewing === v.id ? ' version--on' : ''}`} aria-pressed={viewing === v.id} onClick={() => setViewing(v.id)}>
                    <span className="version__title">
                      Versión {v.versionNumber}{' '}
                      {v.status === 'Published' ? <span className="badge badge--success">Publicada</span> : <span className="badge badge--pending">Borrador</span>}
                    </span>
                    <span className="list-item__meta">
                      {v.publishedAt ? `Publicada ${formatDateTime(v.publishedAt)}` : `Guardada ${formatDateTime(v.updatedAt)}`}
                    </span>
                    {v.changeNotes && <span className="list-item__meta">«{v.changeNotes}»</span>}
                  </button>
                </li>
              ))}
            </ul>
            {!isTemplate && <RoutineAssignments routineId={routine.id} />}
          </section>
          <section className="card" aria-label="Contenido">
            {version.isPending ? (
              <LoadingState />
            ) : version.error ? (
              <ErrorState message={version.error.message} onRetry={() => version.refetch()} />
            ) : (
              <div className="stack">
                <PdfButton getData={() => fromRoutineVersion(version.data!)} label={`Descargar la versión ${version.data!.versionNumber} en PDF`}>
                  Descargar versión {version.data!.versionNumber} en PDF
                </PdfButton>
                <RoutinePreview version={version.data!} />
              </div>
            )}
          </section>
        </div>
      </div>

      {assigning && (
        <AssignModal
          routineId={routine.id}
          versionId={routine.latestPublishedVersionId ?? undefined}
          onClose={() => setAssigning(false)}
          onAssigned={async (count) => {
            setAssigning(false)
            setNotice(count === 1 ? 'Rutina asignada a 1 cliente.' : `Rutina asignada a ${count} clientes.`)
            await qc.invalidateQueries({ queryKey: ['trainer', 'clients'] })
            await qc.invalidateQueries({ queryKey: ['routines', 'assignments', routine.id] })
          }}
        />
      )}
      {(pending === 'archive' || pending === 'restore') && (
        <ConfirmDialog
          title={pending === 'archive' ? 'Archivar' : 'Restaurar'}
          message={
            pending === 'archive'
              ? `«${routine.name}» dejará de aparecer en la lista. No se borra nada: sus versiones se conservan y puedes restaurarla cuando quieras.`
              : `«${routine.name}» volverá a la lista principal.`
          }
          confirmLabel={pending === 'archive' ? 'Archivar' : 'Restaurar'}
          loading={act.isPending}
          onConfirm={() => act.mutate({ kind: pending })}
          onCancel={() => setPending(null)}
        />
      )}
      {(pending === 'duplicate' || pending === 'template' || pending === 'use-template') && (
        <CopyModal
          title={pending === 'duplicate' ? 'Duplicar' : pending === 'template' ? 'Guardar como plantilla' : 'Crear rutina desde esta plantilla'}
          defaultName={pending === 'duplicate' ? `${routine.name} (copia)` : routine.name}
          loading={act.isPending}
          onCancel={() => setPending(null)}
          onConfirm={(title) => act.mutate({ kind: pending, title })}
        />
      )}
    </>
  )
}

/** Clientes que tienen esta rutina: vigentes primero y luego el historial. */
function RoutineAssignments({ routineId }: { routineId: number }) {
  const { data, isPending, error } = useQuery({ queryKey: ['routines', 'assignments', routineId], queryFn: () => clientsApi.routineAssignments(routineId) })
  const current = data?.filter(isCurrent) ?? []
  const pastCount = (data?.length ?? 0) - current.length
  return (
    <div className="stack routine-assigned">
      <h3 className="card__title" id="assigned-title">
        Asignada a
      </h3>
      {isPending ? (
        <LoadingState />
      ) : error ? (
        <Alert kind="error">{error.message}</Alert>
      ) : current.length === 0 ? (
        <p className="muted">Nadie la tiene vigente.</p>
      ) : (
        <ul className="versions" aria-labelledby="assigned-title">
          {current.map((a) => (
            <li key={a.id} className="routine-assigned__item">
              <Link to={`/entrenadora/clientes/${a.clientId}`}>{a.clientName}</Link>
              <span className="list-item__meta">
                Versión {a.versionNumber} · {a.statusLabel} desde {formatDate(a.startDate)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {pastCount > 0 && <p className="field__hint">Además, {pastCount} {pastCount === 1 ? 'asignación anterior' : 'asignaciones anteriores'} en el historial de los clientes.</p>}
    </div>
  )
}

function CopyModal({ title, defaultName, loading, onCancel, onConfirm }: { title: string; defaultName: string; loading: boolean; onCancel: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState(defaultName)
  return (
    <Modal title={title} onClose={onCancel}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) onConfirm(name.trim())
        }}
      >
        <p className="muted">Se crea una copia nueva como borrador. El original no cambia.</p>
        <TextField label="Nombre" required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} error={name.trim() ? undefined : 'Escribe el nombre.'} />
        <div className="form__actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} disabled={!name.trim()}>
            Crear copia
          </Button>
        </div>
      </form>
    </Modal>
  )
}


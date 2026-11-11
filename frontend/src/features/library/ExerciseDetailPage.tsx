import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { libraryApi, MEDIA_LIMITS, type ExerciseDetail, type ExerciseMedia, type ExerciseVariant } from '../../api/library'
import {
  BackLink,
  Alert,
  Button,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  SelectField,
  TextField,
} from '../../components/ui'
import { formatBytes, libraryKeys, useExercise, useExercises } from './libraryQueries'
import './library.css'

export function ExerciseDetailPage() {
  const id = Number(useParams().id)
  const location = useLocation()
  const { data, isPending, error, refetch } = useExercise(id)
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null)

  if (isPending) return <LoadingState label="Cargando ejercicio…" />
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />
  return <Detail exercise={data!} notice={notice} setNotice={setNotice} />
}

function Detail({ exercise: e, notice, setNotice }: { exercise: ExerciseDetail; notice: string | null; setNotice: (n: string | null) => void }) {
  const qc = useQueryClient()
  const [confirmStatus, setConfirmStatus] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: libraryKeys.all })

  const status = useMutation({
    mutationFn: () => libraryApi.setActive(e.id, !e.isActive),
    onSuccess: async () => {
      setConfirmStatus(false)
      setNotice(e.isActive ? 'Ejercicio desactivado. Las rutinas e historial que ya lo usan no cambian.' : 'Ejercicio reactivado.')
      await refresh()
    },
  })
  const favorite = useMutation({ mutationFn: () => libraryApi.setFavorite(e.id, !e.isFavorite), onSuccess: refresh })

  return (
    <>
      <BackLink to="/entrenadora/biblioteca" label="Ejercicios" />
      <PageHeader
        title={e.nameEs}
        subtitle={e.nameEn ?? undefined}
        actions={
          <div className="page-actions">
            <Button variant="ghost" aria-pressed={e.isFavorite} onClick={() => favorite.mutate()} loading={favorite.isPending}>
              {e.isFavorite ? '★ Favorito' : '☆ Marcar favorito'}
            </Button>
            <Link className="btn btn--secondary" to={`/entrenadora/biblioteca/ejercicios/${e.id}/editar`}>
              Editar
            </Link>
            <Button variant={e.isActive ? 'danger' : 'primary'} onClick={() => setConfirmStatus(true)}>
              {e.isActive ? 'Desactivar' : 'Reactivar'}
            </Button>
          </div>
        }
      />
      <div className="stack">
        {notice && <Alert kind="success">{notice}</Alert>}
        {!e.isActive && (
          <Alert kind="warning">
            Este ejercicio está desactivado: no aparece al buscar en la biblioteca, pero las rutinas e historial que ya lo
            usan lo conservan.
          </Alert>
        )}
        {(status.error || favorite.error) && <Alert kind="error">{(status.error ?? favorite.error)!.message}</Alert>}

        <section className="card">
          <h2 className="card__title">Datos</h2>
          <dl className="profile-list">
            <Row label="Tipo" value={e.typeLabel} />
            <Row label="Dificultad" value={e.difficultyLabel} />
            <Row label="Grupo principal" value={e.primaryMuscleGroup?.nameEs} />
            <Row label="Músculos secundarios" value={e.secondaryMuscleGroups.map((m) => m.nameEs).join(', ')} />
            <Row label="Equipamiento" value={e.equipment.map((m) => m.nameEs).join(', ')} />
            <Row label="Patrón de movimiento" value={e.movementPattern?.nameEs} />
            <Row label="Descripción" value={e.description} multiline />
          </dl>
        </section>

        <section className="card">
          <h2 className="card__title">Técnica</h2>
          <dl className="profile-list">
            <Row label="Instrucciones" value={e.instructions} multiline />
            <Row label="Errores frecuentes" value={e.commonMistakes} multiline />
            <Row label="Consejos técnicos" value={e.technicalTips} multiline />
          </dl>
        </section>

        <MediaSection exercise={e} onChanged={refresh} />
        <VariantsSection exercise={e} onChanged={refresh} />
      </div>

      {confirmStatus && (
        <ConfirmDialog
          title={e.isActive ? 'Desactivar ejercicio' : 'Reactivar ejercicio'}
          message={
            e.isActive
              ? `«${e.nameEs}» dejará de aparecer en la biblioteca y al armar rutinas nuevas. No se borra: las rutinas e historial que ya lo usan no cambian y puedes reactivarlo cuando quieras.`
              : `«${e.nameEs}» volverá a aparecer en la biblioteca.`
          }
          confirmLabel={e.isActive ? 'Desactivar' : 'Reactivar'}
          danger={e.isActive}
          loading={status.isPending}
          onConfirm={() => status.mutate()}
          onCancel={() => setConfirmStatus(false)}
        />
      )}
    </>
  )
}

function Row({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
  return (
    <div className="profile-row">
      <dt>{label}</dt>
      <dd className={multiline ? 'pre-line' : undefined}>{value ? value : <span className="muted">Sin indicar</span>}</dd>
    </div>
  )
}

/* ---------- Imágenes y videos ---------- */
function MediaSection({ exercise, onChanged }: { exercise: ExerciseDetail; onChanged: () => Promise<void> }) {
  const [adding, setAdding] = useState<'file' | 'link' | null>(null)
  const [deleting, setDeleting] = useState<ExerciseMedia | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const remove = useMutation({
    mutationFn: (m: ExerciseMedia) => libraryApi.deleteMedia(exercise.id, m.id),
    onSuccess: async () => {
      setDeleting(null)
      setNotice('Se eliminó el medio.')
      await onChanged()
    },
  })

  return (
    <section className="card stack" aria-labelledby="media-title">
      <div className="catalog-head">
        <h2 className="card__title" id="media-title">
          Imágenes y videos
        </h2>
        <div className="page-actions">
          <Button variant="secondary" onClick={() => setAdding('file')}>
            Subir archivo
          </Button>
          <Button variant="secondary" onClick={() => setAdding('link')}>
            Agregar enlace
          </Button>
        </div>
      </div>
      {notice && <Alert kind="success">{notice}</Alert>}
      {remove.error && <Alert kind="error">{remove.error.message}</Alert>}
      {exercise.media.length === 0 ? (
        <p className="muted">Este ejercicio aún no tiene imágenes ni videos.</p>
      ) : (
        <ul className="media-grid" aria-label="Medios del ejercicio">
          {exercise.media.map((m) => (
            <li key={m.id} className="media-card">
              <MediaPreview media={m} exerciseName={exercise.nameEs} />
              <div className="media-card__info">
                <span className="media-card__title">{m.title ?? (m.mediaType === 'Image' ? 'Imagen' : 'Video')}</span>
                <span className="list-item__meta">
                  {m.contentUrl ? `${m.fileName} · ${formatBytes(m.sizeBytes ?? 0)}` : 'Enlace externo'}
                </span>
              </div>
              <Button variant="ghost" onClick={() => setDeleting(m)} aria-label={`Eliminar ${m.title ?? m.fileName ?? 'medio'}`}>
                Eliminar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="field__hint">
        Los archivos son privados: solo se ven con sesión iniciada. Imágenes JPG, PNG o WEBP hasta {formatBytes(MEDIA_LIMITS.imageBytes)}; videos MP4
        o WEBM hasta {formatBytes(MEDIA_LIMITS.videoBytes)}.
      </p>

      {adding === 'file' && (
        <UploadModal
          exerciseId={exercise.id}
          onClose={() => setAdding(null)}
          onDone={async () => {
            setAdding(null)
            setNotice('Archivo subido.')
            await onChanged()
          }}
        />
      )}
      {adding === 'link' && (
        <LinkModal
          exerciseId={exercise.id}
          onClose={() => setAdding(null)}
          onDone={async () => {
            setAdding(null)
            setNotice('Enlace agregado.')
            await onChanged()
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Eliminar medio"
          message={
            deleting.contentUrl
              ? `Se eliminará el archivo «${deleting.fileName}» de forma permanente.`
              : 'Se quitará el enlace de este ejercicio.'
          }
          confirmLabel="Eliminar"
          danger
          loading={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  )
}

function MediaPreview({ media, exerciseName }: { media: ExerciseMedia; exerciseName: string }) {
  if (media.contentUrl && media.mediaType === 'Image')
    return <img className="media-card__preview" src={media.contentUrl} alt={media.title ?? `Imagen de ${exerciseName}`} loading="lazy" />
  if (media.contentUrl)
    return <video className="media-card__preview" src={media.contentUrl} controls preload="metadata" aria-label={media.title ?? `Video de ${exerciseName}`} />
  return (
    <a className="media-card__preview media-card__link" href={media.externalUrl!} target="_blank" rel="noopener noreferrer">
      {media.mediaType === 'Video' ? '▶ Abrir video' : 'Abrir imagen'}
      <span className="list-item__meta">{new URL(media.externalUrl!).hostname}</span>
    </a>
  )
}

function UploadModal({ exerciseId, onClose, onDone }: { exerciseId: number; onClose: () => void; onDone: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const upload = useMutation({ mutationFn: () => libraryApi.uploadMedia(exerciseId, file!, title.trim() || undefined), onSuccess: onDone })

  const choose = (f: File | null) => {
    setError(null)
    setFile(f)
    if (!f) return
    const isImage = MEDIA_LIMITS.imageTypes.includes(f.type)
    const isVideo = MEDIA_LIMITS.videoTypes.includes(f.type)
    if (!isImage && !isVideo) setError('Formato no permitido. Imágenes: JPG, PNG o WEBP. Videos: MP4 o WEBM.')
    else if (isImage && f.size > MEDIA_LIMITS.imageBytes) setError(`La imagen supera ${formatBytes(MEDIA_LIMITS.imageBytes)}.`)
    else if (isVideo && f.size > MEDIA_LIMITS.videoBytes) setError(`El video supera ${formatBytes(MEDIA_LIMITS.videoBytes)}.`)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!file) setError('Selecciona un archivo.')
    else if (!error) upload.mutate()
  }

  return (
    <Modal title="Subir imagen o video" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {upload.error && <Alert kind="error">{upload.error.message}</Alert>}
        <div className="field">
          <label className="field__label" htmlFor="media-file">
            Archivo <span aria-hidden="true">*</span>
          </label>
          <input
            id="media-file"
            className="input"
            type="file"
            accept={[...MEDIA_LIMITS.imageTypes, ...MEDIA_LIMITS.videoTypes].join(',')}
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
            aria-invalid={error ? true : undefined}
          />
          {file && !error && <span className="field__hint">{`${file.name} · ${formatBytes(file.size)}`}</span>}
          {error && (
            <span className="field__error" role="alert">
              {error}
            </span>
          )}
        </div>
        <TextField label="Título" hint="Opcional. Ejemplo: Posición inicial" maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose} disabled={upload.isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={upload.isPending}>
            Subir
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function LinkModal({ exerciseId, onClose, onDone }: { exerciseId: number; onClose: () => void; onDone: () => Promise<void> }) {
  const [url, setUrl] = useState('')
  const [type, setType] = useState<'1' | '2'>('2')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = useMutation({ mutationFn: () => libraryApi.addMediaLink(exerciseId, url.trim(), Number(type) as 1 | 2, title.trim()), onSuccess: onDone })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!/^https:\/\/\S+$/i.test(url.trim())) {
      setError('Escribe un enlace completo y seguro que empiece con https://')
      return
    }
    setError(null)
    add.mutate()
  }

  return (
    <Modal title="Agregar enlace" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {add.error && <Alert kind="error">{add.error.message}</Alert>}
        <TextField label="Enlace" required type="url" placeholder="https://…" maxLength={1000} value={url} onChange={(e) => setUrl(e.target.value)} error={error ?? undefined} hint="Por ejemplo, un video no listado de YouTube." />
        <SelectField label="Tipo" value={type} onChange={(e) => setType(e.target.value as '1' | '2')}>
          <option value="2">Video</option>
          <option value="1">Imagen</option>
        </SelectField>
        <TextField label="Título" hint="Opcional" maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose} disabled={add.isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={add.isPending}>
            Agregar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Variantes ---------- */
function VariantsSection({ exercise, onChanged }: { exercise: ExerciseDetail; onChanged: () => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<ExerciseVariant | null>(null)

  const remove = useMutation({
    mutationFn: (v: ExerciseVariant) => libraryApi.removeVariant(exercise.id, v.exerciseId),
    onSuccess: async () => {
      setRemoving(null)
      await onChanged()
    },
  })

  return (
    <section className="card stack" aria-labelledby="variants-title">
      <div className="catalog-head">
        <h2 className="card__title" id="variants-title">
          Variantes
        </h2>
        <Button variant="secondary" onClick={() => setAdding(true)}>
          Vincular variante
        </Button>
      </div>
      <p className="field__hint">Cada variante es un ejercicio propio de la biblioteca, con su ficha y su historial.</p>
      {remove.error && <Alert kind="error">{remove.error.message}</Alert>}
      {exercise.variants.length === 0 ? (
        <p className="muted">Sin variantes vinculadas.</p>
      ) : (
        <ul className="list" aria-label="Variantes">
          {exercise.variants.map((v) => (
            <li key={v.exerciseId} className="list-item">
              <div className="list-item__main">
                <Link className="list-item__title" to={`/entrenadora/biblioteca/ejercicios/${v.exerciseId}`}>
                  {v.nameEs}
                </Link>
                <span className="list-item__meta">
                  {[v.nameEn, v.note].filter(Boolean).join(' · ')}
                  {!v.isActive && ' · Desactivado'}
                </span>
              </div>
              <Button variant="ghost" onClick={() => setRemoving(v)}>
                Desvincular
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <VariantModal
          exercise={exercise}
          onClose={() => setAdding(false)}
          onDone={async () => {
            setAdding(false)
            await onChanged()
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Desvincular variante"
          message={`Se quitará el vínculo con «${removing.nameEs}». Ambos ejercicios siguen en la biblioteca.`}
          confirmLabel="Desvincular"
          loading={remove.isPending}
          onConfirm={() => remove.mutate(removing)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </section>
  )
}

function VariantModal({ exercise, onClose, onDone }: { exercise: ExerciseDetail; onClose: () => void; onDone: () => Promise<void> }) {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const results = useExercises({ q: q || undefined, status: 'active', page: 1 })
  const linked = new Set([exercise.id, ...exercise.variants.map((v) => v.exerciseId)])
  const options = results.data?.items.filter((i) => !linked.has(i.id)) ?? []

  const add = useMutation({ mutationFn: () => libraryApi.addVariant(exercise.id, selected!, note.trim() || null), onSuccess: onDone })

  return (
    <Modal title={`Vincular variante de «${exercise.nameEs}»`} onClose={onClose}>
      <div className="form">
        {add.error && <Alert kind="error">{add.error.message}</Alert>}
        <form
          className="filters__search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            setQ(search.trim())
          }}
        >
          <TextField label="Buscar ejercicio" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
        {results.isPending ? (
          <LoadingState />
        ) : options.length === 0 ? (
          <p className="muted">No hay ejercicios disponibles con ese nombre.</p>
        ) : (
          <fieldset className="variant-options">
            <legend className="visually-hidden">Ejercicios</legend>
            {options.map((o) => (
              <label key={o.id} className={`variant-option${selected === o.id ? ' variant-option--on' : ''}`}>
                <input type="radio" name="variant" checked={selected === o.id} onChange={() => setSelected(o.id)} />
                <span>
                  {o.nameEs}
                  {o.nameEn && <span className="list-item__meta"> · {o.nameEn}</span>}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <TextField label="Nota" hint="Opcional. Ejemplo: versión unilateral" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => add.mutate()} disabled={selected === null} loading={add.isPending}>
            Vincular
          </Button>
        </div>
      </div>
    </Modal>
  )
}

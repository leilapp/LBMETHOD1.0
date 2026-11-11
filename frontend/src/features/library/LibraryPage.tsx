import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { libraryApi, type CatalogItem, type CatalogKind, type ExerciseFilters } from '../../api/library'
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
  SelectField,
  TextField,
} from '../../components/ui'
import { libraryKeys, useCatalogs, useExercises } from './libraryQueries'
import { Dumbbell, FileSpreadsheet, Plus, Search, SlidersHorizontal, Star } from 'lucide-react'
import './library.css'

const tabs = [
  { id: 'ejercicios', label: 'Ejercicios' },
  { id: 'grupos', label: 'Grupos musculares' },
  { id: 'equipamiento', label: 'Equipamiento' },
  { id: 'patrones', label: 'Patrones de movimiento' },
] as const

type TabId = (typeof tabs)[number]['id']

export function LibraryPage() {
  const [params, setParams] = useSearchParams()
  const tab = (tabs.find((t) => t.id === params.get('vista'))?.id ?? 'ejercicios') as TabId

  return (
    <>
      <PageHeader
        title="Ejercicios"
        subtitle="Tu biblioteca: cada ejercicio se registra una sola vez y se reutiliza en las rutinas."
        actions={
          <div className="head-actions">
            <Link className="btn btn--primary" to="/entrenadora/biblioteca/nuevo">
              <Plus size={18} aria-hidden="true" />
              Nuevo ejercicio
            </Link>
            <MoreMenu items={[{ label: 'Importar o exportar con Excel', icon: FileSpreadsheet, to: '/entrenadora/biblioteca/importar' }]} />
          </div>
        }
      />
      <div className="tabs" role="tablist" aria-label="Secciones de la biblioteca">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            className={`tabs__tab${tab === t.id ? ' tabs__tab--active' : ''}`}
            onClick={() => setParams(t.id === 'ejercicios' ? {} : { vista: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'ejercicios' && <ExerciseList />}
        {tab === 'grupos' && (
          <CatalogTab kind="muscle-groups" singular="grupo muscular" description="Los grupos iniciales vienen de la guía; puedes agregar, renombrar o desactivar." />
        )}
        {tab === 'equipamiento' && <CatalogTab kind="equipment" singular="equipamiento" description="Barras, mancuernas, máquinas, bandas…" />}
        {tab === 'patrones' && (
          <CatalogTab kind="movement-patterns" singular="patrón" description="Bisagra de cadera, sentadilla, empuje, tracción…" />
        )}
      </div>
    </>
  )
}

/* ---------- Ejercicios ---------- */
function ExerciseList() {
  const qc = useQueryClient()
  const catalogs = useCatalogs()
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<ExerciseFilters>({ status: 'active', page: 1 })
  const { data, isPending, error, refetch, isFetching } = useExercises(filters)

  const favorite = useMutation({
    mutationFn: ({ id, value }: { id: number; value: boolean }) => libraryApi.setFavorite(id, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: libraryKeys.all }),
  })

  const update = (patch: Partial<ExerciseFilters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }))
  const toNumber = (v: string) => (v ? Number(v) : undefined)
  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    update({ q: search.trim() || undefined })
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const active = (items?: CatalogItem[]) => items?.filter((i) => i.isActive) ?? []

  return (
    <div className="stack">
      <form className={`card filters${showFilters ? ' filters--open' : ''}`} onSubmit={onSearch} role="search">
        <div className="filters__search">
          <TextField
            label="Buscar"
            type="search"
            placeholder="Nombre en español o inglés"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              // Al borrar la búsqueda se vuelve a ver todo, sin tener que tocar «Buscar».
              if (!e.target.value.trim() && filters.q) update({ q: undefined })
            }}
            hint="No importan mayúsculas ni acentos."
          />
          <Button type="submit" variant="secondary">
            <Search size={18} aria-hidden="true" />
            <span className="filters__search-text">Buscar</span>
          </Button>
          <button type="button" className="chip filters__toggle" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filtros
          </button>
        </div>
        <div className="filters__grid">
          <SelectField label="Grupo muscular" value={filters.muscleGroupId ?? ''} onChange={(e) => update({ muscleGroupId: toNumber(e.target.value) })}>
            <option value="">Todos</option>
            {active(catalogs.data?.muscleGroups).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameEs}
              </option>
            ))}
          </SelectField>
          <SelectField label="Equipamiento" value={filters.equipmentId ?? ''} onChange={(e) => update({ equipmentId: toNumber(e.target.value) })}>
            <option value="">Todos</option>
            {active(catalogs.data?.equipment).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameEs}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Patrón de movimiento"
            value={filters.movementPatternId ?? ''}
            onChange={(e) => update({ movementPatternId: toNumber(e.target.value) })}
          >
            <option value="">Todos</option>
            {active(catalogs.data?.movementPatterns).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameEs}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Estado"
            value={filters.status ?? 'active'}
            onChange={(e) => update({ status: e.target.value as ExerciseFilters['status'] })}
          >
            <option value="active">Activos</option>
            <option value="inactive">Desactivados</option>
            <option value="all">Todos</option>
          </SelectField>
        </div>
        <label className="check">
          <input type="checkbox" checked={!!filters.favorites} onChange={(e) => update({ favorites: e.target.checked })} />
          Solo mis favoritos
        </label>
      </form>

      {active(catalogs.data?.muscleGroups).length > 0 && (
        <div className="chips" role="group" aria-label="Filtrar por músculo">
          <button type="button" className="chip" aria-pressed={!filters.muscleGroupId} onClick={() => update({ muscleGroupId: undefined })}>
            Todos
          </button>
          {active(catalogs.data?.muscleGroups).map((m) => (
            <button
              key={m.id}
              type="button"
              className="chip"
              aria-pressed={filters.muscleGroupId === m.id}
              onClick={() => update({ muscleGroupId: filters.muscleGroupId === m.id ? undefined : m.id })}
            >
              {m.nameEs}
            </button>
          ))}
        </div>
      )}

      {favorite.error && <Alert kind="error">{favorite.error.message}</Alert>}

      {isPending ? (
        <LoadingState label="Cargando ejercicios…" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data!.total === 0 ? (
        <div className="card">
          {filters.q || filters.muscleGroupId || filters.equipmentId || filters.movementPatternId || filters.favorites || filters.status !== 'active' ? (
            <EmptyState title="Sin resultados" description="Ningún ejercicio coincide con la búsqueda o los filtros." />
          ) : (
            <EmptyState
              title="Tu biblioteca está vacía"
              description="Agrega tu primer ejercicio o importa tu catálogo desde Excel."
              action={
                <div className="page-actions">
                  <Link className="btn btn--primary" to="/entrenadora/biblioteca/nuevo">
                    Nuevo ejercicio
                  </Link>
                  <Link className="btn btn--secondary" to="/entrenadora/biblioteca/importar">
                    Importar desde Excel
                  </Link>
                </div>
              }
            />
          )}
        </div>
      ) : (
        <>
          <p className="muted" aria-live="polite">
            {data!.total === 1 ? '1 ejercicio' : `${data!.total} ejercicios`}
            {isFetching && ' · actualizando…'}
          </p>
          <ul className="list exercise-grid" aria-label="Ejercicios">
            {data!.items.map((e) => (
              <li key={e.id} className="list-item exercise-item">
                <Link className="exercise-item__open" to={`/entrenadora/biblioteca/ejercicios/${e.id}`}>
                  {e.thumbnailMediaId ? (
                    <img className="exercise-item__thumb" src={libraryApi.mediaUrl(e.thumbnailMediaId)} alt="" loading="lazy" />
                  ) : (
                    <span className={`exercise-item__thumb icon-chip icon-chip--${muscleColor(e.primaryMuscleGroup)}`} aria-hidden="true">
                      <Dumbbell size={20} />
                    </span>
                  )}
                  <span className="list-item__main">
                    <span className="list-item__title">{e.nameEs}</span>
                    <span className="list-item__meta exercise-item__meta">
                      {[e.primaryMuscleGroup, ...e.equipment.slice(0, 2)].filter(Boolean).join(' · ') || e.typeLabel}
                      {!e.isActive && <span className="badge badge--pending">Desactivado</span>}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  className={`fav${e.isFavorite ? ' fav--on' : ''}`}
                  aria-pressed={e.isFavorite}
                  aria-label={e.isFavorite ? `Quitar ${e.nameEs} de favoritos` : `Marcar ${e.nameEs} como favorito`}
                  onClick={() => favorite.mutate({ id: e.id, value: !e.isFavorite })}
                  disabled={favorite.isPending}
                >
                  <Star size={20} fill={e.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <nav className="pager" aria-label="Páginas">
              <Button variant="secondary" disabled={filters.page === 1} onClick={() => update({ page: (filters.page ?? 1) - 1 })}>
                Anterior
              </Button>
              <span className="muted">
                Página {filters.page} de {totalPages}
              </span>
              <Button variant="secondary" disabled={filters.page === totalPages} onClick={() => update({ page: (filters.page ?? 1) + 1 })}>
                Siguiente
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}

/** Color del ícono según el músculo principal, para reconocer los ejercicios de un vistazo. */
const MUSCLE_COLORS: Record<string, string> = {
  Glúteos: 'rose',
  Femoral: 'rose',
  Abductores: 'rose',
  Aductores: 'rose',
  Cuádriceps: 'gold',
  Pantorrillas: 'gold',
  Espalda: 'sky',
  Pecho: 'sky',
  Hombros: 'violet',
  Bíceps: 'violet',
  Tríceps: 'violet',
  Abdomen: 'mint',
}
const muscleColor = (name: string | null) => (name && MUSCLE_COLORS[name]) || 'violet'

/* ---------- Catálogos administrables ---------- */
const catalogField: Record<CatalogKind, 'muscleGroups' | 'equipment' | 'movementPatterns'> = {
  'muscle-groups': 'muscleGroups',
  equipment: 'equipment',
  'movement-patterns': 'movementPatterns',
}

function CatalogTab({ kind, singular, description }: { kind: CatalogKind; singular: string; description: string }) {
  const qc = useQueryClient()
  const { data, isPending, error, refetch } = useCatalogs()
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null)
  const [toggling, setToggling] = useState<CatalogItem | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const toggle = useMutation({
    mutationFn: (item: CatalogItem) =>
      libraryApi.updateCatalogItem(kind, item.id, { nameEs: item.nameEs, nameEn: item.nameEn, isActive: !item.isActive }),
    onSuccess: async (_, item) => {
      setToggling(null)
      setNotice(item.isActive ? `Se desactivó «${item.nameEs}». Los ejercicios que ya lo usan no cambian.` : `Se reactivó «${item.nameEs}».`)
      await qc.invalidateQueries({ queryKey: libraryKeys.all })
    },
  })

  const items = data?.[catalogField[kind]] ?? []

  return (
    <div className="stack">
      <div className="catalog-head">
        <p className="muted">{description}</p>
        <Button onClick={() => setEditing('new')}>Agregar {singular}</Button>
      </div>
      {notice && <Alert kind="success">{notice}</Alert>}
      {isPending ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState title="Aún no hay elementos" description={`Agrega el primer ${singular} para usarlo en tus ejercicios.`} />
        </div>
      ) : (
        <ul className="list" aria-label={`Lista de ${singular}`}>
          {items.map((item) => (
            <li key={item.id} className="list-item">
              <div className="list-item__main">
                <span className="list-item__title">
                  {item.nameEs}{' '}
                  {!item.isActive && <span className="badge badge--muted">Desactivado</span>}
                </span>
                <span className="list-item__meta">
                  {item.nameEn} · {item.exerciseCount === 1 ? '1 ejercicio' : `${item.exerciseCount} ejercicios`}
                </span>
              </div>
              <div className="list-item__actions">
                <Button variant="secondary" onClick={() => setEditing(item)}>
                  Editar
                </Button>
                <Button variant={item.isActive ? 'ghost' : 'secondary'} onClick={() => setToggling(item)}>
                  {item.isActive ? 'Desactivar' : 'Reactivar'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <CatalogItemModal
          kind={kind}
          singular={singular}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null)
            setNotice(`Se guardó «${name}».`)
          }}
        />
      )}
      {toggling && (
        <ConfirmDialog
          title={toggling.isActive ? `Desactivar ${singular}` : `Reactivar ${singular}`}
          message={
            toggling.isActive
              ? `«${toggling.nameEs}» dejará de aparecer al crear o filtrar ejercicios. Los ${toggling.exerciseCount} ejercicios que ya lo usan lo conservan.`
              : `«${toggling.nameEs}» volverá a estar disponible.`
          }
          confirmLabel={toggling.isActive ? 'Desactivar' : 'Reactivar'}
          danger={toggling.isActive}
          loading={toggle.isPending}
          onConfirm={() => toggle.mutate(toggling)}
          onCancel={() => setToggling(null)}
        />
      )}
      {toggle.error && <Alert kind="error">{toggle.error.message}</Alert>}
    </div>
  )
}

function CatalogItemModal({
  kind,
  singular,
  item,
  onClose,
  onSaved,
}: {
  kind: CatalogKind
  singular: string
  item: CatalogItem | null
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const qc = useQueryClient()
  const [nameEs, setNameEs] = useState(item?.nameEs ?? '')
  const [nameEn, setNameEn] = useState(item?.nameEn ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: async () => {
      if (item) await libraryApi.updateCatalogItem(kind, item.id, { nameEs, nameEn, isActive: item.isActive })
      else await libraryApi.createCatalogItem(kind, { nameEs, nameEn })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: libraryKeys.all })
      onSaved(nameEs.trim())
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v[0]])))
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!nameEs.trim()) next.nameEs = 'Escribe el nombre en español.'
    if (!nameEn.trim()) next.nameEn = 'Escribe el nombre en inglés.'
    setErrors(next)
    if (Object.keys(next).length === 0) save.mutate()
  }

  return (
    <Modal title={item ? `Editar ${singular}` : `Agregar ${singular}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {save.error && !Object.keys(errors).length && <Alert kind="error">{save.error.message}</Alert>}
        <TextField label="Nombre en español" required maxLength={100} value={nameEs} onChange={(e) => setNameEs(e.target.value)} error={errors.nameEs} />
        <TextField label="Nombre en inglés" required maxLength={100} value={nameEn} onChange={(e) => setNameEn(e.target.value)} error={errors.nameEn} />
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

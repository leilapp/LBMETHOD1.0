import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { libraryApi, type CatalogItem, type ExerciseDetail, type ExerciseInput, type LibraryCatalogs } from '../../api/library'
import { Alert, Button, ErrorState, LoadingState, PageHeader, SelectField, TextAreaField, TextField } from '../../components/ui'
import { libraryKeys, useCatalogs, useExercise } from './libraryQueries'
import './library.css'

/** Alta de un ejercicio nuevo. */
export function NewExercisePage() {
  return <ExerciseFormLoader />
}

/** Edición de un ejercicio existente. */
export function EditExercisePage() {
  const id = Number(useParams().id)
  return <ExerciseFormLoader id={id} />
}

function ExerciseFormLoader({ id }: { id?: number }) {
  const catalogs = useCatalogs()
  const exercise = useExercise(id)
  const waitingExercise = id !== undefined && exercise.isPending

  if (catalogs.isPending || waitingExercise) return <LoadingState />
  if (catalogs.error) return <ErrorState message={catalogs.error.message} onRetry={() => catalogs.refetch()} />
  if (id !== undefined && exercise.error) return <ErrorState message={exercise.error.message} onRetry={() => exercise.refetch()} />
  return <ExerciseForm catalogs={catalogs.data!} exercise={id !== undefined ? exercise.data : undefined} />
}

type Form = {
  nameEs: string
  nameEn: string
  description: string
  instructions: string
  commonMistakes: string
  technicalTips: string
  type: string
  difficulty: string
  movementPatternId: string
  primaryMuscleGroupId: string
  secondaryMuscleGroupIds: number[]
  equipmentIds: number[]
}

function initialForm(e?: ExerciseDetail): Form {
  return {
    nameEs: e?.nameEs ?? '',
    nameEn: e?.nameEn ?? '',
    description: e?.description ?? '',
    instructions: e?.instructions ?? '',
    commonMistakes: e?.commonMistakes ?? '',
    technicalTips: e?.technicalTips ?? '',
    type: e ? String(e.type) : '',
    difficulty: e?.difficulty ? String(e.difficulty) : '',
    movementPatternId: e?.movementPattern ? String(e.movementPattern.id) : '',
    primaryMuscleGroupId: e?.primaryMuscleGroup ? String(e.primaryMuscleGroup.id) : '',
    secondaryMuscleGroupIds: e?.secondaryMuscleGroups.map((m) => m.id) ?? [],
    equipmentIds: e?.equipment.map((m) => m.id) ?? [],
  }
}

function ExerciseForm({ catalogs, exercise }: { catalogs: LibraryCatalogs; exercise?: ExerciseDetail }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>(() => initialForm(exercise))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    // Al corregir un campo se quita su aviso de error.
    setErrors((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }
  const optional = (v: string) => (v.trim() ? v.trim() : null)

  // Se muestran los elementos activos y, al editar, también los que el ejercicio ya usa aunque estén desactivados.
  const visible = (items: CatalogItem[], selected: number[]) => items.filter((i) => i.isActive || selected.includes(i.id))

  const save = useMutation({
    mutationFn: (input: ExerciseInput) =>
      exercise ? libraryApi.updateExercise(exercise.id, input).then(() => exercise.id) : libraryApi.createExercise(input).then((r) => r.id),
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: libraryKeys.all })
      navigate(`/entrenadora/biblioteca/ejercicios/${id}`, { state: { notice: exercise ? 'Cambios guardados.' : 'Ejercicio creado.' } })
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v[0]])))
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!form.nameEs.trim()) next.nameEs = 'Escribe el nombre en español.'
    if (!form.primaryMuscleGroupId) next.primaryMuscleGroupId = 'Elige el grupo muscular principal.'
    if (!form.type) next.type = 'Elige el tipo de ejercicio.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const primary = Number(form.primaryMuscleGroupId)
    save.mutate({
      nameEs: form.nameEs.trim(),
      nameEn: optional(form.nameEn),
      description: optional(form.description),
      instructions: optional(form.instructions),
      commonMistakes: optional(form.commonMistakes),
      technicalTips: optional(form.technicalTips),
      type: Number(form.type),
      difficulty: form.difficulty ? Number(form.difficulty) : null,
      movementPatternId: form.movementPatternId ? Number(form.movementPatternId) : null,
      primaryMuscleGroupId: primary,
      secondaryMuscleGroupIds: form.secondaryMuscleGroupIds.filter((m) => m !== primary),
      equipmentIds: form.equipmentIds,
    })
  }

  const primaryId = Number(form.primaryMuscleGroupId) || 0
  const cancelTo = exercise ? `/entrenadora/biblioteca/ejercicios/${exercise.id}` : '/entrenadora/biblioteca'
  const hasFieldErrors = Object.keys(errors).length > 0

  return (
    <>
      <PageHeader
        title={exercise ? `Editar: ${exercise.nameEs}` : 'Nuevo ejercicio'}
        subtitle="Solo los datos del ejercicio. Series, repeticiones y cargas se definen después en cada rutina."
      />
      <form className="form exercise-form" onSubmit={submit} noValidate>
        {save.error && <Alert kind="error">{hasFieldErrors ? 'Revisa los campos marcados.' : save.error.message}</Alert>}

        <section className="card stack">
          <h2 className="card__title">Identificación</h2>
          <div className="form-grid">
            <TextField label="Nombre en español" required maxLength={150} value={form.nameEs} onChange={(e) => set('nameEs', e.target.value)} error={errors.nameEs} />
            <TextField label="Nombre en inglés" maxLength={150} value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} error={errors.nameEn} />
            <SelectField label="Tipo" required value={form.type} onChange={(e) => set('type', e.target.value)} error={errors.type}>
              <option value="">Elige…</option>
              {catalogs.types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SelectField>
            <SelectField label="Dificultad" value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)} hint="Opcional" error={errors.difficulty}>
              <option value="">Sin indicar</option>
              {catalogs.difficulties.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Patrón de movimiento"
              value={form.movementPatternId}
              onChange={(e) => set('movementPatternId', e.target.value)}
              hint={catalogs.movementPatterns.length === 0 ? 'Aún no hay patrones; puedes agregarlos en la pestaña Patrones.' : 'Opcional'}
              error={errors.movementPatternId}
            >
              <option value="">Sin indicar</option>
              {visible(catalogs.movementPatterns, [Number(form.movementPatternId)]).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameEs}
                </option>
              ))}
            </SelectField>
          </div>
          <TextAreaField label="Descripción" maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} error={errors.description} />
        </section>

        <section className="card stack">
          <h2 className="card__title">Músculos y equipamiento</h2>
          <SelectField
            label="Grupo muscular principal"
            required
            value={form.primaryMuscleGroupId}
            onChange={(e) => set('primaryMuscleGroupId', e.target.value)}
            error={errors.primaryMuscleGroupId}
          >
            <option value="">Elige…</option>
            {visible(catalogs.muscleGroups, [primaryId]).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameEs}
              </option>
            ))}
          </SelectField>
          <ChipGroup
            legend="Músculos secundarios"
            items={visible(catalogs.muscleGroups, form.secondaryMuscleGroupIds).filter((m) => m.id !== primaryId)}
            selected={form.secondaryMuscleGroupIds}
            onChange={(ids) => set('secondaryMuscleGroupIds', ids)}
            error={errors.secondaryMuscleGroupIds}
          />
          <ChipGroup
            legend="Equipamiento"
            items={visible(catalogs.equipment, form.equipmentIds)}
            selected={form.equipmentIds}
            onChange={(ids) => set('equipmentIds', ids)}
            empty="Aún no hay equipamiento; puedes agregarlo en la pestaña Equipamiento."
            error={errors.equipmentIds}
          />
        </section>

        <section className="card stack">
          <h2 className="card__title">Técnica</h2>
          <TextAreaField label="Instrucciones de ejecución" maxLength={4000} rows={6} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} error={errors.instructions} />
          <TextAreaField label="Errores frecuentes" maxLength={2000} value={form.commonMistakes} onChange={(e) => set('commonMistakes', e.target.value)} error={errors.commonMistakes} />
          <TextAreaField label="Consejos técnicos" maxLength={2000} value={form.technicalTips} onChange={(e) => set('technicalTips', e.target.value)} error={errors.technicalTips} />
          <p className="muted">Las imágenes, videos y variantes se agregan desde la ficha del ejercicio después de guardarlo.</p>
        </section>

        <div className="form__actions">
          <Link className="btn btn--secondary" to={cancelTo}>
            Cancelar
          </Link>
          <Button type="submit" loading={save.isPending}>
            {exercise ? 'Guardar cambios' : 'Crear ejercicio'}
          </Button>
        </div>
      </form>
    </>
  )
}

function ChipGroup({
  legend,
  items,
  selected,
  onChange,
  empty,
  error,
}: {
  legend: string
  items: CatalogItem[]
  selected: number[]
  onChange: (ids: number[]) => void
  empty?: string
  error?: string
}) {
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <fieldset className="chips">
      <legend className="field__label">{legend}</legend>
      {items.length === 0 ? (
        <p className="field__hint">{empty ?? 'No hay elementos disponibles.'}</p>
      ) : (
        <div className="chips__list">
          {items.map((i) => (
            <label key={i.id} className={`chip${selected.includes(i.id) ? ' chip--on' : ''}`}>
              <input type="checkbox" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} />
              {i.nameEs}
            </label>
          ))}
        </div>
      )}
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </fieldset>
  )
}

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, trainerSession } from './utils'
import { emptyExercise, summarize, toPayload, validate, type BuilderState } from '../features/routines/routineModel'
import type { DraftPayload, RoutineVersion } from '../api/routines'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const base = '/api/trainer/routines'
const me = { 'GET /api/auth/me': () => ({ status: 200, body: trainerSession }) }

const options = {
  setTypes: [
    { value: 1, label: 'Efectiva' },
    { value: 2, label: 'Calentamiento' },
    { value: 3, label: 'Dropset' },
  ],
  daysOfWeek: [
    { value: 1, label: 'Lunes' },
    { value: 4, label: 'Jueves' },
  ],
  weightUnits: [
    { value: 1, label: 'kg' },
    { value: 2, label: 'lb' },
  ],
}

const exercise = (id: number, position: number, name: string, extra: Record<string, unknown> = {}) => ({
  id: 100 + id,
  position,
  exerciseId: id,
  exerciseNameEs: name,
  exerciseNameEn: null,
  exerciseIsActive: true,
  primaryMuscleGroup: 'Glúteos',
  supersetGroup: null,
  sets: 4,
  repsMin: 8,
  repsMax: 12,
  suggestedWeight: null,
  suggestedWeightUnit: null,
  restSeconds: 90,
  tempo: null,
  rir: null,
  rpe: null,
  setType: 1,
  setTypeLabel: 'Efectiva',
  notes: null,
  setDetails: [],
  ...extra,
})

const draftVersion: RoutineVersion = {
  id: 7,
  routineId: 3,
  routineKind: 'Program',
  versionNumber: 1,
  status: 'Draft',
  title: 'Glúteo 6 semanas',
  description: null,
  goal: 'Hipertrofia',
  durationWeeks: 6,
  changeNotes: null,
  publishedAt: null,
  sourceVersionId: null,
  updatedAt: '2026-10-30T18:00:00Z',
  days: [
    {
      id: 50,
      position: 1,
      name: 'Día 1 - Glúteo',
      dayOfWeek: 1,
      dayLabel: 'Lunes',
      notes: null,
      exercises: [exercise(1, 1, 'Hip thrust'), exercise(2, 2, 'Sentadilla búlgara', { sets: 3, supersetGroup: 'A' }), exercise(3, 3, 'Abducción', { sets: 3, supersetGroup: 'A' })],
    },
  ],
}

const detail = {
  id: 3,
  kind: 'Program',
  name: 'Glúteo 6 semanas',
  status: 'Active',
  archivedAt: null,
  draftVersionId: 7,
  latestPublishedVersionId: null,
  versions: [{ id: 7, versionNumber: 1, status: 'Draft', title: 'Glúteo 6 semanas', publishedAt: null, changeNotes: null, updatedAt: '2026-10-30T18:00:00Z' }],
}

const builderRoutes = (extra: Record<string, (init: RequestInit | undefined) => { status: number; body?: unknown }> = {}) => ({
  ...me,
  [`GET ${base}/options`]: () => ({ status: 200, body: options }),
  [`POST ${base}/3/draft`]: () => ({ status: 200, body: { id: 7 } }),
  [`GET ${base}/3/versions/7`]: () => ({ status: 200, body: draftVersion }),
  [`GET ${base}/3`]: () => ({ status: 200, body: detail }),
  ...extra,
})

const bodyOf = (calls: { key: string; init?: RequestInit }[], key: string) => {
  const call = calls.find((c) => c.key === key)
  return call ? (JSON.parse(String(call.init?.body)) as DraftPayload) : undefined
}

describe('rutinas', () => {
  it('lista las rutinas reales con su estado de publicación', async () => {
    mockApi({
      ...me,
      [`GET ${base}?kind=program&status=active`]: () => ({
        status: 200,
        body: [
          { id: 3, kind: 'Program', name: 'Glúteo 6 semanas', status: 'Active', goal: 'Hipertrofia', publishedVersionNumber: 2, hasDraft: true, dayCount: 2, exerciseCount: 6, updatedAt: '2026-10-30T18:00:00Z' },
        ],
      }),
    })
    renderApp('/entrenadora/rutinas')
    const list = await screen.findByRole('list', { name: 'Rutinas' })
    expect(within(list).getByRole('link', { name: 'Glúteo 6 semanas' })).toHaveAttribute('href', '/entrenadora/rutinas/3')
    expect(screen.queryByText(/Pendiente · Fase/)).not.toBeInTheDocument()
  })

  it('el constructor guarda el orden elegido por la entrenadora', async () => {
    const calls = mockApi(builderRoutes({ [`PUT ${base}/3/draft`]: () => ({ status: 204 }) }))
    const user = userEvent.setup()
    renderApp('/entrenadora/rutinas/3/editar')

    const day = await screen.findByRole('region', { name: 'Día 1: Día 1 - Glúteo' })
    await user.click(within(day).getByRole('button', { name: 'Bajar Hip thrust' }))
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await screen.findByText('Borrador guardado.')

    const sent = bodyOf(calls, `PUT ${base}/3/draft`)!
    expect(sent.draftVersionId).toBe(7)
    expect(sent.days[0].exercises.map((e) => e.exerciseId)).toEqual([2, 1, 3])
    expect(sent.days[0].exercises[0].supersetGroup).toBe('A')
    expect(sent.days[0].dayOfWeek).toBe(1)
  })

  it('los ejercicios del día se pliegan y despliegan tocando su encabezado', async () => {
    mockApi(builderRoutes({}))
    const user = userEvent.setup()
    renderApp('/entrenadora/rutinas/3/editar')

    const day = await screen.findByRole('region', { name: 'Día 1: Día 1 - Glúteo' })
    expect(within(day).queryByRole('group', { name: 'Parámetros de Hip thrust' })).not.toBeInTheDocument()

    const head = within(day).getByRole('button', { name: 'Desplegar Hip thrust' })
    expect(head).toHaveAttribute('aria-expanded', 'false')
    await user.click(head)
    expect(within(day).getByRole('group', { name: 'Parámetros de Hip thrust' })).toBeInTheDocument()
    expect(within(day).getByRole('button', { name: 'Plegar Hip thrust' })).toHaveAttribute('aria-expanded', 'true')

    await user.click(within(day).getByRole('button', { name: 'Listo' }))
    expect(within(day).queryByRole('group', { name: 'Parámetros de Hip thrust' })).not.toBeInTheDocument()

    await user.click(within(day).getByRole('button', { name: /^Desplegar todos los ejercicios/ }))
    expect(within(day).getAllByRole('group', { name: /^Parámetros de / })).toHaveLength(3)
    await user.click(within(day).getByRole('button', { name: /^Plegar todos los ejercicios/ }))
    expect(within(day).queryAllByRole('group', { name: /^Parámetros de / })).toHaveLength(0)
  })

  it('un ejercicio recién agregado no trae valores inventados y exige las series', async () => {
    const calls = mockApi(
      builderRoutes({
        'GET /api/trainer/library/catalogs': () => ({ status: 200, body: { muscleGroups: [], equipment: [], movementPatterns: [], types: [], difficulties: [] } }),
        'GET /api/trainer/library/exercises?status=active&page=1': () => ({
          status: 200,
          body: { items: [{ id: 9, nameEs: 'Peso muerto rumano', nameEn: null, type: 1, typeLabel: 'Fuerza', primaryMuscleGroup: 'Femoral', equipment: [], movementPattern: null, isActive: true, isFavorite: false, thumbnailMediaId: null }], total: 1, page: 1, pageSize: 50 },
        }),
      }),
    )
    const user = userEvent.setup()
    renderApp('/entrenadora/rutinas/3/editar')

    const day = await screen.findByRole('region', { name: 'Día 1: Día 1 - Glúteo' })
    await user.click(within(day).getByRole('button', { name: '+ Agregar ejercicio' }))
    const picker = await screen.findByRole('dialog')
    await user.click(await within(picker).findByRole('button', { name: 'Agregar Peso muerto rumano' }))
    await user.click(within(picker).getByRole('button', { name: 'Listo' }))

    const params = within(day).getByRole('group', { name: 'Parámetros de Peso muerto rumano' })
    expect(within(params).getByLabelText(/^Series/)).toHaveValue('')
    expect(within(params).getByLabelText('Reps mín.')).toHaveValue('')
    expect(within(params).getByLabelText('Descanso (s)')).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(await within(params).findByText('Indica las series.')).toBeInTheDocument()
    expect(calls.some((c) => c.key === `PUT ${base}/3/draft`)).toBe(false)
  })

  it('publicar guarda el borrador y luego publica con las notas del cambio', async () => {
    const calls = mockApi(
      builderRoutes({
        [`PUT ${base}/3/draft`]: () => ({ status: 204 }),
        [`POST ${base}/3/publish`]: () => ({ status: 200, body: { id: 7 } }),
      }),
    )
    const user = userEvent.setup()
    renderApp('/entrenadora/rutinas/3/editar')

    await screen.findByRole('region', { name: 'Día 1: Día 1 - Glúteo' })
    await user.click(screen.getByRole('button', { name: 'Publicar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Publicar versión 1' })
    await user.type(within(dialog).getByLabelText('Notas del cambio'), 'Primera versión')
    await user.click(within(dialog).getByRole('button', { name: 'Publicar' }))

    await waitFor(() => expect(calls.some((c) => c.key === `POST ${base}/3/publish`)).toBe(true))
    const keys = calls.map((c) => c.key)
    expect(keys.indexOf(`PUT ${base}/3/draft`)).toBeLessThan(keys.indexOf(`POST ${base}/3/publish`))
    const publish = calls.find((c) => c.key === `POST ${base}/3/publish`)!
    expect(JSON.parse(String(publish.init?.body))).toEqual({ draftVersionId: 7, changeNotes: 'Primera versión' })
  })

  it('la vista previa muestra los días y agrupa la superserie', async () => {
    mockApi(builderRoutes())
    const user = userEvent.setup()
    renderApp('/entrenadora/rutinas/3/editar')

    await screen.findByRole('region', { name: 'Día 1: Día 1 - Glúteo' })
    await user.click(screen.getByRole('button', { name: 'Vista previa' }))
    const preview = await screen.findByRole('dialog', { name: 'Vista previa' })
    expect(within(preview).getByText('Día 1 - Glúteo')).toBeInTheDocument()
    expect(within(preview).getByText('Lunes')).toBeInTheDocument()
    expect(within(preview).getAllByText('Superserie A')).toHaveLength(2)
  })
})

describe('modelo del constructor', () => {
  const state = (exercises: BuilderState['days'][number]['exercises']): BuilderState => ({
    draftVersionId: 1,
    title: 'Rutina',
    description: '',
    goal: '',
    durationWeeks: '',
    days: [{ key: 'd1', name: 'Día 1', dayOfWeek: '', notes: '', exercises }],
  })

  it('no asigna parámetros por su cuenta', () => {
    const row = emptyExercise({ id: 1, nameEs: 'Hip thrust', nameEn: null, primaryMuscleGroup: null })
    expect([row.sets, row.repsMin, row.repsMax, row.weight, row.rest, row.tempo, row.rir, row.rpe]).toEqual(['', '', '', '', '', '', '', ''])
    expect(validate(state([row]))['days[0].exercises[0].sets']).toBe('Indica las series.')
  })

  it('valida rangos y deja opcionales los parámetros no obligatorios', () => {
    const row = { ...emptyExercise({ id: 1, nameEs: 'Hip thrust', nameEn: null, primaryMuscleGroup: null }), sets: '4' }
    expect(validate(state([row]))).toEqual({})
    const bad = { ...row, repsMin: '12', repsMax: '8', rir: '11', supersetGroup: 'A-1' }
    const errors = validate(state([bad]))
    expect(Object.keys(errors).sort()).toEqual(['days[0].exercises[0].repsMax', 'days[0].exercises[0].rir', 'days[0].exercises[0].supersetGroup'])
  })

  it('convierte los textos a números y vacíos a null al guardar', () => {
    const row = { ...emptyExercise({ id: 5, nameEs: 'Hip thrust', nameEn: null, primaryMuscleGroup: null }), sets: '4', repsMin: '8', repsMax: '12', weight: '60', unit: '1', supersetGroup: 'b' }
    const payload = toPayload(state([row]))
    expect(payload.days[0].exercises[0]).toMatchObject({ exerciseId: 5, sets: 4, repsMin: 8, repsMax: 12, suggestedWeight: 60, suggestedWeightUnit: 1, restSeconds: null, rir: null, supersetGroup: 'B' })
    expect(summarize({ sets: 4, repsMin: 8, repsMax: 12, weight: 60, rest: 90, tempo: '3-1-1-0', rir: 2, rpe: null })).toBe('4 × 8–12 · 60 kg · 90 s descanso · tempo 3-1-1-0 · RIR 2')
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clientSession, mockApi, renderApp } from './utils'
import { toDraft, toSessionPayload } from '../features/portal/portalModel'
import type { LoggedSet, PortalHome, PortalProgram, SessionDetail, SessionSummary } from '../api/portal'
import { todayInMexico } from '../lib/format'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const me = { 'GET /api/auth/me': () => ({ status: 200, body: clientSession }) }

const summary = (extra: Partial<SessionSummary> = {}): SessionSummary => ({
  id: 40,
  routineTitle: 'Glúteo 6 semanas',
  versionNumber: 2,
  dayName: 'Día A · Glúteo',
  status: 'Completed',
  startedAt: '2026-10-28T15:00:00Z',
  completedAt: '2026-10-28T16:00:00Z',
  exercisesCompleted: 2,
  exercisesTotal: 2,
  setsCompleted: 7,
  ...extra,
})

const home = (extra: Partial<PortalHome> = {}): PortalHome => ({
  inProgress: null,
  next: [{ assignmentId: 5, routineName: 'Glúteo 6 semanas', routineDayId: 21, dayName: 'Día B · Pierna', dayLabel: 'Miércoles' }],
  week: [{ date: todayInMexico(), label: 'Jueves', planned: ['Día B · Pierna'], sessions: [] }],
  last: summary(),
  ...extra,
})

const program: PortalProgram = {
  assignmentId: 5,
  routineName: 'Glúteo 6 semanas',
  versionNumber: 2,
  description: null,
  goal: 'Fuerza',
  durationWeeks: 6,
  startDate: '2026-10-01',
  endDate: null,
  status: 'Active',
  statusLabel: 'Vigente',
  notes: 'Calienta 10 minutos',
  days: [
    {
      id: 21,
      position: 1,
      name: 'Día A · Glúteo',
      dayLabel: 'Lunes',
      notes: null,
      exercises: [
        {
          id: 100, position: 1, exerciseId: 1, nameEs: 'Hip thrust', nameEn: null, supersetGroup: null, sets: 4, repsMin: 8, repsMax: 10,
          suggestedWeight: 60, weightUnit: 'kg', restSeconds: 90, tempo: '3-1-1', rir: 2, rpe: null, setTypeLabel: 'Efectiva',
          notes: 'Pausa arriba', instructions: 'Apoya la espalda en el banco.', technicalTips: null, setDetails: [], media: [],
        },
        {
          id: 101, position: 2, exerciseId: 2, nameEs: 'Peso muerto rumano', nameEn: null, supersetGroup: 'A', sets: 2, repsMin: null, repsMax: null,
          suggestedWeight: null, weightUnit: null, restSeconds: null, tempo: null, rir: null, rpe: null, setTypeLabel: 'Efectiva', notes: null,
          instructions: null, technicalTips: null, media: [],
          setDetails: [
            { setNumber: 1, setTypeLabel: 'Calentamiento', repsMin: 12, repsMax: 12, suggestedWeight: 20, weightUnit: 'kg', restSeconds: 60, rir: null, rpe: null, notes: null },
            { setNumber: 2, setTypeLabel: 'Efectiva', repsMin: 8, repsMax: 8, suggestedWeight: 40, weightUnit: 'kg', restSeconds: 120, rir: null, rpe: null, notes: null },
          ],
        },
      ],
    },
  ],
}

const loggedSet = (n: number, extra: Partial<LoggedSet> = {}): LoggedSet => ({
  setNumber: n, setTypeLabel: 'Efectiva', isPrescribed: true, prescribedRepsMin: 8, prescribedRepsMax: 10, prescribedWeight: 60, prescribedWeightUnit: 'kg',
  prescribedRestSeconds: 90, prescribedRir: 2, prescribedRpe: null, prescribedNotes: null, reps: null, weight: null, weightUnit: null, rir: null, rpe: null,
  isCompleted: false, notes: null, ...extra,
})

const session = (extra: Partial<SessionDetail> = {}): SessionDetail => ({
  id: 40,
  assignmentId: 5,
  routineTitle: 'Glúteo 6 semanas',
  versionNumber: 2,
  dayName: 'Día A · Glúteo',
  status: 'InProgress',
  startedAt: '2026-10-30T15:00:00Z',
  completedAt: null,
  comment: null,
  exercises: [
    {
      id: 300, position: 1, exerciseId: 1, nameEs: 'Hip thrust', nameEn: null, supersetGroup: null, prescribedSets: 2, prescribedRepsMin: 8, prescribedRepsMax: 10,
      prescribedWeight: 60, prescribedWeightUnit: 'kg', prescribedRestSeconds: 90, prescribedTempo: '3-1-1', prescribedRir: 2, prescribedRpe: null,
      prescribedNotes: 'Pausa arriba', isCompleted: false, comment: null, media: [], sets: [loggedSet(1), loggedSet(2)],
    },
  ],
  ...extra,
})

describe('inicio del portal', () => {
  it('muestra próximo entrenamiento, semana y último entrenamiento con datos reales, y empieza el día', async () => {
    const calls = mockApi({
      ...me,
      'GET /api/portal/home': () => ({ status: 200, body: home() }),
      'GET /api/portal/assignments': () => ({ status: 200, body: [] }),
      'POST /api/portal/sessions': () => ({ status: 201, body: { id: 41 } }),
      'GET /api/portal/sessions/41': () => ({ status: 200, body: session({ id: 41, dayName: 'Día B · Pierna' }) }),
    })
    const user = userEvent.setup()
    renderApp('/portal')
    const next = (await screen.findByRole('heading', { name: 'Próximo entrenamiento' })).closest('section')!
    expect(await within(next).findByText('Día B · Pierna')).toBeInTheDocument()
    const last = screen.getByRole('heading', { name: 'Último entrenamiento' }).closest('section')!
    expect(within(last).getByText('Día A · Glúteo')).toBeInTheDocument()
    expect(within(last).getByText(/2 de 2 ejercicios · 7 series/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Esta semana' }).closest('section')!.querySelector('[aria-current="date"]')).not.toBeNull()

    await user.click(within(next).getByRole('button', { name: 'Empezar Día B · Pierna' }))
    expect(await screen.findByRole('heading', { name: 'Día B · Pierna' })).toBeInTheDocument()
    const post = calls.find((c) => c.key === 'POST /api/portal/sessions')!
    expect(JSON.parse(String(post.init!.body))).toEqual({ assignmentId: 5, routineDayId: 21 })
  })

  it('con un entrenamiento en curso ofrece retomarlo en lugar de empezar otro', async () => {
    mockApi({
      ...me,
      'GET /api/portal/home': () => ({ status: 200, body: home({ inProgress: summary({ id: 42, status: 'InProgress', completedAt: null, exercisesCompleted: 1 }) }) }),
      'GET /api/portal/assignments': () => ({ status: 200, body: [] }),
    })
    renderApp('/portal')
    expect(await screen.findByRole('link', { name: 'Retomar entrenamiento' })).toHaveAttribute('href', '/portal/entrenamiento/42')
    expect(screen.queryByRole('button', { name: /Empezar/ })).not.toBeInTheDocument()
  })
})

describe('mi rutina', () => {
  it('muestra días y ejercicios en orden con series, descanso, tempo y notas, sin controles de edición', async () => {
    mockApi({
      ...me,
      'GET /api/portal/program': () => ({ status: 200, body: [program] }),
      'GET /api/portal/home': () => ({ status: 200, body: home() }),
    })
    const user = userEvent.setup()
    renderApp('/portal/rutina')
    await screen.findByText('Hip thrust')
    const items = screen.getAllByRole('listitem')
    const exercises = items.filter((li) => li.classList.contains('program-ex'))
    expect(exercises.map((li) => within(li).getByText(/Hip thrust|Peso muerto rumano/).textContent)).toEqual(['Hip thrust', expect.stringContaining('Peso muerto rumano')])
    expect(within(exercises[0]).getByText('4 × 8–10 · 60 kg · 90 s descanso · tempo 3-1-1 · RIR 2')).toBeInTheDocument()
    expect(within(exercises[0]).getByText('Pausa arriba')).toBeInTheDocument()
    expect(within(exercises[1]).getByText('Serie 1 · Calentamiento · 12 reps · 20 kg · 60 s descanso')).toBeInTheDocument()
    expect(within(exercises[1]).getByText('Superserie A')).toBeInTheDocument()
    expect(screen.getByText('Calienta 10 minutos')).toBeInTheDocument()

    await user.click(within(exercises[0]).getByRole('button', { name: 'Cómo hacerlo' }))
    expect(within(exercises[0]).getByText('Apoya la espalda en el banco.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Empezar Día A · Glúteo' })).toBeInTheDocument()
  })
})

describe('registro del entrenamiento', () => {
  it('guarda series reales, unidad, ejercicio completado y comentario, y finaliza', async () => {
    const saves: unknown[] = []
    const calls = mockApi({
      ...me,
      'GET /api/portal/sessions/40': () => ({ status: 200, body: session() }),
      'PUT /api/portal/sessions/40': (init) => {
        saves.push(JSON.parse(String(init!.body)))
        return { status: 204 }
      },
      'POST /api/portal/sessions/40/finish': () => ({ status: 204 }),
      'GET /api/portal/home': () => ({ status: 200, body: home() }),
      'GET /api/portal/assignments': () => ({ status: 200, body: [] }),
    })
    const user = userEvent.setup()
    renderApp('/portal/entrenamiento/40')
    const reps1 = await screen.findByLabelText('Repeticiones de la serie 1 de Hip thrust')
    expect(reps1).toHaveValue('')
    expect(reps1).toHaveAttribute('placeholder', '10')
    await user.type(reps1, '9')
    await user.type(screen.getByLabelText('Peso de la serie 1 de Hip thrust'), '62,5')
    await user.click(screen.getByRole('button', { name: /Unidad de la serie 2 de Hip thrust: kg/ }))
    await user.type(screen.getByLabelText('Peso de la serie 2 de Hip thrust'), '135')
    await user.click(screen.getByRole('button', { name: 'Serie 1 de Hip thrust hecha' }))
    await user.click(screen.getByRole('button', { name: '+ Serie extra' }))
    await user.type(screen.getByLabelText('Repeticiones de la serie 3 de Hip thrust'), '6')
    await user.click(screen.getByRole('checkbox', { name: 'Ejercicio completado' }))
    await user.type(screen.getByLabelText('Comentario del entrenamiento'), 'Bien')

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(saves.length).toBeGreaterThan(0))
    expect(saves.at(-1)).toEqual({
      comment: 'Bien',
      exercises: [
        {
          id: 300,
          isCompleted: true,
          comment: null,
          sets: [
            { setNumber: 1, reps: 9, weight: 62.5, weightUnit: 1, rir: null, rpe: null, isCompleted: true, notes: null },
            { setNumber: 2, reps: null, weight: 135, weightUnit: 2, rir: null, rpe: null, isCompleted: false, notes: null },
            { setNumber: 3, reps: 6, weight: null, weightUnit: null, rir: null, rpe: null, isCompleted: false, notes: null },
          ],
        },
      ],
    })
    expect(await screen.findByText(/Guardado/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Finalizar' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('¡Completaste todos los ejercicios!')
    await user.click(within(dialog).getByRole('button', { name: 'Finalizar' }))
    expect(await screen.findByRole('heading', { name: /Hola, Ana Cliente/ })).toBeInTheDocument()
    expect(calls.some((c) => c.key === 'POST /api/portal/sessions/40/finish')).toBe(true)
  })

  it('un entrenamiento finalizado se muestra de solo lectura', async () => {
    mockApi({
      ...me,
      'GET /api/portal/sessions/40': () => ({
        status: 200,
        body: session({ status: 'Completed', completedAt: '2026-10-30T16:00:00Z', exercises: [{ ...session().exercises[0], isCompleted: true, sets: [loggedSet(1, { reps: 9, weight: 62.5, weightUnit: 1, isCompleted: true })] }] }),
      }),
    })
    renderApp('/portal/entrenamiento/40')
    expect(await screen.findByLabelText('Repeticiones de la serie 1 de Hip thrust')).toHaveValue('9')
    expect(screen.getByLabelText('Peso de la serie 1 de Hip thrust')).toBeDisabled()
    expect(screen.getByText(/Entrenamiento finalizado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finalizar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Serie extra' })).not.toBeInTheDocument()
  })

  it('al retomar conserva lo registrado y la unidad usada', () => {
    const d = toDraft(session({ exercises: [{ ...session().exercises[0], sets: [loggedSet(1, { reps: 8, weight: 100, weightUnit: 2 }), loggedSet(2)] }] }))
    expect(d.exercises[0].sets.map((s) => [s.reps, s.weight, s.unit])).toEqual([
      ['8', '100', 2],
      ['', '', 1],
    ])
    const payload = toSessionPayload(d)
    expect(payload.exercises[0].sets[0]).toMatchObject({ reps: 8, weight: 100, weightUnit: 2 })
    expect(payload.exercises[0].sets[1]).toMatchObject({ reps: null, weight: null, weightUnit: null })
  })
})

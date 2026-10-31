import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clientSession, mockApi, renderApp, trainerSession } from './utils'
import { formFrom, toProfilePayload } from '../features/clients/clientModel'
import type { ClientDetail } from '../api/clients'
import { addDays, todayInMexico } from '../lib/format'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const base = '/api/trainer/clients'
const me = { 'GET /api/auth/me': () => ({ status: 200, body: trainerSession }) }

const detail: ClientDetail = {
  id: 10,
  firstName: 'Mariana',
  lastName: 'López',
  email: 'mariana@test.local',
  phone: '+52 473 123 4567',
  birthDate: '1994-05-12',
  height: 165.5,
  heightUnit: 1,
  weight: 62.3,
  weightUnit: 1,
  experienceLevel: 2,
  experienceLabel: 'Intermedio',
  goal: 'Fuerza en glúteo',
  trainingLocation: 1,
  trainingLocationLabel: 'Gimnasio',
  availableDays: 1 | 4 | 16,
  availableDayNames: ['Lunes', 'Miércoles', 'Viernes'],
  sessionDurationMinutes: 60,
  declaredLimitations: 'Rodilla izquierda',
  status: 'Active',
  hasAccount: true,
  registeredAt: '2026-10-01T15:00:00Z',
  deactivatedAt: null,
}

const assignment = (id: number, status: string, statusLabel: string, extra: Record<string, unknown> = {}) => ({
  id,
  clientId: 10,
  clientName: 'Mariana López',
  routineId: 3,
  routineName: 'Glúteo 6 semanas',
  routineVersionId: 7,
  versionNumber: 1,
  latestVersionNumber: 1,
  latestVersionId: 7,
  startDate: '2026-10-01',
  endDate: null,
  status,
  statusLabel,
  notes: null,
  createdAt: '2026-10-01T15:00:00Z',
  ...extra,
})

const detailRoutes = (extra: Record<string, (init: RequestInit | undefined) => { status: number; body?: unknown }> = {}) => ({
  ...me,
  [`GET ${base}/10/profile`]: () => ({ status: 200, body: detail }),
  [`GET ${base}/10/notes`]: () => ({ status: 200, body: [{ id: 1, content: 'Revisar técnica de bisagra', createdAt: '2026-10-02T15:00:00Z' }] }),
  [`GET ${base}/10/assignments`]: () => ({
    status: 200,
    body: [
      assignment(2, 'Active', 'Vigente', { latestVersionNumber: 2, latestVersionId: 8, notes: 'Calienta antes' }),
      assignment(1, 'Completed', 'Terminada', { routineName: 'Base 4 semanas', startDate: '2026-08-01', endDate: '2026-08-28' }),
    ],
  }),
  ...extra,
})

describe('clientes', () => {
  it('la lista enlaza a cada ficha, muestra el programa vigente y filtra', async () => {
    mockApi({
      ...me,
      [`GET ${base}`]: () => ({
        status: 200,
        body: [
          { id: 10, firstName: 'Mariana', lastName: 'López', email: 'm@t', status: 'Active', hasAccount: true, currentProgram: 'Glúteo 6 semanas', registeredAt: null },
          { id: 11, firstName: 'Sofía', lastName: 'Ruiz', email: 's@t', status: 'Active', hasAccount: true, currentProgram: null, registeredAt: null },
          { id: 12, firstName: 'Bea', lastName: 'Inactiva', email: 'b@t', status: 'Inactive', hasAccount: true, currentProgram: null, registeredAt: null },
        ],
      }),
    })
    const user = userEvent.setup()
    renderApp('/entrenadora/clientes')

    const list = await screen.findByRole('list', { name: 'Lista de clientes' })
    expect(within(list).getByRole('link', { name: 'Mariana López' })).toHaveAttribute('href', '/entrenadora/clientes/10')
    expect(within(list).getByText('Glúteo 6 semanas')).toBeInTheDocument()
    expect(within(list).getByText('Sin rutina vigente')).toBeInTheDocument()
    expect(within(list).queryByText(/Bea/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Inactivos' }))
    expect(within(screen.getByRole('list', { name: 'Lista de clientes' })).getAllByRole('listitem')).toHaveLength(1)
    await user.click(screen.getByRole('tab', { name: 'Todos' }))
    await user.type(screen.getByLabelText('Buscar cliente'), 'sofía')
    expect(within(screen.getByRole('list', { name: 'Lista de clientes' })).getAllByRole('listitem')).toHaveLength(1)
  })

  it('la ficha muestra perfil, programa actual, historial y observaciones privadas', async () => {
    mockApi(detailRoutes())
    renderApp('/entrenadora/clientes/10')

    expect(await screen.findByRole('heading', { name: 'Mariana López' })).toBeInTheDocument()
    const current = await screen.findByRole('list', { name: 'Programa actual' })
    expect(within(current).getByText('Vigente')).toBeInTheDocument()
    expect(within(current).getByText(/Hay una versión más nueva \(versión 2\)/)).toBeInTheDocument()
    expect(within(current).getByRole('button', { name: 'Cambiar a versión 2' })).toBeInTheDocument()
    expect(within(current).getByText('Indicaciones: Calienta antes')).toBeInTheDocument()
    const past = screen.getByRole('list', { name: 'Programas anteriores' })
    expect(within(past).getByText('Base 4 semanas')).toBeInTheDocument()
    expect(within(past).getByText('Terminada')).toBeInTheDocument()
    expect(screen.getByText('165.5 cm')).toBeInTheDocument()
    expect(screen.getByText('Lunes, Miércoles, Viernes')).toBeInTheDocument()
    expect(await screen.findByText('Revisar técnica de bisagra')).toBeInTheDocument()
    expect(screen.getByText('Solo tú las ves. El cliente nunca tiene acceso a ellas.')).toBeInTheDocument()
  })

  it('asignar envía la versión elegida, las fechas y solo aplica la fecha de fin sugerida si se pide', async () => {
    const today = todayInMexico()
    const calls = mockApi(
      detailRoutes({
        [`GET ${base}/10/assignments`]: () => ({ status: 200, body: [] }),
        'GET /api/trainer/routines?kind=program&status=active': () => ({
          status: 200,
          body: [
            { id: 3, kind: 'Program', name: 'Glúteo 6 semanas', status: 'Active', goal: null, publishedVersionNumber: 2, hasDraft: false, dayCount: 1, exerciseCount: 1, updatedAt: '' },
            { id: 4, kind: 'Program', name: 'Sin publicar', status: 'Active', goal: null, publishedVersionNumber: null, hasDraft: true, dayCount: 0, exerciseCount: 0, updatedAt: '' },
          ],
        }),
        'GET /api/trainer/routines/3': () => ({
          status: 200,
          body: {
            id: 3, kind: 'Program', name: 'Glúteo 6 semanas', status: 'Active', archivedAt: null, draftVersionId: null, latestPublishedVersionId: 8,
            versions: [
              { id: 8, versionNumber: 2, status: 'Published', title: 'Glúteo 6 semanas', publishedAt: '', changeNotes: null, updatedAt: '' },
              { id: 7, versionNumber: 1, status: 'Published', title: 'Glúteo 6 semanas', publishedAt: '', changeNotes: null, updatedAt: '' },
            ],
          },
        }),
        'GET /api/trainer/routines/3/versions/8': () => ({ status: 200, body: { id: 8, durationWeeks: 6, days: [] } }),
        'POST /api/trainer/assignments': () => ({ status: 201, body: { ids: [99] } }),
      }),
    )
    const user = userEvent.setup()
    renderApp('/entrenadora/clientes/10')

    await user.click(await screen.findByRole('button', { name: 'Asignar rutina existente' }))
    const dialog = await screen.findByRole('dialog', { name: 'Asignar rutina a Mariana' })
    const routineSelect = within(dialog).getByLabelText(/^Rutina/)
    await waitFor(() => expect(within(routineSelect).getAllByRole('option')).toHaveLength(2))
    expect(within(routineSelect).queryByRole('option', { name: 'Sin publicar' })).not.toBeInTheDocument()
    await user.selectOptions(routineSelect, '3')
    expect(await within(dialog).findByRole('option', { name: 'Versión 2 (la más reciente)' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^Fecha de inicio/)).toHaveValue(today)
    expect(within(dialog).getByLabelText(/^Fecha de fin/)).toHaveValue('')
    await user.click(await within(dialog).findByRole('button', { name: 'Usar esa fecha' }))
    await user.type(within(dialog).getByLabelText('Indicaciones para el cliente'), 'Calienta antes')
    await user.click(within(dialog).getByRole('button', { name: 'Asignar' }))

    await screen.findByText('Rutina asignada a Mariana.')
    const sent = JSON.parse(String(calls.find((c) => c.key === 'POST /api/trainer/assignments')!.init?.body))
    expect(sent).toEqual({ clientIds: [10], routineVersionId: 8, startDate: today, endDate: addDays(today, 41), notes: 'Calienta antes' })
  })

  it('desde la ficha crea una rutina personalizada para el cliente y abre el constructor ligado a él', async () => {
    const calls = mockApi(
      detailRoutes({
        [`GET ${base}/10/assignments`]: () => ({ status: 200, body: [] }),
        'GET /api/trainer/routines?kind=template&status=active': () => ({ status: 200, body: [] }),
        'POST /api/trainer/routines': () => ({ status: 201, body: { id: 77 } }),
        'POST /api/trainer/routines/77/draft': () => ({ status: 200, body: { id: 5 } }),
      }),
    )
    const user = userEvent.setup()
    renderApp('/entrenadora/clientes/10')

    await user.click(await screen.findByRole('button', { name: 'Crear rutina para Mariana' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nueva rutina para Mariana' })
    expect(within(dialog).getByLabelText(/^Nombre/)).toHaveValue('Rutina de Mariana López')
    await user.type(within(dialog).getByLabelText('Objetivo'), 'Glúteo y postura')
    await user.click(within(dialog).getByRole('button', { name: 'Crear y abrir constructor' }))

    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/trainer/routines/77/draft')).toBe(true))
    const sent = JSON.parse(String(calls.find((c) => c.key === 'POST /api/trainer/routines')!.init?.body))
    expect(sent).toEqual({ kind: 1, title: 'Rutina de Mariana López', goal: 'Glúteo y postura', description: null, durationWeeks: null })
    expect(calls.filter((c) => c.key.startsWith('POST /api/trainer/assignments'))).toHaveLength(0)
  })

  it('terminar pide el último día y lo envía', async () => {
    const calls = mockApi(detailRoutes({ 'POST /api/trainer/assignments/2/end-date': () => ({ status: 204 }) }))
    const user = userEvent.setup()
    renderApp('/entrenadora/clientes/10')

    const current = await screen.findByRole('list', { name: 'Programa actual' })
    await user.click(within(current).getByRole('button', { name: 'Terminar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Terminar programa' })
    expect(within(dialog).getByLabelText(/^Último día/)).toHaveValue(todayInMexico())
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await screen.findByText(/Se terminó «Glúteo 6 semanas»/)
    expect(JSON.parse(String(calls.find((c) => c.key === 'POST /api/trainer/assignments/2/end-date')!.init?.body))).toEqual({ endDate: todayInMexico() })
  })

  it('el formulario de perfil convierte los datos y respeta los opcionales vacíos', () => {
    const form = formFrom({ ...detail, height: null, weight: null, phone: null, experienceLevel: null })
    expect(toProfilePayload({ ...form, sessionDurationMinutes: '45', weight: '70,5', goal: '  ' })).toEqual({
      firstName: 'Mariana',
      lastName: 'López',
      email: 'mariana@test.local',
      phone: null,
      birthDate: '1994-05-12',
      height: null,
      heightUnit: null,
      weight: 70.5,
      weightUnit: 1,
      experienceLevel: null,
      goal: null,
      trainingLocation: 1,
      availableDays: 21,
      sessionDurationMinutes: 45,
      declaredLimitations: 'Rodilla izquierda',
    })
  })
})

describe('portal del cliente', () => {
  it('muestra la rutina vigente real y el historial, sin lo cancelado', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: clientSession }),
      'GET /api/portal/assignments': () => ({
        status: 200,
        body: [
          { id: 2, routineName: 'Glúteo 6 semanas', versionNumber: 2, startDate: '2026-10-01', endDate: null, status: 'Active', statusLabel: 'Vigente', notes: 'Calienta antes' },
          { id: 1, routineName: 'Base 4 semanas', versionNumber: 1, startDate: '2026-08-01', endDate: '2026-08-28', status: 'Completed', statusLabel: 'Terminada', notes: null },
        ],
      }),
    })
    renderApp('/portal')
    const card = (await screen.findByRole('heading', { name: 'Rutina vigente' })).closest('section')!
    expect(await within(card).findByText('Glúteo 6 semanas')).toBeInTheDocument()
    expect(within(card).getByText('Calienta antes')).toBeInTheDocument()
    expect(within(card).queryByText('Base 4 semanas')).not.toBeInTheDocument()
  })
})

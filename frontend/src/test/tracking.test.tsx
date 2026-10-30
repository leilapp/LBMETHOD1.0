import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clientSession, mockApi, renderApp, trainerSession } from './utils'
import { mondayOf, monthGrid, toNumber } from '../features/tracking/trackingModel'
import type { CalendarItem, Evaluation, MeasurementType, Progress } from '../api/tracking'
import type { ClientDetail } from '../api/clients'
import { todayInMexico } from '../lib/format'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const weeks = Array.from({ length: 12 }, (_, i) => ({ weekStart: `2026-08-${String(10 + i).padStart(2, '0')}`, completed: i === 11 ? 2 : 0 }))

const progress: Progress = {
  measurements: [
    {
      measurementTypeId: 1, name: 'Peso corporal', kind: 'BodyWeight', unit: 'kg',
      points: [
        { measurementId: 1, date: '2026-09-01', value: 70, evaluationId: 10, notes: null },
        { measurementId: 3, date: '2026-10-01', value: 68.5, evaluationId: 11, notes: null },
      ],
    },
    { measurementTypeId: 2, name: 'Cintura', kind: 'Circumference', unit: 'cm', points: [{ measurementId: 2, date: '2026-09-01', value: 74, evaluationId: 10, notes: null }] },
  ],
  exercises: [
    {
      exerciseId: 5, name: 'Hip thrust', unit: 'kg', hasConvertedValues: true,
      points: [
        { date: '2026-10-20', sessionId: 40, weight: 60, reps: 10, volume: 1800, setsLogged: 3, converted: false, originalWeight: 60, originalUnit: 'kg' },
        { date: '2026-10-27', sessionId: 41, weight: 63.5, reps: 8, volume: 1524, setsLogged: 3, converted: true, originalWeight: 140, originalUnit: 'lb' },
      ],
    },
  ],
  frequency: { completed: 2, inProgress: 1, firstSession: '2026-10-20', lastSession: '2026-10-27', weeks },
}

const evaluations: Evaluation[] = [
  {
    id: 11, evaluatedOn: '2026-10-01', notes: 'Buen avance', createdAt: '2026-10-01T16:00:00Z', photos: [],
    measurements: [{ id: 3, measurementTypeId: 1, name: 'Peso corporal', kind: 'BodyWeight', value: 68.5, unit: 'kg', notes: null }],
  },
  {
    id: 10, evaluatedOn: '2026-09-01', notes: null, createdAt: '2026-09-01T16:00:00Z', photos: [],
    measurements: [
      { id: 1, measurementTypeId: 1, name: 'Peso corporal', kind: 'BodyWeight', value: 70, unit: 'kg', notes: null },
      { id: 2, measurementTypeId: 2, name: 'Cintura', kind: 'Circumference', value: 74, unit: 'cm', notes: null },
    ],
  },
]

const photos = [{ id: 7, takenOn: '2026-10-01', category: 1, categoryLabel: 'Frente', evaluationId: 11, notes: null, url: '/api/portal/photos/7/content' }]

describe('progreso del cliente', () => {
  it('muestra datos reales, compara evaluaciones sin estimar y separa peso corporal de cargas', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: clientSession }),
      'GET /api/portal/progress': () => ({ status: 200, body: progress }),
      'GET /api/portal/evaluations': () => ({ status: 200, body: evaluations }),
      'GET /api/portal/photos': () => ({ status: 200, body: photos }),
    })
    renderApp('/portal/progreso')
    expect(await screen.findByText('Entrenamientos finalizados')).toBeInTheDocument()
    expect(screen.getByText(/No tiene relación con la carga de los ejercicios/)).toBeInTheDocument()
    expect(screen.getByText(/1 sin terminar \(no se cuentan\)/)).toBeInTheDocument()

    // Comparación: la cintura solo se midió el 1 de septiembre → «Sin dato», nunca un valor inventado.
    const table = screen.getByRole('table', { name: 'Comparación de evaluaciones' })
    const cintura = within(table).getByRole('rowheader', { name: 'Cintura' }).closest('tr')!
    expect(within(cintura).getByText('74 cm')).toBeInTheDocument()
    expect(within(cintura).getByText('Sin dato')).toBeInTheDocument()
    const peso = within(table).getByRole('rowheader', { name: 'Peso corporal' }).closest('tr')!
    expect(peso).toHaveTextContent('−1.5 kg')

    // Cargas convertidas: se avisa y la tabla conserva el valor original.
    expect(screen.getByText(/se convirtieron \(1 lb = 0.4536 kg\)/)).toBeInTheDocument()
    const user = userEvent.setup()
    const cargas = screen.getByRole('region', { name: 'Cargas por ejercicio' })
    await user.click(within(cargas).getByRole('button', { name: 'Ver tabla' }))
    expect(within(cargas).getByText(/140 lb/)).toBeInTheDocument()

    // Fotos privadas servidas por la API, con fecha y categoría.
    expect(screen.getByRole('img', { name: /Foto de progreso \(Frente\)/ })).toHaveAttribute('src', '/api/portal/photos/7/content')
  })

  it('sin registros muestra estados vacíos en lugar de gráficas', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: clientSession }),
      'GET /api/portal/progress': () => ({
        status: 200,
        body: { measurements: [], exercises: [], frequency: { completed: 0, inProgress: 0, firstSession: null, lastSession: null, weeks } },
      }),
      'GET /api/portal/evaluations': () => ({ status: 200, body: [] }),
      'GET /api/portal/photos': () => ({ status: 200, body: [] }),
    })
    renderApp('/portal/progreso')
    expect(await screen.findByText('Sin registros de peso corporal.')).toBeInTheDocument()
    expect(screen.getByText('Sin medidas registradas.')).toBeInTheDocument()
    expect(screen.getByText('Aún no hay entrenamientos registrados')).toBeInTheDocument()
    expect(screen.getByText('Sin fotos de progreso.')).toBeInTheDocument()
    expect(screen.getAllByText('Sin registros')).toHaveLength(2)
    expect(screen.queryByRole('img', { name: /registros, último/ })).not.toBeInTheDocument()
  })
})

const types: MeasurementType[] = [
  { id: 1, nameEs: 'Peso corporal', nameEn: 'Body weight', kind: 1, kindLabel: 'Peso corporal', unit: 'kg', sortOrder: 1, isActive: true, measurementCount: 2 },
  { id: 2, nameEs: 'Cintura', nameEn: 'Waist', kind: 2, kindLabel: 'Perímetro', unit: 'cm', sortOrder: 2, isActive: true, measurementCount: 1 },
  { id: 3, nameEs: 'Brazo', nameEn: 'Arm', kind: 2, kindLabel: 'Perímetro', unit: 'cm', sortOrder: 3, isActive: false, measurementCount: 0 },
]

const profile = { id: 4, firstName: 'Ana', lastName: 'López', email: 'ana@t', status: 'Active', hasAccount: true } as ClientDetail

describe('evaluaciones (entrenadora)', () => {
  it('envía solo las medidas escritas y muestra el error de la API en su campo', async () => {
    let attempt = 0
    const calls = mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: trainerSession }),
      'GET /api/trainer/clients/4/profile': () => ({ status: 200, body: profile }),
      'GET /api/trainer/clients/4/progress': () => ({ status: 200, body: progress }),
      'GET /api/trainer/clients/4/evaluations': () => ({ status: 200, body: evaluations }),
      'GET /api/trainer/clients/4/photos': () => ({ status: 200, body: [] }),
      'GET /api/trainer/clients/4/sessions': () => ({ status: 200, body: [] }),
      'GET /api/trainer/measurement-types': () => ({ status: 200, body: types }),
      'POST /api/trainer/clients/4/evaluations': () =>
        ++attempt === 1
          ? { status: 400, body: { title: 'Datos inválidos', errors: { 'measurements[0].value': ['El valor debe estar entre 1 y 300 cm.'] } } }
          : { status: 201, body: { id: 12 } },
    })
    renderApp('/entrenadora/clientes/4/seguimiento')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Nueva evaluación' }))
    const dialog = await screen.findByRole('dialog')
    // Las medidas inactivas no se ofrecen.
    expect(within(dialog).queryByLabelText(/Brazo/)).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Cintura (cm)'), '7400')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar evaluación' }))
    expect(await within(dialog).findByText('El valor debe estar entre 1 y 300 cm.')).toBeInTheDocument()

    const field = within(dialog).getByLabelText('Cintura (cm)')
    await user.clear(field)
    await user.type(field, '73,5')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar evaluación' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const posts = calls.filter((c) => c.key === 'POST /api/trainer/clients/4/evaluations')
    expect(posts).toHaveLength(2)
    expect(JSON.parse(String(posts[1].init?.body))).toEqual({
      evaluatedOn: todayInMexico(),
      notes: null,
      measurements: [{ measurementTypeId: 2, value: 73.5, notes: null }],
    })
  })
})

describe('calendario', () => {
  it('la vista semanal del cliente muestra cada tipo con texto, no solo con color', async () => {
    const today = todayInMexico()
    const from = mondayOf(today)
    const end = new Date(`${from}T12:00:00Z`)
    end.setUTCDate(end.getUTCDate() + 6)
    const to = end.toISOString().slice(0, 10)
    const item = (extra: Partial<CalendarItem>): CalendarItem => ({
      kind: 'planned', date: today, title: '', detail: null, status: 'planned', clientId: null, clientName: null,
      eventId: null, sessionId: null, evaluationId: null, startTime: null, endTime: null, notes: null, ...extra,
    })
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: clientSession }),
      [`GET /api/portal/calendar?from=${from}&to=${to}`]: () => ({
        status: 200,
        body: [
          item({ kind: 'planned', title: 'Día A · Glúteo', detail: 'Glúteo 6 semanas' }),
          item({ kind: 'evaluation', title: 'Evaluación mensual', eventId: 3, startTime: '09:30:00' }),
          item({ kind: 'session', title: 'Día B · Pierna', status: 'completed', sessionId: 41 }),
        ],
      }),
    })
    renderApp('/portal/calendario')
    expect(await screen.findByText('Día A · Glúteo')).toBeInTheDocument()
    expect(screen.getByText('09:30 · Evaluación mensual')).toBeInTheDocument()
    const session = screen.getByText('Día B · Pierna').closest('li')!
    expect(session).toHaveTextContent('Entrenamiento registrado')
    expect(session).toHaveTextContent('Hecho')
    // El cliente no puede editar eventos: no hay botones sobre los elementos.
    expect(screen.queryByRole('button', { name: /Evaluación mensual/ })).not.toBeInTheDocument()
  })

  it('arma la cuadrícula del mes de lunes a domingo', () => {
    const days = monthGrid(2026, 10) // noviembre de 2026
    expect(days[0]).toBe('2026-10-26')
    expect(days[days.length - 1]).toBe('2026-12-06')
    expect(days.length % 7).toBe(0)
    expect(mondayOf('2026-11-01')).toBe('2026-10-26')
  })

  it('acepta coma decimal y deja vacío como «sin dato»', () => {
    expect(toNumber('68,5')).toBe(68.5)
    expect(toNumber('  ')).toBeNull()
  })
})

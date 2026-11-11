import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderApp, trainerSession } from './utils'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const base = '/api/trainer/library'

const catalogs = {
  muscleGroups: [
    { id: 1, nameEs: 'Glúteos', nameEn: 'Glutes', isActive: true, exerciseCount: 1 },
    { id: 2, nameEs: 'Femoral', nameEn: 'Hamstrings', isActive: true, exerciseCount: 0 },
    { id: 3, nameEs: 'Cuádriceps', nameEn: 'Quadriceps', isActive: false, exerciseCount: 0 },
  ],
  equipment: [{ id: 5, nameEs: 'Barra', nameEn: 'Barbell', isActive: true, exerciseCount: 1 }],
  movementPatterns: [{ id: 7, nameEs: 'Bisagra de cadera', nameEn: 'Hip hinge', isActive: true, exerciseCount: 0 }],
  types: [
    { value: 1, label: 'Fuerza' },
    { value: 2, label: 'Movilidad' },
  ],
  difficulties: [{ value: 1, label: 'Principiante' }],
}

const hipThrust = {
  id: 42,
  nameEs: 'Hip thrust con barra',
  nameEn: 'Barbell hip thrust',
  type: 1,
  typeLabel: 'Fuerza',
  primaryMuscleGroup: 'Glúteos',
  equipment: ['Barra'],
  movementPattern: null,
  isActive: true,
  isFavorite: false,
  thumbnailMediaId: null,
}

const detail = {
  id: 42,
  nameEs: 'Hip thrust con barra',
  nameEn: 'Barbell hip thrust',
  description: null,
  instructions: 'Apoya la espalda alta en el banco.',
  commonMistakes: null,
  technicalTips: null,
  type: 1,
  typeLabel: 'Fuerza',
  difficulty: null,
  difficultyLabel: null,
  movementPattern: null,
  primaryMuscleGroup: { id: 1, nameEs: 'Glúteos', nameEn: 'Glutes' },
  secondaryMuscleGroups: [],
  equipment: [{ id: 5, nameEs: 'Barra', nameEn: 'Barbell' }],
  isActive: true,
  deactivatedAt: null,
  isFavorite: false,
  variants: [],
  media: [],
}

const me = { 'GET /api/auth/me': () => ({ status: 200, body: trainerSession }) }
const paged = (items: unknown[]) => ({ status: 200, body: { items, total: items.length, page: 1, pageSize: 50 } })

describe('biblioteca de ejercicios', () => {
  it('lista los ejercicios reales y filtra por grupo muscular', async () => {
    const calls = mockApi({
      ...me,
      [`GET ${base}/catalogs`]: () => ({ status: 200, body: catalogs }),
      [`GET ${base}/exercises?status=active&page=1`]: () => paged([hipThrust]),
      [`GET ${base}/exercises?status=active&page=1&muscleGroupId=2`]: () => paged([]),
    })
    renderApp('/entrenadora/biblioteca')

    const list = await screen.findByRole('list', { name: 'Ejercicios' })
    expect(within(list).getByRole('link', { name: /Hip thrust con barra/ })).toHaveAttribute('href', '/entrenadora/biblioteca/ejercicios/42')
    // Fila compacta: nombre y, debajo, músculo principal y equipo.
    expect(within(list).getByText('Glúteos · Barra')).toBeInTheDocument()

    // Los grupos desactivados no se ofrecen como filtro.
    const muscle = screen.getByLabelText('Grupo muscular')
    expect(within(muscle).queryByRole('option', { name: 'Cuádriceps' })).not.toBeInTheDocument()
    await userEvent.selectOptions(muscle, '2')
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument()
    expect(calls.some((c) => c.key.includes('muscleGroupId=2'))).toBe(true)
  })

  it('con la biblioteca vacía invita a crear o importar, sin inventar ejercicios', async () => {
    mockApi({
      ...me,
      [`GET ${base}/catalogs`]: () => ({ status: 200, body: catalogs }),
      [`GET ${base}/exercises?status=active&page=1`]: () => paged([]),
    })
    renderApp('/entrenadora/biblioteca')
    expect(await screen.findByText('Tu biblioteca está vacía')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Importar desde Excel' })).toHaveAttribute('href', '/entrenadora/biblioteca/importar')
  })

  it('el formulario exige los datos obligatorios y envía lo que decide la entrenadora', async () => {
    let sent: Record<string, unknown> | null = null
    mockApi({
      ...me,
      [`GET ${base}/catalogs`]: () => ({ status: 200, body: catalogs }),
      [`POST ${base}/exercises`]: (init) => {
        sent = JSON.parse(String(init!.body))
        return { status: 201, body: { id: 42 } }
      },
      [`GET ${base}/exercises/42`]: () => ({ status: 200, body: detail }),
    })
    renderApp('/entrenadora/biblioteca/nuevo')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Crear ejercicio' }))
    expect(screen.getByText('Escribe el nombre en español.')).toBeInTheDocument()
    expect(screen.getByText('Elige el grupo muscular principal.')).toBeInTheDocument()
    expect(screen.getByText('Elige el tipo de ejercicio.')).toBeInTheDocument()
    expect(sent).toBeNull()

    await user.type(screen.getByLabelText(/Nombre en español/), 'Hip thrust con barra')
    await user.type(screen.getByLabelText(/Nombre en inglés/), 'Barbell hip thrust')
    await user.selectOptions(screen.getByLabelText(/^Tipo/), '1')
    await user.selectOptions(screen.getByLabelText(/Grupo muscular principal/), '1')
    await user.click(screen.getByRole('checkbox', { name: 'Femoral' }))
    await user.click(screen.getByRole('checkbox', { name: 'Barra' }))
    await user.click(screen.getByRole('button', { name: 'Crear ejercicio' }))

    expect(await screen.findByText('Ejercicio creado.')).toBeInTheDocument()
    expect(sent).toMatchObject({
      nameEs: 'Hip thrust con barra',
      nameEn: 'Barbell hip thrust',
      type: 1,
      difficulty: null,
      movementPatternId: null,
      primaryMuscleGroupId: 1,
      secondaryMuscleGroupIds: [2],
      equipmentIds: [5],
    })
  })

  it('muestra el error de duplicado que devuelve el servidor', async () => {
    mockApi({
      ...me,
      [`GET ${base}/catalogs`]: () => ({ status: 200, body: catalogs }),
      [`POST ${base}/exercises`]: () => ({
        status: 409,
        body: { detail: 'Ya existe un ejercicio con ese nombre (puede estar desactivado).', errors: { nameEs: ['Ya existe un ejercicio con ese nombre (puede estar desactivado).'] } },
      }),
    })
    renderApp('/entrenadora/biblioteca/nuevo')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Nombre en español/), 'hip thrust con barra')
    await user.selectOptions(screen.getByLabelText(/^Tipo/), '1')
    await user.selectOptions(screen.getByLabelText(/Grupo muscular principal/), '1')
    await user.click(screen.getByRole('button', { name: 'Crear ejercicio' }))
    expect(await screen.findByText('Ya existe un ejercicio con ese nombre (puede estar desactivado).')).toBeInTheDocument()
  })

  it('desactivar pide confirmación y explica que no afecta rutinas', async () => {
    const calls = mockApi({
      ...me,
      [`GET ${base}/exercises/42`]: () => ({ status: 200, body: detail }),
      [`POST ${base}/exercises/42/status`]: () => ({ status: 204 }),
    })
    renderApp('/entrenadora/biblioteca/ejercicios/42')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Desactivar' }))
    const dialog = screen.getByRole('dialog', { name: 'Desactivar ejercicio' })
    expect(dialog).toHaveTextContent('las rutinas e historial que ya lo usan no cambian')
    await user.click(within(dialog).getByRole('button', { name: 'Desactivar' }))
    await waitFor(() => expect(calls.find((c) => c.key === `POST ${base}/exercises/42/status`)?.init?.body).toBe('{"active":false}'))
  })

  it('no permite subir archivos de un formato no válido', async () => {
    const calls = mockApi({ ...me, [`GET ${base}/exercises/42`]: () => ({ status: 200, body: detail }) })
    renderApp('/entrenadora/biblioteca/ejercicios/42')
    const user = userEvent.setup({ applyAccept: false })
    await user.click(await screen.findByRole('button', { name: 'Subir archivo' }))
    await user.upload(screen.getByLabelText(/Archivo/), new File(['hola'], 'notas.txt', { type: 'text/plain' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Formato no permitido')
    await user.click(screen.getByRole('button', { name: 'Subir' }))
    expect(calls.some((c) => c.key.includes('/media'))).toBe(false)
  })

  it('la importación muestra la vista previa por fila y el reporte de rechazadas', async () => {
    mockApi({
      ...me,
      [`POST ${base}/exercises/import/preview`]: () => ({
        status: 200,
        body: {
          rows: [
            { rowNumber: 2, nameEs: 'Puente de glúteo', nameEn: null, status: 1, messages: [] },
            { rowNumber: 3, nameEs: 'Hip thrust con barra', nameEn: null, status: 2, messages: ['Ya existe en la biblioteca.'] },
            { rowNumber: 4, nameEs: 'Curl', nameEn: null, status: 3, messages: ['Grupo principal "Antebrazo" no existe en el catálogo.'] },
          ],
          valid: 1,
          duplicates: 1,
          errors: 1,
        },
      }),
      [`POST ${base}/exercises/import/commit`]: () => ({
        status: 200,
        body: {
          created: 1,
          rejected: [{ rowNumber: 4, nameEs: 'Curl', nameEn: null, status: 3, messages: ['Grupo principal "Antebrazo" no existe en el catálogo.'] }],
        },
      }),
    })
    renderApp('/entrenadora/biblioteca/importar')
    const user = userEvent.setup()
    await user.upload(await screen.findByLabelText(/Archivo de Excel/), new File(['x'], 'ejercicios.xlsx'))
    await user.click(screen.getByRole('button', { name: 'Revisar archivo' }))

    const table = await screen.findByRole('table', { name: 'Vista previa por fila' })
    expect(within(table).getByText('Duplicada')).toBeInTheDocument()
    expect(within(table).getByText(/Antebrazo/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Importar 1 ejercicio válido' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Importar' }))
    expect(await screen.findByText(/Se importó 1 ejercicio\. 1 fila fue rechazada\./)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Filas rechazadas' })).toBeInTheDocument()
  })
})

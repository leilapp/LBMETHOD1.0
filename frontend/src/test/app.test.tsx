import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../api/client'
import { passwordProblems } from '../lib/validation'
import { formatDate } from '../lib/format'
import { clientSession, mockApi, renderApp, trainerSession } from './utils'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('reglas y formato', () => {
  it('valida la contraseña igual que la API', () => {
    expect(passwordProblems('corta')).toMatch(/10 caracteres/)
    expect(passwordProblems('sinmayuscula1')).toMatch(/mayúscula/)
    expect(passwordProblems('SINMINUSCULA1')).toMatch(/minúscula/)
    expect(passwordProblems('SinNumeroAqui')).toMatch(/número/)
    expect(passwordProblems('Valida2026Ok')).toBeNull()
  })

  it('muestra fechas de calendario sin desfase de zona horaria', () => {
    expect(formatDate('2026-11-01')).toBe('1 de noviembre de 2026')
  })
})

describe('cliente HTTP', () => {
  it('envía el token CSRF en operaciones que modifican datos y lo renueva una vez si venció', async () => {
    let attempts = 0
    const calls = mockApi({
      'POST /api/x': (init) => {
        attempts++
        const token = (init?.headers as Record<string, string>)['X-CSRF-TOKEN']
        return attempts === 1
          ? { status: 400, body: { detail: 'Falta o no es válido el token de seguridad (CSRF).' } }
          : { status: 200, body: { ok: token } }
      },
    })
    const result = await api.post<{ ok: string }>('/api/x', {})
    expect(result.ok).toBe('tok-1')
    expect(calls.filter((c) => c.key === 'GET /api/auth/csrf')).toHaveLength(2)
  })

  it('traduce errores de la API a mensajes en español', async () => {
    mockApi({ 'GET /api/y': () => ({ status: 403 }) })
    await expect(api.get('/api/y')).rejects.toThrow('No tienes permiso para realizar esta acción.')
  })
})

describe('inicio de sesión', () => {
  it('sin sesión redirige al inicio de sesión', async () => {
    mockApi({ 'GET /api/auth/me': () => ({ status: 401 }) })
    renderApp('/entrenadora/clientes')
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('muestra el error de la API y limpia la contraseña', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 401 }),
      'POST /api/auth/login': () => ({ status: 401, body: { detail: 'Correo o contraseña incorrectos.' } }),
    })
    renderApp('/iniciar-sesion')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Correo electrónico/), 'a@b.com')
    await user.type(screen.getByLabelText(/Contraseña/), 'mala')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.')
    expect(screen.getByLabelText(/Contraseña/)).toHaveValue('')
  })

  it('con contraseña temporal obliga a cambiarla', async () => {
    mockApi({ 'GET /api/auth/me': () => ({ status: 200, body: { ...clientSession, mustChangePassword: true } }) })
    renderApp('/portal')
    expect(await screen.findByRole('heading', { name: 'Crea tu contraseña' })).toBeInTheDocument()
  })
})

describe('experiencias separadas por rol', () => {
  it('un cliente que intenta entrar al área de entrenadora vuelve a su portal', async () => {
    mockApi({ 'GET /api/auth/me': () => ({ status: 200, body: clientSession }) })
    renderApp('/entrenadora/clientes')
    expect(await screen.findByRole('heading', { name: /Hola, Ana Cliente/ })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(nav).getByRole('link', { name: /Mi rutina/ })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: /Clientes/ })).not.toBeInTheDocument()
  })

  it('la entrenadora ve su menú completo y los módulos futuros marcados como pendientes', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: trainerSession }),
      'GET /api/trainer/clients': () => ({ status: 200, body: [] }),
    })
    renderApp('/entrenadora/biblioteca')
    const nav = await screen.findByRole('navigation', { name: 'Navegación principal' })
    for (const label of ['Inicio', 'Clientes', 'Biblioteca', 'Rutinas', 'Plantillas', 'Calendario', 'Seguimiento', 'Configuración'])
      expect(within(nav).getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
    expect(screen.getByText('Pendiente · Fase 5')).toBeInTheDocument()
  })

  it('el inicio de la entrenadora usa datos reales y no inventa indicadores', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: trainerSession }),
      'GET /api/trainer/clients': () => ({
        status: 200,
        body: [
          { id: 1, firstName: 'A', lastName: 'Uno', email: 'a@t', status: 'Active', hasAccount: true },
          { id: 2, firstName: 'B', lastName: 'Dos', email: 'b@t', status: 'Inactive', hasAccount: true },
        ],
      }),
    })
    renderApp('/entrenadora')
    expect(await screen.findByText('Clientes activos')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getAllByText(/Pendiente · Fase/)).toHaveLength(3)
  })
})

describe('clientes', () => {
  it('muestra estado vacío cuando no hay clientes', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: trainerSession }),
      'GET /api/trainer/clients': () => ({ status: 200, body: [] }),
    })
    renderApp('/entrenadora/clientes')
    expect(await screen.findByText('Aún no tienes clientes')).toBeInTheDocument()
  })

  it('muestra un error con opción de reintentar si la API falla', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: trainerSession }),
      'GET /api/trainer/clients': () => ({ status: 403 }),
    })
    renderApp('/entrenadora/clientes')
    expect(await screen.findByText('No se pudo cargar la información')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('pide confirmación antes de desactivar y no llama a la API si se cancela', async () => {
    const calls = mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: trainerSession }),
      'GET /api/trainer/clients': () => ({
        status: 200,
        body: [{ id: 7, firstName: 'Ana', lastName: 'López', email: 'ana@t', status: 'Active', hasAccount: true }],
      }),
    })
    renderApp('/entrenadora/clientes')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Desactivar' }))
    const dialog = screen.getByRole('dialog', { name: 'Desactivar cliente' })
    expect(dialog).toHaveTextContent('No se borra ningún dato')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(calls.some((c) => c.key.includes('/access'))).toBe(false)
  })

  it('valida el formulario de nuevo cliente y muestra la contraseña temporal al crearlo', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: trainerSession }),
      'GET /api/trainer/clients': () => ({ status: 200, body: [] }),
      'POST /api/trainer/clients': () => ({ status: 201, body: { clientId: 9, temporaryPassword: 'Tmp9xYzAb2CdEf' } }),
    })
    renderApp('/entrenadora/clientes')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Nuevo cliente' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo cliente' })
    await user.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))
    expect(within(dialog).getByText('Escribe el nombre.')).toBeInTheDocument()
    expect(within(dialog).getByText('Escribe un correo válido.')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/Nombre/), 'Ana')
    await user.type(within(dialog).getByLabelText(/Apellidos/), 'López')
    await user.type(within(dialog).getByLabelText(/Correo electrónico/), 'ana@test.local')
    await user.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))
    await waitFor(() => expect(screen.getByTestId('temporary-password')).toHaveTextContent('Tmp9xYzAb2CdEf'))
  })
})

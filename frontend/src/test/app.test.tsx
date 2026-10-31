import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../api/client'
import { passwordProblems } from '../lib/validation'
import { formatDate } from '../lib/format'
import { listenForInstall } from '../lib/install'
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
        const token = (init!.headers as Record<string, string>)['X-CSRF-TOKEN']
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
  it('ofrece instalar la app cuando el navegador lo permite, y la instala al pulsar', async () => {
    listenForInstall()
    mockApi({ 'GET /api/auth/me': () => ({ status: 401 }) })
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    expect(screen.queryByRole('button', { name: /Instalar la app/ })).not.toBeInTheDocument()
    const prompt = vi.fn(async () => undefined)
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    await userEvent.click(await screen.findByRole('button', { name: /Instalar la app/ }))
    expect(prompt).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Instalar la app/ })).not.toBeInTheDocument())
  })

  it('en un teléfono Android ofrece descargar la APK; dentro de la app ya instalada, no', async () => {
    mockApi({ 'GET /api/auth/me': () => ({ status: 401 }) })
    const ua = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130 Mobile')
    renderApp('/login')
    const link = await screen.findByRole('link', { name: 'Descargar app para Android (APK)' })
    expect(link).toHaveAttribute('href', '/descargar/lbmethod.apk')
    cleanup()
    ua.mockReturnValue('Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130 Mobile LBMETHODAndroid/1.0')
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    expect(screen.queryByRole('link', { name: /Descargar app/ })).not.toBeInTheDocument()
    ua.mockRestore()
  })

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

  it('la entrenadora ve su menú completo, ya sin módulos pendientes', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: trainerSession }),
      'GET /api/trainer/clients': () => ({ status: 200, body: [] }),
    })
    renderApp('/entrenadora/calendario')
    const nav = await screen.findByRole('navigation', { name: 'Navegación principal' })
    for (const label of ['Inicio', 'Clientes', 'Biblioteca', 'Rutinas', 'Plantillas', 'Calendario', 'Seguimiento', 'Configuración'])
      expect(within(nav).getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Calendario' })).toBeInTheDocument()
    // Con la Fase 9 ya no queda ningún módulo marcado como pendiente.
    expect(nav).not.toHaveTextContent(/Fase/)
    expect(screen.queryByText(/Pendiente · Fase/)).not.toBeInTheDocument()
  })

  it('el inicio de la entrenadora usa datos reales y no inventa indicadores', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: trainerSession }),
      'GET /api/trainer/clients': () => ({
        status: 200,
        body: [
          { id: 1, firstName: 'A', lastName: 'Uno', email: 'a@t', status: 'Active', hasAccount: true, currentProgram: 'Glúteo 6 semanas' },
          { id: 2, firstName: 'B', lastName: 'Dos', email: 'b@t', status: 'Inactive', hasAccount: true, currentProgram: null },
          { id: 3, firstName: 'C', lastName: 'Tres', email: 'c@t', status: 'Active', hasAccount: true, currentProgram: null },
        ],
      }),
      'GET /api/trainer/dashboard': () => ({
        status: 200,
        body: {
          upcomingEvaluations: [{ eventId: 4, clientId: 1, clientName: 'A Uno', date: '2026-11-03', startTime: '09:30:00', title: 'Evaluación' }],
          recentActivity: [
            { kind: 'session', clientId: 3, clientName: 'C Tres', occurredAt: '2026-10-29T18:00:00Z', title: 'Día 1', detail: null, sessionId: 9, evaluationId: null },
          ],
        },
      }),
    })
    renderApp('/entrenadora')
    expect(await screen.findByText('Clientes activos')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Clientes con programa vigente').previousElementSibling).toHaveTextContent('1')
    expect(screen.getByText('1 activos sin rutina asignada')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'A Uno' })).toHaveAttribute('href', '/entrenadora/clientes/1/seguimiento')
    expect(screen.getByText(/09:30/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'C Tres' })).toHaveAttribute('href', '/entrenadora/clientes/3/entrenamientos/9')
    expect(screen.getByText(/terminó «Día 1»/)).toBeInTheDocument()
    expect(screen.queryByText(/Pendiente · Fase/)).not.toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Crear su rutina' })).toBeInTheDocument()
  })
})

describe('estilo app de Android', () => {
  it('barra inferior con los cuatro accesos principales y «Más» con todas las secciones', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: trainerSession }),
      'GET /api/trainer/clients': () => ({ status: 200, body: [] }),
    })
    renderApp('/entrenadora/calendario')
    const bar = await screen.findByRole('navigation', { name: 'Accesos rápidos' })
    expect(within(bar).getAllByRole('link').map((a) => a.textContent)).toEqual(['Inicio', 'Clientes', 'Biblioteca', 'Rutinas'])
    const more = within(bar).getByRole('button', { name: 'Más' })
    // Calendario no está en la barra: «Más» se marca como activo.
    expect(more).toHaveClass('active')
    await user.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('shell-nav')).toHaveClass('shell__sidebar--open')
  })

  it('el avatar muestra tus iniciales y abre tu cuenta con el tema y cerrar sesión', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: { ...clientSession, displayName: 'Ana (prueba) Cliente' } }),
      'GET /api/portal/home': () => ({ status: 200, body: { inProgress: null, next: [], week: [], last: null } }),
      'GET /api/portal/assignments': () => ({ status: 200, body: [] }),
    })
    renderApp('/portal')
    const open = await screen.findByRole('button', { name: 'Abrir menú de tu cuenta' })
    expect(open).toHaveTextContent('AC')
    await user.click(open)
    const sheet = screen.getByRole('dialog', { name: 'Tu cuenta' })
    expect(within(sheet).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(within(sheet).getByRole('group', { name: 'Tema de la app' })).toBeInTheDocument()
  })

  it('el tema sigue al sistema y se puede fijar en claro u oscuro', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /api/auth/me': () => ({ status: 200, body: trainerSession }),
      'GET /api/trainer/clients': () => ({ status: 200, body: [] }),
    })
    renderApp('/entrenadora/calendario')
    await screen.findByRole('navigation', { name: 'Navegación principal' })
    expect(document.documentElement).not.toHaveAttribute('data-theme')
    await user.click(screen.getAllByRole('button', { name: 'Claro' })[0])
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem('lb-theme')).toBe('light')
    await user.click(screen.getAllByRole('button', { name: 'Oscuro' })[0])
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await user.click(screen.getAllByRole('button', { name: 'Automático' })[0])
    expect(document.documentElement).not.toHaveAttribute('data-theme')
    expect(localStorage.getItem('lb-theme')).toBeNull()
  })
})

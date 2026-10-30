import { render } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AppRoutes } from '../app/App'
import { createQueryClient } from '../app/queryClient'
import { resetCsrfToken } from '../api/client'

type Handler = (init: RequestInit | undefined) => { status: number; body?: unknown }

/** Simula la API: cada ruta "MÉTODO /ruta" responde lo indicado. Registra todas las llamadas. */
export function mockApi(routes: Record<string, Handler>) {
  resetCsrfToken()
  const calls: { key: string; init?: RequestInit }[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`
    calls.push({ key, init })
    const handler = routes[key] ?? (key === 'GET /api/auth/csrf' ? () => ({ status: 200, body: { token: 'tok-1' } }) : undefined)
    if (!handler) return new Response(null, { status: 404 })
    const { status, body } = handler(init)
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

export function renderApp(path: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

export const trainerSession = {
  userId: 1,
  displayName: 'Leilani',
  email: 'leilani@lbmethod.local',
  role: 'TRAINER',
  mustChangePassword: false,
  clientId: null,
}

export const clientSession = {
  userId: 2,
  displayName: 'Ana Cliente',
  email: 'ana@test.local',
  role: 'CLIENT',
  mustChangePassword: false,
  clientId: 10,
}

import { api, resetCsrfToken } from './client'

export type Role = 'TRAINER' | 'CLIENT'

export interface Session {
  userId: number
  displayName: string
  email: string
  role: Role
  mustChangePassword: boolean
  clientId: number | null
}

export interface ClientSummary {
  id: number
  firstName: string
  lastName: string
  email: string
  status: 'Active' | 'Inactive'
  hasAccount: boolean
}

export interface ClientProfile {
  id: number
  firstName: string
  lastName: string
  email: string
  phone: string | null
  birthDate: string | null
  goal: string | null
  declaredLimitations: string | null
}

export interface TemporaryPassword {
  clientId: number
  temporaryPassword: string
}

export interface NewClient {
  firstName: string
  lastName: string
  email: string
  phone?: string
}

export const authApi = {
  me: () => api.get<Session>('/api/auth/me'),
  async login(email: string, password: string) {
    resetCsrfToken()
    const session = await api.post<Session>('/api/auth/login', { email, password })
    resetCsrfToken()
    return session
  },
  async logout() {
    await api.post<void>('/api/auth/logout')
    resetCsrfToken()
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>('/api/auth/change-password', { currentPassword, newPassword }),
}

export const trainerApi = {
  clients: () => api.get<ClientSummary[]>('/api/trainer/clients'),
  createClient: (data: NewClient) =>
    api.post<TemporaryPassword>('/api/trainer/clients', { ...data, phone: data.phone || null }),
  resetPassword: (clientId: number) => api.post<TemporaryPassword>(`/api/trainer/clients/${clientId}/reset-password`),
  setAccess: (clientId: number, enabled: boolean) => api.post<void>(`/api/trainer/clients/${clientId}/access`, { enabled }),
}

export const portalApi = {
  profile: () => api.get<ClientProfile>('/api/portal/profile'),
}

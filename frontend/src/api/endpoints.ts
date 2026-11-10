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
  currentProgram: string | null
  registeredAt: string | null
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
  height: number | null
  heightUnit: string | null
  weight: number | null
  weightUnit: string | null
  experience: string | null
  trainingLocation: string | null
  availableDays: string[]
  sessionDurationMinutes: number | null
  registeredAt: string | null
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
  /** «Olvidé mi contraseña»: la entrenadora usa un código de recuperación; los clientes, a su entrenadora. */
  recoveryCheck: (email: string) => api.post<{ method: 'recovery-code' | 'ask-trainer' }>('/api/auth/recovery/check', { email }),
  async recoveryReset(email: string, code: string, newPassword: string) {
    const result = await api.post<{ remainingCodes: number }>('/api/auth/recovery/reset', { email, code, newPassword })
    resetCsrfToken()
    return result
  },
}

export interface RecoveryCodesStatus {
  total: number
  remaining: number
  generatedAt: string | null
}

export const trainerApi = {
  clients: () => api.get<ClientSummary[]>('/api/trainer/clients'),
  createClient: (data: NewClient) =>
    api.post<TemporaryPassword>('/api/trainer/clients', { ...data, phone: data.phone || null }),
  resetPassword: (clientId: number) => api.post<TemporaryPassword>(`/api/trainer/clients/${clientId}/reset-password`),
  setAccess: (clientId: number, enabled: boolean) => api.post<void>(`/api/trainer/clients/${clientId}/access`, { enabled }),
  recoveryCodes: () => api.get<RecoveryCodesStatus>('/api/trainer/recovery-codes'),
  generateRecoveryCodes: (currentPassword: string) =>
    api.post<{ codes: string[]; generatedAt: string }>('/api/trainer/recovery-codes', { currentPassword }),
}

export interface PortalAssignment {
  id: number
  routineName: string
  versionNumber: number
  startDate: string
  endDate: string | null
  status: AssignmentStatus
  statusLabel: string
  notes: string | null
}

export type AssignmentStatus = 'Scheduled' | 'Active' | 'Completed' | 'Cancelled' | 'Replaced'

export const portalApi = {
  profile: () => api.get<ClientProfile>('/api/portal/profile'),
  assignments: () => api.get<PortalAssignment[]>('/api/portal/assignments'),
}

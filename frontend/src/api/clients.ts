import { api } from './client'
import type { AssignmentStatus } from './endpoints'
import type { Option } from './library'

const clients = '/api/trainer/clients'
const assignments = '/api/trainer/assignments'

export interface ClientDetail {
  id: number
  firstName: string
  lastName: string
  email: string
  phone: string | null
  birthDate: string | null
  height: number | null
  heightUnit: number | null
  weight: number | null
  weightUnit: number | null
  experienceLevel: number | null
  experienceLabel: string | null
  goal: string | null
  trainingLocation: number | null
  trainingLocationLabel: string | null
  availableDays: number
  availableDayNames: string[]
  sessionDurationMinutes: number | null
  declaredLimitations: string | null
  status: 'Active' | 'Inactive'
  hasAccount: boolean
  registeredAt: string
  deactivatedAt: string | null
}

export interface ProfilePayload {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  birthDate: string | null
  height: number | null
  heightUnit: number | null
  weight: number | null
  weightUnit: number | null
  experienceLevel: number | null
  goal: string | null
  trainingLocation: number | null
  availableDays: number
  sessionDurationMinutes: number | null
  declaredLimitations: string | null
}

export interface ClientNote {
  id: number
  content: string
  createdAt: string
}

export interface ClientOptions {
  experienceLevels: Option[]
  trainingLocations: Option[]
  days: Option[]
  weightUnits: Option[]
  lengthUnits: Option[]
}

export interface Assignment {
  id: number
  clientId: number
  clientName: string
  routineId: number
  routineName: string
  routineVersionId: number
  versionNumber: number
  latestVersionNumber: number | null
  latestVersionId: number | null
  startDate: string
  endDate: string | null
  status: AssignmentStatus
  statusLabel: string
  notes: string | null
  createdAt: string
}

export interface AssignmentPayload {
  clientIds: number[]
  routineVersionId: number
  startDate: string
  endDate: string | null
  notes: string | null
}

export const clientsApi = {
  options: () => api.get<ClientOptions>(`${clients}/options`),
  profile: (id: number) => api.get<ClientDetail>(`${clients}/${id}/profile`),
  updateProfile: (id: number, data: ProfilePayload) => api.put<void>(`${clients}/${id}/profile`, data),
  notes: (id: number) => api.get<ClientNote[]>(`${clients}/${id}/notes`),
  addNote: (id: number, content: string) => api.post<{ id: number }>(`${clients}/${id}/notes`, { content }),
  assignments: (id: number) => api.get<Assignment[]>(`${clients}/${id}/assignments`),
  routineAssignments: (routineId: number) => api.get<Assignment[]>(`/api/trainer/routines/${routineId}/assignments`),
  assign: (data: AssignmentPayload) => api.post<{ ids: number[] }>(assignments, data),
  setEndDate: (id: number, endDate: string) => api.post<void>(`${assignments}/${id}/end-date`, { endDate }),
  cancel: (id: number) => api.post<void>(`${assignments}/${id}/cancel`),
}

/** Asignaciones que cuentan como programa actual: vigentes o por empezar. */
export const isCurrent = (a: { status: AssignmentStatus }) => a.status === 'Active' || a.status === 'Scheduled'

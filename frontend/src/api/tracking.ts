import { api } from './client'
import type { SessionDetail, SessionSummary } from './portal'

export interface MeasurementType {
  id: number
  nameEs: string
  nameEn: string
  kind: number
  kindLabel: string
  unit: string
  sortOrder: number
  isActive: boolean
  measurementCount: number
}

export interface KindOption {
  value: number
  label: string
  units: string[]
}

export interface Option {
  value: number
  label: string
}

export interface TrackingOptions {
  kinds: KindOption[]
  photoCategories: Option[]
  eventTypes: Option[]
}

export interface Measurement {
  id: number
  measurementTypeId: number
  name: string
  kind: string
  value: number
  unit: string
  notes: string | null
}

export interface Photo {
  id: number
  takenOn: string
  category: number | null
  categoryLabel: string | null
  evaluationId: number | null
  notes: string | null
  url: string
}

export interface Evaluation {
  id: number
  evaluatedOn: string
  notes: string | null
  createdAt: string
  measurements: Measurement[]
  photos: Photo[]
}

export interface MeasurementPoint {
  measurementId: number
  date: string
  value: number
  evaluationId: number | null
  notes: string | null
}

export interface MeasurementSeries {
  measurementTypeId: number
  name: string
  kind: string
  unit: string
  points: MeasurementPoint[]
}

export interface LoadPoint {
  date: string
  sessionId: number
  weight: number
  reps: number
  volume: number
  setsLogged: number
  converted: boolean
  originalWeight: number
  originalUnit: string
}

export interface ExerciseProgress {
  exerciseId: number
  name: string
  unit: string
  hasConvertedValues: boolean
  points: LoadPoint[]
}

export interface WeekCount {
  weekStart: string
  completed: number
}

export interface Progress {
  measurements: MeasurementSeries[]
  exercises: ExerciseProgress[]
  frequency: { completed: number; inProgress: number; firstSession: string | null; lastSession: string | null; weeks: WeekCount[] }
}

export type CalendarKind = 'planned' | 'rest' | 'session' | 'evaluation' | 'training' | 'other' | 'program-start' | 'program-end'

export interface CalendarItem {
  kind: CalendarKind
  date: string
  title: string
  detail: string | null
  status: 'planned' | 'completed' | 'cancelled' | 'in-progress'
  clientId: number | null
  clientName: string | null
  eventId: number | null
  sessionId: number | null
  evaluationId: number | null
  startTime: string | null
  endTime: string | null
  notes: string | null
}

export interface TrackingClient {
  clientId: number
  name: string
  status: string
  currentProgram: string | null
  lastEvaluation: string | null
  nextEvaluation: string | null
  lastSession: string | null
  sessionsLast30Days: number
  sessionsInProgress: number
}

export interface TrainerDashboard {
  upcomingEvaluations: { eventId: number; clientId: number; clientName: string; date: string; startTime: string | null; title: string }[]
  recentActivity: {
    kind: 'session' | 'evaluation'
    clientId: number
    clientName: string
    occurredAt: string
    title: string
    detail: string | null
    sessionId: number | null
    evaluationId: number | null
  }[]
}

export interface EvaluationPayload {
  evaluatedOn: string
  notes: string | null
  measurements: { measurementTypeId: number; value: number | null; notes: string | null }[]
}

export interface CalendarEventPayload {
  clientId: number | null
  type: number
  title: string | null
  date: string
  startTime: string | null
  endTime: string | null
  notes: string | null
}

const trainer = '/api/trainer'

export const trackingApi = {
  options: () => api.get<TrackingOptions>(`${trainer}/tracking/options`),
  types: () => api.get<MeasurementType[]>(`${trainer}/measurement-types`),
  createType: (data: { nameEs: string; nameEn: string | null; kind: number; unit: string; isActive: boolean }) =>
    api.post<{ id: number }>(`${trainer}/measurement-types`, data),
  updateType: (id: number, data: { nameEs: string; nameEn: string | null; kind: number; unit: string; isActive: boolean }) =>
    api.put<void>(`${trainer}/measurement-types/${id}`, data),

  overview: () => api.get<TrackingClient[]>(`${trainer}/tracking`),
  dashboard: () => api.get<TrainerDashboard>(`${trainer}/dashboard`),

  evaluations: (clientId: number) => api.get<Evaluation[]>(`${trainer}/clients/${clientId}/evaluations`),
  createEvaluation: (clientId: number, data: EvaluationPayload) => api.post<{ id: number }>(`${trainer}/clients/${clientId}/evaluations`, data),
  updateEvaluation: (id: number, data: EvaluationPayload) => api.put<void>(`${trainer}/evaluations/${id}`, data),
  correctMeasurement: (id: number, value: number | null, notes: string | null) => api.put<void>(`${trainer}/measurements/${id}`, { value, notes }),

  photos: (clientId: number) => api.get<Photo[]>(`${trainer}/clients/${clientId}/photos`),
  uploadPhoto: (clientId: number, file: File, data: { takenOn: string; category: string; evaluationId: string; notes: string }) => {
    const form = new FormData()
    form.append('file', file)
    for (const [k, v] of Object.entries(data)) if (v) form.append(k, v)
    return api.post<{ id: number }>(`${trainer}/clients/${clientId}/photos`, form)
  },

  progress: (clientId: number) => api.get<Progress>(`${trainer}/clients/${clientId}/progress`),
  sessions: (clientId: number) => api.get<SessionSummary[]>(`${trainer}/clients/${clientId}/sessions`),
  session: (clientId: number, id: number) => api.get<SessionDetail>(`${trainer}/clients/${clientId}/sessions/${id}`),

  calendar: (from: string, to: string, clientId?: number | null) =>
    api.get<CalendarItem[]>(`${trainer}/calendar?from=${from}&to=${to}${clientId ? `&clientId=${clientId}` : ''}`),
  createEvent: (data: CalendarEventPayload) => api.post<{ id: number }>(`${trainer}/calendar/events`, data),
  updateEvent: (id: number, data: CalendarEventPayload) => api.put<void>(`${trainer}/calendar/events/${id}`, data),
  setEventStatus: (id: number, status: 2 | 3) => api.post<void>(`${trainer}/calendar/events/${id}/status`, { status }),
}

export const portalTrackingApi = {
  progress: () => api.get<Progress>('/api/portal/progress'),
  evaluations: () => api.get<Evaluation[]>('/api/portal/evaluations'),
  photos: () => api.get<Photo[]>('/api/portal/photos'),
  calendar: (from: string, to: string) => api.get<CalendarItem[]>(`/api/portal/calendar?from=${from}&to=${to}`),
}

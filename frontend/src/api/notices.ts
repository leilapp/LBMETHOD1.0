import { api } from './client'

/** Pendientes de la entrenadora en su inicio (solo existe en la versión de Cloudflare). */
export interface TrainerPending {
  inactiveDays: number
  endingDays: number
  inactive: { clientId: number; name: string; lastTrainingDate: string | null; days: number; neverTrained: boolean }[]
  ending: { assignmentId: number; clientId: number; name: string; routineTitle: string; endDate: string; daysLeft: number }[]
  comments: { sessionId: number; clientId: number; name: string; dayName: string | null; routineTitle: string | null; completedAt: string; comment: string | null; exerciseComments: number }[]
}

/** Aviso de la entrenadora a un cliente (opcionalmente sobre un entrenamiento). */
export interface ClientMessage {
  id: number
  sessionId: number | null
  sessionDayName: string | null
  body: string
  createdAt: string
  readAt: string | null
}

export const noticesApi = {
  pending: () => api.get<TrainerPending>('/api/trainer/pending'),
  review: (clientId: number, sessionId: number) => api.post<void>(`/api/trainer/clients/${clientId}/sessions/${sessionId}/review`),
  messages: (clientId: number) => api.get<ClientMessage[]>(`/api/trainer/clients/${clientId}/messages`),
  send: (clientId: number, body: string, sessionId: number | null = null) => api.post<{ id: number }>(`/api/trainer/clients/${clientId}/messages`, { body, sessionId }),
  remove: (clientId: number, id: number) => api.del<void>(`/api/trainer/clients/${clientId}/messages/${id}`),
  myMessages: () => api.get<ClientMessage[]>('/api/portal/messages'),
  markRead: () => api.post<void>('/api/portal/messages/read'),
}

export const noticeKeys = {
  pending: ['trainer', 'pending'] as const,
  messages: (clientId: number) => ['trainer', 'messages', clientId] as const,
  mine: ['portal', 'messages'] as const,
}

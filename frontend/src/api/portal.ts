import { api } from './client'
import type { AssignmentStatus } from './endpoints'

const base = '/api/portal'

export interface PortalMedia {
  id: number
  type: 'Image' | 'Video'
  title: string | null
  url: string
  isExternal: boolean
}

export interface PortalSet {
  setNumber: number
  setType?: number
  setTypeLabel: string
  repsMin: number | null
  repsMax: number | null
  suggestedWeight: number | null
  weightUnit: string | null
  restSeconds: number | null
  rir: number | null
  rpe: number | null
  notes: string | null
}

export interface PortalExercise {
  id: number
  position: number
  exerciseId: number
  nameEs: string
  nameEn: string | null
  /** Músculo principal (la versión .NET no lo manda). */
  primaryMuscleGroup?: string | null
  supersetGroup: string | null
  sets: number
  repsMin: number | null
  repsMax: number | null
  suggestedWeight: number | null
  weightUnit: string | null
  restSeconds: number | null
  tempo: string | null
  rir: number | null
  rpe: number | null
  setType?: number
  setTypeLabel: string
  notes: string | null
  instructions: string | null
  technicalTips: string | null
  setDetails: PortalSet[]
  media: PortalMedia[]
}

export interface PortalDay {
  id: number
  position: number
  name: string
  dayLabel: string | null
  notes: string | null
  exercises: PortalExercise[]
}

export interface PortalProgram {
  assignmentId: number
  routineName: string
  versionNumber: number
  description: string | null
  goal: string | null
  durationWeeks: number | null
  startDate: string
  endDate: string | null
  status: AssignmentStatus
  statusLabel: string
  notes: string | null
  days: PortalDay[]
}

export interface SessionSummary {
  id: number
  routineTitle: string | null
  versionNumber: number | null
  dayName: string | null
  status: 'InProgress' | 'Completed'
  startedAt: string
  completedAt: string | null
  exercisesCompleted: number
  exercisesTotal: number
  setsCompleted: number
}

export interface NextWorkout {
  assignmentId: number
  routineName: string
  routineDayId: number
  dayName: string
  dayLabel: string | null
}

export interface WeekDay {
  date: string
  label: string
  planned: string[]
  sessions: SessionSummary[]
}

export interface PortalHome {
  inProgress: SessionSummary | null
  next: NextWorkout[]
  week: WeekDay[]
  last: SessionSummary | null
}

export interface LoggedSet {
  setNumber: number
  setTypeLabel: string
  isPrescribed: boolean
  prescribedRepsMin: number | null
  prescribedRepsMax: number | null
  prescribedWeight: number | null
  prescribedWeightUnit: string | null
  prescribedRestSeconds: number | null
  prescribedRir: number | null
  prescribedRpe: number | null
  prescribedNotes: string | null
  reps: number | null
  weight: number | null
  weightUnit: number | null
  rir: number | null
  rpe: number | null
  isCompleted: boolean
  notes: string | null
}

export interface LoggedExercise {
  id: number
  position: number
  exerciseId: number
  nameEs: string
  nameEn: string | null
  supersetGroup: string | null
  prescribedSets: number | null
  prescribedRepsMin: number | null
  prescribedRepsMax: number | null
  prescribedWeight: number | null
  prescribedWeightUnit: string | null
  prescribedRestSeconds: number | null
  prescribedTempo: string | null
  prescribedRir: number | null
  prescribedRpe: number | null
  prescribedNotes: string | null
  isCompleted: boolean
  comment: string | null
  sets: LoggedSet[]
  media: PortalMedia[]
  /** La vez pasada que hizo este ejercicio (solo referencia). La versión .NET no lo manda. */
  previous?: PreviousExercise | null
  /** Su mejor peso antes de este entrenamiento. La versión .NET no lo manda. */
  best?: BestLift | null
}

export interface PreviousExercise {
  date: string
  sets: { setNumber: number; reps: number | null; weight: number | null; weightUnit: string | null }[]
}

export interface BestLift {
  weight: number
  weightUnit: string
  weightKg: number
  reps: number | null
  date: string
}

export interface SessionDetail {
  id: number
  assignmentId: number | null
  routineTitle: string | null
  versionNumber: number | null
  dayName: string | null
  status: 'InProgress' | 'Completed'
  startedAt: string
  completedAt: string | null
  comment: string | null
  exercises: LoggedExercise[]
}

export interface SaveSessionPayload {
  comment: string | null
  exercises: {
    id: number
    isCompleted: boolean
    comment: string | null
    sets: { setNumber: number; reps: number | null; weight: number | null; weightUnit: number | null; rir: number | null; rpe: number | null; isCompleted: boolean; notes: string | null }[]
  }[]
}

export const portalTrainingApi = {
  program: () => api.get<PortalProgram[]>(`${base}/program`),
  home: () => api.get<PortalHome>(`${base}/home`),
  sessions: () => api.get<SessionSummary[]>(`${base}/sessions`),
  session: (id: number) => api.get<SessionDetail>(`${base}/sessions/${id}`),
  start: (assignmentId: number, routineDayId: number) => api.post<{ id: number }>(`${base}/sessions`, { assignmentId, routineDayId }),
  save: (id: number, data: SaveSessionPayload) => api.put<void>(`${base}/sessions/${id}`, data),
  finish: (id: number) => api.post<void>(`${base}/sessions/${id}/finish`),
}

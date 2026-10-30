import { api } from './client'
import type { Option } from './library'

const base = '/api/trainer/routines'

export type RoutineKind = 'Program' | 'Template'

export interface RoutineSummary {
  id: number
  kind: RoutineKind
  name: string
  status: 'Active' | 'Archived'
  goal: string | null
  publishedVersionNumber: number | null
  hasDraft: boolean
  dayCount: number
  exerciseCount: number
  updatedAt: string
}

export interface RoutineVersionSummary {
  id: number
  versionNumber: number
  status: 'Draft' | 'Published'
  title: string
  publishedAt: string | null
  changeNotes: string | null
  updatedAt: string
}

export interface RoutineDetail {
  id: number
  kind: RoutineKind
  name: string
  status: 'Active' | 'Archived'
  archivedAt: string | null
  draftVersionId: number | null
  latestPublishedVersionId: number | null
  versions: RoutineVersionSummary[]
}

export interface RoutineSet {
  setNumber: number
  setType: number
  setTypeLabel: string
  repsMin: number | null
  repsMax: number | null
  suggestedWeight: number | null
  suggestedWeightUnit: number | null
  restSeconds: number | null
  rir: number | null
  rpe: number | null
  notes: string | null
}

export interface RoutineExercise {
  id: number
  position: number
  exerciseId: number
  exerciseNameEs: string
  exerciseNameEn: string | null
  exerciseIsActive: boolean
  primaryMuscleGroup: string | null
  supersetGroup: string | null
  sets: number
  repsMin: number | null
  repsMax: number | null
  suggestedWeight: number | null
  suggestedWeightUnit: number | null
  restSeconds: number | null
  tempo: string | null
  rir: number | null
  rpe: number | null
  setType: number
  setTypeLabel: string
  notes: string | null
  setDetails: RoutineSet[]
}

export interface RoutineDay {
  id: number
  position: number
  name: string
  dayOfWeek: number | null
  dayLabel: string | null
  notes: string | null
  exercises: RoutineExercise[]
}

export interface RoutineVersion {
  id: number
  routineId: number
  routineKind: RoutineKind
  versionNumber: number
  status: 'Draft' | 'Published'
  title: string
  description: string | null
  goal: string | null
  durationWeeks: number | null
  changeNotes: string | null
  publishedAt: string | null
  sourceVersionId: number | null
  updatedAt: string
  days: RoutineDay[]
}

export interface RoutineOptions {
  setTypes: Option[]
  daysOfWeek: Option[]
  weightUnits: Option[]
}

export interface SetPayload {
  setType: number
  repsMin: number | null
  repsMax: number | null
  suggestedWeight: number | null
  suggestedWeightUnit: number | null
  restSeconds: number | null
  rir: number | null
  rpe: number | null
  notes: string | null
}

export interface ExercisePayload extends SetPayload {
  exerciseId: number
  supersetGroup: string | null
  sets: number
  tempo: string | null
  setDetails: SetPayload[]
}

export interface DayPayload {
  name: string
  dayOfWeek: number | null
  notes: string | null
  exercises: ExercisePayload[]
}

export interface DraftPayload {
  draftVersionId: number
  title: string
  description: string | null
  goal: string | null
  durationWeeks: number | null
  days: DayPayload[]
}

export const routinesApi = {
  options: () => api.get<RoutineOptions>(`${base}/options`),
  list: (kind: 'program' | 'template', status: 'active' | 'archived') =>
    api.get<RoutineSummary[]>(`${base}?kind=${kind}&status=${status}`),
  create: (data: { kind: 1 | 2; title: string; description: string | null; goal: string | null; durationWeeks: number | null }) =>
    api.post<{ id: number }>(base, data),
  get: (id: number) => api.get<RoutineDetail>(`${base}/${id}`),
  version: (id: number, versionId: number) => api.get<RoutineVersion>(`${base}/${id}/versions/${versionId}`),
  openDraft: (id: number) => api.post<{ id: number }>(`${base}/${id}/draft`),
  saveDraft: (id: number, data: DraftPayload) => api.put<void>(`${base}/${id}/draft`, data),
  discardDraft: (id: number) => api.del<void>(`${base}/${id}/draft`),
  publish: (id: number, draftVersionId: number, changeNotes: string | null) =>
    api.post<{ id: number }>(`${base}/${id}/publish`, { draftVersionId, changeNotes }),
  copy: (id: number, kind: 1 | 2, title: string | null, versionId?: number) =>
    api.post<{ id: number }>(`${base}/${id}/copy`, { kind, title, versionId: versionId ?? null }),
  archive: (id: number) => api.post<void>(`${base}/${id}/archive`),
  restore: (id: number) => api.post<void>(`${base}/${id}/restore`),
}

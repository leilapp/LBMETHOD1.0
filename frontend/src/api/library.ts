import { api } from './client'

const base = '/api/trainer/library'

export type CatalogKind = 'muscle-groups' | 'equipment' | 'movement-patterns'

export interface CatalogItem {
  id: number
  nameEs: string
  nameEn: string
  isActive: boolean
  exerciseCount: number
}

export interface Option {
  value: number
  label: string
}

export interface LibraryCatalogs {
  muscleGroups: CatalogItem[]
  equipment: CatalogItem[]
  movementPatterns: CatalogItem[]
  types: Option[]
  difficulties: Option[]
}

export interface ExerciseListItem {
  id: number
  nameEs: string
  nameEn: string | null
  type: number
  typeLabel: string
  primaryMuscleGroup: string | null
  equipment: string[]
  movementPattern: string | null
  isActive: boolean
  isFavorite: boolean
  thumbnailMediaId: number | null
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface NamedRef {
  id: number
  nameEs: string
  nameEn: string
}

export interface ExerciseMedia {
  id: number
  mediaType: 'Image' | 'Video'
  title: string | null
  externalUrl: string | null
  contentUrl: string | null
  fileName: string | null
  sizeBytes: number | null
}

export interface ExerciseVariant {
  exerciseId: number
  nameEs: string
  nameEn: string | null
  isActive: boolean
  note: string | null
}

export interface ExerciseDetail {
  id: number
  nameEs: string
  nameEn: string | null
  description: string | null
  instructions: string | null
  commonMistakes: string | null
  technicalTips: string | null
  type: number
  typeLabel: string
  difficulty: number | null
  difficultyLabel: string | null
  movementPattern: NamedRef | null
  primaryMuscleGroup: NamedRef | null
  secondaryMuscleGroups: NamedRef[]
  equipment: NamedRef[]
  isActive: boolean
  deactivatedAt: string | null
  isFavorite: boolean
  variants: ExerciseVariant[]
  media: ExerciseMedia[]
}

export interface ExerciseInput {
  nameEs: string
  nameEn: string | null
  description: string | null
  instructions: string | null
  commonMistakes: string | null
  technicalTips: string | null
  type: number
  difficulty: number | null
  movementPatternId: number | null
  primaryMuscleGroupId: number
  secondaryMuscleGroupIds: number[]
  equipmentIds: number[]
}

export interface ExerciseFilters {
  q?: string
  muscleGroupId?: number
  equipmentId?: number
  movementPatternId?: number
  type?: number
  status?: 'active' | 'inactive' | 'all'
  favorites?: boolean
  page?: number
}

export type ImportRowStatus = 'Valid' | 'Duplicate' | 'Error'

export interface ImportRow {
  rowNumber: number
  nameEs: string | null
  nameEn: string | null
  status: ImportRowStatus | number
  messages: string[]
}

export interface ImportPreview {
  rows: ImportRow[]
  valid: number
  duplicates: number
  errors: number
}

export interface ImportReport {
  created: number
  rejected: ImportRow[]
}

/** El servidor envía el estado como número (1 válida, 2 duplicada, 3 con error). */
export function rowStatus(status: ImportRow['status']): ImportRowStatus {
  if (typeof status === 'string') return status
  return status === 1 ? 'Valid' : status === 2 ? 'Duplicate' : 'Error'
}

function query(filters: ExerciseFilters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '' || value === false) continue
    params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

function fileForm(file: File, fields: Record<string, string | undefined> = {}) {
  const form = new FormData()
  form.append('file', file)
  for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v)
  return form
}

export const libraryApi = {
  catalogs: () => api.get<LibraryCatalogs>(`${base}/catalogs`),
  createCatalogItem: (kind: CatalogKind, data: { nameEs: string; nameEn: string }) =>
    api.post<{ id: number }>(`${base}/${kind}`, { ...data, isActive: true }),
  updateCatalogItem: (kind: CatalogKind, id: number, data: { nameEs: string; nameEn: string; isActive: boolean }) =>
    api.put<void>(`${base}/${kind}/${id}`, data),

  exercises: (filters: ExerciseFilters) => api.get<Paged<ExerciseListItem>>(`${base}/exercises${query(filters)}`),
  exercise: (id: number) => api.get<ExerciseDetail>(`${base}/exercises/${id}`),
  createExercise: (data: ExerciseInput) => api.post<{ id: number }>(`${base}/exercises`, data),
  updateExercise: (id: number, data: ExerciseInput) => api.put<void>(`${base}/exercises/${id}`, data),
  setActive: (id: number, active: boolean) => api.post<void>(`${base}/exercises/${id}/status`, { active }),
  setFavorite: (id: number, favorite: boolean) =>
    favorite ? api.put<void>(`${base}/exercises/${id}/favorite`) : api.del<void>(`${base}/exercises/${id}/favorite`),
  addVariant: (id: number, variantExerciseId: number, note: string | null) =>
    api.post<void>(`${base}/exercises/${id}/variants`, { variantExerciseId, note }),
  removeVariant: (id: number, variantId: number) => api.del<void>(`${base}/exercises/${id}/variants/${variantId}`),
  uploadMedia: (id: number, file: File, title?: string) =>
    api.post<{ id: number }>(`${base}/exercises/${id}/media`, fileForm(file, { title })),
  addMediaLink: (id: number, url: string, mediaType: 1 | 2, title?: string) =>
    api.post<{ id: number }>(`${base}/exercises/${id}/media/link`, { url, mediaType, title: title || null }),
  deleteMedia: (id: number, mediaId: number) => api.del<void>(`${base}/exercises/${id}/media/${mediaId}`),
  mediaUrl: (mediaId: number) => `${base}/media/${mediaId}/content`,

  downloadTemplate: () => api.download(`${base}/exercises/import/template`, 'plantilla-ejercicios-lbmethod.xlsx'),
  previewImport: (file: File) => api.post<ImportPreview>(`${base}/exercises/import/preview`, fileForm(file)),
  commitImport: (file: File) => api.post<ImportReport>(`${base}/exercises/import/commit`, fileForm(file)),
  exportCatalog: (status: 'all' | 'active' | 'inactive') =>
    api.download(`${base}/exercises/export?status=${status}`, 'biblioteca-lbmethod.xlsx'),
}

/** Límites que también valida el servidor; aquí solo se avisa antes de subir. */
export const MEDIA_LIMITS = {
  imageBytes: 5 * 1024 * 1024,
  videoBytes: 100 * 1024 * 1024,
  imageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  videoTypes: ['video/mp4', 'video/webm'],
}

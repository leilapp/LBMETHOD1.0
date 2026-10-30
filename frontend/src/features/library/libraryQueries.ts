import { useQuery } from '@tanstack/react-query'
import { libraryApi, type ExerciseFilters } from '../../api/library'

export const libraryKeys = {
  all: ['library'] as const,
  catalogs: ['library', 'catalogs'] as const,
  exercises: (filters: ExerciseFilters) => ['library', 'exercises', filters] as const,
  exercise: (id: number) => ['library', 'exercise', id] as const,
}

export function useCatalogs() {
  return useQuery({ queryKey: libraryKeys.catalogs, queryFn: libraryApi.catalogs, staleTime: 60_000 })
}

export function useExercises(filters: ExerciseFilters) {
  return useQuery({
    queryKey: libraryKeys.exercises(filters),
    queryFn: () => libraryApi.exercises(filters),
    placeholderData: (previous) => previous,
  })
}

export function useExercise(id: number | undefined) {
  return useQuery({
    queryKey: libraryKeys.exercise(id ?? 0),
    queryFn: () => libraryApi.exercise(id!),
    enabled: id !== undefined,
  })
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

import { useQuery } from '@tanstack/react-query'
import { routinesApi, type RoutineKind } from '../../api/routines'

export type Section = 'rutinas' | 'plantillas'

export const sectionFor = (kind: RoutineKind): Section => (kind === 'Template' ? 'plantillas' : 'rutinas')

export const routineKeys = {
  all: ['routines'] as const,
  options: ['routines', 'options'] as const,
  list: (kind: string, status: string) => ['routines', 'list', kind, status] as const,
  detail: (id: number) => ['routines', 'detail', id] as const,
  version: (id: number, versionId: number) => ['routines', 'version', id, versionId] as const,
}

export function useRoutineOptions() {
  return useQuery({ queryKey: routineKeys.options, queryFn: routinesApi.options, staleTime: Infinity })
}

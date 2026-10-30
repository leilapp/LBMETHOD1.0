import type { LoggedExercise, LoggedSet, SaveSessionPayload, SessionDetail } from '../../api/portal'

export const portalKeys = {
  home: ['portal', 'home'] as const,
  program: ['portal', 'program'] as const,
  sessions: ['portal', 'sessions'] as const,
  session: (id: number) => ['portal', 'sessions', id] as const,
}

export type SetDraft = Omit<LoggedSet, 'reps' | 'weight' | 'rir' | 'rpe'> & { reps: string; weight: string; rir: string; rpe: string; unit: number }
export type ExerciseDraft = Omit<LoggedExercise, 'sets' | 'comment'> & { comment: string; sets: SetDraft[] }

const txt = (v: number | null) => (v === null ? '' : String(v))
const unitOf = (label: string | null) => (label === 'lb' ? 2 : 1)

export function toDraft(s: SessionDetail): { comment: string; exercises: ExerciseDraft[] } {
  return {
    comment: s.comment ?? '',
    exercises: s.exercises.map((e) => ({
      ...e,
      comment: e.comment ?? '',
      sets: e.sets.map((x) => ({
        ...x,
        reps: txt(x.reps),
        weight: txt(x.weight),
        rir: txt(x.rir),
        rpe: txt(x.rpe),
        unit: x.weightUnit ?? unitOf(x.prescribedWeightUnit ?? e.prescribedWeightUnit),
      })),
    })),
  }
}

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

export function toSessionPayload(d: { comment: string; exercises: ExerciseDraft[] }): SaveSessionPayload {
  return {
    comment: d.comment.trim() || null,
    exercises: d.exercises.map((e) => ({
      id: e.id,
      isCompleted: e.isCompleted,
      comment: e.comment.trim() || null,
      sets: e.sets.map((s) => {
        const weight = num(s.weight)
        return { setNumber: s.setNumber, reps: num(s.reps), weight, weightUnit: weight === null ? null : s.unit, rir: num(s.rir), rpe: num(s.rpe), isCompleted: s.isCompleted, notes: s.notes }
      }),
    })),
  }
}


/** Indicaciones de una sola serie en palabras claras: «8–10 reps · 60 kg · 90 s descanso · RIR 2». */
export function setTarget(s: { repsMin: number | null; repsMax: number | null; weight: number | null; unit: string | null; rest: number | null; rir: number | null; rpe: number | null }) {
  const reps = s.repsMin !== null && s.repsMax !== null && s.repsMin !== s.repsMax ? `${s.repsMin}–${s.repsMax}` : (s.repsMin ?? s.repsMax)
  const parts: string[] = []
  if (reps !== null) parts.push(`${reps} reps`)
  if (s.weight !== null) parts.push(`${s.weight} ${s.unit ?? 'kg'}`)
  if (s.rest !== null) parts.push(`${s.rest} s descanso`)
  if (s.rir !== null) parts.push(`RIR ${s.rir}`)
  if (s.rpe !== null) parts.push(`RPE ${s.rpe}`)
  return parts.join(' · ')
}

import type { RoutineExercise, RoutineVersion } from '../../api/routines'
import { summarize } from './routineModel'
import { WeeklyVolume } from './WeeklyVolume'
import { volumeFromVersion } from '../../lib/weeklyVolume'

const unitLabel = (u: number | null) => (u === 2 ? 'lb' : 'kg')

/** Vista de solo lectura de una rutina: lo que verá el cliente una vez asignada (Fase 8). */
export function RoutinePreview({ version }: { version: RoutineVersion }) {
  return (
    <article className="preview" aria-label={`Vista previa de ${version.title}`}>
      <header className="preview__head">
        <h2 className="preview__title">{version.title || 'Sin nombre'}</h2>
        <p className="muted">
          {[version.goal && `Objetivo: ${version.goal}`, version.durationWeeks && `${version.durationWeeks} ${version.durationWeeks === 1 ? 'semana' : 'semanas'}`, `${version.days.length} ${version.days.length === 1 ? 'día' : 'días'}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {version.description && <p className="pre-line">{version.description}</p>}
      </header>
      {version.days.length > 0 && <WeeklyVolume rows={volumeFromVersion(version)} compact />}
      {version.days.length === 0 && <p className="muted">Esta rutina aún no tiene días.</p>}
      {version.days.map((d) => (
        <section key={d.id} className="preview-day" aria-label={d.name}>
          <h3 className="preview-day__title">
            {d.name}
            {d.dayLabel && <span className="badge badge--muted">{d.dayLabel}</span>}
          </h3>
          {d.notes && <p className="muted pre-line">{d.notes}</p>}
          {d.exercises.length === 0 ? (
            <p className="muted">Sin ejercicios.</p>
          ) : (
            <ol className="preview-list">
              {d.exercises.map((e, i) => (
                <PreviewExercise key={e.id} exercise={e} index={i + 1} previous={d.exercises[i - 1]} next={d.exercises[i + 1]} />
              ))}
            </ol>
          )}
        </section>
      ))}
    </article>
  )
}

function PreviewExercise({ exercise: e, index, previous, next }: { exercise: RoutineExercise; index: number; previous?: RoutineExercise; next?: RoutineExercise }) {
  const inGroup = !!e.supersetGroup
  const groupStart = inGroup && previous?.supersetGroup !== e.supersetGroup
  const groupEnd = inGroup && next?.supersetGroup !== e.supersetGroup
  return (
    <li className={`preview-ex${inGroup ? ' preview-ex--superset' : ''}${groupStart ? ' preview-ex--group-start' : ''}${groupEnd ? ' preview-ex--group-end' : ''}`}>
      <span className="preview-ex__index" aria-hidden="true">
        {index}
      </span>
      <div className="preview-ex__body">
        <p className="preview-ex__name">
          {e.exerciseNameEs}
          {e.supersetGroup && <span className="badge badge--lilac">Superserie {e.supersetGroup}</span>}
          {e.setType !== 1 && e.setDetails.length === 0 && <span className="badge badge--pending">{e.setTypeLabel}</span>}
          {!e.exerciseIsActive && <span className="badge badge--danger">Desactivado en la biblioteca</span>}
        </p>
        {e.setDetails.length === 0 ? (
          <p className="preview-ex__rx">
            {summarize({ sets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax, weight: e.suggestedWeight, unitLabel: unitLabel(e.suggestedWeightUnit), rest: e.restSeconds, tempo: e.tempo, rir: e.rir, rpe: e.rpe })}
          </p>
        ) : (
          <>
            {e.tempo && <p className="preview-ex__rx">Tempo {e.tempo}</p>}
            <ul className="preview-sets">
              {e.setDetails.map((s) => (
                <li key={s.setNumber}>
                  <span className="preview-sets__n">Serie {s.setNumber}</span> <span className="badge badge--muted">{s.setTypeLabel}</span>{' '}
                  {summarize({ sets: '', repsMin: s.repsMin, repsMax: s.repsMax, weight: s.suggestedWeight, unitLabel: unitLabel(s.suggestedWeightUnit), rest: s.restSeconds, rir: s.rir, rpe: s.rpe })}
                  {s.notes && <span className="muted"> · {s.notes}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
        {e.notes && <p className="muted pre-line">{e.notes}</p>}
      </div>
    </li>
  )
}

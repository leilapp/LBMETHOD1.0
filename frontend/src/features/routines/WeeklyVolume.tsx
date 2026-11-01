import { useId } from 'react'
import { BarChart3 } from 'lucide-react'
import type { MuscleVolume } from '../../lib/weeklyVolume'

/**
 * «Series por músculo a la semana»: una barra por músculo con su número, de mayor a menor.
 * Va arriba de la rutina (constructor, ficha de la rutina, vista previa y la rutina del cliente).
 */
export function WeeklyVolume({ rows, compact }: { rows: MuscleVolume[] | null; compact?: boolean }) {
  const titleId = useId()
  if (rows === null) return null
  const max = Math.max(1, ...rows.map((r) => r.sets))
  const total = rows.reduce((sum, r) => sum + r.sets, 0)
  return (
    <section className={`card weekly-volume${compact ? ' weekly-volume--compact' : ''}`} aria-labelledby={titleId}>
      <div className="weekly-volume__head">
        <span className="icon-chip icon-chip--sm" aria-hidden="true">
          <BarChart3 size={18} />
        </span>
        <div>
          <h2 className="weekly-volume__title" id={titleId}>
            Series por músculo a la semana
          </h2>
          <p className="weekly-volume__note">
            {total === 0
              ? 'Aún no hay series. Se calcula sola al agregar ejercicios.'
              : `${total} series de trabajo en total · cuenta el músculo principal de cada ejercicio, sin calentamiento`}
          </p>
        </div>
      </div>
      {rows.length > 0 && (
        <ul className="weekly-volume__list">
          {rows.map((r) => (
            <li key={r.muscle} className="weekly-volume__row">
              <span className="weekly-volume__muscle">{r.muscle}</span>
              <span className="weekly-volume__track" aria-hidden="true">
                <span className="weekly-volume__bar" style={{ width: `${(r.sets / max) * 100}%` }} />
              </span>
              <span className="weekly-volume__value">
                {r.sets} <span className="visually-hidden">{r.sets === 1 ? 'serie' : 'series'}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

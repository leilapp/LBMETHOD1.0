import { Target } from 'lucide-react'
import { joinMuscles, type DayMainMuscle as Main } from '../../lib/weeklyVolume'

/**
 * Etiqueta «Músculo principal» arriba de cada día (constructor, vista previa/ficha y rutina del cliente).
 * Se calcula sola con las series de trabajo del día; no muestra nada si aún no hay series con músculo.
 */
export function DayMainMuscle({ main }: { main: Main | null }) {
  if (!main) return null
  const many = main.muscles.length > 1
  return (
    <span className="day-muscle">
      <span className="day-muscle__pill">
        <Target size={15} aria-hidden="true" />
        {joinMuscles(main.muscles)}
      </span>
      <span className="day-muscle__meta">
        {many ? 'Músculos principales' : 'Músculo principal'} · {main.sets} de {main.total} {main.total === 1 ? 'serie' : 'series'}
        {many ? ' cada uno' : ''}
      </span>
    </span>
  )
}

import { useState } from 'react'
import type { Evaluation, MeasurementSeries, Photo, Progress } from '../../api/tracking'
import { EmptyState, SelectField } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { ChartCard, LineChart, WeeklyBars } from './charts'
import { fmt, shortDate } from './trackingModel'

/*
 * Progreso de un cliente, igual para la entrenadora y para el propio cliente. Todo sale de registros guardados:
 * si falta un dato se dice «Sin dato»; nunca se calcula un valor intermedio.
 */

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`

function SeriesTable({ series }: { series: MeasurementSeries }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Fecha</th>
          <th scope="col">Valor</th>
          <th scope="col">Nota</th>
        </tr>
      </thead>
      <tbody>
        {[...series.points].reverse().map((p) => (
          <tr key={p.measurementId}>
            <td>{formatDate(p.date)}</td>
            <td>
              {fmt(p.value)} {series.unit}
            </td>
            <td>{p.notes ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SeriesCard({ series, title }: { series: MeasurementSeries; title?: string }) {
  const first = series.points[0]
  const last = series.points[series.points.length - 1]
  const subtitle =
    series.points.length === 1
      ? `Un solo registro (${formatDate(last.date)}). Con otra medición se verá la evolución.`
      : `${signed(last.value - first.value)} ${series.unit} del ${formatDate(first.date)} al ${formatDate(last.date)} · ${series.points.length} registros`
  return (
    <ChartCard
      title={title ?? `${series.name} (${series.unit})`}
      subtitle={subtitle}
      chart={<LineChart label={series.name} unit={series.unit} points={series.points.map((p) => ({ date: p.date, value: p.value, note: p.notes ?? undefined }))} />}
      table={<SeriesTable series={series} />}
    />
  )
}

/** Compara dos evaluaciones medida por medida, con sus fechas. */
function CompareEvaluations({ evaluations }: { evaluations: Evaluation[] }) {
  const chronological = [...evaluations].sort((a, b) => a.evaluatedOn.localeCompare(b.evaluatedOn) || a.id - b.id)
  const [fromId, setFromId] = useState(chronological[0].id)
  const [toId, setToId] = useState(chronological[chronological.length - 1].id)
  const from = chronological.find((e) => e.id === fromId) ?? chronological[0]
  const to = chronological.find((e) => e.id === toId) ?? chronological[chronological.length - 1]
  const rows = new Map<string, { name: string; unit: string; a?: number; b?: number }>()
  for (const [side, ev] of [['a', from], ['b', to]] as const)
    for (const m of ev.measurements) {
      const key = `${m.measurementTypeId}-${m.unit}`
      const row = rows.get(key) ?? { name: m.name, unit: m.unit }
      row[side] = m.value
      rows.set(key, row)
    }
  const label = (e: Evaluation) => `${shortDate(e.evaluatedOn)} · ${e.measurements.length} ${e.measurements.length === 1 ? 'medida' : 'medidas'}`

  return (
    <section className="chart-card" aria-labelledby="comparar">
      <h3 className="chart-card__title" id="comparar">
        Comparar evaluaciones
      </h3>
      <div className="compare-pickers">
        <SelectField label="Desde" value={from.id} onChange={(e) => setFromId(Number(e.target.value))}>
          {chronological.map((e) => (
            <option key={e.id} value={e.id}>
              {label(e)}
            </option>
          ))}
        </SelectField>
        <SelectField label="Hasta" value={to.id} onChange={(e) => setToId(Number(e.target.value))}>
          {chronological.map((e) => (
            <option key={e.id} value={e.id}>
              {label(e)}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="table-scroll">
        <table className="data-table data-table--stack" aria-label="Comparación de evaluaciones">
          <thead>
            <tr>
              <th scope="col">Medida</th>
              <th scope="col">
                <time dateTime={from.evaluatedOn} title={formatDate(from.evaluatedOn)}>{shortDate(from.evaluatedOn)}</time>
              </th>
              <th scope="col">
                <time dateTime={to.evaluatedOn} title={formatDate(to.evaluatedOn)}>{shortDate(to.evaluatedOn)}</time>
              </th>
              <th scope="col">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {[...rows.values()].map((r) => (
              <tr key={`${r.name}-${r.unit}`}>
                <th scope="row">{r.name}</th>
                <td data-label={shortDate(from.evaluatedOn)}>{r.a !== undefined ? `${fmt(r.a)} ${r.unit}` : <span className="muted">Sin dato</span>}</td>
                <td data-label={shortDate(to.evaluatedOn)}>{r.b !== undefined ? `${fmt(r.b)} ${r.unit}` : <span className="muted">Sin dato</span>}</td>
                <td data-label="Diferencia">{r.a !== undefined && r.b !== undefined ? `${signed(r.b - r.a)} ${r.unit}` : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field__hint">Si una medida no se tomó en alguna de las dos fechas aparece «Sin dato»; no se estima.</p>
    </section>
  )
}

function Loads({ progress }: { progress: Progress }) {
  const [exerciseId, setExerciseId] = useState(progress.exercises[0]?.exerciseId)
  const exercise = progress.exercises.find((e) => e.exerciseId === exerciseId) ?? progress.exercises[0]
  if (!exercise)
    return <p className="muted">Aún no hay entrenamientos finalizados con peso y repeticiones registrados.</p>
  const best = exercise.points.reduce((a, b) => (b.weight > a.weight ? b : a))
  return (
    <div className="stack">
      <SelectField label="Ejercicio" value={exercise.exerciseId} onChange={(e) => setExerciseId(Number(e.target.value))}>
        {progress.exercises.map((e) => (
          <option key={e.exerciseId} value={e.exerciseId}>
            {e.name} ({e.points.length} {e.points.length === 1 ? 'entrenamiento' : 'entrenamientos'})
          </option>
        ))}
      </SelectField>
      <ChartCard
        title={`Mejor serie de ${exercise.name} (${exercise.unit})`}
        subtitle={
          <>
            Máximo: {fmt(best.weight)} {exercise.unit} × {best.reps} el {formatDate(best.date)}.
            {exercise.hasConvertedValues && ` Algunos pesos se registraron en ${exercise.unit === 'kg' ? 'lb' : 'kg'} y se convirtieron (1 lb = 0.4536 kg); la tabla muestra el original.`}
          </>
        }
        chart={
          <LineChart
            label={`Carga en ${exercise.name}`}
            unit={exercise.unit}
            points={exercise.points.map((p) => ({ date: p.date, value: p.weight, note: `${p.reps} reps${p.converted ? ` · registrado ${fmt(p.originalWeight)} ${p.originalUnit}` : ''}` }))}
          />
        }
        table={
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Mejor serie</th>
                <th scope="col">Volumen</th>
                <th scope="col">Series</th>
              </tr>
            </thead>
            <tbody>
              {[...exercise.points].reverse().map((p) => (
                <tr key={p.sessionId}>
                  <td>{formatDate(p.date)}</td>
                  <td>
                    {fmt(p.weight)} {exercise.unit} × {p.reps}
                    {p.converted && <span className="muted"> (registrado {fmt(p.originalWeight)} {p.originalUnit})</span>}
                  </td>
                  <td>
                    {fmt(p.volume)} {exercise.unit}
                  </td>
                  <td>{p.setsLogged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />
      <p className="field__hint">Se cuentan las series con peso y repeticiones de los entrenamientos finalizados. Volumen = peso × repeticiones sumado.</p>
    </div>
  )
}

export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [category, setCategory] = useState<number | 'all'>('all')
  if (photos.length === 0) return <p className="muted">Sin fotos de progreso.</p>
  const categories = [...new Map(photos.filter((p) => p.category !== null).map((p) => [p.category!, p.categoryLabel!])).entries()]
  const shown = photos.filter((p) => category === 'all' || p.category === category)
  return (
    <div className="stack">
      {categories.length > 1 && (
        <div className="chip-row" role="group" aria-label="Filtrar fotos">
          <button type="button" className={`chip${category === 'all' ? ' chip--on' : ''}`} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
            Todas
          </button>
          {categories.map(([value, label]) => (
            <button key={value} type="button" className={`chip${category === value ? ' chip--on' : ''}`} aria-pressed={category === value} onClick={() => setCategory(value)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <ul className="photo-grid" aria-label="Fotos de progreso">
        {shown.map((p) => (
          <li key={p.id} className="photo-grid__item">
            <img src={p.url} alt={`Foto de progreso${p.categoryLabel ? ` (${p.categoryLabel})` : ''} del ${formatDate(p.takenOn)}`} loading="lazy" />
            <span className="photo-grid__caption">
              {formatDate(p.takenOn)}
              {p.categoryLabel ? ` · ${p.categoryLabel}` : ''}
            </span>
            {p.notes && <span className="muted photo-grid__caption">{p.notes}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ProgressView({ progress, evaluations, photos }: { progress: Progress; evaluations: Evaluation[]; photos: Photo[] }) {
  const bodyWeight = progress.measurements.filter((s) => s.kind === 'BodyWeight')
  const others = progress.measurements.filter((s) => s.kind !== 'BodyWeight')
  const f = progress.frequency
  const recent = f.weeks.reduce((s, w) => s + w.completed, 0)
  const lastEval = evaluations[0]

  return (
    <div className="stack progress">
      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-tile__label">Entrenamientos finalizados</span>
          <span className="stat-tile__value">{f.completed}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Últimas {f.weeks.length} semanas</span>
          <span className="stat-tile__value">{recent}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Último entrenamiento</span>
          <span className="stat-tile__value stat-tile__value--sm">{f.lastSession ? formatDate(f.lastSession) : 'Sin registros'}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Última evaluación</span>
          <span className="stat-tile__value stat-tile__value--sm">{lastEval ? formatDate(lastEval.evaluatedOn) : 'Sin registros'}</span>
        </div>
      </div>

      <section className="card stack" aria-labelledby="peso-corporal">
        <h2 className="card__title" id="peso-corporal">
          Peso corporal
        </h2>
        <p className="field__hint">Es el peso de la persona en cada evaluación. No tiene relación con la carga de los ejercicios.</p>
        {bodyWeight.length === 0 ? <p className="muted">Sin registros de peso corporal.</p> : bodyWeight.map((s) => <SeriesCard key={`${s.measurementTypeId}-${s.unit}`} series={s} />)}
      </section>

      <section className="card stack" aria-labelledby="medidas">
        <h2 className="card__title" id="medidas">
          Medidas
        </h2>
        {others.length === 0 ? (
          <p className="muted">Sin medidas registradas.</p>
        ) : (
          <div className="chart-grid">
            {others.map((s) => (
              <SeriesCard key={`${s.measurementTypeId}-${s.unit}`} series={s} />
            ))}
          </div>
        )}
        {evaluations.length >= 2 && <CompareEvaluations evaluations={evaluations} />}
      </section>

      <section className="card stack" aria-labelledby="cargas">
        <h2 className="card__title" id="cargas">
          Cargas por ejercicio
        </h2>
        <Loads progress={progress} />
      </section>

      <section className="card stack" aria-labelledby="frecuencia">
        <h2 className="card__title" id="frecuencia">
          Frecuencia
        </h2>
        {f.completed === 0 && f.inProgress === 0 ? (
          <EmptyState title="Aún no hay entrenamientos registrados" />
        ) : (
          <ChartCard
            title="Entrenamientos finalizados por semana"
            subtitle={`${recent} en las últimas ${f.weeks.length} semanas${f.inProgress ? ` · ${f.inProgress} sin terminar (no se cuentan)` : ''}`}
            chart={<WeeklyBars label="Entrenamientos por semana" weeks={f.weeks} />}
            table={
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Semana (lunes)</th>
                    <th scope="col">Finalizados</th>
                  </tr>
                </thead>
                <tbody>
                  {[...f.weeks].reverse().map((w) => (
                    <tr key={w.weekStart}>
                      <td>{formatDate(w.weekStart)}</td>
                      <td>{w.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          />
        )}
      </section>

      <section className="card stack" aria-labelledby="fotos">
        <h2 className="card__title" id="fotos">
          Fotos de progreso
        </h2>
        <p className="field__hint">Privadas: solo las ven el cliente y su entrenadora.</p>
        <PhotoGallery photos={photos} />
      </section>
    </div>
  )
}

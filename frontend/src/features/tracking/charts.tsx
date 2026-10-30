import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { formatDate } from '../../lib/format'
import { fmt } from './trackingModel'

/*
 * Gráficas propias en SVG (sin librerías): una sola serie por gráfica, línea de 2 px, puntos de 8 px con anillo del color
 * de fondo, cuadrícula tenue y una sola escala vertical. Cada gráfica trae su tabla con los mismos datos, así que ningún
 * valor depende de pasar el cursor por encima.
 */

const H = 200
const PAD = { top: 16, right: 16, bottom: 28, left: 44 }

function useWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000
const shortDate = (iso: string) =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

/** Marcas «redondas» para el eje vertical (3 a 5). */
function niceTicks(min: number, max: number) {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05)
    min -= pad
    max += pad
  }
  const raw = (max - min) / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Number(v.toFixed(6)))
  if (ticks[ticks.length - 1] < max) ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(6)))
  return ticks
}

export interface ChartPoint {
  date: string
  value: number
  /** Texto extra para el detalle (por ejemplo, «8 reps» o «convertido de 160 lb»). */
  note?: string
}

function Tooltip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x - 80, 0), width - 160)
  return (
    <div className="chart__tooltip" style={{ left }} role="status">
      {children}
    </div>
  )
}

/** Línea en el tiempo: el espacio entre puntos respeta las fechas reales; no se dibujan valores intermedios. */
export function LineChart({ points, unit, label }: { points: ChartPoint[]; unit: string; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const ticks = niceTicks(Math.min(...sorted.map((p) => p.value)), Math.max(...sorted.map((p) => p.value)))
  const [y0, y1] = [ticks[0], ticks[ticks.length - 1]]
  const d0 = dayNumber(sorted[0].date)
  const d1 = dayNumber(sorted[sorted.length - 1].date)
  const innerW = width - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (iso: string) => PAD.left + (d1 === d0 ? innerW / 2 : ((dayNumber(iso) - d0) / (d1 - d0)) * innerW)
  const y = (v: number) => PAD.top + innerH - ((v - y0) / (y1 - y0)) * innerH
  const path = sorted.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const xLabels = sorted.length <= 2 ? sorted : [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]]
  const nearest = (px: number) =>
    sorted.reduce((best, p, i) => (Math.abs(x(p.date) - px) < Math.abs(x(sorted[best].date) - px) ? i : best), 0)
  const last = sorted[sorted.length - 1]
  const current = active === null ? null : sorted[active]

  return (
    <div className="chart" ref={ref}>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`${label}: ${sorted.length} ${sorted.length === 1 ? 'registro' : 'registros'}, último ${fmt(last.value)} ${unit} el ${formatDate(last.date)}`}
        tabIndex={0}
        onPointerMove={(e) => setActive(nearest(e.clientX - e.currentTarget.getBoundingClientRect().left))}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(sorted.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? sorted.length) - 1))
          if (e.key === 'ArrowRight') setActive((a) => Math.min(sorted.length - 1, (a ?? -1) + 1))
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart__grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="chart__axis" x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
              {fmt(t)}
            </text>
          </g>
        ))}
        {xLabels.map((p, i) => (
          <text key={`${p.date}-${i}`} className="chart__axis" x={x(p.date)} y={H - 8} textAnchor={i === 0 && xLabels.length > 1 ? 'start' : i === xLabels.length - 1 && xLabels.length > 1 ? 'end' : 'middle'}>
            {shortDate(p.date)}
          </text>
        ))}
        {sorted.length > 1 && <path className="chart__line" d={path} />}
        {current && <line className="chart__crosshair" x1={x(current.date)} x2={x(current.date)} y1={PAD.top} y2={PAD.top + innerH} />}
        {sorted.map((p, i) => (
          <circle key={`${p.date}-${i}`} className={`chart__dot${i === active ? ' chart__dot--active' : ''}`} cx={x(p.date)} cy={y(p.value)} r={i === active ? 6 : 4} />
        ))}
        <text className="chart__value" x={Math.min(x(last.date), width - PAD.right)} y={y(last.value) - 10} textAnchor="end">
          {fmt(last.value)} {unit}
        </text>
      </svg>
      {current && (
        <Tooltip x={x(current.date)} width={width}>
          <strong>
            {fmt(current.value)} {unit}
          </strong>
          <span>{formatDate(current.date)}</span>
          {current.note && <span>{current.note}</span>}
        </Tooltip>
      )}
    </div>
  )
}

/** Columnas por semana (frecuencia de entrenamientos). */
export function WeeklyBars({ weeks, label }: { weeks: { weekStart: string; completed: number }[]; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...weeks.map((w) => w.completed))
  const ticks = niceTicks(0, max).filter((t) => Number.isInteger(t))
  const top = ticks[ticks.length - 1]
  const innerW = width - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const band = innerW / weeks.length
  const barW = Math.min(24, band - 4)
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH
  const current = active === null ? null : weeks[active]

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={H} role="img" aria-label={`${label}: ${weeks.reduce((s, w) => s + w.completed, 0)} en ${weeks.length} semanas`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart__grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="chart__axis" x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const cx = PAD.left + band * i + band / 2
          const h = Math.max(0, PAD.top + innerH - y(w.completed))
          const r = Math.min(4, h / 2)
          const x0 = cx - barW / 2
          const yTop = PAD.top + innerH - h
          return (
            <g
              key={w.weekStart}
              tabIndex={0}
              role="img"
              aria-label={`Semana del ${formatDate(w.weekStart)}: ${w.completed}`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <rect className="chart__hit" x={cx - band / 2} y={PAD.top} width={band} height={innerH} />
              {h > 0 && (
                <path
                  className={`chart__bar${i === active ? ' chart__bar--active' : ''}`}
                  d={`M${x0},${PAD.top + innerH} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${PAD.top + innerH} Z`}
                />
              )}
              {(i === 0 || i === weeks.length - 1 || i === Math.floor(weeks.length / 2)) && (
                <text className="chart__axis" x={cx} y={H - 8} textAnchor="middle">
                  {shortDate(w.weekStart)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {current && (
        <Tooltip x={PAD.left + band * active! + band / 2} width={width}>
          <strong>
            {current.completed} {current.completed === 1 ? 'entrenamiento' : 'entrenamientos'}
          </strong>
          <span>Semana del {formatDate(current.weekStart)}</span>
        </Tooltip>
      )}
    </div>
  )
}

/** Muestra la gráfica o, a elección, la misma información en una tabla. */
export function ChartCard({ title, subtitle, chart, table }: { title: string; subtitle?: ReactNode; chart: ReactNode; table: ReactNode }) {
  const [asTable, setAsTable] = useState(false)
  const id = useId()
  return (
    <section className="chart-card" aria-labelledby={id}>
      <div className="chart-card__head">
        <div>
          <h3 className="chart-card__title" id={id}>
            {title}
          </h3>
          {subtitle && <p className="chart-card__subtitle">{subtitle}</p>}
        </div>
        <button type="button" className="link-button" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {asTable ? 'Ver gráfica' : 'Ver tabla'}
        </button>
      </div>
      {asTable ? <div className="table-scroll">{table}</div> : chart}
    </section>
  )
}

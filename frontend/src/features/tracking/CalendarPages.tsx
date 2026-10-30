import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { trainerApi } from '../../api/endpoints'
import { portalTrackingApi, trackingApi, type CalendarItem, type CalendarKind } from '../../api/tracking'
import { Alert, Button, ErrorState, LoadingState, Modal, PageHeader, SelectField, TextAreaField, TextField } from '../../components/ui'
import { addDays, formatDate, todayInMexico } from '../../lib/format'
import { fieldErrors, mondayOf, monthGrid, trackingKeys } from './trackingModel'
import '../library/library.css'
import '../clients/clients.css'
import './tracking.css'

/*
 * Calendario mensual y semanal. Cada elemento lleva un símbolo y su nombre (no solo color).
 * Todo viene de datos guardados: eventos, asignaciones, entrenamientos registrados y evaluaciones.
 */

const KIND_LABELS: Record<CalendarKind, { label: string; icon: string }> = {
  planned: { label: 'Día de rutina', icon: '○' },
  session: { label: 'Entrenamiento registrado', icon: '✓' },
  training: { label: 'Entrenamiento programado', icon: '▸' },
  evaluation: { label: 'Evaluación', icon: '◆' },
  rest: { label: 'Descanso', icon: '–' },
  other: { label: 'Otro', icon: '•' },
  'program-start': { label: 'Inicio de programa', icon: '⇢' },
  'program-end': { label: 'Fin de programa', icon: '⇥' },
}

const STATUS_LABELS: Record<CalendarItem['status'], string> = {
  planned: 'Programado',
  completed: 'Hecho',
  cancelled: 'Cancelado',
  'in-progress': 'En curso',
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const time = (t: string | null) => (t ? t.slice(0, 5) : null)

function weekdayName(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const name = new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long' })
  return name.charAt(0).toUpperCase() + name.slice(1)
}

type View = 'month' | 'week'

function useRange(view: View, anchor: string) {
  if (view === 'week') {
    const from = mondayOf(anchor)
    return { from, to: addDays(from, 6), days: Array.from({ length: 7 }, (_, i) => addDays(from, i)) }
  }
  const days = monthGrid(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1)
  return { from: days[0], to: days[days.length - 1], days }
}

function ItemRow({ item, showClient, onOpen }: { item: CalendarItem; showClient: boolean; onOpen?: (item: CalendarItem) => void }) {
  const k = KIND_LABELS[item.kind]
  const body = (
    <>
      <span className="cal-item__icon" aria-hidden="true">
        {item.kind === 'session' && item.status === 'in-progress' ? '•' : k.icon}
      </span>
      <span className="cal-item__text">
        <span className="cal-item__title">
          {time(item.startTime) && `${time(item.startTime)}${item.endTime ? `–${time(item.endTime)}` : ''} · `}
          {item.title}
        </span>
        <span className="cal-item__meta">
          {k.label}
          {item.detail && item.detail !== k.label ? ` · ${item.detail}` : ''}
          {showClient && item.clientName ? ` · ${item.clientName}` : ''}
          {item.status !== 'planned' ? ` · ${STATUS_LABELS[item.status]}` : ''}
        </span>
        {item.notes && <span className="cal-item__meta">{item.notes}</span>}
      </span>
    </>
  )
  const cls = `cal-item cal-item--${item.kind}${item.status === 'cancelled' ? ' cal-item--cancelled' : ''}${item.status === 'completed' ? ' cal-item--done' : ''}`
  if (onOpen && item.eventId)
    return (
      <li>
        <button type="button" className={`${cls} cal-item--button`} onClick={() => onOpen(item)}>
          {body}
        </button>
      </li>
    )
  return <li className={cls}>{body}</li>
}

/** Calendario completo: barra de navegación, cuadrícula del mes o semana, y la agenda del día elegido. */
function CalendarView({
  items,
  isPending,
  error,
  onRetry,
  view,
  setView,
  anchor,
  setAnchor,
  showClient,
  onOpen,
  hint,
}: {
  items: CalendarItem[] | undefined
  isPending: boolean
  error: Error | null
  onRetry: () => void
  view: View
  setView: (v: View) => void
  anchor: string
  setAnchor: (d: string) => void
  showClient: boolean
  onOpen?: (item: CalendarItem) => void
  hint?: string
}) {
  const today = todayInMexico()
  const [selected, setSelected] = useState(today)
  const { days } = useRange(view, anchor)
  const month = Number(anchor.slice(5, 7)) - 1
  const byDay = new Map<string, CalendarItem[]>()
  for (const i of items ?? []) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i])
  const title =
    view === 'month' ? `${MONTHS[month].charAt(0).toUpperCase()}${MONTHS[month].slice(1)} ${anchor.slice(0, 4)}` : `Semana del ${formatDate(days[0])} al ${formatDate(days[6])}`
  const move = (dir: 1 | -1) => {
    if (view === 'week') setAnchor(addDays(mondayOf(anchor), 7 * dir))
    else {
      const y = Number(anchor.slice(0, 4))
      const d = new Date(Date.UTC(y, month + dir, 1)).toISOString().slice(0, 10)
      setAnchor(d)
    }
  }
  const selectedItems = byDay.get(selected) ?? []

  return (
    <div className="stack">
      <div className="cal-toolbar">
        <div className="cal-toolbar__nav">
          <Button variant="secondary" onClick={() => move(-1)} aria-label={view === 'month' ? 'Mes anterior' : 'Semana anterior'}>
            ←
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setAnchor(today)
              setSelected(today)
            }}
          >
            Hoy
          </Button>
          <Button variant="secondary" onClick={() => move(1)} aria-label={view === 'month' ? 'Mes siguiente' : 'Semana siguiente'}>
            →
          </Button>
        </div>
        <h2 className="cal-toolbar__title" aria-live="polite">
          {title}
        </h2>
        <div className="segmented" role="group" aria-label="Vista">
          <button type="button" className={view === 'month' ? 'segmented__on' : ''} aria-pressed={view === 'month'} onClick={() => setView('month')}>
            Mes
          </button>
          <button type="button" className={view === 'week' ? 'segmented__on' : ''} aria-pressed={view === 'week'} onClick={() => setView('week')}>
            Semana
          </button>
        </div>
      </div>
      {hint && <p className="field__hint">{hint}</p>}

      {isPending ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} onRetry={onRetry} />
      ) : view === 'month' ? (
        <div className="cal-month-layout">
          <div className="cal-month" role="grid" aria-label={title}>
            <div className="cal-month__row" role="row">
              {WEEKDAYS.map((d) => (
                <span key={d} className="cal-month__weekday" role="columnheader">
                  {d}
                </span>
              ))}
            </div>
            {Array.from({ length: days.length / 7 }, (_, w) => (
              <div key={w} className="cal-month__row" role="row">
                {days.slice(w * 7, w * 7 + 7).map((d) => {
                  const list = byDay.get(d) ?? []
                  const outside = Number(d.slice(5, 7)) - 1 !== month
                  return (
                    <button
                      key={d}
                      type="button"
                      role="gridcell"
                      aria-selected={d === selected}
                      aria-label={`${weekdayName(d)} ${formatDate(d)}: ${list.length === 0 ? 'sin elementos' : list.map((i) => `${KIND_LABELS[i.kind].label} ${i.title}`).join(', ')}`}
                      className={`cal-day${outside ? ' cal-day--outside' : ''}${d === today ? ' cal-day--today' : ''}${d === selected ? ' cal-day--selected' : ''}`}
                      onClick={() => setSelected(d)}
                    >
                      <span className="cal-day__number">{Number(d.slice(8))}</span>
                      <span className="cal-day__marks" aria-hidden="true">
                        {list.slice(0, 4).map((i, n) => (
                          <span key={n} className={`cal-mark cal-mark--${i.kind}${i.status === 'cancelled' ? ' cal-mark--cancelled' : ''}`}>
                            {i.kind === 'session' && i.status === 'in-progress' ? '•' : KIND_LABELS[i.kind].icon}
                          </span>
                        ))}
                        {list.length > 4 && <span className="cal-mark">+{list.length - 4}</span>}
                      </span>
                      <span className="cal-day__labels" aria-hidden="true">
                        {list.slice(0, 2).map((i, n) => (
                          <span key={n} className={`cal-day__label${i.status === 'cancelled' ? ' cal-item--cancelled' : ''}`}>
                            {KIND_LABELS[i.kind].icon} {i.title}
                          </span>
                        ))}
                        {list.length > 2 && <span className="cal-day__label muted">+{list.length - 2} más</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <section className="card cal-agenda" aria-labelledby="dia-elegido">
            <h3 className="card__title" id="dia-elegido">
              {weekdayName(selected)} {formatDate(selected)}
            </h3>
            {selectedItems.length === 0 ? (
              <p className="muted">Nada en este día.</p>
            ) : (
              <ul className="cal-list">
                {selectedItems.map((i, n) => (
                  <ItemRow key={n} item={i} showClient={showClient} onOpen={onOpen} />
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <ol className="cal-week" aria-label={title}>
          {days.map((d) => (
            <li key={d} className={`card cal-week__day${d === today ? ' cal-week__day--today' : ''}`}>
              <h3 className="cal-week__date">
                <span className="cal-week__weekday">{weekdayName(d)}</span> {formatDate(d)}
              </h3>
              {(byDay.get(d) ?? []).length === 0 ? (
                <p className="muted">Nada programado.</p>
              ) : (
                <ul className="cal-list">
                  {(byDay.get(d) ?? []).map((i, n) => (
                    <ItemRow key={n} item={i} showClient={showClient} onOpen={onOpen} />
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}

      <ul className="cal-legend" aria-label="Símbolos">
        {Object.entries(KIND_LABELS).map(([kind, k]) => (
          <li key={kind}>
            <span className={`cal-mark cal-mark--${kind}`} aria-hidden="true">
              {k.icon}
            </span>{' '}
            {k.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- Entrenadora ---------- */
export function TrainerCalendarPage() {
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(todayInMexico())
  const [clientId, setClientId] = useState<number | null>(null)
  const [editing, setEditing] = useState<CalendarItem | 'new' | null>(null)
  const clients = useQuery({ queryKey: ['trainer', 'clients'], queryFn: trainerApi.clients })
  const { from, to } = useRange(view, anchor)
  const items = useQuery({ queryKey: [...trackingKeys.calendar, from, to, clientId], queryFn: () => trackingApi.calendar(from, to, clientId) })

  return (
    <>
      <PageHeader title="Calendario" subtitle="Entrenamientos, descansos, evaluaciones y fechas de programas." actions={<Button onClick={() => setEditing('new')}>Nuevo evento</Button>} />
      <div className="stack">
        <div className="form-grid">
          <SelectField label="Cliente" value={clientId ?? ''} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Todos los clientes</option>
            {clients.data
              ?.filter((c) => c.status === 'Active')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
          </SelectField>
        </div>
        <CalendarView
          items={items.data}
          isPending={items.isPending}
          error={items.error}
          onRetry={() => items.refetch()}
          view={view}
          setView={setView}
          anchor={anchor}
          setAnchor={setAnchor}
          showClient={clientId === null}
          onOpen={setEditing}
          hint={clientId === null ? 'Elige un cliente para ver también sus días de rutina y descansos.' : 'Toca un evento creado por ti para editarlo, marcarlo como hecho o cancelarlo.'}
        />
      </div>
      {editing && <EventModal item={editing === 'new' ? null : editing} defaultClientId={clientId} onClose={() => setEditing(null)} />}
    </>
  )
}

function EventModal({ item, defaultClientId, onClose }: { item: CalendarItem | null; defaultClientId: number | null; onClose: () => void }) {
  const qc = useQueryClient()
  const options = useQuery({ queryKey: trackingKeys.options, queryFn: trackingApi.options })
  const clients = useQuery({ queryKey: ['trainer', 'clients'], queryFn: trainerApi.clients })
  const typeOf: Partial<Record<CalendarKind, string>> = { training: '1', rest: '2', evaluation: '3', other: '99' }
  const [form, setForm] = useState({
    clientId: String(item?.clientId ?? defaultClientId ?? ''),
    type: item ? (typeOf[item.kind] ?? '99') : '3',
    title: item?.title ?? '',
    date: item?.date ?? todayInMexico(),
    startTime: time(item?.startTime ?? null) ?? '',
    endTime: time(item?.endTime ?? null) ?? '',
    notes: item?.notes ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const done = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: trackingKeys.calendar }), qc.invalidateQueries({ queryKey: trackingKeys.dashboard }), qc.invalidateQueries({ queryKey: trackingKeys.overview })])
    onClose()
  }
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        clientId: form.clientId ? Number(form.clientId) : null,
        type: Number(form.type),
        title: form.title.trim() || null,
        date: form.date,
        startTime: form.startTime ? `${form.startTime}:00` : null,
        endTime: form.endTime ? `${form.endTime}:00` : null,
        notes: form.notes.trim() || null,
      }
      if (item?.eventId) await trackingApi.updateEvent(item.eventId, payload)
      else await trackingApi.createEvent(payload)
    },
    onSuccess: done,
    onError: (e) => setErrors(fieldErrors(e)),
  })
  const status = useMutation({ mutationFn: (s: 2 | 3) => trackingApi.setEventStatus(item!.eventId!, s), onSuccess: done })
  const editable = !item || item.status === 'planned'
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    save.mutate()
  }

  return (
    <Modal title={item ? 'Evento' : 'Nuevo evento'} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        {(save.error || status.error) && Object.keys(errors).length === 0 && <Alert kind="error">{(save.error ?? status.error)!.message}</Alert>}
        {!editable && <Alert kind="info">Este evento está {STATUS_LABELS[item!.status].toLowerCase()} y ya no se edita. Queda en el calendario como historial.</Alert>}
        <SelectField label="Tipo" value={form.type} onChange={set('type')} disabled={!editable} error={errors.type}>
          {options.data?.eventTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Cliente" value={form.clientId} onChange={set('clientId')} disabled={!editable} error={errors.clientId} hint="El cliente verá el evento y sus notas en su calendario. Sin cliente, es solo para ti.">
          <option value="">Ninguno (evento general)</option>
          {clients.data
            ?.filter((c) => c.status === 'Active' || String(c.id) === form.clientId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
        </SelectField>
        <TextField label="Título (opcional)" maxLength={150} value={form.title} onChange={set('title')} disabled={!editable} error={errors.title} />
        <div className="form-grid">
          <TextField label="Fecha" type="date" required value={form.date} onChange={set('date')} disabled={!editable} error={errors.date} />
          <TextField label="Hora de inicio" type="time" value={form.startTime} onChange={set('startTime')} disabled={!editable} error={errors.startTime} />
          <TextField label="Hora de fin" type="time" value={form.endTime} onChange={set('endTime')} disabled={!editable} error={errors.endTime} />
        </div>
        <TextAreaField label="Notas" maxLength={1000} value={form.notes} onChange={set('notes')} disabled={!editable} error={errors.notes} />
        <div className="form__actions">
          {item?.eventId && editable && (
            <>
              <Button variant="ghost" onClick={() => status.mutate(3)} loading={status.isPending && status.variables === 3}>
                Cancelar evento
              </Button>
              <Button variant="secondary" onClick={() => status.mutate(2)} loading={status.isPending && status.variables === 2}>
                Marcar como hecho
              </Button>
            </>
          )}
          {editable ? (
            <Button type="submit" loading={save.isPending}>
              Guardar
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Cliente ---------- */
export function PortalCalendarPage() {
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(todayInMexico())
  const { from, to } = useRange(view, anchor)
  const items = useQuery({ queryKey: [...trackingKeys.portal, 'calendar', from, to], queryFn: () => portalTrackingApi.calendar(from, to) })
  return (
    <>
      <PageHeader title="Mi calendario" subtitle="Tus días de rutina, entrenamientos, descansos y evaluaciones." />
      <CalendarView
        items={items.data}
        isPending={items.isPending}
        error={items.error}
        onRetry={() => items.refetch()}
        view={view}
        setView={setView}
        anchor={anchor}
        setAnchor={setAnchor}
        showClient={false}
        hint="Los descansos aparecen cuando tu entrenadora asignó día de la semana a cada día de tu rutina."
      />
      <p className="field__hint cal-footnote">
        ¿Quieres entrenar? Ve a <Link to="/portal/rutina">Mi rutina</Link>.
      </p>
    </>
  )
}

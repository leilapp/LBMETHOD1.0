import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../../api/client'
import { clientsApi } from '../../api/clients'
import { trainerApi } from '../../api/endpoints'
import { routinesApi } from '../../api/routines'
import { Alert, Button, LoadingState, Modal, SelectField, TextAreaField, TextField } from '../../components/ui'
import { addDays, formatDate, todayInMexico } from '../../lib/format'

type Props = {
  /** Desde la ficha de un cliente: el cliente está fijo y se elige la rutina. */
  clientId?: number
  clientName?: string
  /** Desde la ficha de una rutina (o "cambiar a la versión nueva"): la rutina está fija y se eligen los clientes. */
  routineId?: number
  versionId?: number
  onClose: () => void
  onAssigned: (count: number) => void
}

/**
 * Asignar una versión publicada a uno o varios clientes. La entrenadora elige todo: rutina, versión,
 * clientes y fechas. Solo se ofrece la fecha de fin según la duración de la rutina, sin aplicarla sola.
 */
export function AssignModal({ clientId, clientName, routineId: fixedRoutine, versionId: fixedVersion, onClose, onAssigned }: Props) {
  const [routineId, setRoutineId] = useState(fixedRoutine ? String(fixedRoutine) : '')
  const [versionId, setVersionId] = useState(fixedVersion ? String(fixedVersion) : '')
  const [selected, setSelected] = useState<number[]>(clientId ? [clientId] : [])
  const [start, setStart] = useState(todayInMexico())
  const [end, setEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const clear = (field: string) => setErrors(({ [field]: _removed, ...rest }) => rest)

  const programs = useQuery({ queryKey: ['routines', 'list', 'program', 'active'], queryFn: () => routinesApi.list('program', 'active'), enabled: !fixedRoutine })
  const detail = useQuery({ queryKey: ['routines', 'detail', Number(routineId)], queryFn: () => routinesApi.get(Number(routineId)), enabled: !!routineId })
  const published = detail.data?.versions.filter((v) => v.status === 'Published') ?? []
  const chosenVersion = versionId || (published[0] ? String(published[0].id) : '')
  const version = useQuery({
    queryKey: ['routines', 'version', Number(routineId), Number(chosenVersion)],
    queryFn: () => routinesApi.version(Number(routineId), Number(chosenVersion)),
    enabled: !!routineId && !!chosenVersion,
  })
  const clients = useQuery({ queryKey: ['trainer', 'clients'], queryFn: trainerApi.clients, enabled: !clientId })
  const weeks = version.data?.durationWeeks ?? null
  const suggestedEnd = weeks && start ? addDays(start, weeks * 7 - 1) : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found: Record<string, string> = {}
    if (!routineId || !chosenVersion) found.routineVersionId = 'Elige la rutina y su versión.'
    if (selected.length === 0) found.clientIds = 'Elige al menos un cliente.'
    if (!start) found.startDate = 'Indica la fecha de inicio.'
    if (end && start && end < start) found.endDate = 'La fecha de fin no puede ser anterior al inicio.'
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    setProblem(null)
    try {
      const result = await clientsApi.assign({ clientIds: selected, routineVersionId: Number(chosenVersion), startDate: start, endDate: end || null, notes: notes.trim() || null })
      onAssigned(result.ids.length)
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k, v[0]])))
      else setProblem((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const activeClients = clients.data?.filter((c) => c.status === 'Active') ?? []

  return (
    <Modal title={clientName ? `Asignar rutina a ${clientName}` : 'Asignar rutina'} onClose={onClose} wide>
      <form className="form" onSubmit={submit} noValidate>
        {problem && <Alert kind="error">{problem}</Alert>}

        {!fixedRoutine && (
          <SelectField
            label="Rutina"
            required
            value={routineId}
            error={errors.routineVersionId}
            onChange={(e) => {
              setRoutineId(e.target.value)
              setVersionId('')
              clear('routineVersionId')
            }}
          >
            <option value="">Elige una rutina publicada…</option>
            {programs.data
              ?.filter((r) => r.publishedVersionNumber !== null)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </SelectField>
        )}
        {!fixedRoutine && programs.data && programs.data.every((r) => r.publishedVersionNumber === null) && (
          <p className="muted">Aún no tienes rutinas publicadas. Publica una en Rutinas para poder asignarla.</p>
        )}

        {routineId && (
          <SelectField label="Versión" required value={chosenVersion} error={fixedRoutine ? errors.routineVersionId : undefined} onChange={(e) => setVersionId(e.target.value)}>
            {published.map((v, i) => (
              <option key={v.id} value={v.id}>
                Versión {v.versionNumber}
                {i === 0 ? ' (la más reciente)' : ''}
              </option>
            ))}
          </SelectField>
        )}

        {!clientId && (
          <fieldset className="assign-clients">
            <legend className="field__label">Clientes *</legend>
            {clients.isPending ? (
              <LoadingState />
            ) : activeClients.length === 0 ? (
              <p className="muted">No tienes clientes activos.</p>
            ) : (
              <div className="assign-clients__grid">
                {activeClients.map((c) => (
                  <label key={c.id} className="check">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={(e) => {
                        setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))
                        clear('clientIds')
                      }}
                    />
                    <span>
                      {c.firstName} {c.lastName}
                      {c.currentProgram && <span className="list-item__meta"> · ahora: {c.currentProgram}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {errors.clientIds && (
              <span className="field__error" role="alert">
                {errors.clientIds}
              </span>
            )}
            <span className="field__hint">Todos comparten la misma versión de la rutina; no se copian los ejercicios.</span>
          </fieldset>
        )}
        {clientId && errors.clientIds && <Alert kind="error">{errors.clientIds}</Alert>}

        <div className="form-grid">
          <TextField label="Fecha de inicio" type="date" required value={start} error={errors.startDate} onChange={(e) => {
              setStart(e.target.value)
              clear('startDate')
            }} />
          <TextField
            label="Fecha de fin"
            type="date"
            value={end}
            min={start || undefined}
            error={errors.endDate}
            hint="Opcional. Último día del programa."
            onChange={(e) => {
              setEnd(e.target.value)
              clear('endDate')
            }}
          />
        </div>
        {suggestedEnd && end !== suggestedEnd && (
          <p className="field__hint">
            La rutina dura {weeks} {weeks === 1 ? 'semana' : 'semanas'}: terminaría el {formatDate(suggestedEnd)}.{' '}
            <button type="button" className="link-button" onClick={() => {
              setEnd(suggestedEnd)
              clear('endDate')
            }}>
              Usar esa fecha
            </button>
          </p>
        )}
        <TextAreaField
          label="Indicaciones para el cliente"
          value={notes}
          maxLength={1000}
          rows={3}
          error={errors.notes}
          hint="El cliente las verá en su portal. Para notas privadas usa las observaciones del perfil."
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Asignar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

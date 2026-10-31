import { Hono } from 'hono'
import type { Context } from 'hono'
import { audit } from '../audit'
import { effective, STATUS_LABELS } from '../clients/assignments'
import { dayNames, EXPERIENCE, LOCATIONS, PROFILE_COLUMNS, type ProfileRow } from '../clients/profiles'
import { localDate } from '../dates'
import { notFound } from '../http'
import { dayLabel } from '../routines/model'
import { currentUser } from '../session'
import type { AppBindings } from '../types'
import { autoWidths, writeWorkbook, type CellValue } from '../xlsx'
import { download, reps, setDetailText, setTypeLabel, slug, unitName, type SetLike } from './format'

/**
 * Exportaciones a Excel de la entrenadora, solo con sus propios datos (lo ajeno responde 404). Encabezado violeta fijo,
 * fechas como fecha y números como número; el texto se escribe siempre como texto (nunca se vuelve fórmula).
 */
export const excelExports = new Hono<AppBindings>()
type Ctx = Context<AppBindings>

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const date = (iso: string | null): CellValue => (iso ? { date: iso.slice(0, 10) } : null)
const centi = (v: number | null) => (v === null ? null : v / 100)
const byText = (a: string, b: string) => a.localeCompare(b, 'es')

function workbook(name: string, sheets: { name: string; headers: string[]; rows: CellValue[][] }[]) {
  const bytes = writeWorkbook(
    sheets.map((s) => {
      const rows = [s.headers, ...s.rows]
      return { name: s.name, rows, header: 'brand' as const, freezeHeader: true, autoFilter: s.rows.length > 0, widths: autoWidths(rows, 10, 50) }
    }),
  )
  return download(bytes, XLSX_TYPE, `${name}-lbmethod-${localDate()}.xlsx`)
}

/** Clientes con su perfil y el historial de asignaciones. No incluye las observaciones privadas. */
excelExports.get('/clients', async (c: Ctx) => {
  const db = c.env.DB
  const trainerId = currentUser(c).id
  const [clientsRes, assignmentsRes] = await db.batch([
    db.prepare(`SELECT ${PROFILE_COLUMNS} FROM clients WHERE trainer_id = ?`).bind(trainerId),
    db
      .prepare(
        `SELECT a.client_id, v.title, v.version_number, a.start_date, a.end_date, a.status, a.notes FROM routine_assignments a
           JOIN clients c ON c.id = a.client_id JOIN routine_versions v ON v.id = a.routine_version_id WHERE c.trainer_id = ? ORDER BY a.id`,
      )
      .bind(trainerId),
  ])
  const clients = (clientsRes.results as ProfileRow[]).sort((a, b) => byText(a.last_name, b.last_name) || byText(a.first_name, b.first_name))
  type A = { client_id: number; title: string; version_number: number; start_date: string; end_date: string | null; status: number; notes: string | null }
  const today = localDate()
  const assignments = (assignmentsRes.results as A[]).map((a) => ({ ...a, effective: effective(a.status, a.start_date, a.end_date, today) }))
  const names = new Map(clients.map((x) => [x.id, `${x.first_name} ${x.last_name}`]))

  const clientRows = clients.map((x) => {
    const current = assignments.filter((a) => a.client_id === x.id && a.effective === 2).map((a) => a.title)
    return [
      x.first_name, x.last_name, x.email, x.phone, x.status === 'Active' ? 'Activo' : 'Inactivo', date(x.birth_date),
      centi(x.height_centi), x.height_unit === null ? null : x.height_unit === 1 ? 'cm' : 'in',
      centi(x.weight_centi), unitName(x.weight_unit),
      x.experience_level ? EXPERIENCE[x.experience_level] : null, x.goal,
      x.training_location ? LOCATIONS[x.training_location] : null, dayNames(x.available_days).join(', '),
      x.session_duration_minutes, x.declared_limitations, x.user_id === null ? 'No' : 'Sí',
      current.length ? current.join('; ') : null, date(localDate(new Date(x.created_at))),
    ]
  })
  const assignmentRows = assignments
    .filter((a) => names.has(a.client_id))
    .sort((a, b) => byText(names.get(a.client_id)!, names.get(b.client_id)!) || b.start_date.localeCompare(a.start_date))
    .map((a) => [names.get(a.client_id)!, a.title, a.version_number, date(a.start_date), date(a.end_date), STATUS_LABELS[a.effective], a.notes])

  await audit(c, 'ClientsExported', 'Client', null)
  return workbook('clientes', [
    {
      name: 'Clientes',
      headers: [
        'Nombre', 'Apellidos', 'Correo', 'Teléfono', 'Estado', 'Fecha de nacimiento', 'Estatura', 'Unidad estatura', 'Peso', 'Unidad peso',
        'Nivel', 'Objetivo', 'Lugar de entrenamiento', 'Días disponibles', 'Duración por sesión (min)', 'Limitaciones declaradas',
        'Tiene cuenta', 'Programa vigente', 'Registrado',
      ],
      rows: clientRows,
    },
    { name: 'Asignaciones', headers: ['Cliente', 'Rutina', 'Versión', 'Inicio', 'Fin', 'Estado', 'Indicaciones'], rows: assignmentRows },
  ])
})

/** Rutinas y plantillas: resumen y detalle de la versión vigente de cada una (la publicada más reciente o, si no hay, el borrador). */
excelExports.get('/routines', async (c: Ctx) => {
  const db = c.env.DB
  const trainerId = currentUser(c).id
  const [routinesRes, versionsRes, exercisesRes, setsRes, assignmentsRes] = await db.batch([
    db.prepare('SELECT id, kind, name, status FROM routines WHERE trainer_id = ?').bind(trainerId),
    db
      .prepare(
        `SELECT v.id, v.routine_id, v.version_number, v.status, v.goal, v.duration_weeks, v.published_at,
                (SELECT COUNT(*) FROM routine_days d WHERE d.routine_version_id = v.id) AS day_count
           FROM routine_versions v JOIN routines r ON r.id = v.routine_id WHERE r.trainer_id = ?`,
      )
      .bind(trainerId),
    db
      .prepare(
        `SELECT e.*, d.routine_version_id, d.position AS day_position, d.name AS day_name, d.day_of_week, x.name_es
           FROM routine_exercises e JOIN routine_days d ON d.id = e.routine_day_id JOIN routine_versions v ON v.id = d.routine_version_id
           JOIN routines r ON r.id = v.routine_id JOIN exercises x ON x.id = e.exercise_id
          WHERE r.trainer_id = ? ORDER BY d.position, e.position`,
      )
      .bind(trainerId),
    db
      .prepare(
        `SELECT s.* FROM routine_exercise_sets s JOIN routine_exercises e ON e.id = s.routine_exercise_id JOIN routine_days d ON d.id = e.routine_day_id
           JOIN routine_versions v ON v.id = d.routine_version_id JOIN routines r ON r.id = v.routine_id WHERE r.trainer_id = ?`,
      )
      .bind(trainerId),
    db
      .prepare(
        `SELECT v.routine_id, a.status, a.start_date, a.end_date FROM routine_assignments a JOIN routine_versions v ON v.id = a.routine_version_id
           JOIN routines r ON r.id = v.routine_id WHERE r.trainer_id = ?`,
      )
      .bind(trainerId),
  ])
  type R = { id: number; kind: number; name: string; status: number }
  type V = { id: number; routine_id: number; version_number: number; status: number; goal: string | null; duration_weeks: number | null; published_at: string | null; day_count: number }
  type E = SetLike & {
    id: number; routine_version_id: number; day_position: number; day_name: string; day_of_week: number | null; position: number; name_es: string
    superset_group: string | null; sets: number; tempo: string | null; notes: string | null
  }
  const routines = (routinesRes.results as R[]).sort((a, b) => a.kind - b.kind || byText(a.name, b.name))
  const versions = versionsRes.results as V[]
  const setsOf = new Map<number, SetLike[]>()
  for (const s of setsRes.results as (SetLike & { routine_exercise_id: number })[]) setsOf.set(s.routine_exercise_id, [...(setsOf.get(s.routine_exercise_id) ?? []), s])
  const today = localDate()
  const assignments = assignmentsRes.results as { routine_id: number; status: number; start_date: string; end_date: string | null }[]
  const latest = (list: V[]) => list.reduce<V | null>((best, v) => (best === null || v.version_number > best.version_number ? v : best), null)

  const summary: CellValue[][] = []
  const detail: CellValue[][] = []
  for (const r of routines) {
    const mine = versions.filter((v) => v.routine_id === r.id)
    const published = latest(mine.filter((v) => v.status === 2))
    const shown = published ?? latest(mine)
    summary.push([
      r.name, r.kind === 1 ? 'Programa' : 'Plantilla', r.status === 1 ? 'Activa' : 'Archivada', published?.version_number ?? null,
      mine.some((v) => v.status === 1) ? 'Sí' : 'No', shown?.goal ?? null, shown?.duration_weeks ?? null, shown?.day_count ?? null,
      assignments.filter((a) => a.routine_id === r.id && [1, 2].includes(effective(a.status, a.start_date, a.end_date, today))).length,
      published?.published_at ? date(localDate(new Date(published.published_at))) : null,
    ])
    if (!shown) continue
    for (const e of (exercisesRes.results as E[]).filter((x) => x.routine_version_id === shown.id)) {
      const details = setsOf.get(e.id) ?? []
      detail.push([
        r.name, `v${shown.version_number}${shown.status === 1 ? ' (borrador)' : ''}`, e.day_name, dayLabel(e.day_of_week), e.position, e.name_es,
        e.superset_group, e.sets, reps(e.reps_min, e.reps_max), centi(e.suggested_weight_centi), unitName(e.suggested_weight_unit), e.rest_seconds,
        e.tempo, e.rir, e.rpe, setTypeLabel(e.set_type), details.length ? setDetailText(details) : null, e.notes,
      ])
    }
  }

  await audit(c, 'RoutinesExported', 'Routine', null)
  return workbook('rutinas', [
    {
      name: 'Rutinas',
      headers: ['Nombre', 'Tipo', 'Estado', 'Versión publicada', 'Borrador abierto', 'Objetivo', 'Semanas', 'Días', 'Clientes con la rutina vigente o programada', 'Publicada el'],
      rows: summary,
    },
    {
      name: 'Detalle',
      headers: [
        'Rutina', 'Versión', 'Día', 'Día de la semana', 'Orden', 'Ejercicio', 'Superserie', 'Series', 'Repeticiones', 'Peso sugerido', 'Unidad',
        'Descanso (s)', 'Tempo', 'RIR', 'RPE', 'Tipo de serie', 'Series detalladas', 'Notas',
      ],
      rows: detail,
    },
  ])
})

/** Evaluaciones y medidas de todos los clientes o, con clientId, de uno. Una fila por medida, con su fecha y unidad. */
excelExports.get('/evaluations', async (c: Ctx) => {
  const db = c.env.DB
  const trainerId = currentUser(c).id
  const raw = c.req.query('clientId')
  const clientId = raw ? Number(raw) : null
  if (clientId !== null) {
    const owned = Number.isInteger(clientId) && (await db.prepare('SELECT 1 AS x FROM clients WHERE id = ? AND trainer_id = ?').bind(clientId, trainerId).first())
    if (!owned) return notFound(c)
  }
  const [evaluationsRes, measurementsRes] = await db.batch([
    db
      .prepare(
        `SELECT e.id, e.evaluated_on, e.notes, c.first_name, c.last_name FROM evaluations e JOIN clients c ON c.id = e.client_id
          WHERE c.trainer_id = ?1 AND (?2 IS NULL OR c.id = ?2)`,
      )
      .bind(trainerId, clientId),
    db
      .prepare(
        `SELECT m.evaluation_id, t.name_es, m.value_centi, m.unit, m.notes FROM measurements m JOIN measurement_types t ON t.id = m.measurement_type_id
           JOIN clients c ON c.id = m.client_id WHERE c.trainer_id = ?1 AND (?2 IS NULL OR c.id = ?2) AND m.evaluation_id IS NOT NULL
          ORDER BY t.sort_order, m.id`,
      )
      .bind(trainerId, clientId),
  ])
  type Ev = { id: number; evaluated_on: string; notes: string | null; first_name: string; last_name: string }
  type M = { evaluation_id: number; name_es: string; value_centi: number; unit: string; notes: string | null }
  const byEvaluation = new Map<number, M[]>()
  for (const m of measurementsRes.results as M[]) byEvaluation.set(m.evaluation_id, [...(byEvaluation.get(m.evaluation_id) ?? []), m])
  const evaluations = (evaluationsRes.results as Ev[]).sort(
    (a, b) => byText(a.last_name, b.last_name) || byText(a.first_name, b.first_name) || a.evaluated_on.localeCompare(b.evaluated_on) || a.id - b.id,
  )
  const rows: CellValue[][] = []
  for (const e of evaluations) {
    const name = `${e.first_name} ${e.last_name}`
    const list = byEvaluation.get(e.id) ?? []
    if (list.length === 0) rows.push([name, date(e.evaluated_on), null, null, null, null, e.notes])
    for (const m of list) rows.push([name, date(e.evaluated_on), m.name_es, m.value_centi / 100, m.unit, m.notes, e.notes])
  }
  await audit(c, 'EvaluationsExported', 'Evaluation', null, clientId === null ? undefined : `Cliente ${clientId}`)
  const suffix = clientId === null ? '' : `-${slug(evaluations[0]?.first_name ?? 'cliente', 'cliente')}`
  return workbook(`evaluaciones${suffix}`, [
    { name: 'Evaluaciones', headers: ['Cliente', 'Fecha', 'Medida', 'Valor', 'Unidad', 'Nota de la medida', 'Notas de la evaluación'], rows },
  ])
})

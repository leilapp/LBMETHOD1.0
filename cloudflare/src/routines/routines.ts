import { Hono } from 'hono'
import type { Context } from 'hono'
import { audit } from '../audit'
import { notFound, nowIso, problem, readJson, validation } from '../http'
import { currentUser } from '../session'
import { cleanOptional, likeTerm, normalize } from '../text'
import type { AppBindings } from '../types'
import { addError, DAYS, dayLabel, exerciseIds, KINDS, Reader, ROUTINE_STATUS, SET_TYPES, validateDays, validateHeader, VERSION_STATUS, type Errors, type Header } from './model'
import { contentStatements, copyStatements, createStatements, draftOf, loadCatalog, loadVersion, prescription, toInput, versionId } from './store'

/**
 * Constructor manual de rutinas y plantillas (mismas direcciones y respuestas que la versión .NET). La entrenadora
 * decide cada día, ejercicio, orden y parámetro; aquí solo se valida y se guarda. Una versión publicada nunca cambia:
 * editarla crea un borrador nuevo que al publicarse es la siguiente versión. Solo la entrenadora dueña ve sus rutinas;
 * para cualquier otra responden 404.
 */
export const routines = new Hono<AppBindings>()

type Ctx = Context<AppBindings>
const id = (c: Ctx, name = 'id') => Number(c.req.param(name))
const conflict = (c: Ctx, detail: string) => problem(c, 409, 'Conflicto', detail)
const ARCHIVED = 'La rutina está archivada. Restáurala para editarla.'
const ALREADY_PUBLISHED = 'Este borrador ya se publicó. Recarga la rutina para seguir editando sobre una versión nueva.'
const isImmutableError = (err: unknown) => String(err).includes('published_version_immutable')
const isUniqueError = (err: unknown) => /UNIQUE constraint failed/i.test(String(err))

interface RoutineRow {
  id: number
  kind: number
  name: string
  status: number
  archived_at: string | null
}

const owned = (c: Ctx, routineId: number) =>
  c.env.DB.prepare('SELECT id, kind, name, status, archived_at FROM routines WHERE id = ? AND trainer_id = ?').bind(routineId, currentUser(c).id).first<RoutineRow>()

routines.get('/options', (c) =>
  c.json({
    setTypes: Object.entries(SET_TYPES).map(([value, label]) => ({ value: Number(value), label })),
    daysOfWeek: DAYS.map(([value, label]) => ({ value, label })),
    weightUnits: [
      { value: 1, label: 'kg' },
      { value: 2, label: 'lb' },
    ],
  }),
)

/** kind: program (predeterminado) o template. status: active (predeterminado) o archived. q: busca en el nombre. */
routines.get('/', async (c) => {
  const kind = c.req.query('kind') === 'template' ? 2 : 1
  const status = c.req.query('status') === 'archived' ? 2 : 1
  const term = normalize(c.req.query('q')).slice(0, 150)
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.kind, r.name, r.status, r.updated_at, lv.goal,
            (SELECT MAX(version_number) FROM routine_versions v WHERE v.routine_id = r.id AND v.status = 2) AS published,
            EXISTS (SELECT 1 FROM routine_versions v WHERE v.routine_id = r.id AND v.status = 1) AS has_draft,
            (SELECT COUNT(*) FROM routine_days d WHERE d.routine_version_id = lv.id) AS days,
            (SELECT COUNT(*) FROM routine_exercises e JOIN routine_days d ON d.id = e.routine_day_id WHERE d.routine_version_id = lv.id) AS exercises
       FROM routines r
       -- Lo que se ve en la lista corresponde a la versión más reciente (el borrador si existe).
       LEFT JOIN routine_versions lv ON lv.id = (SELECT id FROM routine_versions WHERE routine_id = r.id ORDER BY version_number DESC LIMIT 1)
      WHERE r.trainer_id = ? AND r.kind = ? AND r.status = ? ${term ? "AND r.name_key LIKE ? ESCAPE '\\'" : ''}
      ORDER BY r.updated_at DESC, r.id DESC`,
  )
    .bind(currentUser(c).id, kind, status, ...(term ? [likeTerm(term)] : []))
    .all<{ id: number; kind: number; name: string; status: number; updated_at: string; goal: string | null; published: number | null; has_draft: number; days: number; exercises: number }>()
  return c.json(
    results.map((r) => ({
      id: r.id, kind: KINDS[r.kind], name: r.name, status: ROUTINE_STATUS[r.status], goal: r.goal, publishedVersionNumber: r.published,
      hasDraft: r.has_draft === 1, dayCount: r.days, exerciseCount: r.exercises, updatedAt: r.updated_at,
    })),
  )
})

const parseKind = (value: unknown, errors: Errors) => {
  if (value === undefined || value === null) addError(errors, 'kind', 'Indica si es rutina o plantilla.')
  else if (value !== 1 && value !== 2) addError(errors, 'kind', 'Tipo de rutina no válido.')
  return value as 1 | 2
}

/** Crea la rutina (o plantilla) con su primer borrador y devuelve su id. */
async function create(c: Ctx, kind: number, header: Header, sourceVersionId: number | null) {
  const errors: Errors = {}
  validateHeader(header, errors)
  if (Object.keys(errors).length) return validation(c, errors)
  const [inserted] = await c.env.DB.batch<{ id: number }>(createStatements(c.env.DB, currentUser(c).id, kind, header, sourceVersionId, nowIso()))
  const routineId = inserted.results[0].id
  return c.json({ id: routineId }, 201, { Location: `/api/trainer/routines/${routineId}` })
}

routines.post('/', async (c) => {
  const body = await readJson(c)
  if (!body) return validation(c, { body: ['Datos no válidos.'] })
  const reader = new Reader()
  const kind = parseKind(body.kind, reader.errors)
  const header = reader.header(body)
  if (Object.keys(reader.errors).length) return validation(c, reader.errors)
  return create(c, kind, header, null)
})

routines.get('/:id{[0-9]+}', async (c) => {
  const routine = await owned(c, id(c))
  if (!routine) return notFound(c)
  const { results } = await c.env.DB.prepare(
    'SELECT id, version_number, status, title, published_at, change_notes, updated_at FROM routine_versions WHERE routine_id = ? ORDER BY version_number DESC',
  )
    .bind(routine.id)
    .all<{ id: number; version_number: number; status: number; title: string; published_at: string | null; change_notes: string | null; updated_at: string }>()
  return c.json({
    id: routine.id,
    kind: KINDS[routine.kind],
    name: routine.name,
    status: ROUTINE_STATUS[routine.status],
    archivedAt: routine.archived_at,
    draftVersionId: results.find((v) => v.status === 1)?.id ?? null,
    latestPublishedVersionId: results.find((v) => v.status === 2)?.id ?? null,
    versions: results.map((v) => ({
      id: v.id, versionNumber: v.version_number, status: VERSION_STATUS[v.status], title: v.title, publishedAt: v.published_at,
      changeNotes: v.change_notes, updatedAt: v.updated_at,
    })),
  })
})

/** Contenido completo de una versión (borrador o publicada), para editar, revisar o ver la vista previa. */
routines.get('/:id{[0-9]+}/versions/:versionId{[0-9]+}', async (c) => {
  const loaded = await loadVersion(c.env.DB, currentUser(c).id, id(c, 'versionId'))
  if (!loaded || loaded.version.routine_id !== id(c)) return notFound(c)
  const v = loaded.version
  return c.json({
    id: v.id,
    routineId: v.routine_id,
    routineKind: KINDS[v.kind],
    versionNumber: v.version_number,
    status: VERSION_STATUS[v.status],
    title: v.title,
    description: v.description,
    goal: v.goal,
    durationWeeks: v.duration_weeks,
    changeNotes: v.change_notes,
    publishedAt: v.published_at,
    sourceVersionId: v.source_version_id,
    updatedAt: v.updated_at,
    days: loaded.days.map((d) => ({
      id: d.id,
      position: d.position,
      name: d.name,
      dayOfWeek: d.day_of_week,
      dayLabel: dayLabel(d.day_of_week),
      notes: d.notes,
      exercises: d.exercises.map((e) => ({
        id: e.id,
        position: e.position,
        exerciseId: e.exercise_id,
        exerciseNameEs: e.name_es,
        exerciseNameEn: e.name_en,
        exerciseIsActive: e.is_active === 1,
        primaryMuscleGroup: e.primary_muscle,
        supersetGroup: e.superset_group,
        sets: e.sets,
        ...prescription(e),
        tempo: e.tempo,
        rir: e.rir,
        rpe: e.rpe,
        setType: e.set_type,
        setTypeLabel: SET_TYPES[e.set_type],
        notes: e.notes,
        setDetails: e.details.map((s) => ({
          setNumber: s.set_number,
          setType: s.set_type,
          setTypeLabel: SET_TYPES[s.set_type],
          ...prescription(s),
          rir: s.rir,
          rpe: s.rpe,
          notes: s.notes,
        })),
      })),
    })),
  })
})

/** Abre el borrador para editar. Si no existe, se crea copiando la última versión (queda como la siguiente). */
routines.post('/:id{[0-9]+}/draft', async (c) => {
  const routine = await owned(c, id(c))
  if (!routine) return notFound(c)
  if (routine.status === 2) return conflict(c, ARCHIVED)
  const db = c.env.DB
  const existing = () => db.prepare('SELECT id FROM routine_versions WHERE routine_id = ? AND status = 1').bind(routine.id).first<{ id: number }>()
  const draft = await existing()
  if (draft) return c.json({ id: draft.id })

  const latest = await db
    .prepare('SELECT id, version_number FROM routine_versions WHERE routine_id = ? ORDER BY version_number DESC LIMIT 1')
    .bind(routine.id)
    .first<{ id: number; version_number: number }>()
  if (!latest) return notFound(c)
  const now = nowIso()
  try {
    const [inserted] = await db.batch<{ id: number }>([
      db
        .prepare(
          `INSERT INTO routine_versions (routine_id, version_number, title, description, goal, duration_weeks, source_version_id, created_at, updated_at)
           SELECT routine_id, version_number + 1, title, description, goal, duration_weeks, id, ?, ? FROM routine_versions WHERE id = ? RETURNING id`,
        )
        .bind(now, now, latest.id),
      ...copyStatements(db, draftOf(routine.id), latest.id, now),
      db
        .prepare(`INSERT INTO audit_logs (occurred_at, user_id, action, entity_type, entity_id, details) VALUES (?, ?, 'RoutineDraftOpened', 'Routine', ?, ?)`)
        .bind(now, currentUser(c).id, String(routine.id), String(latest.id)),
    ])
    return c.json({ id: inserted.results[0].id })
  } catch (err) {
    // Dos pestañas abrieron el borrador al mismo tiempo: solo puede existir uno y se devuelve ese.
    const again = isUniqueError(err) ? await existing() : null
    if (again) return c.json({ id: again.id })
    throw err
  }
})

/**
 * Guarda el borrador completo (datos, días y ejercicios en el orden recibido). Se permite guardar incompleto; las
 * reglas para publicar se revisan al publicar.
 */
routines.put('/:id{[0-9]+}/draft', async (c) => {
  const body = await readJson(c)
  if (!body) return validation(c, { body: ['Datos no válidos.'] })
  const draftVersionId = body.draftVersionId
  if (typeof draftVersionId !== 'number' || !Number.isInteger(draftVersionId)) return validation(c, { draftVersionId: ['Falta el borrador que se guarda.'] })
  const routine = await owned(c, id(c))
  if (!routine) return notFound(c)
  if (routine.status === 2) return conflict(c, ARCHIVED)
  const db = c.env.DB
  const draft = await db.prepare('SELECT status FROM routine_versions WHERE id = ? AND routine_id = ?').bind(draftVersionId, routine.id).first<{ status: number }>()
  if (!draft) return notFound(c)
  if (draft.status !== 1) return conflict(c, ALREADY_PUBLISHED)

  const reader = new Reader()
  const header = reader.header(body)
  const days = reader.days(body)
  const errors = reader.errors
  validateHeader(header, errors)
  validateDays(days, await loadCatalog(db, exerciseIds(days)), errors, false)
  if (Object.keys(errors).length) return validation(c, errors)

  const now = nowIso()
  const title = header.title.trim()
  try {
    // El borrador no lo usa nadie todavía: su contenido se reemplaza completo. Si otra pestaña lo publicó mientras
    // tanto, la base rechaza el cambio (versión publicada inmutable) y no se guarda nada.
    await db.batch([
      db.prepare('DELETE FROM routine_days WHERE routine_version_id = ?').bind(draftVersionId),
      db
        .prepare('UPDATE routine_versions SET title = ?, description = ?, goal = ?, duration_weeks = ?, updated_at = ? WHERE id = ?')
        .bind(title, cleanOptional(header.description), cleanOptional(header.goal), header.durationWeeks, now, draftVersionId),
      db.prepare('UPDATE routines SET name = ?, name_key = ?, updated_at = ? WHERE id = ?').bind(title, normalize(title), now, routine.id),
      ...contentStatements(db, versionId(draftVersionId), days, now),
      db
        .prepare(`INSERT INTO audit_logs (occurred_at, user_id, action, entity_type, entity_id, details) VALUES (?, ?, 'RoutineDraftSaved', 'Routine', ?, ?)`)
        .bind(now, currentUser(c).id, String(routine.id), String(draftVersionId)),
    ])
  } catch (err) {
    if (isImmutableError(err)) return conflict(c, ALREADY_PUBLISHED)
    throw err
  }
  return c.body(null, 204)
})

/** Descarta el borrador. Solo si ya existe alguna versión publicada (si no, se archiva la rutina). */
routines.delete('/:id{[0-9]+}/draft', async (c) => {
  const routine = await owned(c, id(c))
  if (!routine) return notFound(c)
  const db = c.env.DB
  const draft = await db.prepare('SELECT id, version_number FROM routine_versions WHERE routine_id = ? AND status = 1').bind(routine.id).first<{ id: number; version_number: number }>()
  if (!draft) return notFound(c)
  if (!(await db.prepare('SELECT 1 FROM routine_versions WHERE routine_id = ? AND status = 2').bind(routine.id).first()))
    return conflict(c, 'Esta rutina no tiene versiones publicadas; en lugar de descartar el borrador, archívala.')
  // Borrar la versión borra en cascada sus días, ejercicios y series. Las versiones publicadas no se pueden borrar.
  await db.batch([
    db.prepare('DELETE FROM routine_versions WHERE id = ? AND status = 1').bind(draft.id),
    db
      .prepare(`INSERT INTO audit_logs (occurred_at, user_id, action, entity_type, entity_id, details) VALUES (?, ?, 'RoutineDraftDiscarded', 'Routine', ?, ?)`)
      .bind(nowIso(), currentUser(c).id, String(routine.id), `v${draft.version_number}`),
  ])
  return c.body(null, 204)
})

/** Publica el borrador: queda como versión fija y trazable, lista para asignarse. */
routines.post('/:id{[0-9]+}/publish', async (c) => {
  const body = (await readJson(c)) ?? {}
  const draftVersionId = body.draftVersionId
  if (typeof draftVersionId !== 'number' || !Number.isInteger(draftVersionId)) return validation(c, { draftVersionId: ['Falta el borrador que se publica.'] })
  if (body.changeNotes !== undefined && body.changeNotes !== null && typeof body.changeNotes !== 'string') return validation(c, { changeNotes: ['Debe ser texto.'] })
  const routine = await owned(c, id(c))
  if (!routine) return notFound(c)
  if (routine.status === 2) return conflict(c, 'La rutina está archivada. Restáurala para publicarla.')
  const db = c.env.DB
  const loaded = await loadVersion(db, currentUser(c).id, draftVersionId)
  if (!loaded || loaded.version.routine_id !== routine.id) return notFound(c)
  if (loaded.version.status !== 1) return conflict(c, 'Esta versión ya está publicada.')
  const changeNotes = cleanOptional(body.changeNotes)
  if (changeNotes && changeNotes.length > 1000) return validation(c, { changeNotes: ['Máximo 1000 caracteres.'] })

  const days = toInput(loaded)
  const errors: Errors = {}
  validateDays(days, await loadCatalog(db, exerciseIds(days)), errors, true)
  if (Object.keys(errors).length) return validation(c, errors)

  const now = nowIso()
  const result = await db
    .prepare('UPDATE routine_versions SET status = 2, published_at = ?, published_by_user_id = ?, change_notes = ?, updated_at = ? WHERE id = ? AND status = 1')
    .bind(now, currentUser(c).id, changeNotes, now, draftVersionId)
    .run()
  if (!result.meta.changes) return conflict(c, 'Esta versión ya está publicada.')
  await audit(c, 'RoutinePublished', 'Routine', routine.id, `v${loaded.version.version_number}`)
  return c.json({ id: draftVersionId })
})

/**
 * Copia una versión en una rutina nueva: duplicar, guardar como plantilla o crear desde plantilla. Si no se indica
 * versión, se usa la más reciente (el borrador si existe). La copia empieza como borrador y no toca el original.
 */
routines.post('/:id{[0-9]+}/copy', async (c) => {
  const body = await readJson(c)
  if (!body) return validation(c, { body: ['Datos no válidos.'] })
  const reader = new Reader()
  const kind = parseKind(body.kind, reader.errors)
  const title = reader.str(body, 'title', 'title')
  const requested = reader.int(body, 'versionId', 'versionId')
  if (title && title.trim().length > 150) addError(reader.errors, 'title', 'Máximo 150 caracteres.')
  if (Object.keys(reader.errors).length) return validation(c, reader.errors)

  const routine = await owned(c, id(c))
  if (!routine) return notFound(c)
  const source = await c.env.DB.prepare(
    `SELECT id, title, description, goal, duration_weeks FROM routine_versions
      WHERE routine_id = ? ${requested === null ? '' : 'AND id = ?'} ORDER BY version_number DESC LIMIT 1`,
  )
    .bind(routine.id, ...(requested === null ? [] : [requested]))
    .first<{ id: number; title: string; description: string | null; goal: string | null; duration_weeks: number | null }>()
  if (!source) return notFound(c)
  const header: Header = { title: title?.trim() ? title : source.title, description: source.description, goal: source.goal, durationWeeks: source.duration_weeks }
  return create(c, kind, header, source.id)
})

/** Archivar oculta la rutina de las listas sin borrar versiones ni historial. */
for (const [path, archived] of [['archive', true], ['restore', false]] as const) {
  routines.post(`/:id{[0-9]+}/${path}`, async (c) => {
    const now = nowIso()
    const result = await c.env.DB.prepare('UPDATE routines SET status = ?, archived_at = ?, updated_at = ? WHERE id = ? AND trainer_id = ?')
      .bind(archived ? 2 : 1, archived ? now : null, now, id(c), currentUser(c).id)
      .run()
    if (!result.meta.changes) return notFound(c)
    await audit(c, archived ? 'RoutineArchived' : 'RoutineRestored', 'Routine', id(c))
    return c.body(null, 204)
  })
}

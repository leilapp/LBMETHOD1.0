// Uso: con la API y 'npm run dev' en marcha → node e2e/seguimiento.cjs <carpeta-capturas> <imagen.png>
// Seguimiento (Fase 9): evaluaciones, medidas, fotos privadas, progreso y calendario. Frontend (Vite) + API real + SQL Server real.
// Requiere LBMETHOD_E2E_EMAIL, LBMETHOD_E2E_PASSWORD (cuenta de PRUEBA) y LBMETHOD_E2E_TAG (texto único por ejecución).
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:5173'
const OUT = process.argv[2] ?? require('os').tmpdir()
const IMAGE = process.argv[3]
const TAG = process.env.LBMETHOD_E2E_TAG
const TRAINER = { email: process.env.LBMETHOD_E2E_EMAIL, password: process.env.LBMETHOD_E2E_PASSWORD }
if (!TRAINER.email || !TRAINER.password || !TAG || !IMAGE) {
  console.error('Define LBMETHOD_E2E_EMAIL, LBMETHOD_E2E_PASSWORD y LBMETHOD_E2E_TAG, e indica una imagen PNG')
  process.exit(1)
}
const results = []
let current = null
const check = (name, ok) => { results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}`); if (!ok) process.exitCode = 1 }
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const weekday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay() // 0 = domingo, igual que DayOfWeek de .NET
const monday = addDays(today, -((weekday(today) + 6) % 7))
// Un día de esta misma semana distinto de hoy (para que la vista semanal lo muestre).
const otherDay = weekday(today) === 0 ? addDays(today, -1) : addDays(today, 1)
const monthAgo = addDays(today, -30)
const phone = { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
const esDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')

async function csrf(page) {
  return (await (await page.request.get(`${BASE}/api/auth/csrf`)).json()).token
}
async function call(page, method, url, data) {
  const res = await page.request.fetch(`${BASE}${url}`, { method, headers: { 'X-CSRF-TOKEN': await csrf(page) }, data })
  if (res.status() >= 300) throw new Error(`${method} ${url}: ${res.status()} ${await res.text()}`)
  return res.status() === 204 ? null : res.json()
}
async function status(page, method, url, data) {
  return (await page.request.fetch(`${BASE}${url}`, { method, headers: { 'X-CSRF-TOKEN': await csrf(page) }, data })).status()
}
async function login(page, email, password) {
  await page.goto(`${BASE}/iniciar-sesion`)
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: false }).fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}
async function firstLogin(browser, email, tmp, password) {
  const ctx = await browser.newContext(phone)
  const page = await ctx.newPage()
  await login(page, email, tmp)
  await page.getByRole('heading', { name: 'Crea tu contraseña' }).waitFor()
  await page.getByLabel('Contraseña actual').fill(tmp)
  await page.getByRole('textbox', { name: 'Nueva contraseña', exact: true }).fill(password)
  await page.getByLabel('Confirmar nueva contraseña').fill(password)
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await page.getByRole('heading', { name: /Hola, / }).waitFor()
  return { ctx, page }
}

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const tp = await ctx.newPage()
  current = tp
  tp.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await login(tp, TRAINER.email, TRAINER.password)
  await tp.getByText('Clientes activos').waitFor()

  // ---------- Preparación por la API: rutina con días de la semana, dos clientes, asignación ----------
  const hip = await call(tp, 'POST', '/api/trainer/library/exercises', { nameEs: `Hip thrust ${TAG}`, type: 1, primaryMuscleGroupId: 1, secondaryMuscleGroupIds: [], equipmentIds: [] })
  const ROUTINE = `Seguimiento ${TAG}`
  const routine = await call(tp, 'POST', '/api/trainer/routines', { kind: 1, title: ROUTINE, durationWeeks: 8 })
  const draft = await call(tp, 'POST', `/api/trainer/routines/${routine.id}/draft`)
  await call(tp, 'PUT', `/api/trainer/routines/${routine.id}/draft`, {
    draftVersionId: draft.id, title: ROUTINE, durationWeeks: 8,
    days: [
      { name: 'Día A · Glúteo', dayOfWeek: weekday(today), exercises: [{ exerciseId: hip.id, sets: 2, repsMin: 8, repsMax: 10, suggestedWeight: 60, suggestedWeightUnit: 1, restSeconds: 90, setType: 1 }] },
      { name: 'Día B · Pierna', dayOfWeek: (weekday(today) + 2) % 7, exercises: [{ exerciseId: hip.id, sets: 2, repsMin: 10, repsMax: 12, setType: 1 }] },
    ],
  })
  await call(tp, 'POST', `/api/trainer/routines/${routine.id}/publish`, { draftVersionId: draft.id, changeNotes: null })
  const emailA = `sofia.${TAG}@test.local`
  const emailB = `marta.${TAG}@test.local`
  const clientA = await call(tp, 'POST', '/api/trainer/clients', { firstName: 'Sofía', lastName: `Ruiz ${TAG}`, email: emailA, phone: null })
  const clientB = await call(tp, 'POST', '/api/trainer/clients', { firstName: 'Marta', lastName: `Paz ${TAG}`, email: emailB, phone: null })
  const A = clientA.clientId
  await call(tp, 'POST', '/api/trainer/assignments', { clientIds: [A], routineVersionId: draft.id, startDate: monday, endDate: null, notes: null })

  // ---------- Cliente A registra un entrenamiento real (por la API) ----------
  const { ctx: phoneCtx, page: cp } = await firstLogin(browser, emailA, clientA.temporaryPassword, 'SofiaSegura2026')
  cp.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const [prog] = await call(cp, 'GET', '/api/portal/program')
  const started = await call(cp, 'POST', '/api/portal/sessions', { assignmentId: prog.assignmentId, routineDayId: prog.days.find((d) => d.name === 'Día A · Glúteo').id })
  const detail = await call(cp, 'GET', `/api/portal/sessions/${started.id}`)
  await call(cp, 'PUT', `/api/portal/sessions/${started.id}`, {
    comment: null,
    exercises: detail.exercises.map((e) => ({
      id: e.id, isCompleted: true, comment: null,
      sets: [
        { setNumber: 1, reps: 10, weight: 60, weightUnit: 1, rir: null, rpe: null, isCompleted: true, notes: null },
        { setNumber: 2, reps: 8, weight: 140, weightUnit: 2, rir: null, rpe: null, isCompleted: true, notes: null },
      ],
    })),
  })
  await call(cp, 'POST', `/api/portal/sessions/${started.id}/finish`)

  // ---------- Entrenadora: tipo de medida configurable ----------
  const CUSTOM = `Antebrazo ${TAG}`
  await tp.goto(`${BASE}/entrenadora/configuracion`)
  await tp.getByRole('heading', { name: 'Tipos de medida' }).waitFor()
  await tp.getByRole('button', { name: 'Nuevo tipo' }).click()
  let dialog = tp.getByRole('dialog')
  await dialog.getByRole('textbox', { name: /^Nombre\b/ }).first().fill(CUSTOM)
  await dialog.getByLabel('Tipo').selectOption({ label: 'Perímetro' })
  const units = await dialog.getByLabel('Unidad').locator('option').allTextContents()
  check('un perímetro solo admite cm o in (sin kg ni %)', units.join(',') === 'cm,in')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await tp.getByText(`${CUSTOM} (cm)`).waitFor()
  check('la entrenadora crea un tipo de medida propio', true)
  await shot(tp, '01-tipos-de-medida')

  // ---------- Entrenadora: evaluaciones con datos faltantes y validación ----------
  await tp.goto(`${BASE}/entrenadora/clientes/${A}`)
  await tp.locator('#contenido').getByRole('link', { name: 'Seguimiento', exact: true }).click()
  await tp.getByRole('heading', { name: `Seguimiento de Sofía Ruiz ${TAG}` }).waitFor()
  await tp.getByText('Sin registros de peso corporal.').waitFor()
  check('sin evaluaciones no se dibujan gráficas inventadas', (await tp.locator('.chart__line').count()) === 0)

  await tp.getByRole('button', { name: 'Nueva evaluación' }).click()
  dialog = tp.getByRole('dialog')
  await dialog.getByLabel('Fecha').fill(monthAgo)
  await dialog.getByLabel('Peso corporal (kg)').fill('70')
  await dialog.getByLabel('Cintura (cm)').fill('7400')
  await dialog.getByLabel(`${CUSTOM} (cm)`).fill('25')
  await dialog.getByRole('button', { name: 'Guardar evaluación' }).click()
  await dialog.getByText('Debe estar entre 1 y 300 cm.').waitFor()
  check('un valor fuera de rango se rechaza y se señala en su campo', (await tp.getByRole('dialog').count()) === 1)
  await dialog.getByLabel('Cintura (cm)').fill('74')
  await dialog.getByLabel('Notas de la evaluación').fill('Primera evaluación')
  await dialog.getByRole('button', { name: 'Guardar evaluación' }).click()
  await dialog.waitFor({ state: 'detached' })

  // Evento de evaluación para hoy: al registrar la evaluación de hoy debe quedar «Hecho» solo.
  const evalEvent = await call(tp, 'POST', '/api/trainer/calendar/events', { clientId: A, type: 3, title: null, date: today, startTime: '09:00:00', endTime: null, notes: null })

  await tp.getByRole('button', { name: 'Nueva evaluación' }).click()
  dialog = tp.getByRole('dialog')
  await dialog.getByLabel('Peso corporal (kg)').fill('68,5')
  await dialog.getByRole('button', { name: 'Guardar evaluación' }).click()
  await dialog.waitFor({ state: 'detached' })
  const compare = tp.getByRole('table', { name: 'Comparación de evaluaciones' })
  await compare.waitFor()
  const waistRow = compare.locator('tr', { has: tp.getByRole('rowheader', { name: 'Cintura' }) })
  check('la comparación muestra las dos fechas', (await compare.locator('thead').textContent()).includes(esDate(monthAgo)) && (await compare.locator('thead').textContent()).includes(esDate(today)))
  check('una medida no tomada aparece como «Sin dato» (no se estima)', (await waistRow.textContent()).includes('Sin dato'))
  check('la diferencia de peso corporal es exacta', (await compare.locator('tr', { has: tp.getByRole('rowheader', { name: 'Peso corporal' }) }).textContent()).includes('−1.5 kg'))
  check('la gráfica de peso usa los dos registros reales', (await tp.getByRole('img', { name: /Peso corporal: 2 registros, último 68.5 kg/ }).count()) === 1)

  // Corrección auditada de una medida.
  await tp.getByRole('button', { name: /^Corregir Cintura/ }).click()
  dialog = tp.getByRole('dialog')
  await dialog.getByLabel('Valor (cm)').fill('75')
  await dialog.getByRole('button', { name: /Guardar/ }).click()
  await dialog.waitFor({ state: 'detached' })
  await tp.getByRole('list', { name: 'Evaluaciones' }).getByText('75 cm').waitFor()
  check('la corrección se guarda y la evaluación conserva su fecha', true)

  // Foto privada.
  await tp.getByRole('button', { name: 'Subir foto' }).click()
  dialog = tp.getByRole('dialog')
  await dialog.getByLabel('Foto', { exact: true }).setInputFiles(IMAGE)
  await dialog.getByLabel('Categoría (opcional)').selectOption({ label: 'Frente' })
  await dialog.getByRole('button', { name: 'Subir foto' }).click()
  await dialog.waitFor({ state: 'detached' })
  await tp.waitForFunction(() => [...document.images].some((i) => i.alt.startsWith('Foto de progreso (Frente)') && i.naturalWidth > 0))
  const [photo] = await call(tp, 'GET', `/api/trainer/clients/${A}/photos`)
  check('la foto se sirve por la API protegida, no por una carpeta pública', photo.url === `/api/trainer/photos/${photo.id}/content`)
  const fake = await tp.request.post(`${BASE}/api/trainer/clients/${A}/photos`, {
    headers: { 'X-CSRF-TOKEN': await csrf(tp) },
    multipart: { file: { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('esto no es una imagen') }, takenOn: today },
  })
  check('un archivo que no es imagen se rechaza aunque diga .png (400)', fake.status() === 400)

  // Cargas por ejercicio: la serie en lb se convierte y se avisa.
  check('las cargas avisan de valores convertidos de lb', (await tp.getByText(/se convirtieron \(1 lb = 0.4536 kg\)/).count()) === 1)
  const loads = tp.getByRole('region', { name: 'Cargas por ejercicio' })
  await loads.getByRole('button', { name: 'Ver tabla' }).click()
  check('la tabla de cargas conserva el valor original (140 lb)', (await loads.getByText(/registrado 140 lb/).count()) === 1)
  check('la ficha de seguimiento no se desborda', await noOverflow(tp))
  await shot(tp, '02-seguimiento-entrenadora')

  // Detalle del entrenamiento: indicado frente a hecho, solo lectura.
  await tp.getByRole('list', { name: 'Entrenamientos registrados' }).getByRole('link', { name: 'Día A · Glúteo' }).click()
  await tp.getByRole('columnheader', { name: 'Indicado' }).first().waitFor()
  check('la entrenadora ve lo indicado y lo hecho en cada serie', (await tp.getByRole('columnheader', { name: 'Hecho' }).count()) >= 1 && (await tp.locator('#contenido input').count()) === 0)
  await shot(tp, '03-detalle-entrenamiento')

  // ---------- Desactivar el tipo propio: deja de ofrecerse, su historial queda ----------
  await tp.goto(`${BASE}/entrenadora/configuracion`)
  await tp.getByRole('button', { name: `Editar ${CUSTOM}` }).click()
  dialog = tp.getByRole('dialog')
  check('con registros, la unidad del tipo ya no se puede cambiar', await dialog.getByLabel('Unidad').isDisabled())
  await dialog.getByLabel('Activo').uncheck()
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await dialog.waitFor({ state: 'detached' })
  const evals = await call(tp, 'GET', `/api/trainer/clients/${A}/evaluations`)
  check('al desactivar un tipo su historial se conserva', evals.some((e) => e.measurements.some((m) => m.name === CUSTOM && m.value === 25)))

  // ---------- Calendario de la entrenadora ----------
  await call(tp, 'POST', '/api/trainer/calendar/events', { clientId: A, type: 3, title: 'Evaluación mensual', date: addDays(today, 5), startTime: '10:30:00', endTime: null, notes: null })
  await call(tp, 'POST', '/api/trainer/calendar/events', { clientId: null, type: 99, title: `Junta interna ${TAG}`, date: otherDay, startTime: null, endTime: null, notes: null })
  await tp.goto(`${BASE}/entrenadora/calendario`)
  await tp.getByRole('heading', { name: 'Calendario' }).waitFor()
  await tp.getByRole('button', { name: 'Nuevo evento' }).click()
  dialog = tp.getByRole('dialog')
  await dialog.getByLabel('Tipo').selectOption({ label: 'Otro' })
  await dialog.getByLabel('Cliente', { exact: true }).selectOption({ label: `Sofía Ruiz ${TAG}` })
  await dialog.getByLabel('Título (opcional)').fill(`Traer banda ${TAG}`)
  await dialog.getByLabel('Fecha').fill(otherDay)
  await dialog.getByLabel('Notas').fill('La banda mediana')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await dialog.waitFor({ state: 'detached' })
  await tp.getByRole('button', { name: 'Nuevo evento' }).click()
  dialog = tp.getByRole('dialog')
  await dialog.getByLabel('Tipo').selectOption({ label: 'Descanso' })
  await dialog.getByLabel('Cliente', { exact: true }).selectOption({ label: `Sofía Ruiz ${TAG}` })
  await dialog.getByLabel('Título (opcional)').fill(`Descanso extra ${TAG}`)
  await dialog.getByLabel('Fecha').fill(otherDay)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await dialog.waitFor({ state: 'detached' })
  await tp.getByRole('button', { name: 'Semana' }).click()
  await tp.getByRole('button', { name: new RegExp(`Descanso extra ${TAG}`) }).click()
  dialog = tp.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Cancelar evento' }).click()
  await dialog.waitFor({ state: 'detached' })
  const cancelled = tp.locator('.cal-item--cancelled', { hasText: `Descanso extra ${TAG}` })
  check('un evento cancelado se queda en el calendario como historial', (await cancelled.count()) === 1 && (await cancelled.textContent()).includes('Cancelado'))
  const evalToday = tp.locator('.cal-item', { hasText: '09:00' }).filter({ hasText: `Sofía Ruiz ${TAG}` })
  check('el evento de evaluación de hoy quedó «Hecho» al registrar la evaluación', (await evalToday.textContent()).includes('Hecho'))
  await tp.getByLabel('Cliente').first().selectOption({ label: `Sofía Ruiz ${TAG}` })
  await tp.locator('.cal-item--planned, .cal-item--rest').first().waitFor()
  check('con un cliente elegido se ven sus días de rutina y descansos', (await tp.locator('.cal-item--rest').count()) >= 1 && (await tp.locator('.cal-item--planned', { hasText: 'Día A · Glúteo' }).count()) === 1)
  check('el día de rutina ya entrenado aparece como hecho', (await tp.locator('.cal-item--planned', { hasText: 'Día A · Glúteo' }).textContent()).includes('Hecho'))
  await shot(tp, '04-calendario-semana')
  await tp.getByRole('button', { name: 'Mes' }).click()
  await tp.getByRole('grid').waitFor()
  check('la vista mensual va de lunes a domingo', (await tp.getByRole('columnheader').first().textContent()) === 'Lun' && (await tp.getByRole('gridcell').count()) % 7 === 0)
  await shot(tp, '05-calendario-mes')
  check('el calendario rechaza rangos de más de 62 días (400)', (await status(tp, 'GET', `/api/trainer/calendar?from=${today}&to=${addDays(today, 90)}`)) === 400)

  // Panel: próximas evaluaciones y actividad reciente con datos reales.
  await tp.goto(`${BASE}/entrenadora`)
  const upcoming = tp.locator('section', { has: tp.getByRole('heading', { name: 'Próximas evaluaciones' }) })
  await upcoming.getByRole('link', { name: `Sofía Ruiz ${TAG}` }).waitFor()
  const activity = tp.locator('section', { has: tp.getByRole('heading', { name: 'Actividad reciente' }) })
  check('el panel muestra la próxima evaluación y la actividad reciente reales',
    (await upcoming.getByText(/10:30/).count()) >= 1 && (await activity.getByRole('link', { name: `Sofía Ruiz ${TAG}` }).count()) >= 1)
  await shot(tp, '06-panel')

  // ---------- Cliente A en su celular ----------
  current = cp
  await cp.goto(`${BASE}/portal/progreso`)
  await cp.getByRole('heading', { name: 'Mi progreso' }).waitFor()
  await cp.getByRole('table', { name: 'Comparación de evaluaciones' }).waitFor()
  check('el cliente ve su progreso con fechas y «Sin dato»', (await cp.getByText('Sin dato').count()) >= 1 && (await cp.getByRole('img', { name: /Peso corporal: 2 registros/ }).count()) === 1)
  await cp.waitForFunction(() => [...document.images].some((i) => i.alt.startsWith('Foto de progreso (Frente)') && i.naturalWidth > 0))
  check('el cliente ve su foto por su propia ruta protegida', (await cp.getByRole('img', { name: /Foto de progreso \(Frente\)/ }).getAttribute('src')) === `/api/portal/photos/${photo.id}/content`)
  check('el progreso del cliente es de solo lectura', (await cp.getByRole('button', { name: /Nueva evaluación|Corregir|Subir foto/ }).count()) === 0)
  const cmp = cp.getByRole('table', { name: 'Comparación de evaluaciones' })
  check('la comparación cabe en el ancho del celular', await cmp.evaluate((t) => t.parentElement.scrollWidth <= t.parentElement.clientWidth))
  check('Mi progreso en celular no se desborda', await noOverflow(cp))
  await shot(cp, '07-mi-progreso')

  await cp.goto(`${BASE}/portal/calendario`)
  await cp.getByRole('heading', { name: 'Mi calendario' }).waitFor()
  await cp.getByText(`Traer banda ${TAG}`).waitFor()
  check('el cliente ve sus eventos con notas', (await cp.getByText('La banda mediana').count()) === 1)
  check('el cliente no ve eventos cancelados', (await cp.getByText(`Descanso extra ${TAG}`).count()) === 0)
  check('el cliente no ve los eventos generales de la entrenadora', (await cp.getByText(`Junta interna ${TAG}`).count()) === 0)
  check('el cliente ve su entrenamiento registrado de hoy', (await cp.locator('.cal-item--session', { hasText: 'Día A · Glúteo' }).count()) === 1)
  check('el cliente no puede editar eventos', (await cp.locator('.cal-item--button').count()) === 0)
  check('Mi calendario en celular no se desborda', await noOverflow(cp))
  await shot(cp, '08-mi-calendario-semana')
  await cp.getByRole('button', { name: 'Mes' }).click()
  await cp.getByRole('grid').waitFor()
  check('la vista mensual en celular no se desborda', await noOverflow(cp))
  await shot(cp, '09-mi-calendario-mes')
  const items = await call(cp, 'GET', `/api/portal/calendar?from=${monday}&to=${addDays(monday, 6)}`)
  check('la API del calendario del cliente no expone nombres de clientes', items.every((i) => i.clientName === null))

  // ---------- Permisos ----------
  const photoRes = await cp.request.get(`${BASE}/api/portal/photos/${photo.id}/content`)
  check('la foto se entrega sin caché compartida (no-store)', (photoRes.headers()['cache-control'] ?? '').includes('no-store') && photoRes.headers()['content-type'] === 'image/png')
  check('un cliente no puede usar la API de seguimiento de la entrenadora (403)', (await status(cp, 'GET', `/api/trainer/clients/${A}/progress`)) === 403)
  const { ctx: bctx, page: bp } = await firstLogin(browser, emailB, clientB.temporaryPassword, 'MartaSegura2026')
  current = bp
  bp.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  check('otro cliente no puede ver la foto ajena (404)', (await status(bp, 'GET', `/api/portal/photos/${photo.id}/content`)) === 404)
  check('otro cliente no ve evaluaciones ni medidas ajenas', (await call(bp, 'GET', '/api/portal/evaluations')).length === 0 && (await call(bp, 'GET', '/api/portal/progress')).measurements.length === 0)
  const bItems = await call(bp, 'GET', `/api/portal/calendar?from=${monday}&to=${addDays(monday, 6)}`)
  check('otro cliente no ve el calendario ajeno', !bItems.some((i) => i.title.includes(TAG)) && !bItems.some((i) => i.title === 'Día A · Glúteo'))
  await bp.goto(`${BASE}/portal/progreso`)
  await bp.getByText('Sin registros de peso corporal.').waitFor()
  check('el progreso vacío lo dice en lugar de inventar datos', (await bp.getByText('Sin fotos de progreso.').count()) === 1)
  await bctx.close()
  const anon = await browser.newContext()
  check('sin sesión la foto no se entrega (401)', (await anon.request.get(`${BASE}/api/portal/photos/${photo.id}/content`)).status() === 401 && (await anon.request.get(`${BASE}/api/trainer/photos/${photo.id}/content`)).status() === 401)
  await anon.close()
  await phoneCtx.close()

  // ---------- Persistencia: lo guardado sigue igual tras volver a consultar ----------
  const after = await call(tp, 'GET', `/api/trainer/clients/${A}/evaluations`)
  check('las evaluaciones persisten en SQL Server con su fecha', after.length === 2 && after[0].evaluatedOn === today && after[1].evaluatedOn === monthAgo)
  const ev = await call(tp, 'GET', `/api/trainer/calendar?from=${today}&to=${today}&clientId=${A}`)
  check('el evento de evaluación quedó ligado y completado', ev.some((i) => i.eventId === evalEvent.id && i.status === 'completed'))

  check('sin errores inesperados en la consola', errors.filter((e) => !/401|403|404|400|Unauthorized|Not Found|Bad Request|Forbidden/.test(e)).length === 0)
  if (errors.length) console.log(errors.join('\n'))
  console.log(results.join('\n'))
  await browser.close()
})().catch(async (e) => {
  console.error(e)
  if (current) await current.screenshot({ path: path.join(OUT, 'fallo.png'), fullPage: true }).catch(() => {})
  console.log(results.join('\n'))
  process.exit(1)
})

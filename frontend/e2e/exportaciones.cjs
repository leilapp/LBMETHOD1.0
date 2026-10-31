// Uso: con la API y 'npm run dev' en marcha → node e2e/exportaciones.cjs <carpeta-salida>
// PDF de rutinas y exportaciones a Excel (Fase 10): descarga real desde los botones de la interfaz y revisión del contenido
// con pdftotext/pdfinfo (poppler) y unzip. Frontend (Vite) + API real + SQL Server real.
// Requiere LBMETHOD_E2E_EMAIL, LBMETHOD_E2E_PASSWORD (cuenta de PRUEBA) y LBMETHOD_E2E_TAG (texto único por ejecución).
const { chromium } = require('playwright')
const path = require('path')
const { execFileSync } = require('child_process')

const BASE = process.env.LBMETHOD_E2E_BASE || 'http://localhost:5173'
const OUT = process.argv[2] ?? require('os').tmpdir()
const TAG = process.env.LBMETHOD_E2E_TAG
const TRAINER = { email: process.env.LBMETHOD_E2E_EMAIL, password: process.env.LBMETHOD_E2E_PASSWORD }
if (!TRAINER.email || !TRAINER.password || !TAG) {
  console.error('Define LBMETHOD_E2E_EMAIL, LBMETHOD_E2E_PASSWORD y LBMETHOD_E2E_TAG')
  process.exit(1)
}
const results = []
let current = null
const check = (name, ok) => { results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}`); if (!ok) process.exitCode = 1 }
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
const phone = { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
const pdfText = (file) => execFileSync('pdftotext', ['-layout', file, '-']).toString()
const pdfPages = (file) => Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [file]).toString())[1])
const xlsxText = (file) => execFileSync('unzip', ['-p', file, 'xl/sharedStrings.xml', 'xl/workbook.xml']).toString()

async function csrf(page) {
  return (await (await page.request.get(`${BASE}/api/auth/csrf`)).json()).token
}
async function call(page, method, url, data) {
  const res = await page.request.fetch(`${BASE}${url}`, { method, headers: { 'X-CSRF-TOKEN': await csrf(page) }, data })
  if (res.status() >= 300) throw new Error(`${method} ${url}: ${res.status()} ${await res.text()}`)
  return res.status() === 204 ? null : res.json()
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
/** Pulsa un botón de descarga y guarda el archivo; devuelve su ruta. */
async function download(page, button, name) {
  const [file] = await Promise.all([page.waitForEvent('download'), button.click()])
  const target = path.join(OUT, `${name}-${file.suggestedFilename()}`)
  await file.saveAs(target)
  return target
}

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true })
  const tp = await ctx.newPage()
  current = tp
  tp.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await login(tp, TRAINER.email, TRAINER.password)
  await tp.getByText('Clientes activos').waitFor()

  // ---------- Datos reales: rutina larga con acentos, cliente y evaluación ----------
  const ex = await call(tp, 'POST', '/api/trainer/library/exercises', { nameEs: `Extensión de cadera ${TAG}`, nameEn: `Hip extension ${TAG}`, type: 1, primaryMuscleGroupId: 1, secondaryMuscleGroupIds: [], equipmentIds: [] })
  const ROUTINE = `Glúteo y pierna ${TAG}`
  const routine = await call(tp, 'POST', '/api/trainer/routines', { kind: 1, title: ROUTINE, goal: 'Fuerza e hipertrofia de glúteo', durationWeeks: 8 })
  const draft = await call(tp, 'POST', `/api/trainer/routines/${routine.id}/draft`)
  const days = Array.from({ length: 5 }, (_, d) => ({
    name: `Día ${d + 1} · Pierna`, dayOfWeek: (d + 1) % 7, notes: 'Calentamiento de 10 minutos; movilidad de cadera',
    exercises: Array.from({ length: 8 }, (_, i) => ({
      exerciseId: ex.id, sets: 3, repsMin: 8, repsMax: 12, suggestedWeight: 42.5, suggestedWeightUnit: 1, restSeconds: 90, tempo: '3-1-1', rir: 2, setType: 1,
      supersetGroup: i < 2 ? 'A' : null, notes: i === 0 ? 'Pausa de un segundo arriba; señal de bloqueo' : null,
      setDetails: i === 2 ? [
        { setType: 2, repsMin: 12, repsMax: 12, suggestedWeight: 20, suggestedWeightUnit: 1, restSeconds: 60 },
        { setType: 1, repsMin: 8, repsMax: 8, suggestedWeight: 100, suggestedWeightUnit: 2, restSeconds: 120 },
      ] : null,
    })),
  }))
  await call(tp, 'PUT', `/api/trainer/routines/${routine.id}/draft`, { draftVersionId: draft.id, title: ROUTINE, goal: 'Fuerza e hipertrofia de glúteo', durationWeeks: 8, days })
  await call(tp, 'POST', `/api/trainer/routines/${routine.id}/publish`, { draftVersionId: draft.id, changeNotes: null })
  const emailA = `begona.${TAG}@test.local`
  const emailB = `ines.${TAG}@test.local`
  const clientA = await call(tp, 'POST', '/api/trainer/clients', { firstName: 'Begoña', lastName: `Muñoz ${TAG}`, email: emailA, phone: null })
  const clientB = await call(tp, 'POST', '/api/trainer/clients', { firstName: 'Inés', lastName: `Peña ${TAG}`, email: emailB, phone: null })
  const [assignmentId] = (await call(tp, 'POST', '/api/trainer/assignments', { clientIds: [clientA.clientId], routineVersionId: draft.id, startDate: today, endDate: null, notes: 'Anota el peso real de cada serie' })).ids
  await call(tp, 'POST', `/api/trainer/clients/${clientA.clientId}/evaluations`, { evaluatedOn: today, notes: 'Evaluación inicial', measurements: [{ measurementTypeId: 1, value: 61.4 }, { measurementTypeId: 4, value: 98 }] })

  // ---------- PDF desde la ficha de la rutina ----------
  await tp.goto(`${BASE}/entrenadora/rutinas/${routine.id}`)
  const pdfButton = tp.getByRole('button', { name: 'Descargar la versión 1 en PDF' })
  await pdfButton.waitFor()
  await shot(tp, '01-rutina-con-pdf')
  const versionPdf = await download(tp, pdfButton, 'version')
  const vText = pdfText(versionPdf)
  check('el PDF de la versión se descarga con nombre sin espacios ni acentos', /^version-[a-z0-9-]+-v1\.pdf$/.test(path.basename(versionPdf)))
  check('el PDF lleva la identidad LB METHOD', vText.includes('LB METHOD'))
  check('los acentos y la ñ se conservan (Glúteo, Día, señal)', vText.includes(`Glúteo y pierna ${TAG}`) && vText.includes('Día 1 · Pierna') && vText.includes('señal de bloqueo'))
  check('el PDF muestra objetivo, duración y parámetros', vText.includes('Fuerza e hipertrofia de glúteo') && vText.includes('8 semanas') && vText.includes('8–12') && vText.includes('42.5 kg') && vText.includes('3-1-1') && vText.includes('RIR 2'))
  check('las series detalladas y la superserie aparecen', vText.includes('Serie 2 · Efectiva · 8 reps · 100 lb · 2 min descanso') && vText.includes('Superserie A'))
  const pages = pdfPages(versionPdf)
  check(`una rutina de 5 días × 8 ejercicios se pagina (${pages} páginas) con «Página X de Y»`, pages >= 2 && vText.includes(`Página 1 de ${pages}`) && vText.includes(`Página ${pages} de ${pages}`))
  check('el encabezado de la tabla se repite en cada página', (vText.match(/RIR \/ RPE/g) ?? []).length >= 5)
  check('la versión sin asignar no muestra datos de clientes', !vText.includes('Begoña'))
  execFileSync('pdftoppm', ['-png', '-r', '60', '-f', '1', '-l', '2', versionPdf, path.join(OUT, '02-pdf-pagina')])

  // PDF de la asignación, desde la ficha del cliente.
  await tp.goto(`${BASE}/entrenadora/clientes/${clientA.clientId}`)
  const assignmentPdf = await download(tp, tp.getByRole('button', { name: `Descargar en PDF: ${ROUTINE}` }), 'asignacion')
  const aText = pdfText(assignmentPdf)
  check('el PDF de la asignación incluye cliente, fechas, estado e indicaciones', aText.includes(`Begoña Muñoz ${TAG}`) && /Desde el \d+ de \w+ de \d{4}/.test(aText) && aText.includes('Vigente') && aText.includes('Anota el peso real de cada serie'))

  // ---------- Excel ----------
  await tp.goto(`${BASE}/entrenadora/clientes`)
  const clientsXlsx = await download(tp, tp.getByRole('button', { name: 'Exportar clientes a Excel' }), 'excel')
  const cText = xlsxText(clientsXlsx)
  check('Excel de clientes: hojas Clientes y Asignaciones con datos reales', cText.includes('name="Clientes"') && cText.includes('name="Asignaciones"') && cText.includes(emailA) && cText.includes(`Peña ${TAG}`) && cText.includes(ROUTINE))
  await tp.goto(`${BASE}/entrenadora/rutinas`)
  const routinesXlsx = await download(tp, tp.getByRole('button', { name: 'Exportar rutinas y plantillas a Excel' }), 'excel')
  const rText = xlsxText(routinesXlsx)
  check('Excel de rutinas: resumen y detalle con ejercicios y parámetros', rText.includes('name="Detalle"') && rText.includes(ROUTINE) && rText.includes(`Extensión de cadera ${TAG}`) && rText.includes('3-1-1'))
  await tp.goto(`${BASE}/entrenadora/clientes/${clientA.clientId}/seguimiento`)
  const evalXlsx = await download(tp, tp.getByRole('button', { name: `Exportar evaluaciones de Begoña Muñoz ${TAG} a Excel` }), 'excel')
  const eText = xlsxText(evalXlsx)
  const eSheet = execFileSync('unzip', ['-p', evalXlsx, 'xl/worksheets/sheet1.xml']).toString()
  check('Excel de evaluaciones: una fila por medida con valor numérico', eText.includes('Peso corporal') && eText.includes('Glúteos') && /<(x:)?v>61\.4<\/(x:)?v>/.test(eSheet) && /<(x:)?v>98<\/(x:)?v>/.test(eSheet))
  check('el Excel de un cliente no incluye a otros', !eText.includes('Inés'))
  await shot(tp, '03-seguimiento-exportar')

  // ---------- Cliente en su celular ----------
  const { ctx: phoneCtx, page: cp } = await firstLogin(browser, emailA, clientA.temporaryPassword, 'BegonaSegura2026')
  current = cp
  cp.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await cp.goto(`${BASE}/portal/rutina`)
  const portalButton = cp.getByRole('button', { name: `Descargar en PDF: ${ROUTINE}` })
  await portalButton.waitFor()
  await shot(cp, '04-mi-rutina-pdf')
  const clientPdf = await download(cp, portalButton, 'cliente')
  check('el cliente descarga el PDF de su rutina vigente', pdfText(clientPdf).includes(`Begoña Muñoz ${TAG}`))
  check('el cliente no puede descargar exportaciones de la entrenadora (403)', (await cp.request.get(`${BASE}/api/trainer/exports/clients`)).status() === 403 && (await cp.request.get(`${BASE}/api/trainer/assignments/${assignmentId}/pdf`)).status() === 403)
  await phoneCtx.close()

  const { ctx: bctx, page: bp } = await firstLogin(browser, emailB, clientB.temporaryPassword, 'InesSegura2026')
  current = bp
  check('otro cliente no puede descargar el PDF ajeno (404)', (await bp.request.get(`${BASE}/api/portal/program/${assignmentId}/pdf`)).status() === 404)
  await bctx.close()
  const anon = await browser.newContext()
  check('sin sesión no se descarga nada (401)', (await anon.request.get(`${BASE}/api/portal/program/${assignmentId}/pdf`)).status() === 401 && (await anon.request.get(`${BASE}/api/trainer/exports/clients`)).status() === 401)
  await anon.close()

  check('sin errores inesperados en la consola', errors.filter((e) => !/401|403|404|Unauthorized|Not Found|Forbidden/.test(e)).length === 0)
  if (errors.length) console.log(errors.join('\n'))
  console.log(results.join('\n'))
  await browser.close()
})().catch(async (e) => {
  console.error(e)
  if (current) await current.screenshot({ path: path.join(OUT, 'fallo.png'), fullPage: true }).catch(() => {})
  console.log(results.join('\n'))
  process.exit(1)
})

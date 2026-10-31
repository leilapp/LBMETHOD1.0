// Uso: con la API y 'npm run dev' en marcha → node e2e/portal.cjs <carpeta-capturas> <imagen.png>
// Portal del cliente y registro de entrenamientos en un celular Android simulado: frontend (Vite) + API real + SQL Server real.
// Requiere LBMETHOD_E2E_EMAIL, LBMETHOD_E2E_PASSWORD (cuenta de PRUEBA) y LBMETHOD_E2E_TAG (texto único por ejecución).
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = process.env.LBMETHOD_E2E_BASE || 'http://localhost:5173'
const OUT = process.argv[2] ?? require('os').tmpdir()
const IMAGE = process.argv[3]
const TAG = process.env.LBMETHOD_E2E_TAG
const TRAINER = { email: process.env.LBMETHOD_E2E_EMAIL, password: process.env.LBMETHOD_E2E_PASSWORD }
if (!TRAINER.email || !TRAINER.password || !TAG || !IMAGE) {
  console.error('Define LBMETHOD_E2E_EMAIL, LBMETHOD_E2E_PASSWORD y LBMETHOD_E2E_TAG, e indica una imagen PNG')
  process.exit(1)
}
const results = []
let current = null // página activa, para una captura si algo falla
const check = (name, ok) => { results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}`); if (!ok) process.exitCode = 1 }
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
const phone = { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }

async function csrf(page) {
  return (await (await page.request.get(`${BASE}/api/auth/csrf`)).json()).token
}

/** Llamada a la API con la sesión del navegador (para preparar datos que no son el objeto de la prueba). */
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

  // ---------- La entrenadora prepara la rutina (por la API) y la asigna ----------
  const hip = await call(tp, 'POST', '/api/trainer/library/exercises', {
    nameEs: `Hip thrust ${TAG}`, type: 1, primaryMuscleGroupId: 1, secondaryMuscleGroupIds: [], equipmentIds: [],
    instructions: 'Apoya la espalda alta en el banco y empuja con los talones.',
  })
  const rdl = await call(tp, 'POST', '/api/trainer/library/exercises', { nameEs: `Peso muerto rumano ${TAG}`, type: 1, primaryMuscleGroupId: 1, secondaryMuscleGroupIds: [], equipmentIds: [] })
  const upload = await tp.request.post(`${BASE}/api/trainer/library/exercises/${hip.id}/media`, {
    headers: { 'X-CSRF-TOKEN': await csrf(tp) },
    multipart: { file: { name: 'hip-thrust.png', mimeType: 'image/png', buffer: fs.readFileSync(IMAGE) }, title: 'Posición final' },
  })
  if (upload.status() >= 300) throw new Error(`subir imagen: ${upload.status()} ${await upload.text()}`)
  const mediaId = (await upload.json()).id

  const ROUTINE = `Glúteo fuerza ${TAG}`
  const routine = await call(tp, 'POST', '/api/trainer/routines', { kind: 1, title: ROUTINE, durationWeeks: 6 })
  const draft = await call(tp, 'POST', `/api/trainer/routines/${routine.id}/draft`)
  await call(tp, 'PUT', `/api/trainer/routines/${routine.id}/draft`, {
    draftVersionId: draft.id, title: ROUTINE, durationWeeks: 6,
    days: [
      {
        name: 'Día A · Glúteo', notes: 'Calienta 10 minutos en bicicleta',
        exercises: [
          { exerciseId: hip.id, sets: 3, repsMin: 8, repsMax: 10, suggestedWeight: 60, suggestedWeightUnit: 1, restSeconds: 90, tempo: '3-1-1', rir: 2, setType: 1, notes: 'Pausa de 1 s arriba' },
          {
            exerciseId: rdl.id, sets: 2, setType: 1,
            setDetails: [
              { setType: 2, repsMin: 12, repsMax: 12, suggestedWeight: 20, suggestedWeightUnit: 1, restSeconds: 60 },
              { setType: 1, repsMin: 8, repsMax: 8, suggestedWeight: 40, suggestedWeightUnit: 1, restSeconds: 120 },
            ],
          },
        ],
      },
      { name: 'Día B · Pierna', exercises: [{ exerciseId: rdl.id, sets: 3, repsMin: 10, repsMax: 12, setType: 1 }] },
    ],
  })
  await call(tp, 'POST', `/api/trainer/routines/${routine.id}/publish`, { draftVersionId: draft.id, changeNotes: null })
  const versionBefore = JSON.stringify((await call(tp, 'GET', `/api/trainer/routines/${routine.id}/versions/${draft.id}`)).days)

  const emailA = `paula.${TAG}@test.local`
  const emailB = `renata.${TAG}@test.local`
  const clientA = await call(tp, 'POST', '/api/trainer/clients', { firstName: 'Paula', lastName: `Mora ${TAG}`, email: emailA, phone: null })
  const clientB = await call(tp, 'POST', '/api/trainer/clients', { firstName: 'Renata', lastName: `Gil ${TAG}`, email: emailB, phone: null })
  await call(tp, 'POST', '/api/trainer/assignments', { clientIds: [clientA.clientId], routineVersionId: draft.id, startDate: today, endDate: null, notes: 'Registra el peso real de cada serie' })

  // ---------- Cliente en su celular: inicio y rutina ----------
  const PASS_A = 'PaulaSegura2026'
  let { ctx: phoneCtx, page: cp } = await firstLogin(browser, emailA, clientA.temporaryPassword, PASS_A)
  current = cp
  cp.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const next = cp.locator('section', { has: cp.getByRole('heading', { name: 'Próximo entrenamiento' }) })
  await next.getByText('Día A · Glúteo', { exact: true }).waitFor()
  check('el inicio muestra el próximo entrenamiento real', (await next.getByText(ROUTINE).count()) === 1)
  check('el inicio muestra la semana actual (lunes a domingo)', (await cp.locator('.week__day').count()) === 7 && (await cp.locator('.week__day--today').count()) === 1)
  check('sin entrenamientos aún, el último entrenamiento lo indica', await cp.getByText('Aún no has registrado entrenamientos.').isVisible())
  check('el inicio en celular no se desborda', await noOverflow(cp))
  await shot(cp, '01-inicio-cliente')

  await cp.getByRole('link', { name: 'Ver días y ejercicios' }).click()
  await cp.getByRole('heading', { name: 'Mi rutina' }).waitFor()
  const dayA = cp.locator('details', { hasText: 'Día A · Glúteo' })
  await dayA.getByText(`Hip thrust ${TAG}`).waitFor()
  const dayText = await dayA.textContent()
  check('la rutina muestra series, reps, peso, descanso, tempo y notas',
    ['3 × 8–10 · 60 kg · 90 s descanso · tempo 3-1-1 · RIR 2', 'Pausa de 1 s arriba', 'Calienta 10 minutos en bicicleta'].every((t) => dayText.includes(t)))
  check('la rutina muestra las series detalladas con su tipo', dayText.includes('Serie 1 · Calentamiento · 12 reps · 20 kg · 60 s descanso') && dayText.includes('Serie 2 · Efectiva · 8 reps · 40 kg · 120 s descanso'))
  const exNames = await dayA.locator('.program-ex__name').allTextContents()
  check('los ejercicios aparecen en el orden indicado', exNames[0].startsWith('Hip thrust') && exNames[1].startsWith('Peso muerto rumano'))
  await dayA.locator('li', { hasText: `Hip thrust ${TAG}` }).getByRole('button', { name: 'Cómo hacerlo' }).click()
  await cp.waitForFunction(() => [...document.images].some((i) => i.alt === 'Posición final' && i.naturalWidth > 0))
  check('la imagen autorizada se ve desde el portal (endpoint protegido)', (await cp.getByRole('img', { name: 'Posición final' }).getAttribute('src')) === `/api/portal/media/${mediaId}/content`)
  check('la vista de rutina no tiene campos para editarla', (await cp.locator('#contenido input, #contenido textarea').count()) === 0)
  check('la rutina en celular no se desborda', await noOverflow(cp))
  await shot(cp, '02-mi-rutina')

  // ---------- Registrar el entrenamiento ----------
  await dayA.getByRole('button', { name: 'Empezar Día A · Glúteo' }).click()
  await cp.waitForURL(/\/portal\/entrenamiento\/\d+$/)
  const sessionId = Number(cp.url().split('/').pop())
  const H = `Hip thrust ${TAG}`
  const R = `Peso muerto rumano ${TAG}`
  await cp.getByLabel(`Repeticiones de la serie 1 de ${H}`).waitFor()
  check('las casillas empiezan vacías (el objetivo es solo una guía)', (await cp.getByLabel(`Peso de la serie 1 de ${H}`).inputValue()) === '' && (await cp.getByLabel(`Peso de la serie 1 de ${H}`).getAttribute('placeholder')) === '60')
  check('cada serie muestra su objetivo con unidades', (await cp.getByText('Objetivo: 8–10 reps · 60 kg · 90 s descanso · RIR 2').count()) === 3)
  const touchOk = await cp.evaluate(() => [...document.querySelectorAll('.log-input, .unit-toggle, .set-check')].every((el) => el.getBoundingClientRect().height >= 44))
  check('los controles de captura miden al menos 44 px (cómodos en Android)', touchOk)

  await cp.getByLabel(`Repeticiones de la serie 1 de ${H}`).fill('10')
  await cp.getByLabel(`Peso de la serie 1 de ${H}`).fill('62.5')
  await cp.getByRole('button', { name: `Serie 1 de ${H} hecha` }).click()
  await cp.getByLabel(`Repeticiones de la serie 2 de ${H}`).fill('9')
  await cp.getByRole('button', { name: new RegExp(`Unidad de la serie 2 de ${H}: kg`) }).click()
  await cp.getByLabel(`Peso de la serie 2 de ${H}`).fill('140')
  await cp.getByRole('button', { name: `Serie 2 de ${H} hecha` }).click()
  await cp.locator('section', { hasText: H }).getByLabel('Comentario del ejercicio').fill('La segunda serie costó')
  await cp.getByText('Guardado').waitFor()
  check('el avance se guarda solo, sin botones extra', true)
  await shot(cp, '03-registro-en-curso')

  // Recargar la página: lo capturado sigue ahí.
  await cp.reload()
  await cp.getByLabel(`Repeticiones de la serie 1 de ${H}`).waitFor()
  check('tras recargar se conservan reps, peso y unidad',
    (await cp.getByLabel(`Repeticiones de la serie 1 de ${H}`).inputValue()) === '10' &&
    (await cp.getByLabel(`Peso de la serie 1 de ${H}`).inputValue()) === '62.5' &&
    (await cp.getByLabel(`Peso de la serie 2 de ${H}`).inputValue()) === '140' &&
    (await cp.getByRole('button', { name: new RegExp(`Unidad de la serie 2 de ${H}: lb`) }).count()) === 1 &&
    (await cp.getByRole('button', { name: `Serie 2 de ${H} hecha` }).getAttribute('aria-pressed')) === 'true')

  // Salir sin terminar, cerrar sesión y volver a entrar.
  await cp.goto(`${BASE}/portal`)
  await cp.getByRole('link', { name: 'Retomar entrenamiento' }).waitFor()
  check('el inicio ofrece retomar el entrenamiento incompleto', (await cp.getByRole('button', { name: /^Empezar/ }).count()) === 0)
  await cp.getByRole('button', { name: /Abrir menú/ }).click()
  await cp.getByRole('button', { name: 'Cerrar sesión' }).click()
  await cp.getByRole('heading', { name: 'Iniciar sesión' }).waitFor()
  await phoneCtx.close()

  phoneCtx = await browser.newContext(phone)
  cp = await phoneCtx.newPage()
  current = cp
  cp.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await login(cp, emailA, PASS_A)
  await cp.getByRole('link', { name: 'Retomar entrenamiento' }).click()
  await cp.getByLabel(`Repeticiones de la serie 1 de ${H}`).waitFor()
  check('al volver a iniciar sesión retoma la misma sesión con sus datos',
    cp.url().endsWith(`/portal/entrenamiento/${sessionId}`) &&
    (await cp.getByLabel(`Peso de la serie 1 de ${H}`).inputValue()) === '62.5' &&
    (await cp.locator('section', { hasText: H }).getByLabel('Comentario del ejercicio').inputValue()) === 'La segunda serie costó')

  // Empezar otra vez el mismo día no duplica: devuelve la sesión en curso.
  const [prog] = await call(cp, 'GET', '/api/portal/program')
  const again = await call(cp, 'POST', '/api/portal/sessions', { assignmentId: prog.assignmentId, routineDayId: prog.days[0].id })
  check('empezar de nuevo no crea una sesión duplicada', again.id === sessionId && (await call(cp, 'GET', '/api/portal/sessions')).length === 1)

  await cp.getByLabel(`Repeticiones de la serie 3 de ${H}`).fill('8')
  await cp.getByLabel(`Peso de la serie 3 de ${H}`).fill('60')
  await cp.getByRole('button', { name: `Serie 3 de ${H} hecha` }).click()
  await cp.locator('section', { hasText: H }).getByRole('checkbox', { name: 'Ejercicio completado' }).check()
  const rdlSection = cp.locator('section', { hasText: R })
  await rdlSection.getByRole('button', { name: '+ Serie extra' }).click()
  await cp.getByLabel(`Repeticiones de la serie 3 de ${R}`).fill('6')
  await cp.getByLabel(`Peso de la serie 3 de ${R}`).fill('45')
  await cp.getByLabel(`Repeticiones de la serie 2 de ${R}`).fill('8')
  await cp.getByLabel(`Peso de la serie 2 de ${R}`).fill('40')
  await cp.getByLabel('Comentario del entrenamiento').fill(`Buena energía ${TAG}`)
  await cp.getByText('Guardado').waitFor()
  check('el registro en celular no se desborda', await noOverflow(cp))
  await shot(cp, '04-registro-completo')

  await cp.locator('.session-bar').getByRole('button', { name: 'Finalizar' }).click()
  const dialog = cp.getByRole('dialog')
  check('al finalizar avisa cuántos ejercicios faltan', (await dialog.getByText('Llevas 1 de 2 ejercicios completados').count()) === 1)
  await shot(cp, '05-confirmar-finalizar')
  await dialog.getByRole('button', { name: 'Finalizar' }).click()
  await cp.getByRole('heading', { name: /Hola, Paula/ }).waitFor()
  const last = cp.locator('section', { has: cp.getByRole('heading', { name: 'Último entrenamiento' }) })
  await last.getByText('Día A · Glúteo').waitFor()
  check('el inicio muestra el último entrenamiento con su avance', (await last.getByText(/1 de 2 ejercicios · 3 series/).count()) === 1)
  check('la semana marca hoy como entrenado', (await cp.locator('.week__day--today .week__mark--done').count()) === 1)
  check('el siguiente día sugerido pasa al Día B', (await cp.locator('section', { has: cp.getByRole('heading', { name: 'Próximo entrenamiento' }) }).getByText('Día B · Pierna', { exact: true }).count()) === 1)
  await shot(cp, '06-inicio-tras-entrenar')

  await cp.goto(`${BASE}/portal/entrenamientos`)
  const list = cp.getByRole('list', { name: 'Entrenamientos' })
  await list.locator('li').first().waitFor()
  check('el historial muestra el entrenamiento finalizado', (await list.locator('li', { hasText: 'Finalizado' }).count()) === 1)
  await list.getByRole('link', { name: 'Día A · Glúteo' }).click()
  await cp.getByText('Entrenamiento finalizado.').waitFor()
  check('el detalle finalizado conserva todo y es de solo lectura',
    (await cp.getByLabel(`Peso de la serie 3 de ${R}`).inputValue()) === '45' && (await cp.getByLabel(`Peso de la serie 3 de ${R}`).isDisabled()) &&
    (await cp.getByText(`Buena energía ${TAG}`).count()) === 1 && (await cp.locator('.session-bar').count()) === 0)
  check('el detalle conserva lo prescrito junto a lo hecho', (await cp.getByText('Objetivo: 8 reps · 40 kg · 120 s descanso').count()) === 1 && (await cp.getByText('Objetivo: Serie extra').count()) === 1)
  await shot(cp, '07-detalle-finalizado')
  check('una sesión finalizada ya no acepta cambios (409)', (await status(cp, 'PUT', `/api/portal/sessions/${sessionId}`, { comment: 'x', exercises: [] })) === 409)

  // ---------- Seguridad: otro cliente no ve ni toca nada de Paula ----------
  const { page: bp } = await firstLogin(browser, emailB, clientB.temporaryPassword, 'RenataSegura2026')
  current = bp
  bp.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  check('otro cliente no ve rutinas ajenas', (await call(bp, 'GET', '/api/portal/program')).length === 0 && (await bp.getByText('Cuando tu entrenadora te asigne una rutina').count()) === 1)
  check('otro cliente recibe 404 al pedir la sesión ajena', (await status(bp, 'GET', `/api/portal/sessions/${sessionId}`)) === 404)
  check('otro cliente no puede escribir en la sesión ajena', (await status(bp, 'PUT', `/api/portal/sessions/${sessionId}`, { comment: 'x', exercises: [] })) === 404 && (await status(bp, 'POST', `/api/portal/sessions/${sessionId}/finish`)) === 404)
  check('otro cliente no puede ver la imagen del ejercicio ajeno', (await status(bp, 'GET', `/api/portal/media/${mediaId}/content`)) === 404)
  const programA = (await call(cp, 'GET', '/api/portal/program'))[0]
  check('otro cliente no puede iniciar con la asignación ajena', (await status(bp, 'POST', '/api/portal/sessions', { assignmentId: programA.assignmentId, routineDayId: programA.days[0].id })) === 404)
  await bp.goto(`${BASE}/portal/entrenamiento/${sessionId}`)
  await bp.getByRole('alert').waitFor()
  check('la pantalla de la sesión ajena no muestra datos', (await bp.getByText(`Buena energía ${TAG}`).count()) === 0)
  check('un cliente no puede usar la API de la entrenadora (403)', (await status(cp, 'GET', `/api/trainer/routines/${routine.id}`)) === 403)

  // ---------- La rutina maestra no cambió ----------
  const versionAfter = JSON.stringify((await call(tp, 'GET', `/api/trainer/routines/${routine.id}/versions/${draft.id}`)).days)
  check('registrar entrenamientos no modifica la rutina maestra', versionAfter === versionBefore)

  check('sin errores inesperados en la consola', errors.filter((e) => !/401|404|Unauthorized|Not Found/.test(e)).length === 0)
  if (errors.length) console.log(errors.join('\n'))
  console.log(results.join('\n'))
  await browser.close()
})().catch(async (e) => {
  console.error(e)
  if (current) await current.screenshot({ path: path.join(OUT, 'fallo.png'), fullPage: true }).catch(() => {})
  console.log(results.join('\n'))
  process.exit(1)
})

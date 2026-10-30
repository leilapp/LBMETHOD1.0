// Uso: con la API y 'npm run dev' en marcha → node e2e/clientes.cjs <carpeta-capturas>
// Perfil de clientes, observaciones privadas y asignaciones en navegador real: frontend (Vite) + API real + SQL Server real.
// Requiere LBMETHOD_E2E_EMAIL, LBMETHOD_E2E_PASSWORD (cuenta de PRUEBA) y LBMETHOD_E2E_TAG (texto único por ejecución).
const { chromium } = require('playwright')
const path = require('path')

const BASE = 'http://localhost:5173'
const OUT = process.argv[2] ?? require('os').tmpdir()
const TAG = process.env.LBMETHOD_E2E_TAG
const TRAINER = { email: process.env.LBMETHOD_E2E_EMAIL, password: process.env.LBMETHOD_E2E_PASSWORD }
if (!TRAINER.email || !TRAINER.password || !TAG) {
  console.error('Define LBMETHOD_E2E_EMAIL, LBMETHOD_E2E_PASSWORD y LBMETHOD_E2E_TAG')
  process.exit(1)
}
const results = []
let current = null // página activa, para una captura si algo falla
const check = (name, ok) => { results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}`); if (!ok) process.exitCode = 1 }
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())

/** Llamada a la API con la sesión del navegador (para preparar datos que no son el objeto de la prueba). */
async function call(page, method, url, data) {
  const { token } = await (await page.request.get(`${BASE}/api/auth/csrf`)).json()
  const res = await page.request.fetch(`${BASE}${url}`, { method, headers: { 'X-CSRF-TOKEN': token }, data })
  if (res.status() >= 300) throw new Error(`${method} ${url}: ${res.status()} ${await res.text()}`)
  return res.status() === 204 ? null : res.json()
}

/** Rutina publicada con un día y un ejercicio, creada por la API. */
async function publishedRoutine(page, title) {
  const ex = await call(page, 'POST', '/api/trainer/library/exercises', { nameEs: `Hip thrust ${TAG}`, type: 1, primaryMuscleGroupId: 1, secondaryMuscleGroupIds: [], equipmentIds: [] })
  const routine = await call(page, 'POST', '/api/trainer/routines', { kind: 1, title, durationWeeks: 6 })
  await publish(page, routine.id, title, ex.id)
  return { routineId: routine.id, exerciseId: ex.id }
}

async function publish(page, routineId, title, exerciseId, sets = 4) {
  const draft = await call(page, 'POST', `/api/trainer/routines/${routineId}/draft`)
  await call(page, 'PUT', `/api/trainer/routines/${routineId}/draft`, {
    draftVersionId: draft.id, title, durationWeeks: 6,
    days: [{ name: 'Día 1 - Glúteo', exercises: [{ exerciseId, sets, repsMin: 8, repsMax: 12, setType: 1 }] }],
  })
  return call(page, 'POST', `/api/trainer/routines/${routineId}/publish`, { draftVersionId: draft.id, changeNotes: null })
}

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const page = await ctx.newPage()
  current = page
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.goto(`${BASE}/iniciar-sesion`)
  await page.getByLabel('Correo electrónico').fill(TRAINER.email)
  await page.getByLabel('Contraseña', { exact: false }).fill(TRAINER.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByText('Clientes activos').waitFor()

  // ---------- Datos de partida ----------
  const ROUTINE = `Glúteo 6 semanas ${TAG}`
  const { routineId, exerciseId } = await publishedRoutine(page, ROUTINE)
  const emailA = `mariana.${TAG}@test.local`
  const emailB = `sofia.${TAG}@test.local`
  const clientA = await call(page, 'POST', '/api/trainer/clients', { firstName: 'Mariana', lastName: `Pérez ${TAG}`, email: emailA, phone: null })
  await call(page, 'POST', '/api/trainer/clients', { firstName: 'Sofía', lastName: `Ruiz ${TAG}`, email: emailB, phone: null })
  const nameA = `Mariana Pérez ${TAG}`

  // ---------- Lista y perfil ----------
  await page.getByRole('link', { name: 'Clientes', exact: true }).click()
  await page.getByLabel('Buscar cliente').fill(TAG)
  const list = page.getByRole('list', { name: 'Lista de clientes' })
  await list.getByRole('link', { name: nameA }).waitFor()
  check('la búsqueda muestra los clientes de prueba', (await list.locator('li').count()) === 2)
  check('un cliente nuevo aparece sin rutina vigente', (await list.locator('li', { hasText: nameA }).getByText('Sin rutina vigente').count()) === 1)
  await shot(page, '01-lista-clientes')

  await list.getByRole('link', { name: nameA }).click()
  await page.getByRole('heading', { name: nameA }).waitFor()
  await page.getByRole('link', { name: 'Editar perfil' }).click()
  await page.getByRole('heading', { name: 'Editar perfil de Mariana' }).waitFor()
  await page.getByLabel('Correo electrónico').fill('no-es-correo')
  await page.getByRole('button', { name: 'Guardar perfil' }).click()
  check('valida el correo antes de guardar', await page.getByText('Escribe un correo válido.').isVisible())
  await page.getByLabel('Correo electrónico').fill(emailA)
  await page.getByLabel('Teléfono').fill('+52 473 123 4567')
  await page.getByLabel('Fecha de nacimiento').fill('1994-05-12')
  await page.getByLabel('Estatura', { exact: true }).fill('165.5')
  await page.getByLabel('Peso', { exact: true }).fill('62.3')
  await page.getByLabel('Experiencia').selectOption({ label: 'Intermedio' })
  await page.getByLabel('Lugar de entrenamiento').selectOption({ label: 'Gimnasio' })
  await page.getByLabel('Duración de sesión (min)').fill('60')
  for (const d of ['Lunes', 'Miércoles', 'Viernes']) await page.getByRole('checkbox', { name: d }).check()
  await page.getByLabel('Objetivo').fill('Ganar fuerza en glúteo')
  await page.getByLabel('Limitaciones declaradas').fill('Molestia en rodilla izquierda')
  await shot(page, '02-editar-perfil')
  await page.getByRole('button', { name: 'Guardar perfil' }).click()
  await page.getByRole('heading', { name: 'Perfil' }).waitFor()
  const profile = page.locator('section', { has: page.getByRole('heading', { name: 'Perfil' }) })
  const text = await profile.textContent()
  check('el perfil guardado se recupera de SQL Server',
    ['+52 473 123 4567', '12 de mayo de 1994', '165.5 cm', '62.3 kg', 'Intermedio', 'Gimnasio', 'Lunes, Miércoles, Viernes', '60 min', 'Molestia en rodilla izquierda'].every((t) => text.includes(t)))

  // ---------- Observaciones privadas ----------
  const SECRET = `Revisar técnica de bisagra ${TAG}`
  await page.getByLabel('Nueva observación').fill(SECRET)
  await page.getByRole('button', { name: 'Guardar observación' }).click()
  await page.getByRole('list', { name: 'Observaciones' }).getByText(SECRET).waitFor()
  check('la observación privada se guarda', true)

  // ---------- Asignar desde la ficha del cliente ----------
  await page.getByRole('button', { name: 'Asignar rutina' }).click()
  let dialog = page.getByRole('dialog', { name: 'Asignar rutina a Mariana' })
  await dialog.getByRole('button', { name: 'Asignar' }).click()
  check('exige elegir la rutina', await dialog.getByText('Elige la rutina y su versión.').isVisible())
  await dialog.getByLabel('Rutina').selectOption({ label: ROUTINE })
  await dialog.getByText('La rutina dura 6 semanas').waitFor()
  await dialog.getByRole('button', { name: 'Usar esa fecha' }).click()
  await dialog.getByLabel('Indicaciones para el cliente').fill('Calienta 10 minutos antes de empezar')
  await shot(page, '03-asignar-desde-cliente')
  await dialog.getByRole('button', { name: 'Asignar' }).click()
  await page.getByText('Rutina asignada a Mariana.').waitFor()
  const programa = page.getByRole('list', { name: 'Programa actual' })
  await programa.locator('li', { hasText: ROUTINE }).waitFor()
  check('la asignación aparece como vigente con su versión', (await programa.locator('li', { hasText: ROUTINE }).filter({ hasText: 'versión 1' }).filter({ hasText: 'Vigente' }).count()) === 1)
  check('la fecha de fin sugerida (6 semanas) se aplicó solo al pedirla', (await programa.getByText(/^Del .+ al .+/).count()) === 1)
  await shot(page, '04-ficha-cliente')

  // ---------- Asignar desde la rutina a otro cliente ----------
  await page.goto(`${BASE}/entrenadora/rutinas/${routineId}`)
  await page.getByRole('button', { name: 'Asignar a clientes' }).click()
  dialog = page.getByRole('dialog', { name: 'Asignar rutina' })
  await dialog.getByRole('checkbox', { name: new RegExp(`Sofía Ruiz ${TAG}`) }).check()
  await shot(page, '05-asignar-desde-rutina')
  await dialog.getByRole('button', { name: 'Asignar' }).click()
  await page.getByText('Rutina asignada a 1 cliente.').waitFor()
  const assigned = page.getByRole('list', { name: 'Asignada a' })
  await assigned.getByRole('link', { name: `Sofía Ruiz ${TAG}` }).waitFor()
  check('la rutina muestra a los dos clientes que la tienen', (await assigned.locator('li').count()) === 2)
  await shot(page, '06-rutina-asignada-a')

  // ---------- Versión nueva: la asignación no cambia sola ----------
  await publish(page, routineId, ROUTINE, exerciseId, 5)
  await page.goto(`${BASE}/entrenadora/clientes/${clientA.clientId}`)
  await programa.waitFor()
  check('al publicar la versión 2, la asignación sigue en la versión 1 y avisa', (await page.getByText('Hay una versión más nueva (versión 2)').count()) === 1)

  // Terminar el programa: queda en el historial.
  await programa.getByRole('button', { name: 'Cambiar fecha de fin' }).click()
  dialog = page.getByRole('dialog', { name: 'Cambiar fecha de fin' })
  await dialog.getByLabel('Último día').fill(today)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await page.getByText(/Se terminó «/).waitFor()
  const history = page.getByRole('list', { name: 'Programas anteriores' })
  await history.locator('li').first().waitFor()
  check('terminar el programa lo pasa al historial sin borrarlo', (await history.locator('li', { hasText: 'Terminada' }).count()) === 1)

  // Asignar la versión 2 a partir de mañana y cancelarla (asignada por error): queda como cancelada.
  await page.getByRole('button', { name: 'Asignar rutina' }).click()
  dialog = page.getByRole('dialog', { name: 'Asignar rutina a Mariana' })
  await dialog.getByLabel('Rutina').selectOption({ label: ROUTINE })
  await dialog.getByLabel('Versión').locator('option', { hasText: 'Versión 2' }).waitFor({ state: 'attached' })
  check('por defecto se ofrece la versión más reciente', (await dialog.getByLabel('Versión').inputValue()) !== '' && (await dialog.getByLabel('Versión').locator('option:checked').textContent()).includes('Versión 2'))
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)
  await dialog.getByLabel('Fecha de inicio').fill(tomorrow)
  await dialog.getByRole('button', { name: 'Asignar' }).click()
  await programa.locator('li', { hasText: 'Programada' }).waitFor()
  await programa.getByRole('button', { name: 'Cancelar' }).click()
  dialog = page.getByRole('dialog', { name: 'Cancelar asignación' })
  await dialog.getByRole('button', { name: 'Cancelar asignación' }).click()
  await page.getByText(/Se canceló «/).waitFor()
  await history.locator('li', { hasText: 'Cancelada' }).waitFor()
  check('cancelar una asignación futura la deja en el historial', (await history.locator('li', { hasText: 'Cancelada' }).count()) === 1)

  // Asignar la versión 2 desde hoy.
  await page.getByRole('button', { name: 'Asignar rutina' }).click()
  dialog = page.getByRole('dialog', { name: 'Asignar rutina a Mariana' })
  await dialog.getByLabel('Rutina').selectOption({ label: ROUTINE })
  await dialog.getByRole('button', { name: 'Asignar' }).click()
  await programa.locator('li', { hasText: 'versión 2' }).waitFor()
  await page.waitForTimeout(300)
  check('el cambio de programa conserva todo el historial', (await history.locator('li').count()) === 2 && (await programa.locator('li').count()) === 1)
  await shot(page, '07-historial')

  // ---------- Portal del cliente ----------
  const tmp = clientA.temporaryPassword
  const clientCtx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })
  const cp = await clientCtx.newPage()
  current = cp
  cp.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await cp.goto(`${BASE}/iniciar-sesion`)
  await cp.getByLabel('Correo electrónico').fill(emailA)
  await cp.getByLabel('Contraseña', { exact: false }).fill(tmp)
  await cp.getByRole('button', { name: 'Entrar' }).click()
  await cp.getByRole('heading', { name: 'Crea tu contraseña' }).waitFor()
  await cp.getByLabel('Contraseña actual').fill(tmp)
  await cp.getByRole('textbox', { name: 'Nueva contraseña', exact: true }).fill('MarianaSegura2026')
  await cp.getByLabel('Confirmar nueva contraseña').fill('MarianaSegura2026')
  await cp.getByRole('button', { name: 'Guardar contraseña' }).click()
  await cp.getByRole('heading', { name: /Hola, Mariana/ }).waitFor()
  const card = cp.locator('section', { has: cp.getByRole('heading', { name: 'Rutina vigente' }) })
  await card.getByText(ROUTINE).waitFor()
  check('el cliente ve su rutina vigente en el inicio', (await card.getByText('Vigente', { exact: true }).count()) === 1)
  await shot(cp, '08-portal-inicio')
  await cp.goto(`${BASE}/portal/perfil`)
  await cp.getByRole('heading', { name: 'Mis programas' }).waitFor()
  await cp.getByRole('list', { name: 'Mis programas' }).locator('li').first().waitFor()
  const portalText = await cp.locator('#contenido').textContent()
  check('el cliente ve su perfil completo', ['165.5 cm', 'Intermedio', 'Lunes, Miércoles, Viernes', 'Molestia en rodilla izquierda'].every((t) => portalText.includes(t)))
  check('el cliente ve su historial pero no lo cancelado', (await cp.getByRole('list', { name: 'Mis programas' }).locator('li').count()) === 2 && !portalText.includes('Cancelada'))
  check('el cliente nunca ve las observaciones privadas', !portalText.includes(SECRET))
  check('el portal en celular no se desborda', await cp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await shot(cp, '09-portal-perfil')

  // ---------- Celular: ficha del cliente ----------
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() })
  const m = await mobile.newPage()
  current = m
  await m.goto(`${BASE}/entrenadora/clientes/${clientA.clientId}`)
  await m.getByRole('heading', { name: 'Programa' }).waitFor()
  await m.getByRole('list', { name: 'Programa actual' }).waitFor()
  check('la ficha del cliente en celular no se desborda', await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await shot(m, '10-ficha-movil')

  check('sin errores inesperados en la consola', errors.filter((e) => !/401|Unauthorized/.test(e)).length === 0)
  if (errors.length) console.log(errors.join('\n'))
  console.log(results.join('\n'))
  await browser.close()
})().catch(async (e) => {
  console.error(e)
  if (current) await current.screenshot({ path: path.join(OUT, 'fallo.png'), fullPage: true }).catch(() => {})
  console.log(results.join('\n'))
  process.exit(1)
})

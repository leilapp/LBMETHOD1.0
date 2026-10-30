// Uso: con la API y 'npm run dev' en marcha → node e2e/rutinas.cjs <carpeta-capturas>
// Constructor de rutinas en navegador real: frontend (Vite) + API real + SQL Server real.
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

/** Crea un ejercicio de prueba por la API, con la sesión del navegador. */
async function createExercise(page, nameEs) {
  const { token } = await (await page.request.get(`${BASE}/api/auth/csrf`)).json()
  const res = await page.request.post(`${BASE}/api/trainer/library/exercises`, {
    headers: { 'X-CSRF-TOKEN': token },
    data: { nameEs, type: 1, primaryMuscleGroupId: 1, secondaryMuscleGroupIds: [], equipmentIds: [] },
  })
  if (res.status() !== 201) throw new Error(`No se creó ${nameEs}: ${res.status()}`)
}

const exerciseNames = async (day) =>
  (await day.locator('.ex-card__name').allTextContents()).map((t) => t.replace(/(Superserie|Dropset|Calentamiento).*/, '').trim())

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const page = await ctx.newPage()
  current = page
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('dialog', (d) => d.accept())

  await page.goto(`${BASE}/iniciar-sesion`)
  await page.getByLabel('Correo electrónico').fill(TRAINER.email)
  await page.getByLabel('Contraseña', { exact: false }).fill(TRAINER.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByText('Clientes activos').waitFor()

  const HIP = `Hip thrust ${TAG}`
  const BSS = `Sentadilla búlgara ${TAG}`
  const ABD = `Abducción en máquina ${TAG}`
  for (const name of [HIP, BSS, ABD]) await createExercise(page, name)

  // ---------- Crear rutina ----------
  await page.getByRole('link', { name: 'Rutinas' }).click()
  await page.getByRole('heading', { name: 'Rutinas', exact: true }).waitFor()
  check('Rutinas ya no aparece como pendiente', !(await page.getByText('Pendiente · Fase 6').count()))
  await page.getByRole('button', { name: 'Nueva rutina' }).first().click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre').fill(`Glúteo 6 semanas ${TAG}`)
  await dialog.getByLabel('Objetivo').fill('Hipertrofia de glúteo')
  await dialog.getByLabel('Duración (semanas)').fill('6')
  await dialog.getByRole('button', { name: 'Crear y abrir constructor' }).click()
  await page.getByRole('heading', { name: 'Datos generales' }).waitFor()
  const builderUrl = page.url()
  check('crear la rutina abre el constructor', /\/rutinas\/\d+\/editar$/.test(builderUrl))
  const routineUrl = builderUrl.replace(/\/editar$/, '')

  // ---------- Días y ejercicios ----------
  await page.getByRole('button', { name: '+ Agregar día' }).click()
  let day1 = page.getByRole('region', { name: /^Día 1:/ })
  await day1.getByLabel('Nombre del día 1').fill('Día 1 - Glúteo')
  day1 = page.getByRole('region', { name: 'Día 1: Día 1 - Glúteo' })
  await day1.getByLabel('Día de la semana').selectOption({ label: 'Lunes' })
  await day1.getByRole('button', { name: '+ Agregar ejercicio' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Buscar en la biblioteca').fill(TAG)
  await dialog.getByRole('button', { name: 'Buscar' }).click()
  for (const name of [HIP, BSS, ABD]) await dialog.getByRole('button', { name: `Agregar ${name}` }).click()
  await dialog.getByRole('button', { name: `Agregar ${HIP}` }).filter({ hasText: 'Agregado' }).waitFor()
  await shot(page, '01-buscar-ejercicios')
  await dialog.getByRole('button', { name: 'Listo' }).click()
  check('se agregan ejercicios buscados en la biblioteca', (await day1.locator('.ex-card').count()) === 3)

  // Sin parámetros no se puede guardar: la entrenadora define cada uno.
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  check('exige las series de cada ejercicio (no inventa valores)', (await day1.getByText('Indica las series.').count()) === 3)
  await shot(page, '02-validacion-parametros')

  const params = (name) => day1.getByRole('group', { name: `Parámetros de ${name}` })
  let p = params(HIP)
  await p.getByLabel('Series').fill('4')
  await p.getByLabel('Reps mín.').fill('8')
  await p.getByLabel('Reps máx.').fill('12')
  await p.getByLabel('Peso sugerido').fill('60')
  await p.getByLabel('Descanso (s)').fill('90')
  await p.getByLabel('Tempo').fill('3-1-1-0')
  await p.getByLabel('RIR').fill('2')
  await p.getByLabel('Notas técnicas').fill('Pausa de 1 s arriba')
  p = params(BSS)
  await p.getByLabel('Series').fill('3')
  await p.getByLabel('Reps mín.').fill('10')
  await p.getByLabel('Reps máx.').fill('12')
  await p.getByLabel('Superserie').fill('a')
  p = params(ABD)
  await p.getByLabel('Series').fill('3')
  await p.getByLabel('Reps mín.').fill('15')
  await p.getByLabel('Reps máx.').fill('20')
  await p.getByLabel('RPE').fill('8')
  await p.getByLabel('Superserie').fill('A')
  await p.getByLabel('Tipo de serie').selectOption({ label: 'Dropset' })
  await shot(page, '03-parametros')

  // Cerrar tarjetas para ver la lista compacta.
  for (let i = 0; i < 3; i++) await day1.getByRole('button', { name: 'Cerrar' }).first().click()

  // Arrastrar Abducción antes de Hip thrust.
  const handleOf = (name) => day1.locator('.ex-card', { hasText: name }).locator('.handle')
  await handleOf(ABD).dragTo(day1.locator('.ex-card', { hasText: HIP }))
  check('arrastrar y soltar reordena los ejercicios', JSON.stringify(await exerciseNames(day1)) === JSON.stringify([ABD, HIP, BSS]))
  await day1.getByRole('button', { name: `Bajar ${ABD}` }).click()
  await day1.getByRole('button', { name: `Bajar ${ABD}` }).click()
  check('los botones ↑ ↓ también reordenan', JSON.stringify(await exerciseNames(day1)) === JSON.stringify([HIP, BSS, ABD]))
  await shot(page, '04-dia-ordenado')

  // Duplicar el día y ajustar el segundo.
  await day1.getByRole('button', { name: 'Duplicar día' }).click()
  let day2 = page.getByRole('region', { name: /^Día 2:/ })
  await day2.getByLabel('Nombre del día 2').fill('Día 2 - Pierna')
  day2 = page.getByRole('region', { name: 'Día 2: Día 2 - Pierna' })
  await day2.getByLabel('Día de la semana').selectOption({ label: 'Jueves' })
  check('duplicar día copia sus ejercicios', (await day2.locator('.ex-card').count()) === 3)
  await day2.getByRole('button', { name: `Quitar ${BSS}` }).click()
  await day2.getByRole('button', { name: `Duplicar ${HIP}` }).click()
  check('duplicar y quitar ejercicios', (await day2.locator('.ex-card').count()) === 3)
  // Detallar serie por serie el primer Hip thrust del día 2.
  await day2.getByRole('button', { name: 'Parámetros' }).first().click()
  const detail = day2.getByRole('group', { name: `Parámetros de ${HIP}` }).first()
  await detail.getByLabel(/Detallar serie por serie/).check()
  await detail.getByLabel('Tipo de la serie 1').selectOption({ label: 'Calentamiento' })
  await detail.getByLabel('Peso de la serie 1').fill('20')
  await detail.getByLabel('Reps mínimas de la serie 1').fill('12')
  await detail.getByLabel('Reps máximas de la serie 1').fill('12')
  check('detalle por serie crea una fila por serie', (await detail.locator('tbody tr').count()) === 4)
  await shot(page, '05-detalle-por-serie')

  // ---------- Guardar, recargar y recuperar ----------
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await page.getByText('Borrador guardado.').waitFor()
  await page.reload()
  await page.getByRole('heading', { name: 'Datos generales' }).waitFor()
  day1 = page.getByRole('region', { name: 'Día 1: Día 1 - Glúteo' })
  day2 = page.getByRole('region', { name: 'Día 2: Día 2 - Pierna' })
  check('al recargar, el orden de los ejercicios se recupera de SQL Server', JSON.stringify(await exerciseNames(day1)) === JSON.stringify([HIP, BSS, ABD]))
  check('al recargar, los parámetros se recuperan', (await day1.locator('.ex-card', { hasText: HIP }).textContent()).includes('4 × 8–12 · 60 kg · 90 s descanso · tempo 3-1-1-0 · RIR 2'))
  check('al recargar, el detalle por serie se recupera', (await day2.getByText('4 series detalladas').count()) === 1)
  check('la superserie se normaliza a mayúscula', (await day1.getByText('Superserie A').count()) === 2)
  await shot(page, '06-constructor-recargado')

  // ---------- Vista previa y publicación ----------
  await page.getByRole('button', { name: 'Vista previa' }).click()
  dialog = page.getByRole('dialog', { name: 'Vista previa' })
  check('la vista previa muestra los días y la superserie', (await dialog.getByText('Superserie A').count()) >= 2 && (await dialog.getByText('Jueves').count()) === 1)
  await shot(page, '07-vista-previa')
  await dialog.getByRole('button', { name: 'Cerrar' }).click()

  // Al duplicar el día, la superserie A del día 2 quedó con un solo ejercicio: publicar debe impedirlo.
  await page.getByRole('button', { name: 'Publicar' }).click()
  dialog = page.getByRole('dialog', { name: 'Publicar versión 1' })
  await dialog.getByLabel('Notas del cambio').fill('Primera versión')
  await dialog.getByRole('button', { name: 'Publicar' }).click()
  await day2.getByText('La superserie A del día «Día 2 - Pierna» tiene un solo ejercicio.').waitFor()
  check('no se publica una superserie incompleta', /\/editar$/.test(page.url()))
  const abdCard = day2.locator('.ex-card', { hasText: ABD })
  await abdCard.getByRole('button', { name: 'Parámetros' }).click()
  await abdCard.getByLabel('Superserie').fill('')
  await page.getByRole('button', { name: 'Publicar' }).click()
  dialog = page.getByRole('dialog', { name: 'Publicar versión 1' })
  await dialog.getByLabel('Notas del cambio').fill('Primera versión')
  await dialog.getByRole('button', { name: 'Publicar' }).click()
  await page.getByRole('heading', { name: 'Versiones' }).waitFor()
  check('publicar lleva a la ficha con la versión 1 publicada', (await page.getByRole('button', { name: /Versión 1 Publicada/ }).count()) === 1)
  await shot(page, '08-ficha-version-1')

  // ---------- Editar lo publicado = versión 2 ----------
  await page.getByRole('link', { name: 'Editar' }).click()
  await page.getByText('Borrador · versión 2', { exact: false }).waitFor()
  day1 = page.getByRole('region', { name: 'Día 1: Día 1 - Glúteo' })
  await day1.getByRole('button', { name: 'Parámetros' }).first().click()
  await day1.getByRole('group', { name: `Parámetros de ${HIP}` }).getByLabel('Series').fill('5')
  await page.getByRole('button', { name: 'Publicar' }).click()
  dialog = page.getByRole('dialog', { name: 'Publicar versión 2' })
  await dialog.getByLabel('Notas del cambio').fill('Una serie más de hip thrust')
  await dialog.getByRole('button', { name: 'Publicar' }).click()
  await page.getByRole('button', { name: /Versión 2 Publicada/ }).waitFor()
  check('la versión 2 se muestra con sus notas', (await page.getByText('«Una serie más de hip thrust»').count()) === 1)
  await page.getByRole('button', { name: /Versión 1 Publicada/ }).click()
  await page.getByText('4 × 8–12', { exact: false }).first().waitFor()
  check('la versión 1 se conserva intacta (4 series)', (await page.locator('.preview').getByText('5 × 8–12').count()) === 0)
  await shot(page, '09-historial-versiones')

  // ---------- Plantilla, duplicar y archivar ----------
  await page.getByRole('button', { name: 'Guardar como plantilla' }).click()
  dialog = page.getByRole('dialog', { name: 'Guardar como plantilla' })
  await dialog.getByLabel('Nombre').fill(`Plantilla glúteo ${TAG}`)
  await dialog.getByRole('button', { name: 'Crear copia' }).click()
  await page.getByRole('heading', { name: 'Datos generales' }).waitFor()
  check('guardar como plantilla abre su constructor', page.url().includes('/plantillas/'))
  await page.goto(`${BASE}/entrenadora/plantillas`)
  await page.getByRole('link', { name: `Plantilla glúteo ${TAG}` }).waitFor()
  check('la plantilla aparece en Plantillas', true)

  await page.getByRole('link', { name: `Plantilla glúteo ${TAG}` }).click()
  await page.getByRole('button', { name: 'Usar plantilla' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre').fill(`Programa desde plantilla ${TAG}`)
  await dialog.getByRole('button', { name: 'Crear copia' }).click()
  await page.getByRole('heading', { name: 'Datos generales' }).waitFor()
  check('crear rutina desde plantilla copia sus días', (await page.locator('.day').count()) === 2)

  await page.goto(routineUrl)
  await page.getByRole('button', { name: 'Duplicar' }).click()
  dialog = page.getByRole('dialog', { name: 'Duplicar' })
  await dialog.getByRole('button', { name: 'Crear copia' }).click()
  await page.getByRole('heading', { name: 'Datos generales' }).waitFor()
  const copyUrl = page.url().replace(/\/editar$/, '')
  await page.goto(copyUrl)
  await page.getByRole('button', { name: 'Archivar' }).click()
  dialog = page.getByRole('dialog', { name: 'Archivar' })
  await shot(page, '10-confirmar-archivar')
  await dialog.getByRole('button', { name: 'Archivar' }).click()
  await page.getByText('Se archivó. Sus versiones se conservan.').waitFor()
  await page.goto(`${BASE}/entrenadora/rutinas`)
  await page.getByRole('link', { name: `Glúteo 6 semanas ${TAG}`, exact: true }).waitFor()
  check('la copia archivada no aparece entre las activas', !(await page.getByRole('link', { name: `Glúteo 6 semanas ${TAG} (copia)` }).count()))
  await page.getByRole('tab', { name: 'Archivadas' }).click()
  await page.getByRole('link', { name: `Glúteo 6 semanas ${TAG} (copia)` }).waitFor()
  check('aparece en Archivadas', true)
  await page.getByRole('tab', { name: 'Activas' }).click()
  await page.getByRole('link', { name: `Glúteo 6 semanas ${TAG}`, exact: true }).waitFor()
  await shot(page, '11-lista-rutinas')

  // ---------- Celular ----------
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() })
  const m = await mobile.newPage()
  await m.goto(`${routineUrl}/editar`)
  await m.getByRole('heading', { name: 'Datos generales' }).waitFor()
  check('el constructor en celular no se desborda', await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  // Captura de la pantalla tal como se ve (con la barra fija abajo), a la altura de los ejercicios.
  await m.locator('.ex-card').first().scrollIntoViewIfNeeded()
  await m.screenshot({ path: path.join(OUT, '12-constructor-movil.png') })
  await m.goto(routineUrl)
  await m.getByRole('heading', { name: 'Versiones' }).waitFor()
  check('la ficha en celular no se desborda', await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await shot(m, '13-ficha-movil')

  // Esperados: 401 antes de iniciar sesión y un 400 por la superserie incompleta que se intentó publicar.
  const unexpected = errors.filter((e) => !/401|Unauthorized/.test(e))
  check('sin errores inesperados en la consola', unexpected.length === 1 && /400/.test(unexpected[0]))
  if (errors.length) console.log(errors.join('\n'))
  console.log(results.join('\n'))
  await browser.close()
})().catch(async (e) => {
  console.error(e)
  if (current) await current.screenshot({ path: path.join(OUT, 'fallo.png'), fullPage: true }).catch(() => {})
  console.log(results.join('\n'))
  process.exit(1)
})

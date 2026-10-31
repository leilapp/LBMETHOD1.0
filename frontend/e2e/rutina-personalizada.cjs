// Uso: node e2e/rutina-personalizada.cjs <carpeta-capturas>
// Flujo pedido por Leilani (31/10/2026): crear un cliente y armarle SU rutina; además crear una rutina y asignarla
// a varios clientes. Navegador real contra la API real. La entrenadora define cada ejercicio y parámetro.
// Requiere LBMETHOD_E2E_BASE, LBMETHOD_E2E_EMAIL, LBMETHOD_E2E_PASSWORD (cuenta de PRUEBA) y LBMETHOD_E2E_TAG.
const { chromium } = require('playwright')
const path = require('path')

const BASE = process.env.LBMETHOD_E2E_BASE || 'http://localhost:5173'
const OUT = process.argv[2] ?? require('os').tmpdir()
const TAG = process.env.LBMETHOD_E2E_TAG
const TRAINER = { email: process.env.LBMETHOD_E2E_EMAIL, password: process.env.LBMETHOD_E2E_PASSWORD }
if (!TRAINER.email || !TRAINER.password || !TAG) {
  console.error('Define LBMETHOD_E2E_EMAIL, LBMETHOD_E2E_PASSWORD y LBMETHOD_E2E_TAG')
  process.exit(1)
}
const results = []
const check = (name, ok) => { results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}`); if (!ok) process.exitCode = 1 }
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })

async function api(page, method, url, data) {
  const { token } = await (await page.request.get(`${BASE}/api/auth/csrf`)).json()
  const res = await page.request.fetch(`${BASE}${url}`, { method, headers: { 'X-CSRF-TOKEN': token }, data })
  return res.status() === 204 ? null : res.json()
}

async function login(page, email, password) {
  await page.goto(`${BASE}/iniciar-sesion`)
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel(/^Contraseña/).fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

/** En el constructor: un día con un ejercicio y sus parámetros, escritos a mano. */
async function buildDay(page, exercise, { sets, min, max, dayName }) {
  await page.getByRole('heading', { name: 'Datos generales' }).waitFor()
  await page.getByRole('button', { name: '+ Agregar día' }).click()
  let day = page.getByRole('region', { name: /^Día 1:/ })
  await day.getByLabel('Nombre del día 1').fill(dayName)
  day = page.getByRole('region', { name: `Día 1: ${dayName}` })
  await day.getByRole('button', { name: '+ Agregar ejercicio' }).click()
  const picker = page.getByRole('dialog')
  await picker.getByLabel('Buscar en la biblioteca').fill(TAG)
  await picker.getByRole('button', { name: 'Buscar' }).click()
  await picker.getByRole('button', { name: `Agregar ${exercise}` }).click()
  await picker.getByRole('button', { name: 'Listo' }).click()
  const params = day.getByRole('group', { name: `Parámetros de ${exercise}` })
  await params.getByLabel('Series').fill(String(sets))
  await params.getByLabel('Reps mín.').fill(String(min))
  await params.getByLabel('Reps máx.').fill(String(max))
}

async function publish(page) {
  await page.getByRole('button', { name: 'Publicar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Publicar versión 1' })
  await dialog.getByRole('button', { name: 'Publicar' }).click()
}

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  try {
    await login(page, TRAINER.email, TRAINER.password)
    await page.getByText('Clientes activos').waitFor()
    const EX = `Hip thrust personal ${TAG}`
    await api(page, 'POST', '/api/trainer/library/exercises', { nameEs: EX, type: 1, primaryMuscleGroupId: 1, secondaryMuscleGroupIds: [], equipmentIds: [] })

    // ---------- 1. Crear un cliente y armarle su rutina ----------
    await page.getByRole('navigation').getByRole('link', { name: 'Clientes' }).click()
    await page.getByRole('button', { name: 'Nuevo cliente' }).click()
    let dialog = page.getByRole('dialog', { name: 'Nuevo cliente' })
    await dialog.getByLabel('Nombre').fill('Valeria')
    await dialog.getByLabel('Apellidos').fill(`Ríos ${TAG}`)
    const email = `valeria.${TAG}@test.local`
    await dialog.getByLabel('Correo electrónico').fill(email)
    await dialog.getByRole('button', { name: 'Crear cuenta' }).click()
    const temp = (await page.getByTestId('temporary-password').textContent()).trim()
    check('al crear el cliente se muestra su contraseña temporal', temp.length >= 10)
    await shot(page, 'p1-cliente-creado')
    await page.getByRole('button', { name: 'Crear su rutina' }).click()

    dialog = page.getByRole('dialog', { name: 'Nueva rutina para Valeria' })
    await dialog.waitFor()
    check('«Crear su rutina» abre la rutina nueva para ese cliente', /\/entrenadora\/clientes\/\d+/.test(page.url()))
    const clientUrl = page.url().replace(/\?.*$/, '')
    check('el nombre sugerido lleva el nombre del cliente (editable)', (await dialog.getByLabel('Nombre').inputValue()) === `Rutina de Valeria Ríos ${TAG}`)
    await dialog.getByLabel('Objetivo').fill('Glúteo y postura')
    await dialog.getByRole('button', { name: 'Crear y abrir constructor' }).click()
    await page.getByText(`Rutina personalizada para Valeria Ríos ${TAG}`).waitFor()
    check('el constructor indica para quién es la rutina', true)
    await buildDay(page, EX, { sets: 4, min: 8, max: 12, dayName: 'Día 1 - Glúteo' })
    await shot(page, 'p2-constructor-personalizado')
    await publish(page)

    dialog = page.getByRole('dialog', { name: 'Asignar rutina' })
    await dialog.waitFor()
    check('al publicar se abre la asignación con el cliente ya elegido', (await dialog.getByRole('checkbox').count()) === 0)
    await shot(page, 'p3-asignar-al-publicar')
    await dialog.getByRole('button', { name: 'Asignar' }).click()
    await page.getByText('Rutina asignada a 1 cliente.').waitFor()
    check('la rutina personalizada queda asignada', true)

    await page.goto(clientUrl)
    const current = page.getByRole('list', { name: 'Programa actual' })
    await current.waitFor()
    check('la ficha del cliente muestra su rutina', (await current.getByText(`Rutina de Valeria Ríos ${TAG}`).count()) === 1)
    await shot(page, 'p4-ficha-con-rutina')

    // ---------- 2. Una rutina para varios clientes ----------
    const other1 = await api(page, 'POST', '/api/trainer/clients', { firstName: 'Ana', lastName: `Grupo ${TAG}`, email: `ana.${TAG}@test.local`, phone: null })
    const other2 = await api(page, 'POST', '/api/trainer/clients', { firstName: 'Bety', lastName: `Grupo ${TAG}`, email: `bety.${TAG}@test.local`, phone: null })
    await page.getByRole('navigation').getByRole('link', { name: 'Rutinas' }).click()
    await page.getByRole('button', { name: 'Nueva rutina' }).first().click()
    dialog = page.getByRole('dialog', { name: 'Nueva rutina' })
    await dialog.getByLabel('Nombre').fill(`Grupal ${TAG}`)
    await dialog.getByRole('button', { name: 'Crear y abrir constructor' }).click()
    await buildDay(page, EX, { sets: 3, min: 10, max: 15, dayName: 'Día 1 - Grupal' })
    await publish(page)
    await page.getByRole('button', { name: 'Asignar a clientes' }).click()
    dialog = page.getByRole('dialog', { name: 'Asignar rutina' })
    await dialog.getByRole('checkbox', { name: new RegExp(`Ana Grupo ${TAG}`) }).check()
    await dialog.getByRole('checkbox', { name: new RegExp(`Bety Grupo ${TAG}`) }).check()
    await dialog.getByRole('button', { name: 'Asignar' }).click()
    await page.getByText('Rutina asignada a 2 clientes.').waitFor()
    check('una rutina se asigna a varios clientes a la vez', true)
    const a1 = await api(page, 'GET', `/api/trainer/clients/${other1.clientId}/assignments`)
    const a2 = await api(page, 'GET', `/api/trainer/clients/${other2.clientId}/assignments`)
    check('cada cliente del grupo tiene la rutina', a1.length === 1 && a2.length === 1)

    // ---------- 3. El cliente nuevo ve SU rutina ----------
    const cctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })
    const cp = await cctx.newPage()
    await login(cp, email, temp)
    await cp.getByRole('heading', { name: 'Crea tu contraseña' }).waitFor()
    await cp.getByLabel('Contraseña actual').fill(temp)
    await cp.getByLabel(/^Nueva contraseña/).fill('Valeria2026Segura')
    await cp.getByLabel('Confirmar nueva contraseña').fill('Valeria2026Segura')
    await cp.getByRole('button', { name: /Cambiar|Guardar/ }).click()
    await cp.waitForURL(/\/portal/)
    await cp.goto(`${BASE}/portal/rutina`)
    await cp.getByText(EX).first().waitFor()
    check('el cliente ve su rutina personalizada con su ejercicio', (await cp.getByText(`Rutina de Valeria Ríos ${TAG}`).count()) >= 1)
    check('el cliente no ve la rutina grupal (no se la asignaron)', (await cp.getByText(`Grupal ${TAG}`).count()) === 0)
    await shot(cp, 'p5-portal-cliente')
  } catch (err) {
    results.push(`FAIL error: ${err.message.split('\n')[0]}`)
    process.exitCode = 1
    await shot(page, 'p-error').catch(() => {})
  }
  check('sin errores inesperados en la consola', errors.filter((e) => !/401|Failed to load resource/.test(e)).length === 0)
  console.log(results.join('\n'))
  await browser.close()
})()

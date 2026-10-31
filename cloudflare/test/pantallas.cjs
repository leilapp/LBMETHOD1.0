// Prueba en navegador de la etapa 1 con las pantallas reales de LB METHOD servidas por el Worker (wrangler dev).
// Uso: con «npm run dev» en marcha y una entrenadora de PRUEBA creada con «npm run create-trainer»:
//   LBMETHOD_E2E_EMAIL=... LBMETHOD_E2E_PASSWORD=... node test/pantallas.cjs <carpeta-capturas>
// Requiere Playwright (npm install --no-save playwright && npx playwright install chromium).
const { chromium } = require('playwright')
const path = require('path')

const BASE = process.env.LBMETHOD_E2E_BASE || 'http://localhost:8787'
const OUT = process.argv[2] ?? require('os').tmpdir()
const TRAINER = { email: process.env.LBMETHOD_E2E_EMAIL, password: process.env.LBMETHOD_E2E_PASSWORD }
const results = []
const check = (name, ok) => { results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}`); if (!ok) process.exitCode = 1 }
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })

async function login(page, email, password) {
  await page.goto(`${BASE}/iniciar-sesion`)
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: false }).fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const listen = (page) => page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  // ---------- Entrenadora (escritorio) ----------
  const desk = await browser.newContext({ viewport: { width: 1366, height: 860 } })
  let page = await desk.newPage()
  listen(page)
  await page.goto(BASE)
  await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor()
  check('sin sesión redirige a iniciar sesión', page.url().endsWith('/iniciar-sesion'))

  await login(page, TRAINER.email, 'Incorrecta123')
  await page.getByRole('alert').waitFor()
  check('contraseña incorrecta muestra el error en español', (await page.getByRole('alert').textContent()).includes('incorrectos'))

  await login(page, TRAINER.email, TRAINER.password)
  await page.waitForURL(/\/entrenadora$/)
  check('la entrenadora entra a su panel', true)
  await page.reload()
  await page.waitForURL(/\/entrenadora$/)
  check('la sesión persiste al recargar (cookie de D1)', true)
  await shot(page, '01-panel-entrenadora')

  await page.getByRole('link', { name: 'Clientes', exact: true }).click()
  await page.getByRole('button', { name: 'Nuevo cliente' }).click()
  const email = `cliente.${Date.now()}@prueba.local`
  const dialog = page.getByRole('dialog', { name: 'Nuevo cliente' })
  await dialog.getByLabel('Nombre').fill('Begoña')
  await dialog.getByLabel('Apellidos').fill('Núñez Cloudflare')
  await dialog.getByLabel('Correo electrónico').fill(email)
  await dialog.getByRole('button', { name: 'Crear cuenta' }).click()
  const tmp = (await page.getByTestId('temporary-password').textContent()).trim()
  check('se muestra la contraseña temporal de 14 caracteres', tmp.length === 14)
  await shot(page, '02-contrasena-temporal')
  await page.getByRole('button', { name: 'Listo' }).click()
  await page.getByText(email).waitFor()
  check('el cliente nuevo aparece en la lista (guardado en D1, con acentos)', await page.getByText('Begoña Núñez Cloudflare').first().isVisible())
  await shot(page, '03-lista-clientes')

  await page.reload()
  await page.getByText(email).waitFor()
  check('la lista se vuelve a leer de D1 al recargar', true)

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor()
  await page.goto(`${BASE}/entrenadora/clientes`)
  await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor()
  check('tras cerrar sesión no se puede volver al panel', page.url().endsWith('/iniciar-sesion'))

  // ---------- Cliente (celular Android) ----------
  const phone = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  page = await phone.newPage()
  listen(page)
  await login(page, email, tmp)
  await page.getByRole('heading', { name: 'Crea tu contraseña' }).waitFor()
  check('el cliente con contraseña temporal debe crear la suya', page.url().endsWith('/cambiar-contrasena'))
  await page.getByLabel('Contraseña actual').fill(tmp)
  await page.getByRole('textbox', { name: 'Nueva contraseña', exact: true }).fill('BegonaSegura2026')
  await page.getByLabel('Confirmar nueva contraseña').fill('BegonaSegura2026')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await page.waitForURL(/\/portal$/)
  check('tras cambiarla entra a su portal', true)
  await page.waitForTimeout(1500)
  await shot(page, '04-portal-celular')

  await page.goto(`${BASE}/entrenadora/clientes`)
  await page.waitForTimeout(1000)
  check('el cliente no puede abrir las pantallas de la entrenadora', !page.url().includes('/entrenadora'))

  // Errores de consola: se esperan los 401 de las comprobaciones de sesión y los 501 de lo que aún no se migra.
  const unexpected = errors.filter((e) => !/status of (401|501)/.test(e))
  check('sin errores inesperados en la consola (ningún bloqueo de la CSP)', unexpected.length === 0)
  if (unexpected.length) console.log(unexpected.join('\n'))

  await browser.close()
  console.log(results.join('\n'))
})().catch((e) => { console.error(e); process.exit(1) })

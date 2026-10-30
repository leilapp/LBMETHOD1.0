// Uso: con la API y 'npm run dev' en marcha → node e2e/flujo-completo.cjs [carpeta-capturas]
// Flujo completo en navegador real: frontend (Vite) + API real + SQL Server real.
const { chromium } = require('playwright')
const path = require('path')

const BASE = 'http://localhost:5173'
const OUT = process.argv[2] ?? require('os').tmpdir()
// Cuenta de entrenadora de PRUEBA (nunca la real): definir LBMETHOD_E2E_EMAIL y LBMETHOD_E2E_PASSWORD.
const TRAINER = { email: process.env.LBMETHOD_E2E_EMAIL, password: process.env.LBMETHOD_E2E_PASSWORD }
if (!TRAINER.email || !TRAINER.password) { console.error('Define LBMETHOD_E2E_EMAIL y LBMETHOD_E2E_PASSWORD'); process.exit(1) }
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

  // ---------- Escritorio: entrenadora ----------
  const desk = await browser.newContext({ viewport: { width: 1366, height: 860 } })
  let page = await desk.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(BASE)
  await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor()
  check('sin sesión redirige a iniciar sesión', page.url().endsWith('/iniciar-sesion'))
  await shot(page, '01-login-escritorio')

  await login(page, TRAINER.email, 'Incorrecta123')
  await page.getByRole('alert').waitFor()
  check('contraseña incorrecta muestra error', (await page.getByRole('alert').textContent()).includes('incorrectos'))
  await shot(page, '02-login-error')

  await login(page, TRAINER.email, TRAINER.password)
  await page.getByText('Clientes activos').waitFor()
  check('entrenadora entra a su inicio', page.url().endsWith('/entrenadora'))
  await shot(page, '03-entrenadora-inicio')

  await page.reload()
  await page.getByText('Clientes activos').waitFor()
  check('la sesión persiste al recargar', page.url().endsWith('/entrenadora'))

  await page.getByRole('link', { name: 'Clientes', exact: true }).click()
  await page.getByRole('button', { name: 'Nuevo cliente' }).click()
  const email = `cliente.${Date.now()}@test.local`
  const dialog = page.getByRole('dialog', { name: 'Nuevo cliente' })
  await dialog.getByLabel('Nombre').fill('Mariana')
  await dialog.getByLabel('Apellidos').fill('Prueba E2E')
  await dialog.getByLabel('Correo electrónico').fill(email)
  await shot(page, '04-nuevo-cliente')
  await dialog.getByRole('button', { name: 'Crear cuenta' }).click()
  const tmp = (await page.getByTestId('temporary-password').textContent()).trim()
  check('se muestra contraseña temporal de 14 caracteres', tmp.length === 14)
  await shot(page, '05-contrasena-temporal')
  await page.getByRole('button', { name: 'Listo' }).click()
  await page.getByText(email).waitFor()
  check('el cliente nuevo aparece en la lista (guardado en SQL Server)', await page.getByText(email).isVisible())

  const item = page.locator('li', { hasText: email })
  await item.getByRole('button', { name: 'Desactivar' }).click()
  await shot(page, '06-confirmar-desactivar')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
  await shot(page, '07-clientes-lista')

  await page.getByRole('link', { name: /Calendario/ }).click()
  await page.getByText('Pendiente · Fase 9').waitFor()
  check('módulo futuro se marca como pendiente', true)
  await shot(page, '08-modulo-pendiente')

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor()
  await page.goto(`${BASE}/entrenadora`)
  await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor()
  check('tras cerrar sesión no se puede volver al panel', page.url().endsWith('/iniciar-sesion'))

  // ---------- Celular (Android): cliente ----------
  const phone = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  page = await phone.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(BASE)
  await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor()
  await shot(page, '09-login-celular')
  await login(page, email, tmp)
  await page.getByRole('heading', { name: 'Crea tu contraseña' }).waitFor()
  check('cliente con contraseña temporal debe crear la suya', page.url().endsWith('/cambiar-contrasena'))
  await page.getByLabel('Contraseña actual').fill(tmp)
  await page.getByRole('textbox', { name: 'Nueva contraseña', exact: true }).fill('debil')
  await page.getByLabel('Confirmar nueva contraseña').fill('debil')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  check('contraseña débil se rechaza', await page.getByText('Debe tener al menos 10 caracteres.').isVisible())
  await shot(page, '10-cambiar-contrasena-celular')
  await page.getByRole('textbox', { name: 'Nueva contraseña', exact: true }).fill('MarianaSegura2026')
  await page.getByLabel('Confirmar nueva contraseña').fill('MarianaSegura2026')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await page.getByRole('heading', { name: /Hola, Mariana/ }).waitFor()
  check('tras cambiarla entra a su portal', page.url().endsWith('/portal'))
  await shot(page, '11-portal-inicio-celular')

  await page.getByRole('button', { name: /Abrir menú/ }).click()
  await page.waitForTimeout(300)
  await shot(page, '12-portal-menu-celular')
  await page.getByRole('link', { name: 'Mi perfil' }).click()
  await page.getByText('Mis datos').waitFor()
  // Se busca dentro del contenido: el menú del celular también muestra el nombre y el correo mientras se cierra.
  await page.locator('#contenido').getByText(email).waitFor()
  check('el perfil muestra los datos reales del cliente', await page.locator('#contenido').getByText('Mariana Prueba E2E').isVisible())
  await page.waitForTimeout(400)
  await shot(page, '13-portal-perfil-celular')

  await page.goto(`${BASE}/entrenadora/clientes`)
  await page.getByRole('heading', { name: /Hola, Mariana/ }).waitFor()
  check('cliente que entra a la URL de entrenadora vuelve a su portal', page.url().endsWith('/portal'))
  const forbidden = await page.evaluate(async () => (await fetch('/api/trainer/clients')).status)
  check('la API niega al cliente los datos de entrenadora (403)', forbidden === 403)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  check('sin desplazamiento horizontal en celular', !overflow)

  // ---------- Tablet: entrenadora ----------
  const tablet = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true })
  page = await tablet.newPage()
  await login(page, TRAINER.email, TRAINER.password)
  await page.getByText('Clientes activos').waitFor()
  await shot(page, '14-entrenadora-inicio-tablet')
  await page.goto(`${BASE}/entrenadora/clientes`)
  await page.getByText(email).waitFor()
  await shot(page, '15-clientes-tablet')
  const overflowTablet = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  check('sin desplazamiento horizontal en tablet', !overflowTablet)

  // ---------- Celular: entrenadora ----------
  const phone2 = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  page = await phone2.newPage()
  await login(page, TRAINER.email, TRAINER.password)
  await page.getByText('Clientes activos').waitFor()
  await page.goto(`${BASE}/entrenadora/clientes`)
  await page.getByText(email).waitFor()
  await shot(page, '16-clientes-celular')

  check('sin errores en la consola del navegador (salvo 401/403 esperados)',
    errors.filter((e) => !/401|403|Unauthorized|Forbidden/.test(e)).length === 0)

  await browser.close()
  console.log(results.join('\n'))
  if (errors.length) console.log('Mensajes de consola:\n' + errors.join('\n'))
})().catch((e) => { console.error(e); process.exit(1) })

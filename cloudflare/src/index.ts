import { Hono } from 'hono'
import { problem, securityHeaders } from './http'
import { auth } from './routes/auth'
import { clients } from './routes/clients'
import { recovery, recoveryCodes } from './routes/recovery'
import { routines } from './routines/routines'
import { assignments, routineAssignments } from './clients/assignments'
import { portalProfile } from './clients/portal'
import { portalTraining } from './training/portal'
import { calendarEvents } from './tracking/calendar'
import { trackingPortal } from './tracking/portal'
import { trackingTrainer } from './tracking/trainer'
import { excelExports } from './exports/excel'
import { profiles } from './clients/profiles'
import { catalogs } from './library/catalogs'
import { exercises } from './library/exercises'
import { importExport } from './library/import-export'
import { exerciseMedia, mediaContent } from './library/media'
import { loadSession, requireCsrf, requireRole } from './session'
import type { AppBindings } from './types'

const app = new Hono<AppBindings>()

// Nunca se muestran detalles internos (pila, SQL) al usuario; el detalle queda solo en el registro del Worker.
app.onError((err, c) => {
  console.error('Error no controlado', err)
  return problem(c, 500, 'Error del servidor', 'Ocurrió un error inesperado. Inténtalo de nuevo.')
})

const api = new Hono<AppBindings>()
api.use('*', loadSession, requireCsrf)
api.route('/auth', auth)
api.route('/auth/recovery', recovery)
api.use('/trainer/*', requireRole('TRAINER'))
api.use('/portal/*', requireRole('CLIENT'))
api.route('/trainer/recovery-codes', recoveryCodes)
api.route('/trainer/clients', clients)
api.route('/trainer/clients', profiles)
api.route('/trainer/assignments', assignments)
api.route('/trainer/library', catalogs)
// Importación y exportación antes que /:id para que «export» e «import/...» no se confundan con un ejercicio.
api.route('/trainer/library/exercises', importExport)
api.route('/trainer/library/exercises', exerciseMedia)
api.route('/trainer/library/exercises', exercises)
api.route('/trainer/library/media', mediaContent)
api.route('/trainer/routines', routines)
api.route('/trainer/routines', routineAssignments)
api.route('/trainer/calendar', calendarEvents)
api.route('/trainer', trackingTrainer)
api.route('/trainer/exports', excelExports)
api.route('/portal', portalProfile)
api.route('/portal', portalTraining)
api.route('/portal', trackingPortal)

// Lo que aún no se migra responde 501 con un mensaje claro (con la misma regla de sesión y rol que tendrá).
api.all('*', requireRole(), (c) =>
  problem(c, 501, 'Pendiente', 'Esta función todavía no está disponible en la versión de Cloudflare. Llega en una etapa siguiente.'),
)
app.route('/api', api)

// Todo lo demás son las pantallas compiladas; las rutas de la aplicación devuelven index.html.
// La APK de Android se descarga como archivo (no se intenta abrir en el navegador).
app.get('/descargar/lbmethod.apk', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (!res.ok) return res
  const download = new Response(res.body, res)
  download.headers.set('Content-Disposition', 'attachment; filename="LB-METHOD.apk"')
  return download
})
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default {
  async fetch(request, env, ctx) {
    const res = await app.fetch(request, env, ctx)
    return securityHeaders(res, new URL(request.url).pathname)
  },
} satisfies ExportedHandler<AppBindings['Bindings']>

import { Hono } from 'hono'
import { problem, securityHeaders } from './http'
import { auth } from './routes/auth'
import { clients } from './routes/clients'
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
api.use('/trainer/*', requireRole('TRAINER'))
api.use('/portal/*', requireRole('CLIENT'))
api.route('/trainer/clients', clients)

// Lo que aún no se migra responde 501 con un mensaje claro (con la misma regla de sesión y rol que tendrá).
api.all('*', requireRole(), (c) =>
  problem(c, 501, 'Pendiente', 'Esta función todavía no está disponible en la versión de Cloudflare. Llega en una etapa siguiente.'),
)
app.route('/api', api)

// Todo lo demás son las pantallas compiladas; las rutas de la aplicación devuelven index.html.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default {
  async fetch(request, env, ctx) {
    const res = await app.fetch(request, env, ctx)
    return securityHeaders(res, new URL(request.url).pathname)
  },
} satisfies ExportedHandler<AppBindings['Bindings']>

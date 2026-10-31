export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  /**
   * Archivos privados (fotos, imágenes y videos) en Workers KV, gratis y sin medio de pago. Nunca se publica: todo
   * pasa por la API con permisos. Ver storage.ts.
   */
  FILES?: KVNamespace
  /** Opcional: si se activa R2 y se agrega su binding, los archivos se guardan ahí en lugar de KV. */
  MEDIA?: R2Bucket
  /**
   * Llave para firmar los tokens CSRF. Opcional: `wrangler secret put APP_SECRET` (en local, .dev.vars).
   * Si no existe, el Worker genera una al azar y la guarda en D1 (tabla app_settings).
   */
  APP_SECRET?: string
  SESSION_HOURS: string
  MAX_FAILED_LOGINS: string
  LOCKOUT_MINUTES: string
  LOGIN_REQUESTS_PER_MINUTE: string
  MAX_IMAGE_BYTES: string
  MAX_VIDEO_BYTES: string
  /** Tamaño máximo de una foto de progreso (10 MB, como en .NET). */
  MAX_PHOTO_BYTES: string
}

export type Role = 'TRAINER' | 'CLIENT'

export interface SessionUser {
  id: number
  email: string
  displayName: string
  role: Role
  mustChangePassword: boolean
  sessionId: string
}

export interface AppBindings {
  Bindings: Env
  Variables: { user: SessionUser | null }
}

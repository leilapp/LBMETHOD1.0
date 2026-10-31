export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  /** Archivos privados (fotos, imágenes y videos). Nunca se publica: todo pasa por la API con permisos. */
  MEDIA: R2Bucket
  /** Llave para firmar los tokens CSRF. Secreto: `wrangler secret put APP_SECRET` (en local, .dev.vars). */
  APP_SECRET: string
  SESSION_HOURS: string
  MAX_FAILED_LOGINS: string
  LOCKOUT_MINUTES: string
  LOGIN_REQUESTS_PER_MINUTE: string
  MAX_IMAGE_BYTES: string
  MAX_VIDEO_BYTES: string
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

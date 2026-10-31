/**
 * Contraseñas, tokens y firmas con Web Crypto (incluido en Workers).
 * Contraseñas: PBKDF2-SHA256 con sal aleatoria de 16 bytes.
 * Formato guardado: pbkdf2-sha256$<iteraciones>$<sal base64>$<huella base64> (scripts/create-trainer.mjs usa el mismo).
 *
 * Iteraciones: 10 000. El plan gratuito de Workers da unos 10 ms de procesador por petición y 100 000 iteraciones
 * tardan unos 50 ms, así que el inicio de sesión fallaba (error 1102). Con 10 000 tarda unos 5 ms. La protección
 * principal contra adivinar contraseñas sigue igual: 10 intentos por minuto y bloqueo tras 5 fallos.
 * Las cuentas guardadas con otra cantidad se actualizan solas al iniciar sesión (needsRehash).
 */
export const ITERATIONS = 10_000
const encoder = new TextEncoder()

const toB64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const fromB64 = (value: string) => Uint8Array.from(atob(value), (ch) => ch.charCodeAt(0))
const toB64Url = (bytes: ArrayBuffer | Uint8Array) => toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256))
}

/** Comparación en tiempo constante, para no revelar por el tiempo de respuesta cuántos bytes coinciden. */
export function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export const sameText = (a: string, b: string) => sameBytes(encoder.encode(a), encoder.encode(b))

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2-sha256$${ITERATIONS}$${toB64(salt)}$${toB64(await pbkdf2(password, salt, ITERATIONS))}`
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iterations, salt, hash] = stored.split('$')
  if (scheme !== 'pbkdf2-sha256' || !salt || !hash) return false
  return sameBytes(await pbkdf2(password, fromB64(salt), Number(iterations)), fromB64(hash))
}

/** true si la contraseña se guardó con otra cantidad de iteraciones y conviene volver a guardarla. */
export const needsRehash = (stored: string) => stored.split('$')[1] !== String(ITERATIONS)

/** Hash de cuenta inexistente: se verifica igual para que el tiempo no revele si el correo existe. */
export const DUMMY_HASH = 'pbkdf2-sha256$10000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

export const randomToken = (bytes = 32) => toB64Url(crypto.getRandomValues(new Uint8Array(bytes)))

export async function sha256(value: string) {
  return toB64Url(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

export async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toB64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

/** Reglas de contraseña de la versión .NET: mínimo 10 caracteres, con mayúscula, minúscula y número. */
export function passwordProblems(password: string): string[] {
  const problems: string[] = []
  if (password.length < 10) problems.push('La contraseña debe tener al menos 10 caracteres.')
  if (!/[A-Z]/.test(password)) problems.push('La contraseña debe tener al menos una mayúscula.')
  if (!/[a-z]/.test(password)) problems.push('La contraseña debe tener al menos una minúscula.')
  if (!/[0-9]/.test(password)) problems.push('La contraseña debe tener al menos un número.')
  return problems
}

/** Contraseña temporal legible (sin 0/O ni 1/l/I), con mayúscula, minúscula y número garantizados. */
export function temporaryPassword(length = 14) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = upper + lower + digits
  const pick = (set: string) => set[randomInt(set.length)]
  const chars = [pick(upper), pick(lower), pick(digits)]
  while (chars.length < length) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** Entero aleatorio uniforme en [0, max), sin sesgo de módulo. */
function randomInt(max: number) {
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % max
}

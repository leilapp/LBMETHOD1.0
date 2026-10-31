import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/endpoints'
import { Alert, Button, LoadingState, Logo, TextField } from '../../components/ui'
import { homeFor, sessionKey, useSession, useSignOut } from '../../app/session'
import { installApp, useCanInstall } from '../../lib/install'
import { passwordProblems } from '../../lib/validation'
import './auth.css'

export function LoginPage() {
  const { data: session, isPending } = useSession()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const canInstall = useCanInstall()
  const offerApk = isAndroidBrowser()

  if (isPending) return <LoadingState label="Verificando sesión…" />
  if (session) return <Navigate to={homeFor(session)} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.')
      return
    }
    setSubmitting(true)
    try {
      const s = await authApi.login(email.trim(), password)
      qc.setQueryData(sessionKey, s)
      navigate(homeFor(s), { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth lb-dark">
      <div className="lb-sparkles" aria-hidden="true" />
      <div className="auth__panel">
        <div className="auth__brand">
          <Logo size="lg" />
          <p className="auth__tagline">Entrenamiento personal</p>
        </div>
        <form className="form" onSubmit={onSubmit} noValidate>
          <h1 className="auth__title">Iniciar sesión</h1>
          {error && <Alert kind="error">{error}</Alert>}
          <TextField
            label="Correo electrónico"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" block loading={submitting}>
            Entrar
          </Button>
          <p className="auth__help">¿Olvidaste tu contraseña? Pide a tu entrenadora que la restablezca.</p>
        </form>
        {(canInstall || offerApk) && (
          <div className="auth__install">
            {offerApk && (
              <>
                <a className="btn btn--primary btn--block" href="/descargar/lbmethod.apk" download="LB-METHOD.apk">
                  Descargar app para Android (APK)
                </a>
                <p className="auth__help">
                  Al abrir el archivo, Android te pedirá permitir instalar apps de Chrome. Es normal: la app no viene de la Play Store.
                </p>
              </>
            )}
          </div>
        )}
        {canInstall && (
          <div className="auth__install">
            <Button type="button" variant="secondary" block onClick={() => void installApp()}>
              Instalar la app en este dispositivo
            </Button>
            <p className="auth__help">Queda como una app más en tu teléfono o computadora, sin pasar por una tienda.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Teléfono Android en el navegador (no dentro de la app ya instalada, que agrega «LBMETHODAndroid»). */
function isAndroidBrowser() {
  const ua = navigator.userAgent
  return /Android/i.test(ua) && !/LBMETHODAndroid/.test(ua)
}

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ next?: string; confirm?: string; form?: string }>({})
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSuccess(false)
    const found: typeof errors = {}
    const problem = passwordProblems(next)
    if (problem) found.next = problem
    else if (next === current) found.next = 'La nueva contraseña debe ser distinta de la actual.'
    if (next !== confirm) found.confirm = 'Las contraseñas no coinciden.'
    if (!current) found.form = 'Escribe tu contraseña actual.'
    setErrors(found)
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      await authApi.changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setSuccess(true)
      await qc.invalidateQueries({ queryKey: sessionKey })
      onDone?.()
    } catch (err) {
      setErrors({ form: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      {errors.form && <Alert kind="error">{errors.form}</Alert>}
      {success && <Alert kind="success">Tu contraseña se cambió correctamente.</Alert>}
      <TextField
        label="Contraseña actual"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        required
      />
      <TextField
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        hint="Mínimo 10 caracteres, con mayúscula, minúscula y número."
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={errors.next}
        required
      />
      <TextField
        label="Confirmar nueva contraseña"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={errors.confirm}
        required
      />
      <div className="form__actions">
        <Button type="submit" loading={submitting}>
          Guardar contraseña
        </Button>
      </div>
    </form>
  )
}

/** Pantalla obligatoria cuando la cuenta tiene una contraseña temporal. */
export function ChangePasswordPage() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()
  const signOut = useSignOut()

  if (isPending) return <LoadingState label="Verificando sesión…" />
  if (!session) return <Navigate to="/iniciar-sesion" replace />
  if (!session.mustChangePassword) return <Navigate to={homeFor(session)} replace />

  return (
    <div className="auth lb-dark">
      <div className="lb-sparkles" aria-hidden="true" />
      <div className="auth__panel">
        <div className="auth__brand">
          <Logo size="lg" />
        </div>
        <h1 className="auth__title">Crea tu contraseña</h1>
        <Alert kind="info">
          Hola, {session.displayName}. Entraste con una contraseña temporal; crea una propia para continuar.
        </Alert>
        <ChangePasswordForm onDone={() => navigate(session.role === 'TRAINER' ? '/entrenadora' : '/portal', { replace: true })} />
        <Button
          variant="ghost"
          block
          onClick={async () => {
            await signOut()
            navigate('/iniciar-sesion', { replace: true })
          }}
        >
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}

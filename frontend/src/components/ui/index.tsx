import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

/* ---------- Marca ---------- */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className="lb-logo" style={{ fontSize: size === 'lg' ? '1.6rem' : '1.05rem' }} aria-label="LB METHOD">
      <span>LB</span>
      <span className="lb-logo__method">METHOD</span>
    </span>
  )
}

/* ---------- Botón ---------- */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  block,
  loading,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; block?: boolean; loading?: boolean }) {
  return (
    <button
      type={type}
      className={`btn btn--${variant}${block ? ' btn--block' : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? 'Procesando…' : children}
    </button>
  )
}

/* ---------- Campo de formulario accesible ---------- */
export function TextField({
  label,
  hint,
  error,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {input.required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {hint && (
        <span id={`${id}-hint`} className="field__hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

/** Etiqueta, ayuda y error comunes a los campos que no son de texto simple. */
function FieldFrame({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && (
        <span id={`${id}-hint`} className="field__hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <FieldFrame id={id} label={label} required={select.required} hint={hint} error={error}>
      <select id={id} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...select}>
        {children}
      </select>
    </FieldFrame>
  )
}

export function TextAreaField({
  label,
  hint,
  error,
  ...textarea
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string }) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <FieldFrame id={id} label={label} required={textarea.required} hint={hint} error={error}>
      <textarea
        id={id}
        className="input input--area"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        rows={4}
        {...textarea}
      />
    </FieldFrame>
  )
}

/* ---------- Avisos ---------- */
export function Alert({ kind, children }: { kind: 'error' | 'success' | 'warning' | 'info'; children: ReactNode }) {
  return (
    <div className={`alert alert--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

/* ---------- Estados de carga, error y vacío ---------- */
export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <p className="state__title">No se pudo cargar la información</p>
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

/* ---------- Encabezado de página ---------- */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}

/* ---------- Módulo pendiente: nunca se muestran datos simulados ---------- */
export function PendingModule({ title, phase, description }: { title: string; phase: number; description: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="card">
        <div className="state">
          <span className="badge badge--pending">Pendiente · Fase {phase}</span>
          <p className="state__title">Este módulo aún no está disponible</p>
          <p>{description}</p>
        </div>
      </div>
    </>
  )
}

/* ---------- Modal accesible ---------- */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  // Se guarda la última función de cierre para que el foco no salte cada vez que el padre se vuelve a dibujar.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button, [href]')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <h2 id={titleId} className="modal__title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}

/** Confirmación antes de acciones importantes (desactivar, restablecer…). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="stack">
        <div className="muted">{message}</div>
        <div className="form__actions">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

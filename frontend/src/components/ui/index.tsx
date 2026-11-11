import { Link } from 'react-router-dom'
import { ArrowLeft, EllipsisVertical, type LucideIcon } from 'lucide-react'
import {
  useEffect,
  useState,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

/* ---------- Marca ---------- */
/**
 * Logo de LB METHOD (trazado del logo original: monograma LB caligráfico, «METHOD» y la pesa).
 * - lg: el logo completo, en oro con un brillo que lo recorre (inicio de sesión).
 * - md: monograma + «METHOD», para el menú.
 * Las formas vienen de /brand/*.svg y se pintan con CSS (máscara), así el color y el brillo se cambian en global.css.
 */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  if (size === 'lg') {
    return (
      <span className="lb-brand lb-brand--lg" role="img" aria-label="LB METHOD">
        <span className="lb-brand__shine lb-brand__lockup" />
      </span>
    )
  }
  return (
    <span className="lb-brand" role="img" aria-label="LB METHOD">
      <span className="lb-brand__shine lb-brand__mark" />
      <span className="lb-brand__shine lb-brand__word" />
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

/* ---------- Regreso: siempre la misma flecha, en el mismo lugar ---------- */
/** Flecha para volver a la pantalla anterior, con el nombre de esa pantalla. */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link className="back-link" to={to}>
      <span className="back-link__icon" aria-hidden="true">
        <ArrowLeft size={18} />
      </span>
      <span className="back-link__label">{label}</span>
    </Link>
  )
}

/* ---------- Menú ⋮ con las acciones que se usan poco ---------- */
export interface MenuAction {
  label: string
  icon?: LucideIcon
  /** Lleva a otra pantalla. */
  to?: string
  onSelect?: () => void
  /** Acción delicada (desactivar, quitar…): se pinta en rojo. */
  danger?: boolean
  disabled?: boolean
}

/**
 * Botón ⋮ que abre una lista corta de acciones. Así cada pantalla deja a la vista solo su botón principal.
 * Se cierra al elegir, al tocar fuera o con Escape.
 */
export function MoreMenu({ items, label = 'Más acciones', className }: { items: (MenuAction | false | null | undefined)[]; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  // Si el botón queda del lado izquierdo de la pantalla, el menú se abre hacia la derecha para no salirse.
  const [alignLeft, setAlignLeft] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const list = items.filter(Boolean) as MenuAction[]

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      ref.current?.querySelector<HTMLElement>('.more-menu__toggle')?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (list.length === 0) return null
  return (
    <div className={`more-menu${className ? ` ${className}` : ''}`} ref={ref}>
      <button
        type="button"
        className="icon-button more-menu__toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        onClick={() => {
          const box = ref.current?.getBoundingClientRect()
          if (box) setAlignLeft(box.right < 260)
          setOpen((v) => !v)
        }}
      >
        <EllipsisVertical size={20} aria-hidden="true" />
      </button>
      {open && (
        <div className={`more-menu__list${alignLeft ? ' more-menu__list--left' : ''}`} role="menu" id={menuId} aria-label={label}>
          {list.map(({ label: text, icon: Icon, to, onSelect, danger, disabled }) => {
            const content = (
              <>
                {Icon && <Icon size={18} aria-hidden="true" />}
                <span>{text}</span>
              </>
            )
            const cls = `more-menu__item${danger ? ' more-menu__item--danger' : ''}`
            return to ? (
              <Link key={text} role="menuitem" className={cls} to={to} onClick={() => setOpen(false)}>
                {content}
              </Link>
            ) : (
              <button
                key={text}
                type="button"
                role="menuitem"
                className={cls}
                disabled={disabled}
                onClick={() => {
                  setOpen(false)
                  onSelect?.()
                }}
              >
                {content}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ---------- Pestañas ---------- */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
  label,
  fill,
}: {
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (v: T) => void
  label: string
  /** Ocupa todo el ancho, con pestañas del mismo tamaño. */
  fill?: boolean
}) {
  return (
    <div className={`tabs${fill ? ' tabs--fill' : ''}`} role="tablist" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} className={`tabs__tab${value === v ? ' tabs__tab--active' : ''}`} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  )
}

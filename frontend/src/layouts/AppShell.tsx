import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Check, Ellipsis, LogOut, Monitor, Moon, Sun, X, type LucideIcon } from 'lucide-react'
import { Button, Logo } from '../components/ui'
import { useSession, useSignOut } from '../app/session'
import { DARK_PALETTES, setDarkPalette, setThemePreference, useDarkPalette, useThemePreference, type ThemePreference } from '../lib/theme'
import { initials } from '../lib/format'
import { FocusModeContext } from './focusMode'
import './AppShell.css'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Texto corto para la barra inferior del teléfono. */
  short?: string
  /** Aparece en la barra inferior del teléfono (máximo 4); los demás quedan en «Más». */
  primary?: boolean
  /** Fase en la que se habilita el módulo; si existe, se muestra como pendiente. */
  pendingPhase?: number
  end?: boolean
  /** Otras rutas que también cuentan como esta sección (por ejemplo, plantillas dentro de Rutinas). */
  also?: string[]
}

const THEMES: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Automático', icon: Monitor },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
]

/** Elegir tema: automático (el del teléfono), claro u oscuro. */
export function ThemeSwitch() {
  const pref = useThemePreference()
  return (
    <div className="segmented" role="group" aria-label="Tema de la app">
      {THEMES.map(({ value, label, icon: Icon }) => (
        <button key={value} type="button" title={label} aria-pressed={pref === value} onClick={() => setThemePreference(value)}>
          <Icon size={15} aria-hidden="true" />
          <span className="segmented__label">{label}</span>
        </button>
      ))}
    </div>
  )
}

/** Elegir el estilo del modo oscuro (también cambia la tarjeta principal y el inicio de sesión). */
export function DarkPaletteSwitch() {
  const palette = useDarkPalette()
  const current = DARK_PALETTES.find((p) => p.value === palette)
  return (
    <div className="palette-picker">
      <div className="palette-picker__head">
        <span className="palette-picker__title">Estilo oscuro</span>
        <span className="palette-picker__name">{current?.label}</span>
      </div>
      <div className="palette-picker__options" role="group" aria-label="Estilo oscuro">
        {DARK_PALETTES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`palette-swatch palette-swatch--${value}`}
            title={label}
            aria-label={label}
            aria-pressed={palette === value}
            onClick={() => setDarkPalette(value)}
          >
            {palette === value && <Check size={16} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Estructura común, al estilo de una app de Android:
 * - Computadora: menú lateral con íconos.
 * - Teléfono y tablet: barra superior (logo y tu inicial) y barra inferior con los accesos principales y «Más».
 */
export function AppShell({
  nav,
  areaLabel,
  accountLink,
}: {
  nav: NavItem[]
  areaLabel: string
  /** Enlace en la hoja de tu cuenta (círculo con tu inicial), por ejemplo «Mi perfil». */
  accountLink?: { to: string; label: string; icon: LucideIcon }
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [focus, setFocus] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { data: session } = useSession()
  const signOut = useSignOut()
  const primary = nav.filter((i) => i.primary).slice(0, 4)
  const under = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  const isActive = (item: NavItem) => (item.end ? location.pathname === item.to : under(item.to) || (item.also ?? []).some(under))
  const extra = nav.filter((i) => !primary.includes(i))
  const moreActive = extra.some(isActive)

  useEffect(() => {
    if (!moreOpen && !accountOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMoreOpen(false)
      setAccountOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [moreOpen, accountOpen])

  const closeSheets = () => {
    setMoreOpen(false)
    setAccountOpen(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/iniciar-sesion', { replace: true })
  }

  const name = session?.displayName ?? ''

  return (
    <div className={`shell${focus ? ' shell--focus' : ''}`}>
      <header className="shell__topbar">
        <Logo />
        <button
          className="shell__avatar-button"
          aria-expanded={accountOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setMoreOpen(false)
            setAccountOpen((v) => !v)
          }}
        >
          <span className="avatar avatar--gold" aria-hidden="true">
            {initials(name)}
          </span>
          <span className="visually-hidden">{accountOpen ? 'Cerrar menú de tu cuenta' : 'Abrir menú de tu cuenta'}</span>
        </button>
      </header>

      <aside id="shell-nav" className={`shell__sidebar${moreOpen ? ' shell__sidebar--open' : ''}`} aria-label="Menú">
        <div className="shell__brand">
          <Logo />
          <span className="shell__area">{areaLabel}</span>
        </div>
        <div className="shell__sheet-head">
          <span className="shell__sheet-title">Todas las secciones</span>
          <button className="icon-button" onClick={() => setMoreOpen(false)}>
            <X size={20} aria-hidden="true" />
            <span className="visually-hidden">Cerrar</span>
          </button>
        </div>
        <nav aria-label="Navegación principal">
          <ul className="shell__nav">
            {nav.map((item) => {
              const { to, end, label, icon: Icon, pendingPhase } = item
              return (
              <li key={to}>
                <NavLink to={to} end={end} className={() => `shell__link${isActive(item) ? ' active' : ''}`} onClick={() => setMoreOpen(false)}>
                  <span className="shell__link-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className="shell__link-label">{label}</span>
                  {pendingPhase && (
                    <span className="shell__soon" title={`Disponible en la fase ${pendingPhase}`}>
                      Fase {pendingPhase}
                    </span>
                  )}
                </NavLink>
              </li>
              )
            })}
          </ul>
        </nav>
        <div className="shell__user">
          <div className="shell__user-card">
            <span className="avatar avatar--gold" aria-hidden="true">
              {initials(name)}
            </span>
            <div className="shell__user-text">
              <div className="shell__user-name">{name}</div>
              <div className="shell__user-email">{session?.email}</div>
            </div>
          </div>
          {accountLink && (
            <Link className="btn btn--secondary btn--block" to={accountLink.to} onClick={closeSheets}>
              <accountLink.icon size={16} aria-hidden="true" />
              {accountLink.label}
            </Link>
          )}
          <ThemeSwitch />
          <DarkPaletteSwitch />
          <Button variant="secondary" block onClick={handleSignOut}>
            <LogOut size={16} aria-hidden="true" />
            Cerrar sesión
          </Button>
        </div>
      </aside>
      {moreOpen && <div className="shell__scrim" onClick={() => setMoreOpen(false)} aria-hidden="true" />}

      {accountOpen && (
        <>
          <div className="shell__scrim shell__scrim--account" onClick={() => setAccountOpen(false)} aria-hidden="true" />
          <div className="shell__account" role="dialog" aria-modal="true" aria-label="Tu cuenta">
            <div className="shell__user-card">
              <span className="avatar avatar--gold avatar--lg" aria-hidden="true">
                {initials(name)}
              </span>
              <div className="shell__user-text">
                <div className="shell__user-name">{name}</div>
                <div className="shell__user-email">{session?.email}</div>
                <div className="shell__area">{areaLabel}</div>
              </div>
            </div>
            {accountLink && (
              <Link className="btn btn--secondary btn--block" to={accountLink.to} onClick={closeSheets}>
                <accountLink.icon size={16} aria-hidden="true" />
                {accountLink.label}
              </Link>
            )}
            <ThemeSwitch />
            <DarkPaletteSwitch />
            <Button variant="secondary" block onClick={handleSignOut}>
              <LogOut size={16} aria-hidden="true" />
              Cerrar sesión
            </Button>
          </div>
        </>
      )}

      <main className="shell__main" id="contenido">
        <FocusModeContext.Provider value={setFocus}>
          <Outlet />
        </FocusModeContext.Provider>
      </main>

      <nav className="bottom-nav" aria-label="Accesos rápidos" hidden={focus}>
        {primary.map((item) => {
          const { to, end, label, short, icon: Icon } = item
          return (
          <NavLink key={to} to={to} end={end} className={() => `bottom-nav__item${isActive(item) ? ' active' : ''}`} onClick={closeSheets}>
            <span className="bottom-nav__pill" aria-hidden="true">
              <Icon size={22} />
            </span>
            <span className="bottom-nav__label">{short ?? label}</span>
          </NavLink>
          )
        })}
        {extra.length > 0 && (
        <button
          className={`bottom-nav__item${moreActive || moreOpen ? ' active' : ''}`}
          aria-expanded={moreOpen}
          aria-controls="shell-nav"
          onClick={() => {
            setAccountOpen(false)
            setMoreOpen((v) => !v)
          }}
        >
          <span className="bottom-nav__pill" aria-hidden="true">
            <Ellipsis size={22} />
          </span>
          <span className="bottom-nav__label">Más</span>
        </button>
        )}
      </nav>
    </div>
  )
}

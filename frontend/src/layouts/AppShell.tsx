import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Ellipsis, LogOut, Monitor, Moon, Sun, X, type LucideIcon } from 'lucide-react'
import { Button, Logo } from '../components/ui'
import { useSession, useSignOut } from '../app/session'
import { setThemePreference, useThemePreference, type ThemePreference } from '../lib/theme'
import { initials } from '../lib/format'
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

/**
 * Estructura común, al estilo de una app de Android:
 * - Computadora: menú lateral con íconos.
 * - Teléfono y tablet: barra superior (logo y tu inicial) y barra inferior con los accesos principales y «Más».
 */
export function AppShell({ nav, areaLabel }: { nav: NavItem[]; areaLabel: string }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { data: session } = useSession()
  const signOut = useSignOut()
  const primary = nav.filter((i) => i.primary).slice(0, 4)
  const isActive = (item: NavItem) =>
    item.end ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  const moreActive = nav.some((i) => !primary.includes(i) && isActive(i))

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
    <div className="shell">
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
            {nav.map(({ to, end, label, icon: Icon, pendingPhase }) => (
              <li key={to}>
                <NavLink to={to} end={end} className="shell__link" onClick={() => setMoreOpen(false)}>
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
            ))}
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
          <ThemeSwitch />
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
            <ThemeSwitch />
            <Button variant="secondary" block onClick={handleSignOut}>
              <LogOut size={16} aria-hidden="true" />
              Cerrar sesión
            </Button>
          </div>
        </>
      )}

      <main className="shell__main" id="contenido">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Accesos rápidos">
        {primary.map(({ to, end, label, short, icon: Icon }) => (
          <NavLink key={to} to={to} end={end} className="bottom-nav__item" onClick={closeSheets}>
            <span className="bottom-nav__pill" aria-hidden="true">
              <Icon size={22} />
            </span>
            <span className="bottom-nav__label">{short ?? label}</span>
          </NavLink>
        ))}
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
      </nav>
    </div>
  )
}

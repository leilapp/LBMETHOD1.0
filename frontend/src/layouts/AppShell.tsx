import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button, Logo } from '../components/ui'
import { useSession, useSignOut } from '../app/session'
import './AppShell.css'

export interface NavItem {
  to: string
  label: string
  /** Fase en la que se habilita el módulo; si existe, se muestra como pendiente. */
  pendingPhase?: number
  end?: boolean
}

/** Estructura común: menú lateral en escritorio y menú desplegable en tablet y celular. */
export function AppShell({ nav, areaLabel }: { nav: NavItem[]; areaLabel: string }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data: session } = useSession()
  const signOut = useSignOut()

  async function handleSignOut() {
    await signOut()
    navigate('/iniciar-sesion', { replace: true })
  }

  return (
    <div className="shell">
      <header className="shell__topbar">
        <Logo />
        <button
          className="shell__menu-button"
          aria-expanded={open}
          aria-controls="shell-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
          <span className="visually-hidden">{open ? 'Cerrar menú' : 'Abrir menú'}</span>
        </button>
      </header>

      <aside id="shell-nav" className={`shell__sidebar${open ? ' shell__sidebar--open' : ''}`}>
        <div className="shell__brand">
          <Logo />
          <span className="shell__area">{areaLabel}</span>
        </div>
        <nav aria-label="Navegación principal">
          <ul className="shell__nav">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className="shell__link" onClick={() => setOpen(false)}>
                  <span>{item.label}</span>
                  {item.pendingPhase && (
                    <span className="shell__soon" title={`Disponible en la fase ${item.pendingPhase}`}>
                      Fase {item.pendingPhase}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="shell__user">
          <div className="shell__user-name">{session?.displayName}</div>
          <div className="shell__user-email">{session?.email}</div>
          <Button variant="secondary" block onClick={handleSignOut}>
            Cerrar sesión
          </Button>
        </div>
      </aside>
      {open && <div className="shell__scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <main className="shell__main" id="contenido">
        <Outlet />
      </main>
    </div>
  )
}

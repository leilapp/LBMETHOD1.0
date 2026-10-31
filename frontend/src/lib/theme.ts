import { useSyncExternalStore } from 'react'

/**
 * Tema de la app: «system» sigue al teléfono o la computadora (por defecto); «light» y «dark» lo fijan.
 * La preferencia se guarda solo en este navegador. El CSS (styles/tokens.css) lee data-theme en <html>.
 */
export type ThemePreference = 'system' | 'light' | 'dark'

const KEY = 'lb-theme'
const listeners = new Set<() => void>()
const darkQuery = () => (typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null)

function read(): ThemePreference {
  try {
    const value = window.localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

let current: ThemePreference = 'system'

/** Tema que se ve en pantalla, ya resuelto. */
export function resolvedTheme(pref: ThemePreference = current): 'light' | 'dark' {
  if (pref !== 'system') return pref
  return darkQuery()?.matches === false ? 'light' : 'dark'
}

interface AndroidBridge {
  setTheme?: (theme: string) => void
}

function apply() {
  const root = document.documentElement
  if (current === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', current)
  const theme = resolvedTheme()
  // Color de la barra del navegador en el teléfono.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = theme === 'light' ? '#F3F1F9' : '#07060B'
    m.removeAttribute('media')
  })
  // En la app de Android, las barras del sistema siguen al tema (versiones anteriores de la app no tienen esta función).
  const android = (window as unknown as { LBAndroid?: AndroidBridge }).LBAndroid
  if (typeof android?.setTheme === 'function') android.setTheme(theme)
  listeners.forEach((l) => l())
}

/** Se llama una vez al arrancar: aplica la preferencia guardada y escucha los cambios del sistema. */
export function initTheme() {
  current = read()
  apply()
  darkQuery()?.addEventListener?.('change', () => current === 'system' && apply())
}

export function setThemePreference(pref: ThemePreference) {
  current = pref
  try {
    if (pref === 'system') window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, pref)
  } catch {
    /* sin almacenamiento: se aplica solo en esta visita */
  }
  apply()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => current)
}

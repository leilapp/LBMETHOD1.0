import { useSyncExternalStore } from 'react'

/**
 * Tema de la app: «system» sigue al teléfono o la computadora (por defecto); «light» y «dark» lo fijan.
 * La preferencia se guarda solo en este navegador. El CSS (styles/tokens.css y palettes.css) lee data-theme y data-palette en <html>.
 */
export type ThemePreference = 'system' | 'light' | 'dark'

/**
 * Estilo del modo oscuro (también pinta la tarjeta principal y el inicio de sesión, que siempre son oscuros).
 * «amatista» es el original; los demás ponen data-palette en <html> (styles/palettes.css).
 */
export type DarkPalette = 'amatista' | 'grafito' | 'medianoche' | 'ciruela'
export const DARK_PALETTES: { value: DarkPalette; label: string; bar: string }[] = [
  { value: 'amatista', label: 'Noche y amatista', bar: '#07060B' },
  { value: 'grafito', label: 'Grafito y oro', bar: '#0B0B0C' },
  { value: 'medianoche', label: 'Azul medianoche', bar: '#060A14' },
  { value: 'ciruela', label: 'Ciruela y oro rosa', bar: '#0E080B' },
]

const KEY = 'lb-theme'
const PALETTE_KEY = 'lb-dark-palette'
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

function readPalette(): DarkPalette {
  try {
    const value = window.localStorage.getItem(PALETTE_KEY)
    return DARK_PALETTES.some((p) => p.value === value) ? (value as DarkPalette) : 'amatista'
  } catch {
    return 'amatista'
  }
}

let current: ThemePreference = 'system'
let palette: DarkPalette = 'amatista'

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
  if (palette === 'amatista') root.removeAttribute('data-palette')
  else root.setAttribute('data-palette', palette)
  const theme = resolvedTheme()
  const darkBar = DARK_PALETTES.find((p) => p.value === palette)?.bar ?? '#07060B'
  // Color de la barra del navegador en el teléfono.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = theme === 'light' ? '#F3F1F9' : darkBar
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
  palette = readPalette()
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

export function setDarkPalette(value: DarkPalette) {
  palette = value
  try {
    if (value === 'amatista') window.localStorage.removeItem(PALETTE_KEY)
    else window.localStorage.setItem(PALETTE_KEY, value)
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

export function useDarkPalette(): DarkPalette {
  return useSyncExternalStore(subscribe, () => palette)
}

import { useSyncExternalStore } from 'react'

/**
 * Instalar la app desde el navegador (Chrome y Edge en Android y computadora). El navegador avisa con el evento
 * «beforeinstallprompt» cuando se puede instalar; se guarda para mostrar el botón «Instalar la app» en el inicio de
 * sesión. En iPhone no existe ese evento: ahí se instala con Compartir → «Agregar a inicio».
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Se llama una vez al arrancar (main.tsx), antes de que se muestre cualquier pantalla. */
export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** true si el navegador permite instalar la app ahora (y no se está usando ya la app instalada). */
export function useCanInstall() {
  return useSyncExternalStore(subscribe, () => deferred !== null)
}

export async function installApp() {
  const event = deferred
  if (!event) return
  deferred = null
  notify()
  await event.prompt()
  await event.userChoice
}

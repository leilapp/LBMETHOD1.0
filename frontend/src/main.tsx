import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { listenForInstall } from './lib/install'
import { initTheme } from './lib/theme'
import './styles/global.css'

initTheme()
listenForInstall()

// Guarda las pantallas en el teléfono para que la app abra sin señal (los datos siguen viniendo del servidor).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

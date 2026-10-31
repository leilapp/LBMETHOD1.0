import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { listenForInstall } from './lib/install'
import { initTheme } from './lib/theme'
import './styles/global.css'

initTheme()
listenForInstall()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

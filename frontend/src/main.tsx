import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { listenForInstall } from './lib/install'
import './styles/global.css'

listenForInstall()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

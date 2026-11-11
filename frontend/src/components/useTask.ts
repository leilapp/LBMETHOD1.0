import { useState } from 'react'
import { ApiError } from '../api/client'

/**
 * Para acciones que se lanzan desde un menú ⋮ (descargar PDF o Excel…): guarda si está trabajando y el error,
 * para mostrarlo en la pantalla aunque el menú ya se haya cerrado.
 */
export function useTask(fallbackMessage: string) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(task: () => Promise<unknown>) {
    setPending(true)
    setError(null)
    try {
      await task()
    } catch (e) {
      // Los errores de la API traen un mensaje para la persona; los demás (técnicos) no.
      setError(e instanceof ApiError ? e.message : fallbackMessage)
    } finally {
      setPending(false)
    }
  }
  return { run, pending, error, clear: () => setError(null) }
}

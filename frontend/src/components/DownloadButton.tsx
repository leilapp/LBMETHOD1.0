import { useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { Alert, Button } from './ui'

/**
 * Botón que descarga un archivo protegido (PDF o Excel) con la sesión actual.
 * Mientras descarga muestra el estado de carga y, si falla, el mensaje de la API debajo.
 */
export function DownloadButton({
  path,
  fileName,
  children,
  variant = 'secondary',
  label,
}: {
  path: string
  fileName: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  /** Nombre accesible cuando el texto visible es corto (por ejemplo, «PDF»). */
  label?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="download">
      <Button
        variant={variant}
        loading={loading}
        aria-label={label}
        onClick={async () => {
          setLoading(true)
          setError(null)
          try {
            await api.download(path, fileName)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo descargar el archivo.')
          } finally {
            setLoading(false)
          }
        }}
      >
        {children}
      </Button>
      {error && <Alert kind="error">{error}</Alert>}
    </span>
  )
}

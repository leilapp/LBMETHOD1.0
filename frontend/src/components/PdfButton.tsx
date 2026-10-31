import { useState, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import { buildRoutinePdf, routinePdfName, savePdf, type RoutinePdfData } from '../lib/routinePdf'
import { Alert, Button } from './ui'

/**
 * Botón que genera el PDF de una rutina en el navegador y lo descarga.
 * `getData` entrega los datos que ya autorizó la API (y puede pedir lo que falte); mientras se arma el archivo
 * muestra el estado de carga y, si algo falla, un mensaje claro debajo.
 */
export function PdfButton({
  getData,
  children,
  variant = 'secondary',
  label,
}: {
  getData: () => RoutinePdfData | Promise<RoutinePdfData>
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
            const data = await getData()
            await savePdf(await buildRoutinePdf(data), routinePdfName(data))
          } catch (e) {
            // Los errores de la API ya traen un mensaje para la persona; los demás (por ejemplo, sin memoria) no.
            setError(e instanceof ApiError ? e.message : 'No se pudo generar el PDF. Inténtalo de nuevo.')
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

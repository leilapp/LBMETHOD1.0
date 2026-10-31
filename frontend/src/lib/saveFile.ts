/**
 * Guarda un archivo generado en el equipo (PDF o Excel).
 * - En el navegador: enlace de descarga normal.
 * - Dentro de la app de Android (APK): el navegador interno no sabe descargar archivos creados en la página, así que se
 *   le entrega el contenido a la app, que lo guarda en Descargas y lo abre. La app expone `window.LBAndroid`.
 */
interface AndroidBridge {
  saveFile: (base64: string, mimeType: string, fileName: string) => void
}

const bridge = () => (window as unknown as { LBAndroid?: AndroidBridge }).LBAndroid

export async function saveBlob(blob: Blob, fileName: string, revokeAfterMs = 60_000) {
  const android = bridge()
  if (android) {
    android.saveFile(await toBase64(blob), blob.type || 'application/octet-stream', fileName)
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Algunos navegadores de teléfono leen el archivo después del clic: se libera la memoria un poco más tarde.
  if (revokeAfterMs > 0) setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs)
  else URL.revokeObjectURL(url)
}

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(blob)
  })
}

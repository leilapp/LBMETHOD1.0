import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveBlob } from '../lib/saveFile'

afterEach(() => {
  delete (window as unknown as { LBAndroid?: unknown }).LBAndroid
  vi.restoreAllMocks()
})

describe('guardar archivos', () => {
  it('dentro de la app de Android entrega el archivo a la app (sin enlace de descarga)', async () => {
    const saveFile = vi.fn()
    ;(window as unknown as { LBAndroid: unknown }).LBAndroid = { saveFile }
    const create = vi.spyOn(URL, 'createObjectURL')
    await saveBlob(new Blob(['hola'], { type: 'application/pdf' }), 'rutina.pdf')
    expect(saveFile).toHaveBeenCalledWith('aG9sYQ==', 'application/pdf', 'rutina.pdf')
    expect(create).not.toHaveBeenCalled()
  })

  it('en el navegador usa un enlace de descarga con el nombre del archivo', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    await saveBlob(new Blob(['x']), 'datos.xlsx', 0)
    expect(click).toHaveBeenCalledOnce()
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('datos.xlsx')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x')
  })
})

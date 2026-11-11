import { createContext, useContext, useEffect } from 'react'

/**
 * «Modo enfoque»: en pantallas de trabajo (armar una rutina, registrar un entrenamiento) se esconde la barra inferior
 * del teléfono para que no estorbe ni se toque por error. Se sale con la flecha de regreso.
 */
export const FocusModeContext = createContext<(on: boolean) => void>(() => {})

export function useFocusMode(on = true) {
  const set = useContext(FocusModeContext)
  useEffect(() => {
    set(on)
    return () => set(false)
  }, [on, set])
}

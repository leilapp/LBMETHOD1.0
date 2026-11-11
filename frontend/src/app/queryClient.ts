import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { sessionKey } from './session'

export function createQueryClient() {
  const qc = new QueryClient({
    defaultOptions: {
      // «always»: sin señal, las consultas fallan de inmediato (en vez de quedarse en espera) para que las pantallas
      // puedan usar lo guardado en el teléfono, como el entrenamiento en curso.
      mutations: { networkMode: 'always' },
      queries: {
        networkMode: 'always',
        refetchOnWindowFocus: false,
        retry: (count, err) => !(err instanceof ApiError && err.status < 500 && err.status !== 0) && count < 2,
      },
    },
  })
  // Si la sesión expira o se cierra desde otro lugar, se vuelve a pedir inicio de sesión.
  qc.getQueryCache().subscribe((event) => {
    const err = event.query.state.error
    if (event.type === 'updated' && err instanceof ApiError && err.status === 401 && event.query.queryKey[0] !== sessionKey[0]) {
      qc.setQueryData(sessionKey, null)
    }
  })
  return qc
}

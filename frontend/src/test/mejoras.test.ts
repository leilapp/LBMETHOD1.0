import { afterEach, describe, expect, it } from 'vitest'
import { isNewRecord, lift } from '../features/portal/portalModel'
import { clearLocalSessions, localSessionsInProgress, readLocalSession, removeLocalSession, writeLocalSession } from '../lib/offlineSession'
import { clock } from '../lib/restTimer'
import type { SessionDetail } from '../api/portal'

afterEach(() => localStorage.clear())

const best = { weight: 60, weightUnit: 'kg', weightKg: 60, reps: 8, date: '2026-11-01T15:00:00Z' }

describe('récord al registrar', () => {
  it('solo marca récord si supera su mejor peso anterior (comparando en kilos)', () => {
    expect(isNewRecord({ best }, { weight: '62.5', reps: '6', unit: 1 })).toBe(true)
    expect(isNewRecord({ best }, { weight: '60', reps: '10', unit: 1 })).toBe(false)
    expect(isNewRecord({ best }, { weight: '135', reps: '5', unit: 2 })).toBe(true) // 61.2 kg
    expect(isNewRecord({ best }, { weight: '130', reps: '5', unit: 2 })).toBe(false) // 59 kg
    expect(isNewRecord({ best }, { weight: '70', reps: '0', unit: 1 })).toBe(false)
    expect(isNewRecord({ best }, { weight: '', reps: '8', unit: 1 })).toBe(false)
    // La primera vez que hace un ejercicio no hay marca que superar.
    expect(isNewRecord({ best: null }, { weight: '100', reps: '5', unit: 1 })).toBe(false)
  })

  it('describe una serie en palabras cortas', () => {
    expect(lift(10, 60, 'kg')).toBe('10 × 60 kg')
    expect(lift(12, null, null)).toBe('12 reps')
    expect(lift(null, 25, 'lb')).toBe('25 lb')
  })
})

describe('cronómetro de descanso', () => {
  it('muestra minutos y segundos', () => {
    expect(clock(90)).toBe('1:30')
    expect(clock(5.2)).toBe('0:06')
    expect(clock(-3)).toBe('0:00')
  })
})

describe('copia del entrenamiento en el teléfono', () => {
  const session = { id: 7, status: 'InProgress', exercises: [] } as unknown as SessionDetail
  it('guarda, lee, lista los que siguen en curso y se borra al cerrar sesión', () => {
    writeLocalSession(7, { session, draft: { comment: 'x', exercises: [] }, pending: true })
    writeLocalSession(8, { session: { ...session, id: 8, status: 'Completed' }, draft: { comment: '', exercises: [] }, pending: false })
    expect(readLocalSession(7)?.pending).toBe(true)
    expect(readLocalSession(7)?.draft.comment).toBe('x')
    expect(localSessionsInProgress().map((l) => l.session.id)).toEqual([7])
    removeLocalSession(7)
    expect(readLocalSession(7)).toBeNull()
    clearLocalSessions()
    expect(readLocalSession(8)).toBeNull()
  })
})

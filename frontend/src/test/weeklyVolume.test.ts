import { describe, expect, it } from 'vitest'
import { NO_MUSCLE, volumeFromBuilder, volumeFromVersion, weeklyVolume, workingSets } from '../lib/weeklyVolume'

describe('Series por músculo a la semana', () => {
  it('cuenta solo las series de trabajo: sin calentamiento, con o sin detalle serie por serie', () => {
    expect(workingSets({ muscle: 'Glúteo', sets: 4, setType: 1, detailTypes: [] })).toBe(4)
    expect(workingSets({ muscle: 'Glúteo', sets: 2, setType: 2, detailTypes: [] })).toBe(0)
    // Con detalle, manda el detalle: 1 calentamiento + 2 efectivas + 1 drop set = 3 de trabajo.
    expect(workingSets({ muscle: 'Glúteo', sets: 9, setType: 1, detailTypes: [2, 1, 1, 3] })).toBe(3)
  })

  it('suma todos los días, ordena de mayor a menor y agrupa lo que no tiene músculo', () => {
    const rows = weeklyVolume([
      { muscle: 'Glúteo', sets: 4, setType: 1, detailTypes: [] },
      { muscle: 'Cuádriceps', sets: 3, setType: 1, detailTypes: [] },
      { muscle: 'Glúteo', sets: 3, setType: 3, detailTypes: [] },
      { muscle: 'Bíceps', sets: 3, setType: 1, detailTypes: [] },
      { muscle: null, sets: 2, setType: 1, detailTypes: [] },
      { muscle: 'Pantorrilla', sets: 3, setType: 2, detailTypes: [] },
    ])
    expect(rows).toEqual([
      { muscle: 'Glúteo', sets: 7 },
      { muscle: 'Bíceps', sets: 3 },
      { muscle: 'Cuádriceps', sets: 3 },
      { muscle: NO_MUSCLE, sets: 2 },
    ])
  })

  it('rutina guardada y programa del cliente; si la API no manda el músculo no muestra nada', () => {
    const ex = (primaryMuscleGroup: string | null | undefined, sets: number, setDetails: { setType?: number }[] = []) => ({ primaryMuscleGroup, sets, setType: 1, setDetails })
    expect(volumeFromVersion({ days: [{ exercises: [ex('Espalda', 4)] }, { exercises: [ex('Espalda', 3, [{ setType: 2 }, { setType: 1 }])] }] })).toEqual([{ muscle: 'Espalda', sets: 5 }])
    expect(volumeFromVersion({ days: [{ exercises: [ex(undefined, 4)] }] })).toBeNull()
    expect(volumeFromVersion({ days: [] })).toEqual([])
  })

  it('el constructor se recalcula con lo que la entrenadora va escribiendo', () => {
    const state = {
      days: [
        { exercises: [{ primaryMuscle: 'Glúteo', sets: '4', setType: '1', details: null }, { primaryMuscle: 'Glúteo', sets: '', setType: '1', details: null }] },
        { exercises: [{ primaryMuscle: 'Isquiotibiales', sets: '3', setType: '1', details: [{ setType: '2' }, { setType: '1' }, { setType: '1' }] }] },
      ],
    }
    expect(volumeFromBuilder(state)).toEqual([
      { muscle: 'Glúteo', sets: 4 },
      { muscle: 'Isquiotibiales', sets: 2 },
    ])
  })
})

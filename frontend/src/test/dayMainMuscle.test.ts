import { describe, expect, it } from 'vitest'
import { dayMainMuscle, joinMuscles, mainMuscleFromBuilderDay, mainMuscleFromVersionDay, mainMuscleText } from '../lib/weeklyVolume'

const item = (muscle: string | null, sets: number, setType = 1, detailTypes: number[] = []) => ({ muscle, sets, setType, detailTypes })

describe('Músculo principal de cada día', () => {
  it('elige el músculo con más series de trabajo (sin calentamiento)', () => {
    const main = dayMainMuscle([item('Pecho', 3), item('Pecho', 3), item('Tríceps', 4), item('Tríceps', 3, 2)])
    expect(main).toEqual({ muscles: ['Pecho'], sets: 6, total: 10 })
    expect(mainMuscleText(main!)).toBe('Músculo principal: Pecho (6 de 10 series)')
  })

  it('en empate muestra todos los empatados', () => {
    const main = dayMainMuscle([item('Espalda', 4), item('Bíceps', 4), item('Hombro', 2)])
    expect(main?.muscles).toEqual(['Bíceps', 'Espalda'])
    expect(mainMuscleText(main!)).toBe('Músculos principales: Bíceps y Espalda (4 de 10 series cada uno)')
    expect(joinMuscles(['A', 'B', 'C'])).toBe('A, B y C')
  })

  it('lo que no tiene músculo no gana; sin series no hay etiqueta', () => {
    expect(dayMainMuscle([item(null, 8), item('Glúteo', 3)])).toEqual({ muscles: ['Glúteo'], sets: 3, total: 11 })
    expect(dayMainMuscle([item(null, 8)])).toBeNull()
    expect(dayMainMuscle([item('Glúteo', 0)])).toBeNull()
    expect(dayMainMuscle([])).toBeNull()
  })

  it('funciona con la rutina guardada, el programa del cliente y el constructor', () => {
    expect(mainMuscleFromVersionDay({ exercises: [{ primaryMuscleGroup: 'Glúteo', sets: 4, setDetails: [] }] })?.muscles).toEqual(['Glúteo'])
    expect(mainMuscleFromVersionDay({ exercises: [{ primaryMuscleGroup: undefined, sets: 4, setDetails: [] }] })).toBeNull()
    expect(
      mainMuscleFromBuilderDay({
        exercises: [
          { primaryMuscle: 'Isquiotibiales', sets: '3', setType: '1', details: [{ setType: '2' }, { setType: '1' }] },
          { primaryMuscle: 'Glúteo', sets: '3', setType: '1', details: null },
        ],
      })?.muscles,
    ).toEqual(['Glúteo'])
  })
})

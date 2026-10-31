import { describe, expect, it } from 'vitest'
import type { RoutineExercise, RoutineVersion } from '../api/routines'
import type { PortalProgram } from '../api/portal'
import { buildRoutinePdf, fromPortalProgram, fromRoutineVersion, pdfText, routinePdfName } from '../lib/routinePdf'

const exercise = (position: number, extra: Partial<RoutineExercise> = {}): RoutineExercise => ({
  id: position, position, exerciseId: position, exerciseNameEs: `Ejercicio ${position}`, exerciseNameEn: null, exerciseIsActive: true,
  primaryMuscleGroup: null, supersetGroup: null, sets: 3, repsMin: 10, repsMax: 12, suggestedWeight: null, suggestedWeightUnit: null,
  restSeconds: 60, tempo: null, rir: null, rpe: null, setType: 1, setTypeLabel: 'Efectiva', notes: null, setDetails: [], ...extra,
})

/** Rutina larga y variada: 3 días de 10 ejercicios, con superseries, nombres en inglés, series detalladas y notas. */
const version: RoutineVersion = {
  id: 7, routineId: 3, routineKind: 'Program', versionNumber: 2, status: 'Published', title: 'Glúteo y pierna · fase 2',
  description: 'Bloque de fuerza con énfasis en glúteo.', goal: 'Fuerza e hipertrofia', durationWeeks: 6, changeNotes: null,
  publishedAt: '2026-10-30T18:00:00Z', sourceVersionId: null, updatedAt: '2026-10-30T18:00:00Z',
  days: [1, 2, 3].map((d) => ({
    id: d, position: d, name: d === 1 ? 'Día A · Glúteo' : `Pierna ${d}`, dayOfWeek: d, dayLabel: ['Lunes', 'Miércoles', 'Viernes'][d - 1],
    notes: d === 1 ? 'Calienta 10 minutos en la caminadora 💪 → luego movilidad.' : null,
    exercises: Array.from({ length: 10 }, (_, i) =>
      i === 0
        ? exercise(1, { exerciseNameEs: 'Hip thrust con barra', exerciseNameEn: 'Barbell hip thrust', sets: 4, repsMin: 8, repsMax: 10, suggestedWeight: 62.5, suggestedWeightUnit: 1, restSeconds: 90, tempo: '3-1-1', rir: 2, notes: 'Pausa de 1 s arriba; no arquees la espalda.' })
        : i === 1
          ? exercise(2, { exerciseNameEs: 'Peso muerto rumano con mancuernas a una pierna, apoyo en banco', supersetGroup: 'A', rpe: 8.5 })
          : i === 2
            ? exercise(3, { supersetGroup: 'A', sets: 2, repsMin: null, repsMax: null, restSeconds: null, setDetails: [
                { setNumber: 1, setType: 2, setTypeLabel: 'Calentamiento', repsMin: 12, repsMax: 12, suggestedWeight: 20, suggestedWeightUnit: 1, restSeconds: 60, rir: null, rpe: null, notes: null },
                { setNumber: 2, setType: 1, setTypeLabel: 'Efectiva', repsMin: 8, repsMax: 8, suggestedWeight: 45, suggestedWeightUnit: 2, restSeconds: 120, rir: 1, rpe: null, notes: 'Controla la bajada' },
              ] })
            : i === 3
              ? exercise(4, { setType: 3, setTypeLabel: 'Drop set' })
              : exercise(i + 1),
    ),
  })),
}

const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ'

/** Lee los textos de un PDF sin comprimir (jsPDF escribe cada texto entre paréntesis, en WinAnsi). */
async function pdfStrings(blob: Blob) {
  // WinAnsi = Latin-1 más 27 signos en 0x80–0x9F (guiones, comillas, €…), que se traducen a mano.
  const raw = [...new Uint8Array(await blob.arrayBuffer())].map((b) => (b >= 0x80 && b <= 0x9f ? CP1252[b - 0x80] : String.fromCharCode(b))).join('')
  return { raw, text: [...raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) => m[1].replace(/\\(.)/g, '$1')).join('\n') }
}

describe('PDF de rutinas en el navegador', () => {
  it('incluye los datos reales del cliente, la rutina, los ejercicios, las series, los descansos y las notas', async () => {
    const assignment = { clientName: 'Begoña Núñez', startDate: '2026-11-02', endDate: '2026-12-13', statusLabel: 'Programada', notes: 'Toma agua entre series.' }
    const data = fromRoutineVersion(version, assignment)
    const blob = await buildRoutinePdf(data, new Date('2026-10-31T18:50:00Z'), { compress: false })
    const { raw, text } = await pdfStrings(blob)
    expect(raw.startsWith('%PDF-1.3')).toBe(true)
    expect(raw.trimEnd().endsWith('%%EOF')).toBe(true)
    for (const expected of [
      'Begoña Núñez', 'Glúteo y pierna · fase 2', 'Versión 2', 'Fuerza e hipertrofia', 'Del 2 de noviembre de 2026 al 13 de diciembre de 2026',
      '6 semanas', '3 días de entrenamiento', 'Programada', 'Toma agua entre series.', 'Día A · Glúteo', 'Día 2 · Pierna 2', 'Lunes',
      'Hip thrust con barra', 'Barbell hip thrust', '8–10', '62.5 kg', '90 s', '3-1-1', 'RIR 2', 'RPE 8.5', 'Superserie A',
      'Serie 1 · Calentamiento · 12 reps · 20 kg · 1 min descanso', 'Serie 2 · Efectiva · 8 reps · 45 lb · 2 min descanso · RIR 1 · Controla la bajada',
      'Tipo de serie: Drop set', 'Notas: Pausa de 1 s arriba; no arquees la espalda.', 'por serie',
      'Generado el 31 de octubre de 2026, 12:50 (hora del centro de México) · Página 1 de',
    ])
      expect(text, expected).toContain(expected)
    // Emojis y flechas no existen en las fuentes del PDF: se cambian o se omiten, nunca salen como símbolos raros.
    expect(text).toContain('Calienta 10 minutos en la caminadora -> luego movilidad.')
    // Una rutina larga ocupa varias páginas y cada una lleva encabezado y número.
    const pages = Number(/\/Count (\d+)/.exec(raw)![1])
    expect(pages).toBeGreaterThan(1)
    expect(text).toContain(`Página ${pages} de ${pages}`)
    expect(text.match(/METHOD/g)!.length).toBeGreaterThanOrEqual(pages)
    expect(routinePdfName(data)).toBe('gluteo-y-pierna-fase-2-begona-nunez.pdf')
  })

  it('la versión de una plantilla o borrador no lleva datos de cliente', async () => {
    const data = fromRoutineVersion({ ...version, status: 'Draft', days: [] })
    const { text } = await pdfStrings(await buildRoutinePdf(data, new Date(), { compress: false }))
    expect(text).toContain('Versión 2 · Borrador (aún no publicada)')
    expect(text).toContain('Esta rutina todavía no tiene días.')
    expect(text).not.toContain('Cliente')
    expect(routinePdfName(data)).toBe('gluteo-y-pierna-fase-2-v2.pdf')
  })

  it('el PDF del portal usa solo el programa de la clienta que lo pide', async () => {
    const program: PortalProgram = {
      assignmentId: 5, routineName: 'Glúteo 6 semanas', versionNumber: 3, description: null, goal: null, durationWeeks: null,
      startDate: '2026-10-01', endDate: null, status: 'Active', statusLabel: 'Vigente', notes: null,
      days: [{ id: 1, position: 1, name: 'Día A', dayLabel: null, notes: null, exercises: [{
        id: 1, position: 1, exerciseId: 1, nameEs: 'Sentadilla', nameEn: 'Squat', supersetGroup: null, sets: 3, repsMin: 6, repsMax: 6,
        suggestedWeight: 100, weightUnit: 'lb', restSeconds: 150, tempo: null, rir: null, rpe: null, setTypeLabel: 'Efectiva', notes: null,
        instructions: null, technicalTips: null, setDetails: [], media: [],
      }] }],
    }
    const { text } = await pdfStrings(await buildRoutinePdf(fromPortalProgram(program, 'Ana López'), new Date(), { compress: false }))
    for (const expected of ['Ana López', 'Glúteo 6 semanas', 'Versión 3', 'Desde el 1 de octubre de 2026 (sin fecha de fin)', 'Vigente', 'Sentadilla', 'Squat', '100 lb', '150 s'])
      expect(text, expected).toContain(expected)
  })

  it('el texto se adapta a las fuentes del PDF sin perder el español', () => {
    expect(pdfText('¿Señora Núñez? ¡Sí! 8–12 · “bien” …')).toBe('¿Señora Núñez? ¡Sí! 8–12 · “bien” …')
    expect(pdfText('Fuerza 💪 ≥ 80 % → Łódź')).toBe('Fuerza >= 80 % -> Lódz')
  })
})

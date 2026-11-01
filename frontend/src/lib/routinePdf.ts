import type { PortalProgram } from '../api/portal'
import type { RoutineVersion } from '../api/routines'
import { saveBlob } from './saveFile'
import { volumeFromVersion, type MuscleVolume } from './weeklyVolume'

/**
 * PDF de una rutina generado en el navegador (jsPDF + jspdf-autotable), con el mismo diseño que tenía el PDF del
 * servidor: encabezado con la marca en cada página, resumen del programa, un bloque por día con la tabla de ejercicios
 * (el encabezado de la tabla se repite al cambiar de página) y pie con «Página X de Y».
 *
 * Solo usa datos que la pantalla ya recibió de la API con los permisos de quien la abre: la entrenadora solo ve sus
 * rutinas y asignaciones, y el cliente solo sus programas vigentes o programados. El archivo se arma en el equipo y
 * nunca se envía a ningún servidor.
 */

// ---------- Modelo del documento (independiente de la pantalla de origen) ----------

export interface PdfSet {
  setNumber: number
  setType: string
  reps: string | null
  weight: string | null
  rest: string | null
  effort: string | null
  notes: string | null
}

export interface PdfExercise {
  position: number
  name: string
  nameEn: string | null
  superset: string | null
  sets: number
  reps: string | null
  weight: string | null
  rest: string | null
  tempo: string | null
  effort: string | null
  setType: string
  setDetails: PdfSet[]
  notes: string | null
}

export interface PdfDay {
  position: number
  name: string
  dayLabel: string | null
  notes: string | null
  exercises: PdfExercise[]
}

export interface RoutinePdfData {
  title: string
  versionNumber: number
  isDraft: boolean
  clientName: string | null
  goal: string | null
  description: string | null
  durationWeeks: number | null
  startDate: string | null
  endDate: string | null
  assignmentStatus: string | null
  assignmentNotes: string | null
  /** Series de trabajo por músculo a la semana (null si la API no manda el músculo). */
  weeklyVolume?: MuscleVolume[] | null
  days: PdfDay[]
}

// ---------- Textos (mismos formatos que el PDF y el Excel del servidor) ----------

const number = (v: number, decimals: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: decimals, useGrouping: false }).format(v)
const unitName = (u: number | null) => (u === 1 ? 'kg' : u === 2 ? 'lb' : null)

export function reps(min: number | null, max: number | null) {
  if (min === null && max === null) return null
  if (min !== null && max !== null && min !== max) return `${min}–${max}`
  return `${min ?? max}`
}

export function weight(value: number | null, unit: string | null) {
  if (value === null) return null
  return `${number(value, 2)} ${unit ?? ''}`.trim()
}

export function rest(seconds: number | null) {
  if (seconds === null) return null
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`
}

export function effort(rir: number | null, rpe: number | null) {
  const parts: string[] = []
  if (rir !== null) parts.push(`RIR ${number(rir, 1)}`)
  if (rpe !== null) parts.push(`RPE ${number(rpe, 1)}`)
  return parts.length ? parts.join(' · ') : null
}

const blank = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null)

/** Nombre de archivo seguro: sin acentos, espacios ni signos (igual que el servidor). */
export function slug(text: string, fallback = 'rutina') {
  const ascii = text.normalize('NFD').replace(/\p{Mn}/gu, '')
  const s = ascii
    .split('')
    .map((ch) => (/[A-Za-z0-9]/.test(ch) ? ch.toLowerCase() : '-'))
    .join('')
    .split('-')
    .filter(Boolean)
    .join('-')
  return s.length === 0 ? fallback : s.slice(0, 60)
}

// ---------- De la pantalla al documento ----------

/** Versión de rutina o plantilla (pantalla de la entrenadora). Con `assignment`, agrega cliente, fechas e indicaciones. */
export function fromRoutineVersion(
  version: RoutineVersion,
  assignment?: { clientName: string; startDate: string; endDate: string | null; statusLabel: string; notes: string | null },
): RoutinePdfData {
  return {
    title: version.title,
    versionNumber: version.versionNumber,
    isDraft: version.status === 'Draft',
    clientName: assignment?.clientName ?? null,
    goal: blank(version.goal),
    description: blank(version.description),
    durationWeeks: version.durationWeeks,
    startDate: assignment?.startDate ?? null,
    endDate: assignment?.endDate ?? null,
    assignmentStatus: assignment?.statusLabel ?? null,
    assignmentNotes: blank(assignment?.notes),
    weeklyVolume: volumeFromVersion(version),
    days: version.days.map((d) => ({
      position: d.position,
      name: d.name,
      dayLabel: d.dayLabel,
      notes: blank(d.notes),
      exercises: d.exercises.map((e) => ({
        position: e.position,
        name: e.exerciseNameEs,
        nameEn: blank(e.exerciseNameEn),
        superset: blank(e.supersetGroup),
        sets: e.sets,
        reps: reps(e.repsMin, e.repsMax),
        weight: weight(e.suggestedWeight, unitName(e.suggestedWeightUnit)),
        rest: rest(e.restSeconds),
        tempo: blank(e.tempo),
        effort: effort(e.rir, e.rpe),
        setType: e.setTypeLabel,
        notes: blank(e.notes),
        setDetails: [...e.setDetails]
          .sort((a, b) => a.setNumber - b.setNumber)
          .map((s) => ({
            setNumber: s.setNumber,
            setType: s.setTypeLabel,
            reps: reps(s.repsMin, s.repsMax),
            weight: weight(s.suggestedWeight, unitName(s.suggestedWeightUnit)),
            rest: rest(s.restSeconds),
            effort: effort(s.rir, s.rpe),
            notes: blank(s.notes),
          })),
      })),
    })),
  }
}

/** Programa del cliente (portal). Solo llegan aquí sus programas vigentes o programados. */
export function fromPortalProgram(program: PortalProgram, clientName: string | null): RoutinePdfData {
  return {
    title: program.routineName,
    versionNumber: program.versionNumber,
    isDraft: false,
    clientName: blank(clientName),
    goal: blank(program.goal),
    description: blank(program.description),
    durationWeeks: program.durationWeeks,
    startDate: program.startDate,
    endDate: program.endDate,
    assignmentStatus: program.statusLabel,
    assignmentNotes: blank(program.notes),
    weeklyVolume: volumeFromVersion(program),
    days: program.days.map((d) => ({
      position: d.position,
      name: d.name,
      dayLabel: d.dayLabel,
      notes: blank(d.notes),
      exercises: d.exercises.map((e) => ({
        position: e.position,
        name: e.nameEs,
        nameEn: blank(e.nameEn),
        superset: blank(e.supersetGroup),
        sets: e.sets,
        reps: reps(e.repsMin, e.repsMax),
        weight: weight(e.suggestedWeight, e.weightUnit),
        rest: rest(e.restSeconds),
        tempo: blank(e.tempo),
        effort: effort(e.rir, e.rpe),
        setType: e.setTypeLabel,
        notes: blank(e.notes),
        setDetails: [...e.setDetails]
          .sort((a, b) => a.setNumber - b.setNumber)
          .map((s) => ({
            setNumber: s.setNumber,
            setType: s.setTypeLabel,
            reps: reps(s.repsMin, s.repsMax),
            weight: weight(s.suggestedWeight, s.weightUnit),
            rest: rest(s.restSeconds),
            effort: effort(s.rir, s.rpe),
            notes: blank(s.notes),
          })),
      })),
    })),
  }
}

// ---------- Texto compatible con las fuentes del PDF ----------

// Las fuentes estándar del PDF (Helvetica y Times) cubren el español completo: acentos, ñ, ü, ¿ ¡, comillas, guiones
// y €. No incluyen emojis ni flechas, así que se cambian por un equivalente o se omiten en lugar de salir como basura.
const CP1252_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
const REPLACEMENTS: Record<string, string> = { '→': '->', '←': '<-', '⇒': '=>', '≥': '>=', '≤': '<=', '≈': '~', '✓': '', '✔': '', 'Ł': 'L', 'ł': 'l', 'Đ': 'D', 'đ': 'd', '\t': ' ' }
const printable = (ch: string) => {
  const code = ch.codePointAt(0)!
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRA.has(ch) || ch === '\n'
}

export function pdfText(value: string): string {
  let out = ''
  for (const ch of value.replace(/\r\n?/g, '\n')) {
    if (printable(ch)) out += ch
    else if (ch in REPLACEMENTS) out += REPLACEMENTS[ch]
    else {
      const base = ch.normalize('NFD').replace(/\p{Mn}/gu, '')
      if (base && [...base].every(printable)) out += base
    }
  }
  return out.replace(/[  ]{2,}/g, ' ').trim()
}

// ---------- Construcción del PDF ----------

const VIOLET: [number, number, number] = [0x3b, 0x25, 0x66]
const GOLD: [number, number, number] = [0xb8, 0x9b, 0x5e]
const MUTED: [number, number, number] = [0x6b, 0x64, 0x80]
const RULE: [number, number, number] = [0xd9, 0xcd, 0xf2]
const BAND: [number, number, number] = [0xf4, 0xf0, 0xfb]
const INK: [number, number, number] = [0x1d, 0x1a, 0x26]
const WHITE: [number, number, number] = [255, 255, 255]

// A4 en milímetros, con los mismos márgenes que el PDF del servidor.
const PAGE_W = 210
const PAGE_H = 297
const MARGIN = { top: 26, bottom: 20, left: 18, right: 18 }
const CONTENT_W = PAGE_W - MARGIN.left - MARGIN.right // 174 mm
const PT = 25.4 / 72 // 1 punto en mm

const COLUMNS: { header: string; width: number; align: 'left' | 'center' }[] = [
  { header: '#', width: 8, align: 'center' },
  { header: 'Ejercicio', width: 56, align: 'left' },
  { header: 'Series', width: 13, align: 'center' },
  { header: 'Reps', width: 16, align: 'center' },
  { header: 'Peso', width: 20, align: 'center' },
  { header: 'Descanso', width: 19, align: 'center' },
  { header: 'Tempo', width: 16, align: 'center' },
  { header: 'RIR / RPE', width: 26, align: 'center' },
]

function longDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
}

/** «31 de octubre de 2026, 12:50» en la hora del centro de México. */
function generatedAt(now: Date) {
  const date = now.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'long', year: 'numeric' })
  const time = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${date}, ${time}`
}

function details(e: PdfExercise) {
  const lines: string[] = []
  if (e.setType !== 'Efectiva' && e.setDetails.length === 0) lines.push(`Tipo de serie: ${e.setType}`)
  for (const s of e.setDetails) {
    const parts = [`Serie ${s.setNumber} · ${s.setType}`]
    if (s.reps) parts.push(`${s.reps} reps`)
    if (s.weight) parts.push(s.weight)
    if (s.rest) parts.push(`${s.rest} descanso`)
    if (s.effort) parts.push(s.effort)
    if (s.notes) parts.push(s.notes)
    lines.push(parts.join(' · '))
  }
  if (e.notes) lines.push(`Notas: ${e.notes}`)
  return lines.map(pdfText)
}

function summaryRows(data: RoutinePdfData): [string, string][] {
  const rows: [string, string][] = []
  if (data.clientName) rows.push(['Cliente', data.clientName])
  rows.push(['Programa', data.title])
  if (data.goal) rows.push(['Objetivo', data.goal])
  if (data.startDate)
    rows.push(['Fechas', data.endDate ? `Del ${longDate(data.startDate)} al ${longDate(data.endDate)}` : `Desde el ${longDate(data.startDate)} (sin fecha de fin)`])
  if (data.durationWeeks !== null) rows.push(['Duración', data.durationWeeks === 1 ? '1 semana' : `${data.durationWeeks} semanas`])
  rows.push(['Días', data.days.length === 1 ? '1 día de entrenamiento' : `${data.days.length} días de entrenamiento`])
  if (data.assignmentStatus) rows.push(['Estado', data.assignmentStatus])
  if (data.description) rows.push(['Descripción', data.description])
  if (data.assignmentNotes) rows.push(['Indicaciones', data.assignmentNotes])
  return rows.map(([l, v]) => [l, pdfText(v)])
}

/** Arma el PDF y devuelve sus bytes. Las bibliotecas se cargan solo al pedir un PDF, para no hacer más lenta la app. */
export async function buildRoutinePdf(data: RoutinePdfData, now = new Date(), { compress = true } = {}): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress })
  const title = pdfText(data.title) || 'Rutina'
  const client = data.clientName ? pdfText(data.clientName) : null
  doc.setProperties({ title, author: 'LB METHOD', creator: 'LB METHOD', subject: client ? `Rutina de ${client}` : 'Rutina' })
  doc.setTextColor(...INK)
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  const lineH = (pt: number) => pt * PT * 1.25

  let y = MARGIN.top
  const ensure = (height: number) => {
    if (y + height > PAGE_H - MARGIN.bottom) {
      doc.addPage()
      y = MARGIN.top
    }
  }
  const paragraph = (text: string, size: number, color: [number, number, number], font: 'helvetica' | 'times' = 'helvetica', style = 'normal') => {
    doc.setFont(font, style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    for (const line of doc.splitTextToSize(text, CONTENT_W) as string[]) {
      ensure(lineH(size))
      doc.text(line, MARGIN.left, y + size * PT)
      y += lineH(size)
    }
  }

  // Resumen
  paragraph(title, 20, VIOLET, 'times', 'bold')
  y += 1
  paragraph(`Versión ${data.versionNumber}${data.isDraft ? ' · Borrador (aún no publicada)' : ''}`, 9.5, MUTED)
  y += 3
  autoTable(doc, {
    startY: y,
    margin: MARGIN,
    theme: 'grid',
    body: summaryRows(data),
    styles: { font: 'helvetica', fontSize: 9.5, textColor: INK, lineColor: RULE, lineWidth: 0.5 * PT, cellPadding: { top: 3 * PT, bottom: 3 * PT, left: 6 * PT, right: 6 * PT } },
    columnStyles: { 0: { cellWidth: 34, fillColor: BAND, textColor: VIOLET, fontStyle: 'bold' }, 1: { cellWidth: CONTENT_W - 34 } },
  })
  y = lastY() + 6

  // Series por músculo a la semana: músculo principal de cada ejercicio, sin calentamiento. Dos pares por fila.
  const volume = data.weeklyVolume ?? []
  if (volume.length > 0) {
    const total = volume.reduce((sum, r) => sum + r.sets, 0)
    ensure(lineH(13) + lineH(8.5) + 20)
    paragraph('Series por músculo a la semana', 13, VIOLET, 'times', 'bold')
    paragraph(`${total} series de trabajo en total · cuenta el músculo principal de cada ejercicio, sin calentamiento.`, 8.5, MUTED)
    y += 1.5
    const half = Math.ceil(volume.length / 2)
    const rows = Array.from({ length: half }, (_, i) => {
      const a = volume[i]
      const b = volume[i + half]
      return [pdfText(a.muscle), String(a.sets), b ? pdfText(b.muscle) : '', b ? String(b.sets) : '']
    })
    const nameW = CONTENT_W / 2 - 20
    autoTable(doc, {
      startY: y,
      margin: MARGIN,
      theme: 'grid',
      head: [['Músculo', 'Series', 'Músculo', 'Series']],
      body: rows,
      rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 9.5, textColor: INK, lineColor: RULE, lineWidth: 0.5 * PT, cellPadding: { top: 3 * PT, bottom: 3 * PT, left: 6 * PT, right: 6 * PT } },
      headStyles: { fillColor: VIOLET, textColor: WHITE, fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: { 0: { cellWidth: nameW }, 1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, 2: { cellWidth: nameW }, 3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' } },
      didParseCell: (hook) => {
        if (hook.section === 'head' && (hook.column.index === 1 || hook.column.index === 3)) hook.cell.styles.halign = 'center'
      },
    })
    y = lastY() + 6
  }

  if (data.days.length === 0) paragraph('Esta rutina todavía no tiene días.', 9.5, MUTED)

  const nameWidth = COLUMNS[1].width - 2 * 4 * PT
  for (const day of data.days) {
    const name = pdfText(day.name)
    const heading = /^día/i.test(name) ? name : `Día ${day.position} · ${name}`
    const notes = day.notes ? (doc.setFont('helvetica', 'normal'), doc.setFontSize(9.5), doc.splitTextToSize(pdfText(day.notes), CONTENT_W) as string[]) : []
    // El título del día no se queda solo al final de una página: va con sus notas y al menos el primer ejercicio.
    y += 3
    ensure(lineH(13) + notes.length * lineH(9.5) + 18)
    doc.setFont('times', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...VIOLET)
    doc.text(heading, MARGIN.left, y + 13 * PT)
    if (day.dayLabel) {
      doc.setTextColor(...GOLD)
      doc.text(`   ${pdfText(day.dayLabel)}`, MARGIN.left + doc.getTextWidth(heading), y + 13 * PT)
    }
    y += lineH(13) + 1
    if (notes.length) paragraph(notes.join('\n'), 9.5, MUTED)
    if (day.exercises.length === 0) {
      paragraph('Sin ejercicios.', 9.5, MUTED)
      y += 2
      continue
    }

    // Filas: cada ejercicio y, debajo, su detalle (series, tipo y notas) en una fila sombreada de todo el ancho.
    type NameCell = { name: string[]; superset: string | null; en: string[] }
    const nameCells = new Map<number, NameCell>()
    const body: unknown[][] = []
    for (const e of day.exercises) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      const nameLines = doc.splitTextToSize(pdfText(e.name), nameWidth) as string[]
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const en = e.nameEn && e.nameEn !== e.name ? (doc.splitTextToSize(pdfText(e.nameEn), nameWidth) as string[]) : []
      const superset = e.superset ? `Superserie ${pdfText(e.superset)}` : null
      nameCells.set(body.length, { name: nameLines, superset, en })
      const perSet = e.setDetails.length > 0 ? 'por serie' : null
      const values = [String(e.position), [...nameLines, ...(superset ? [superset] : []), ...en].join('\n'), String(e.sets), e.reps ?? perSet, e.weight ?? perSet, e.rest ?? perSet, e.tempo, e.effort ?? perSet]
      body.push(values.map((v) => pdfText(v ?? '—') || '—'))
      const lines = details(e)
      if (lines.length) body.push([{ content: lines.join('\n'), colSpan: COLUMNS.length, styles: { fillColor: BAND, fontSize: 8.5, halign: 'left', cellPadding: { top: 3 * PT, bottom: 3 * PT, left: 4 * PT + 8, right: 4 * PT } } }])
    }

    autoTable(doc, {
      startY: y,
      margin: MARGIN,
      theme: 'grid',
      head: [COLUMNS.map((c) => c.header)],
      body: body as string[][],
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 9.5, textColor: INK, lineColor: RULE, lineWidth: 0.5 * PT, valign: 'middle', cellPadding: { top: 3 * PT, bottom: 3 * PT, left: 4 * PT, right: 4 * PT } },
      headStyles: { fillColor: VIOLET, textColor: WHITE, fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
      columnStyles: Object.fromEntries(COLUMNS.map((c, i) => [i, { cellWidth: c.width, halign: c.align }])),
      didParseCell: (hook) => {
        if (hook.section === 'head' && hook.column.index === 1) hook.cell.styles.halign = 'left'
        if (hook.section === 'body' && hook.column.index === 1 && nameCells.has(hook.row.index)) hook.cell.styles.fontStyle = 'bold'
      },
      willDrawCell: (hook) => {
        // El nombre se dibuja a mano: en negritas, la superserie en dorado y el nombre en inglés más chico y gris.
        if (hook.section === 'body' && hook.column.index === 1 && nameCells.has(hook.row.index)) hook.cell.text = []
      },
      didDrawCell: (hook) => {
        const cell = nameCells.get(hook.row.index)
        if (hook.section !== 'body' || hook.column.index !== 1 || !cell) return
        const blockH = (cell.name.length + (cell.superset ? 1 : 0)) * lineH(9.5) + cell.en.length * lineH(8)
        let ty = hook.cell.y + (hook.cell.height - blockH) / 2
        const x = hook.cell.x + 4 * PT
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.setTextColor(...INK)
        for (const line of cell.name) {
          doc.text(line, x, ty + 9.5 * PT)
          ty += lineH(9.5)
        }
        if (cell.superset) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
          doc.setTextColor(...GOLD)
          doc.text(cell.superset, x, ty + 9.5 * PT)
          ty += lineH(9.5)
        }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...MUTED)
        for (const line of cell.en) {
          doc.text(line, x, ty + 8 * PT)
          ty += lineH(8)
        }
      },
    })
    y = lastY() + 4
  }

  // Encabezado y pie en todas las páginas (el pie necesita el total de páginas, por eso va al final).
  const pages = doc.getNumberOfPages()
  const right = client ? `${title} · ${client}` : title
  const stamp = generatedAt(now)
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFont('times', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...VIOLET)
    doc.text('LB ', MARGIN.left, 15)
    doc.setTextColor(...GOLD)
    doc.text('METHOD', MARGIN.left + doc.getTextWidth('LB '), 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    const rightText = (doc.splitTextToSize(right, 100) as string[])[0]
    doc.text(rightText, PAGE_W - MARGIN.right, 15, { align: 'right' })
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.75 * PT)
    doc.line(MARGIN.left, 17.5, PAGE_W - MARGIN.right, 17.5)
    doc.setFontSize(7.5)
    doc.text(`Generado el ${stamp} (hora del centro de México) · Página ${page} de ${pages}`, PAGE_W / 2, PAGE_H - 9, { align: 'center' })
  }
  return doc.output('blob')
}

/** Guarda el PDF en el equipo. Funciona en computadoras y en Chrome de Android (lo deja en Descargas). */
export function savePdf(blob: Blob, fileName: string) {
  return saveBlob(blob, fileName)
}

export const routinePdfName = (data: RoutinePdfData) =>
  data.clientName ? `${slug(data.title)}-${slug(data.clientName, 'cliente')}.pdf` : `${slug(data.title)}-v${data.versionNumber}.pdf`

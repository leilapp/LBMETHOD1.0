import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

/**
 * Lectura y escritura mínima de archivos de Excel (.xlsx) para Workers, con fflate (ZIP).
 * Escribe celdas con su tipo: texto como texto (nunca se convierte en fórmula), números como números y fechas como
 * fechas de Excel. Lee texto, números y valores lógicos de la primera hoja o de una hoja por nombre.
 */

export type CellValue = string | number | boolean | { date: string } | null | undefined

export interface SheetSpec {
  name: string
  rows: CellValue[][]
  /** Estilo de la fila 1: 'light' (rosa claro, como la plantilla de la biblioteca) o 'brand' (violeta LB METHOD). */
  header?: 'light' | 'brand'
  /** Columnas (base 0) cuyo encabezado se marca como obligatorio (texto rojo). */
  requiredColumns?: number[]
  freezeHeader?: boolean
  autoFilter?: boolean
  widths?: number[]
  /** Listas desplegables: rango destino (p. ej. «D2:D2001») y origen (p. ej. «'Catálogos'!$A$2:$A$13»). */
  dropDowns?: { range: string; source: string }[]
}

export class SpreadsheetFormatError extends Error {}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

// Quita caracteres que XML no admite y escapa los especiales.
const escapeXml = (value: string) =>
  value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const columnName = (index: number) => {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const r = (n - 1) % 26
    name = String.fromCharCode(65 + r) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

const columnIndex = (ref: string) => {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A'
  return [...letters].reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1
}

/** Días desde 1899-12-30 (sistema de fechas de Excel) para una fecha AAAA-MM-DD. */
const excelDate = (iso: string) => (Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000

// Estilos: 0 normal · 1 encabezado claro · 2 encabezado obligatorio · 3 fecha dd/mm/aaaa · 4 encabezado violeta
const STYLES = `${XML_HEADER}<styleSheet xmlns="${MAIN_NS}">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF9F1D35"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3E8EC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF3B2566"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function sheetXml(spec: SheetSpec) {
  const width = Math.max(1, ...spec.rows.map((r) => r.length))
  const rows = spec.rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = `${columnName(c)}${r + 1}`
          let style = 0
          if (r === 0 && spec.header) style = spec.header === 'brand' ? 4 : spec.requiredColumns?.includes(c) ? 2 : 1
          const s = style ? ` s="${style}"` : ''
          if (value === null || value === undefined || value === '') return style ? `<c r="${ref}"${s}/>` : ''
          if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`
          if (typeof value === 'boolean') return `<c r="${ref}"${s} t="b"><v>${value ? 1 : 0}</v></c>`
          if (typeof value === 'object' && 'date' in value) return `<c r="${ref}" s="3"><v>${excelDate(value.date)}</v></c>`
          const text = String(value)
          const preserve = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : ''
          return `<c r="${ref}"${s} t="inlineStr"><is><t${preserve}>${escapeXml(text)}</t></is></c>`
        })
        .join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')
  const views = spec.freezeHeader
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
  const cols = spec.widths?.length
    ? `<cols>${spec.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const filter = spec.autoFilter && spec.rows.length ? `<autoFilter ref="A1:${columnName(width - 1)}${spec.rows.length}"/>` : ''
  const validations = spec.dropDowns?.length
    ? `<dataValidations count="${spec.dropDowns.length}">${spec.dropDowns
        .map((d) => `<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="${d.range}"><formula1>${escapeXml(d.source)}</formula1></dataValidation>`)
        .join('')}</dataValidations>`
    : ''
  return `${XML_HEADER}<worksheet xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">${views}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData>${filter}${validations}</worksheet>`
}

/** Ancho aproximado de cada columna según su contenido (entre 12 y 45), como hacía la versión .NET. */
export function autoWidths(rows: CellValue[][], min = 12, max = 45) {
  const width = Math.max(1, ...rows.map((r) => r.length))
  return Array.from({ length: width }, (_, c) =>
    Math.min(max, Math.max(min, ...rows.slice(0, 200).map((r) => (r[c] === null || r[c] === undefined ? 0 : String(typeof r[c] === 'object' ? '00/00/0000' : r[c]).length + 2)))),
  )
}

export function writeWorkbook(sheets: SheetSpec[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}</Types>`,
    ),
    '_rels/.rels': strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `${XML_HEADER}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>${sheets
        .map((s, i) => `<sheet name="${escapeXml(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(STYLES),
  }
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s))))
  return zipSync(files, { level: 6 })
}

// ---------- Lectura ----------

const MAX_UNZIPPED_BYTES = 60 * 1024 * 1024
const MAX_ROW_NUMBER = 20_000

const decodeXml = (value: string) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

const attr = (attrs: string, name: string) => attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1]

/** Texto de un elemento con posibles «runs» de formato (<r><t>…</t></r>), sin la guía fonética (<rPh>). */
const textOf = (xml: string) =>
  [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('')

/**
 * Lee las filas de una hoja como texto (los números se convierten a texto tal como se ven sin formato).
 * Devuelve la hoja pedida por nombre o, si no existe, la primera.
 */
export function readSheet(content: Uint8Array, preferredSheet?: string): { name: string; rows: string[][] } {
  let files: Record<string, Uint8Array>
  try {
    let total = 0
    files = unzipSync(content, {
      // Solo las partes necesarias, y con un límite de tamaño para evitar archivos «bomba».
      filter: (f) => {
        const wanted = f.name === 'xl/workbook.xml' || f.name === 'xl/_rels/workbook.xml.rels' || f.name === 'xl/sharedStrings.xml' || f.name.startsWith('xl/worksheets/sheet')
        if (!wanted) return false
        total += f.originalSize
        if (total > MAX_UNZIPPED_BYTES) throw new SpreadsheetFormatError('El archivo es demasiado grande al descomprimirlo.')
        return true
      },
    })
  } catch (err) {
    if (err instanceof SpreadsheetFormatError) throw err
    throw new SpreadsheetFormatError('El archivo no es un Excel válido (.xlsx).')
  }
  const workbook = files['xl/workbook.xml'] && strFromU8(files['xl/workbook.xml'])
  const rels = files['xl/_rels/workbook.xml.rels'] && strFromU8(files['xl/_rels/workbook.xml.rels'])
  if (!workbook || !rels) throw new SpreadsheetFormatError('El archivo no es un Excel válido (.xlsx).')

  const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => ({ name: decodeXml(attr(m[1], 'name') ?? ''), rid: attr(m[1], 'r:id') ?? '' }))
  if (!sheets.length) throw new SpreadsheetFormatError('El archivo no tiene hojas.')
  const sheet = sheets.find((s) => preferredSheet && s.name.toLowerCase() === preferredSheet.toLowerCase()) ?? sheets[0]
  const relMatch = [...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].find((m) => attr(m[1], 'Id') === sheet.rid)
  const target = relMatch ? attr(relMatch[1], 'Target') ?? '' : ''
  const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
  const sheetData = files[path]
  if (!sheetData) throw new SpreadsheetFormatError('No se pudo leer la hoja del archivo.')

  const shared = files['xl/sharedStrings.xml']
    ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
    : []

  const rows: string[][] = []
  for (const rowMatch of strFromU8(sheetData).matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNumber = Number(attr(rowMatch[1], 'r') ?? rows.length + 1)
    if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > MAX_ROW_NUMBER)
      throw new SpreadsheetFormatError(`El archivo usa filas más allá de la ${MAX_ROW_NUMBER}. Divídelo en varios archivos.`)
    const cells: string[] = []
    let next = 0
    for (const cellMatch of (rowMatch[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(cellMatch[1], 'r')
      const col = ref ? columnIndex(ref) : next
      next = col + 1
      const type = attr(cellMatch[1], 't')
      const inner = cellMatch[2] ?? ''
      const raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let value = ''
      if (type === 's') value = shared[Number(raw)] ?? ''
      else if (type === 'inlineStr') value = textOf(inner)
      else if (type === 'b') value = raw === '1' ? 'Sí' : 'No'
      else if (raw !== undefined) value = decodeXml(raw)
      cells[col] = value
    }
    rows[rowNumber - 1] = Array.from(cells, (v) => v ?? '')
  }
  return { name: sheet.name, rows: Array.from(rows, (r) => r ?? []) }
}

import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { libraryApi, rowStatus, type ImportPreview, type ImportReport, type ImportRow } from '../../api/library'
import { Alert, Button, ConfirmDialog, PageHeader, SelectField } from '../../components/ui'
import { libraryKeys } from './libraryQueries'
import './library.css'

const statusLabel = { Valid: 'Válida', Duplicate: 'Duplicada', Error: 'Con errores' } as const
const statusBadge = { Valid: 'badge--success', Duplicate: 'badge--pending', Error: 'badge--danger' } as const

export function ImportExportPage() {
  return (
    <>
      <p className="breadcrumb">
        <Link to="/entrenadora/biblioteca">← Biblioteca</Link>
      </p>
      <PageHeader title="Importar y exportar" subtitle="Carga tu catálogo desde Excel o descárgalo completo." />
      <div className="stack">
        <ImportSection />
        <ExportSection />
      </div>
    </>
  )
}

function ImportSection() {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [confirming, setConfirming] = useState(false)

  const template = useMutation({ mutationFn: libraryApi.downloadTemplate })
  const review = useMutation({
    mutationFn: (f: File) => libraryApi.previewImport(f),
    onSuccess: (p) => setPreview(p),
  })
  const commit = useMutation({
    mutationFn: (f: File) => libraryApi.commitImport(f),
    onSuccess: async (r) => {
      setConfirming(false)
      setReport(r)
      setPreview(null)
      await qc.invalidateQueries({ queryKey: libraryKeys.all })
    },
  })

  const choose = (f: File | null) => {
    setPreview(null)
    setReport(null)
    review.reset()
    commit.reset()
    setFile(f)
    setFileError(f && !f.name.toLowerCase().endsWith('.xlsx') ? 'El archivo debe ser de Excel (.xlsx).' : null)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!file) setFileError('Selecciona el archivo de Excel.')
    else if (!fileError) review.mutate(file)
  }

  return (
    <section className="card stack" aria-labelledby="import-title">
      <h2 className="card__title" id="import-title">
        Importar desde Excel
      </h2>
      <ol className="steps">
        <li>
          <strong>Descarga la plantilla.</strong> Incluye una hoja con los grupos musculares, equipamiento y patrones válidos.{' '}
          <Button variant="secondary" onClick={() => template.mutate()} loading={template.isPending}>
            Descargar plantilla
          </Button>
          {template.error && <Alert kind="error">{template.error.message}</Alert>}
        </li>
        <li>
          <strong>Llénala</strong> con un ejercicio por fila. Obligatorios: nombre en español, grupo principal y tipo.
        </li>
        <li>
          <strong>Súbela para revisarla.</strong> Nada se guarda hasta que confirmes.
        </li>
      </ol>

      <form className="filters__search" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="import-file">
            Archivo de Excel (.xlsx)
          </label>
          <input
            id="import-file"
            className="input"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
            aria-invalid={fileError ? true : undefined}
          />
          {fileError && (
            <span className="field__error" role="alert">
              {fileError}
            </span>
          )}
        </div>
        <Button type="submit" variant="secondary" loading={review.isPending}>
          Revisar archivo
        </Button>
      </form>
      {review.error && <Alert kind="error">{review.error.message}</Alert>}

      {preview && (
        <div className="stack" aria-live="polite">
          <div className="import-summary">
            <Summary label="Válidas" value={preview.valid} kind="Valid" />
            <Summary label="Duplicadas" value={preview.duplicates} kind="Duplicate" />
            <Summary label="Con errores" value={preview.errors} kind="Error" />
          </div>
          <RowsTable rows={preview.rows} caption="Vista previa por fila" />
          {preview.valid > 0 ? (
            <div className="form__actions">
              <Button onClick={() => setConfirming(true)}>
                Importar {preview.valid === 1 ? '1 ejercicio válido' : `${preview.valid} ejercicios válidos`}
              </Button>
            </div>
          ) : (
            <Alert kind="warning">No hay filas válidas para importar. Corrige el archivo y vuelve a revisarlo.</Alert>
          )}
          {commit.error && <Alert kind="error">{commit.error.message}</Alert>}
        </div>
      )}

      {report && (
        <div className="stack" aria-live="polite">
          <Alert kind={report.created > 0 ? 'success' : 'warning'}>
            {report.created === 1 ? 'Se importó 1 ejercicio.' : `Se importaron ${report.created} ejercicios.`}{' '}
            {report.rejected.length > 0 &&
              (report.rejected.length === 1 ? '1 fila fue rechazada.' : `${report.rejected.length} filas fueron rechazadas.`)}
          </Alert>
          {report.rejected.length > 0 && <RowsTable rows={report.rejected} caption="Filas rechazadas" />}
          <Link to="/entrenadora/biblioteca">Ver la biblioteca</Link>
        </div>
      )}

      {confirming && preview && file && (
        <ConfirmDialog
          title="Confirmar importación"
          message={`Se agregarán ${preview.valid} ejercicios a la biblioteca. Las filas duplicadas o con errores no se importan.`}
          confirmLabel="Importar"
          loading={commit.isPending}
          onConfirm={() => commit.mutate(file)}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  )
}

function Summary({ label, value, kind }: { label: string; value: number; kind: keyof typeof statusBadge }) {
  return (
    <div className="import-summary__item">
      <span className={`badge ${statusBadge[kind]}`}>{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  )
}

function RowsTable({ rows, caption }: { rows: ImportRow[]; caption: string }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Fila</th>
            <th scope="col">Ejercicio</th>
            <th scope="col">Estado</th>
            <th scope="col">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = rowStatus(r.status)
            return (
              <tr key={r.rowNumber}>
                <td>{r.rowNumber}</td>
                <td>
                  {r.nameEs ?? <span className="muted">Sin nombre</span>}
                  {r.nameEn && <span className="list-item__meta"> · {r.nameEn}</span>}
                </td>
                <td>
                  <span className={`badge ${statusBadge[s]}`}>{statusLabel[s]}</span>
                </td>
                <td>{r.messages.length ? r.messages.join(' ') : <span className="muted">Lista para importar</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ExportSection() {
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const download = useMutation({ mutationFn: () => libraryApi.exportCatalog(status) })
  return (
    <section className="card stack" aria-labelledby="export-title">
      <h2 className="card__title" id="export-title">
        Exportar catálogo
      </h2>
      <p className="muted">Descarga la biblioteca en Excel, con las mismas columnas de la plantilla y una columna «Activo».</p>
      <div className="filters__search">
        <SelectField label="Ejercicios" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">Todos</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo desactivados</option>
        </SelectField>
        <Button variant="secondary" onClick={() => download.mutate()} loading={download.isPending}>
          Descargar Excel
        </Button>
      </div>
      {download.error && <Alert kind="error">{download.error.message}</Alert>}
    </section>
  )
}

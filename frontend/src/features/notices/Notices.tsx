import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, CalendarClock, MessageCircle, UserX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { noticeKeys, noticesApi, type ClientMessage } from '../../api/notices'
import { Alert, Button, ConfirmDialog, LoadingState, TextAreaField } from '../../components/ui'
import { formatDate, formatDateTime, initials } from '../../lib/format'
import './notices.css'

const MAX = 1000

/* ---------- Entrenadora: pendientes en su inicio ---------- */

/**
 * Lo que la entrenadora tiene que atender: clientes con rutina vigente que llevan días sin entrenar, rutinas que terminan
 * pronto y comentarios nuevos en entrenamientos. Si la API no lo tiene (versión .NET), la tarjeta no se muestra.
 */
export function TrainerPendingCard() {
  const qc = useQueryClient()
  const pending = useQuery({ queryKey: noticeKeys.pending, queryFn: noticesApi.pending, retry: false })
  const review = useMutation({
    mutationFn: ({ clientId, sessionId }: { clientId: number; sessionId: number }) => noticesApi.review(clientId, sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: noticeKeys.pending }),
  })
  if (pending.isPending)
    return (
      <section className="card">
        <LoadingState />
      </section>
    )
  if (pending.error) return null
  const { inactive, ending, comments, inactiveDays, endingDays } = pending.data
  const total = inactive.length + ending.length + comments.length

  return (
    <section className="card pending" aria-labelledby="pendientes">
      <div className="section-head">
        <h2 className="card__title" id="pendientes">
          Pendientes {total > 0 && <span className="pending__count">{total}</span>}
        </h2>
      </div>
      {total === 0 ? (
        <p className="muted">Todo al día: nadie lleva {inactiveDays} días sin entrenar, ninguna rutina termina esta semana y no hay comentarios nuevos.</p>
      ) : (
        <div className="pending__groups">
          {comments.length > 0 && (
            <div className="pending__group">
              <h3 className="pending__title">
                <MessageCircle size={18} aria-hidden="true" /> Comentarios nuevos
              </h3>
              <ul className="person-list">
                {comments.map((c) => (
                  <li key={c.sessionId} className="person-row pending__row">
                    <span className="avatar" aria-hidden="true">
                      {initials(c.name)}
                    </span>
                    <span className="person-row__main">
                      <Link to={`/entrenadora/clientes/${c.clientId}/entrenamientos/${c.sessionId}`}>{c.name}</Link>
                      <span className="person-row__meta">
                        {c.dayName ?? 'Entrenamiento'} · {formatDateTime(c.completedAt)}
                      </span>
                      {c.comment && <span className="pending__quote">«{c.comment}»</span>}
                      {c.exerciseComments > 0 && (
                        <span className="person-row__meta">
                          {c.exerciseComments} {c.exerciseComments === 1 ? 'comentario en un ejercicio' : 'comentarios en ejercicios'}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="link-button pending__seen"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ clientId: c.clientId, sessionId: c.sessionId })}
                    >
                      Visto
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {inactive.length > 0 && (
            <div className="pending__group">
              <h3 className="pending__title">
                <UserX size={18} aria-hidden="true" /> Sin entrenar {inactiveDays} días o más
              </h3>
              <ul className="person-list">
                {inactive.map((r) => (
                  <li key={r.clientId} className="person-row">
                    <span className="avatar" aria-hidden="true">
                      {initials(r.name)}
                    </span>
                    <span className="person-row__main">
                      <Link to={`/entrenadora/clientes/${r.clientId}`}>{r.name}</Link>
                      <span className="person-row__meta">
                        {r.neverTrained ? `No ha registrado entrenamientos con su rutina (${r.days} días)` : `Último entrenamiento: ${formatDate(r.lastTrainingDate!)} (hace ${r.days} días)`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ending.length > 0 && (
            <div className="pending__group">
              <h3 className="pending__title">
                <CalendarClock size={18} aria-hidden="true" /> Rutinas que terminan en {endingDays} días
              </h3>
              <ul className="person-list">
                {ending.map((r) => (
                  <li key={r.assignmentId} className="person-row">
                    <span className="avatar" aria-hidden="true">
                      {initials(r.name)}
                    </span>
                    <span className="person-row__main">
                      <Link to={`/entrenadora/clientes/${r.clientId}`}>{r.name}</Link>
                      <span className="person-row__meta">
                        {r.routineTitle} · {r.daysLeft === 0 ? 'termina hoy' : r.daysLeft === 1 ? 'termina mañana' : `termina el ${formatDate(r.endDate)}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {review.error && <Alert kind="error">{review.error.message}</Alert>}
        </div>
      )}
    </section>
  )
}

/* ---------- Entrenadora: avisos a un cliente ---------- */

function MessageForm({ clientId, sessionId = null, label, onSent }: { clientId: number; sessionId?: number | null; label: string; onSent?: () => void }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const send = useMutation({
    mutationFn: () => noticesApi.send(clientId, text.trim(), sessionId),
    onSuccess: async () => {
      setText('')
      onSent?.()
      await qc.invalidateQueries({ queryKey: noticeKeys.messages(clientId) })
      await qc.invalidateQueries({ queryKey: noticeKeys.pending })
    },
  })
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) send.mutate()
      }}
    >
      <TextAreaField label={label} rows={3} maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)} error={send.error?.message} />
      <div className="form__actions">
        <Button type="submit" loading={send.isPending} disabled={!text.trim()}>
          Enviar aviso
        </Button>
      </div>
    </form>
  )
}

function MessageList({ clientId, messages }: { clientId: number; messages: ClientMessage[] }) {
  const qc = useQueryClient()
  const [removing, setRemoving] = useState<ClientMessage | null>(null)
  const remove = useMutation({
    mutationFn: (id: number) => noticesApi.remove(clientId, id),
    onSuccess: async () => {
      setRemoving(null)
      await qc.invalidateQueries({ queryKey: noticeKeys.messages(clientId) })
    },
  })
  return (
    <>
      <ul className="notes" aria-label="Avisos enviados">
        {messages.map((m) => (
          <li key={m.id} className="note">
            <span className="note__date">
              {formatDateTime(m.createdAt)} · {m.readAt ? `Visto ${formatDateTime(m.readAt)}` : 'Sin ver'}
              {m.sessionId && m.sessionDayName && ` · sobre «${m.sessionDayName}»`}
            </span>
            <p className="note__text">{m.body}</p>
            {!m.readAt && (
              <button type="button" className="link-button" onClick={() => setRemoving(m)}>
                Borrar
              </button>
            )}
          </li>
        ))}
      </ul>
      {removing && (
        <ConfirmDialog
          title="Borrar aviso"
          message={
            <>
              Tu cliente todavía no lo ha visto. ¿Borrarlo?
              {remove.error && <Alert kind="error">{remove.error.message}</Alert>}
            </>
          }
          confirmLabel="Borrar"
          loading={remove.isPending}
          onConfirm={() => remove.mutate(removing.id)}
          onCancel={() => {
            remove.reset()
            setRemoving(null)
          }}
        />
      )}
    </>
  )
}

/** Tarjeta de la ficha del cliente: escribirle un aviso y ver los que ya se enviaron (y si los vio). */
export function ClientMessagesCard({ clientId, firstName, canWrite }: { clientId: number; firstName: string; canWrite: boolean }) {
  const messages = useQuery({ queryKey: noticeKeys.messages(clientId), queryFn: () => noticesApi.messages(clientId), retry: false })
  if (messages.error) return null
  return (
    <section className="card stack" aria-labelledby="avisos-title">
      <div>
        <h2 className="card__title" id="avisos-title">
          Avisos para {firstName}
        </h2>
        <p className="field__hint">{firstName} los ve en el inicio de su app. No se envían correos.</p>
      </div>
      {canWrite && <MessageForm clientId={clientId} label="Nuevo aviso" />}
      {messages.isPending ? <LoadingState /> : messages.data.length === 0 ? <p className="muted">Aún no le has enviado avisos.</p> : <MessageList clientId={clientId} messages={messages.data} />}
    </section>
  )
}

/**
 * En el detalle de un entrenamiento: lo marca como revisado al abrirlo (sus comentarios dejan de salir en pendientes)
 * y permite contestarle al cliente.
 */
export function SessionReply({ clientId, sessionId, completed }: { clientId: number; sessionId: number; completed: boolean }) {
  const qc = useQueryClient()
  const messages = useQuery({ queryKey: noticeKeys.messages(clientId), queryFn: () => noticesApi.messages(clientId), retry: false })
  const [sent, setSent] = useState(false)
  useEffect(() => {
    if (!completed) return
    noticesApi
      .review(clientId, sessionId)
      .then(() => qc.invalidateQueries({ queryKey: noticeKeys.pending }))
      .catch(() => undefined)
  }, [clientId, sessionId, completed, qc])
  if (messages.error) return null
  const replies = messages.data?.filter((m) => m.sessionId === sessionId) ?? []
  return (
    <section className="card stack" aria-labelledby="responder-title">
      <h2 className="card__title" id="responder-title">
        Responder a tu cliente
      </h2>
      {sent && <Alert kind="success">Aviso enviado. Lo verá en el inicio de su app.</Alert>}
      {replies.length > 0 && <MessageList clientId={clientId} messages={replies} />}
      <MessageForm clientId={clientId} sessionId={sessionId} label="Tu respuesta" onSent={() => setSent(true)} />
    </section>
  )
}

/* ---------- Cliente: avisos en su inicio ---------- */

/** Avisos de la entrenadora en el inicio del cliente. Los nuevos se destacan; «Entendido» los marca como vistos. */
export function PortalMessagesCard() {
  const qc = useQueryClient()
  const messages = useQuery({ queryKey: noticeKeys.mine, queryFn: noticesApi.myMessages, retry: false })
  const [showAll, setShowAll] = useState(false)
  const read = useMutation({ mutationFn: noticesApi.markRead, onSuccess: () => qc.invalidateQueries({ queryKey: noticeKeys.mine }) })
  if (messages.isPending || messages.error || messages.data.length === 0) return null
  const unread = messages.data.filter((m) => !m.readAt)
  const shown = showAll ? messages.data : unread.length > 0 ? unread : messages.data.slice(0, 1)
  return (
    <section className={`card stack portal-notices${unread.length ? ' portal-notices--new' : ''}`} aria-labelledby="avisos-entrenadora">
      <h2 className="card__title" id="avisos-entrenadora">
        <BellRing size={20} aria-hidden="true" /> {unread.length ? `${unread.length === 1 ? 'Aviso nuevo' : `${unread.length} avisos nuevos`} de tu entrenadora` : 'Avisos de tu entrenadora'}
      </h2>
      <ul className="notes">
        {shown.map((m) => (
          <li key={m.id} className={`note${m.readAt ? '' : ' note--new'}`}>
            <span className="note__date">
              {formatDateTime(m.createdAt)}
              {m.sessionId && m.sessionDayName && (
                <>
                  {' · sobre tu entrenamiento '}
                  <Link to={`/portal/entrenamiento/${m.sessionId}`}>{m.sessionDayName}</Link>
                </>
              )}
            </span>
            <p className="note__text">{m.body}</p>
          </li>
        ))}
      </ul>
      <div className="portal-notices__actions">
        {unread.length > 0 && (
          <Button loading={read.isPending} onClick={() => read.mutate()}>
            Entendido
          </Button>
        )}
        {messages.data.length > shown.length && (
          <button type="button" className="link-button" onClick={() => setShowAll(true)}>
            Ver todos ({messages.data.length})
          </button>
        )}
      </div>
    </section>
  )
}

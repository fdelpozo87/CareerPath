import { useCallback, useEffect, useState } from 'react'
import { abrir, enviar, guardar, NIVEL_KEYS, puntuar, SCORE_KEYS, type Abierta, type Puntajes, type Respuesta, type Respuestas } from '../../lib/evaluaciones'
import { getLang, tr } from '../../lib/i18n'
import ConfirmDialog from '../ConfirmDialog'
import { InformeView } from './InformeView'

// Responder una autoevaluación (o ver una ya enviada). Quien creó la evaluación ve respuestas e informe solo
// cuando la persona los envió; el servidor lo aplica, acá solo se refleja.

const MIN_EVIDENCIA = 20

export function AnswerView({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const [data, setData] = useState<Abierta | null>(null)
  const [answers, setAnswers] = useState<Respuestas>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  // El puntaje de quien evalúa (lo escribe quien creó la evaluación, después de que la persona la envía).
  const [scores, setScores] = useState<Puntajes>({})
  const [confirmScore, setConfirmScore] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await abrir(id)
      setData(d)
      setAnswers(d.respuestas)
      setScores(d.puntajes ?? {})
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('cloud.error'))
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde el servidor; el estado se actualiza al responder
    void load()
  }, [load])

  if (!data) {
    return error ? (
      <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft p-3 text-sm text-danger">
        {error}
      </p>
    ) : (
      <p role="status" className="text-sm text-text-muted">
        {tr('common.loading')}
      </p>
    )
  }

  const ev = data.evaluacion
  const canAnswer = data.rol === 'responde' && data.estado !== 'completada'
  const get = (cid: string): Respuesta => (typeof answers[cid] === 'object' ? (answers[cid] as Respuesta) : { evidencia: '' })
  const set = (cid: string, patch: Partial<Respuesta>) => setAnswers((a) => ({ ...a, [cid]: { ...get(cid), ...patch } }))
  const missing = ev.competencias.find((c) => !get(c.id).nivel || get(c.id).evidencia.trim().length < MIN_EVIDENCIA)
  // Puntuar: solo quien creó la evaluación, y cuando la persona ya la envió.
  const canScore = data.rol === 'creador' && data.estado === 'completada' && ev.tipo === 'asignada'
  const sc = (cid: string) => scores[cid] ?? { puntaje: 0, comentario: '' }
  const setSc = (cid: string, patch: Partial<{ puntaje: number; comentario: string }>) => setScores((x) => ({ ...x, [cid]: { ...sc(cid), ...patch } }))
  const missingScore = ev.competencias.find((c) => !sc(c.id).puntaje)

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      if (done) setNotice(done)
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('cloud.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-text-muted underline underline-offset-2 hover:text-foreground">
        ← {tr('eval.back')}
      </button>
      <h2 className="mb-1 text-2xl">{ev.titulo}</h2>
      <p className="mb-4 text-sm text-text-muted">
        {[ev.area, ev.rol, ev.periodo].filter(Boolean).join(' · ')}
      </p>

      {/* Transparencia: quién va a leer lo que se escriba, antes de escribirlo. */}
      <p className="mb-6 rounded-xl bg-primary-soft p-4 text-sm leading-relaxed text-foreground">
        {data.rol === 'creador'
          ? tr('eval.who.creator', { email: data.email })
          : ev.tipo === 'directa'
            ? tr('eval.who.self')
            : tr('eval.who.sees', { who: data.creadaPor })}
      </p>

      {data.rol === 'responde' && data.puntajes && (
        <p role="status" className="mb-6 rounded-xl border border-border-color p-4 text-sm leading-relaxed text-foreground" style={{ borderLeft: '3px solid var(--color-accent)' }}>
          {tr('eval.score.seen', { who: data.creadaPor })}
        </p>
      )}

      {data.rol === 'creador' && data.estado !== 'completada' && (
        <p role="status" className="rounded-xl border border-border-color p-4 text-sm text-text-muted">
          {tr('eval.creator.waiting', { email: data.email })}
        </p>
      )}

      {canAnswer || data.estado === 'completada' ? (
        <>
          {data.informe && data.estado === 'completada' && (
            <section aria-labelledby="informe-titulo" className="mb-8">
              <h3 id="informe-titulo" className="mb-3 text-xl">
                {tr('eval.report.title')}
              </h3>
              <InformeView informe={data.informe} />
            </section>
          )}

          <section aria-labelledby="resp-titulo">
            {data.estado === 'completada' && (
              <h3 id="resp-titulo" className="mb-3 text-xl">
                {tr('eval.answers.title')}
              </h3>
            )}
            <div className="space-y-5">
              {ev.competencias.map((c) => {
                const r = get(c.id)
                return (
                  <div key={c.id} className="card">
                    <fieldset disabled={!canAnswer} className="m-0 min-w-0 border-0 p-0">
                    <legend className="sr-only">{c.nombre}</legend>
                    <h4 className="text-base font-semibold">{c.nombre}</h4>
                    {c.descripcion && <p className="mb-3 text-sm text-text-muted">{c.descripcion}</p>}
                    <ul className="mb-4 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                      {c.preguntas.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>

                    <p className="mb-1.5 text-sm font-medium text-foreground">{tr(data.rol === 'creador' ? 'eval.level.labelOther' : 'eval.level.label')}</p>
                    <div role="radiogroup" aria-label={`${tr('eval.level.label')}: ${c.nombre}`} className="mb-4 flex flex-wrap gap-2">
                      {NIVEL_KEYS.map((k, i) => {
                        const n = i + 1
                        const selected = r.nivel === n
                        return (
                          <button
                            key={k}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => set(c.id, { nivel: n })}
                            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${selected ? 'border-accent bg-accent-soft font-semibold text-foreground' : 'border-border-color text-text-muted hover:bg-secondary'} disabled:cursor-default`}
                          >
                            {tr(k)}
                          </button>
                        )
                      })}
                    </div>

                    <label htmlFor={`ev-${c.id}`} className="mb-1 block text-sm font-medium text-foreground">
                      {tr(data.rol === 'creador' ? 'eval.evidence.labelOther' : 'eval.evidence.label')}
                    </label>
                    <textarea
                      id={`ev-${c.id}`}
                      rows={4}
                      maxLength={2000}
                      value={r.evidencia}
                      onChange={(e) => set(c.id, { evidencia: e.target.value })}
                      placeholder={tr('eval.evidence.placeholder')}
                      className="w-full resize-y rounded-xl border border-border-color bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
                    />

                    </fieldset>

                    {/* Puntaje de quien evalúa: lo escribe quien creó la evaluación y la persona lo ve al guardarse. */}
                    {(canScore || data.puntajes) && (
                      <div className="mt-4 rounded-xl bg-secondary p-4">
                        <p className="mb-2 text-sm font-semibold text-foreground">{canScore ? tr('eval.score.mine') : tr('eval.score.from', { who: data.creadaPor })}</p>
                        {canScore ? (
                          <>
                            <div role="radiogroup" aria-label={`${tr('eval.score.label')}: ${c.nombre}`} className="mb-3 flex flex-wrap gap-2">
                              {SCORE_KEYS.map((k, i) => {
                                const selected = sc(c.id).puntaje === i + 1
                                return (
                                  <button
                                    key={k}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => setSc(c.id, { puntaje: i + 1 })}
                                    className={`rounded-full border px-3.5 py-1.5 text-sm transition ${selected ? 'border-accent bg-accent-soft font-semibold text-foreground' : 'border-border-color bg-card text-text-muted hover:bg-card/70'}`}
                                  >
                                    {i + 1} · {tr(k)}
                                  </button>
                                )
                              })}
                            </div>
                            <label htmlFor={`sc-${c.id}`} className="mb-1 block text-xs font-medium text-text-muted">{tr('eval.score.comment')}</label>
                            <textarea
                              id={`sc-${c.id}`}
                              rows={2}
                              maxLength={500}
                              value={sc(c.id).comentario}
                              onChange={(e) => setSc(c.id, { comentario: e.target.value })}
                              className="w-full resize-y rounded-xl border border-border-color bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
                            />
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-foreground">
                              <span className="mr-2 inline-block rounded-full border border-accent bg-accent-soft px-3 py-0.5 font-semibold">{sc(c.id).puntaje}</span>
                              {sc(c.id).puntaje >= 1 && tr(SCORE_KEYS[sc(c.id).puntaje - 1])}
                            </p>
                            {sc(c.id).comentario && <p className="mt-2 text-sm italic leading-relaxed text-text-muted">“{sc(c.id).comentario}”</p>}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="card">
                <label htmlFor="ev-desarrollo" className="mb-1 block text-sm font-medium text-foreground">
                  {tr('eval.develop.label')}
                </label>
                <textarea
                  id="ev-desarrollo"
                  rows={3}
                  maxLength={2000}
                  disabled={!canAnswer}
                  value={typeof answers.desarrollo === 'string' ? answers.desarrollo : ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, desarrollo: e.target.value }))}
                  className="w-full resize-y rounded-xl border border-border-color bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            {canScore && (
              <div className="mt-6">
                <p role="alert" className="min-h-6 text-sm text-danger">
                  {error}
                </p>
                <p role="status" className="min-h-6 text-sm text-text-muted">
                  {notice ?? (data.puntuadaAt ? tr('eval.score.sharedOn', { date: new Date(data.puntuadaAt).toLocaleDateString(getLang() === 'en' ? 'en-US' : 'es') }) : '')}
                </p>
                <div className="flex justify-end">
                  <button disabled={busy || Boolean(missingScore)} onClick={() => setConfirmScore(true)} className="btn-advance px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40">
                    {busy ? tr('login.sending') : data.puntuadaAt ? tr('eval.score.update') : tr('eval.score.save')}
                  </button>
                </div>
                {missingScore && <p className="mt-2 text-right text-xs text-text-muted">{tr('eval.score.missing', { name: missingScore.nombre })}</p>}
              </div>
            )}

            {canAnswer && (
              <div className="mt-6">
                <p role="alert" className="min-h-6 text-sm text-danger">
                  {error}
                </p>
                <p role="status" className="min-h-6 text-sm text-text-muted">
                  {notice}
                </p>
                <div className="flex flex-wrap justify-end gap-3">
                  <button disabled={busy} onClick={() => void run(() => guardar(id, answers).then(onChanged), tr('eval.draftSaved'))} className="btn-secondary px-5 py-2.5 text-sm disabled:opacity-50">
                    {tr('eval.saveDraft')}
                  </button>
                  <button
                    disabled={busy || Boolean(missing)}
                    onClick={() => setConfirm(true)}
                    className="btn-advance px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? tr('login.sending') : tr('eval.submit')}
                  </button>
                </div>
                {missing && <p className="mt-2 text-right text-xs text-text-muted">{tr('eval.missing', { name: missing.nombre })}</p>}
              </div>
            )}
          </section>
        </>
      ) : null}

      {data.rol !== 'creador' && error && !canAnswer && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmScore}
        title={tr('eval.score.confirm.title')}
        body={tr('eval.score.confirm.body', { email: data.email })}
        confirmLabel={tr('eval.score.confirm.action')}
        onCancel={() => setConfirmScore(false)}
        onConfirm={() => {
          setConfirmScore(false)
          void run(async () => {
            await puntuar(id, scores)
            onChanged()
            await load()
            setNotice(tr('eval.score.saved', { email: data.email }))
          })
        }}
      />

      <ConfirmDialog
        open={confirm}
        title={tr('eval.confirm.title')}
        body={ev.tipo === 'directa' ? tr('eval.confirm.self') : tr('eval.confirm.body', { who: data.creadaPor })}
        confirmLabel={tr('eval.confirm.action')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false)
          void run(async () => {
            await enviar(id, answers)
            onChanged()
            await load()
          })
        }}
      />
    </div>
  )
}

import { useEffect, useId, useState, type FormEvent } from 'react'
import { crear, cuentas, generar, type Borrador, type Competencia, type ResultadoAsignacion } from '../../lib/evaluaciones'
import { tr } from '../../lib/i18n'

// Armar una evaluación con ayuda de la IA: describir el área → revisar y editar la propuesta → asignar.
// Es el flujo de quien evalúa a otras personas: se asigna a emails de cuentas de Bivio. (Evaluarse a uno mismo
// tiene su propio flujo corto: SelfStart.)

type Step = 'form' | 'draft' | 'assign' | 'done'

const inputCls = 'w-full rounded-xl border border-border-color bg-background p-3 text-sm text-foreground outline-none focus:border-primary'

const modo = 'jefe' as const

export function Builder({ onBack, isAdmin = false }: { onBack: () => void; isAdmin?: boolean }) {
  const [step, setStep] = useState<Step>('form')
  const [area, setArea] = useState('')
  const [rol, setRol] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [foco, setFoco] = useState('')
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [ajuste, setAjuste] = useState('')
  const [emails, setEmails] = useState('')
  const [existentes, setExistentes] = useState<string[]>([])
  const [buscar, setBuscar] = useState('')
  const [notify, setNotify] = useState(true)
  const [resultados, setResultados] = useState<ResultadoAsignacion[]>([])
  const [error, setError] = useState<string | null>(null)
  // Si la IA no aplicó una parte del pedido (por ejemplo, un tema prohibido en una evaluación), lo explica acá.
  const [aiNote, setAiNote] = useState('')
  const [busy, setBusy] = useState(false)
  // Quien administra elige entre las cuentas activas (el servidor solo le da la lista a ella o a él).
  useEffect(() => {
    if (!isAdmin) return
    let alive = true
    cuentas().then((r) => alive && setExistentes(r.emails)).catch(() => {})
    return () => {
      alive = false
    }
  }, [isAdmin])
  const elegidos = new Set(emails.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))
  const toggle = (email: string) => {
    const next = new Set(elegidos)
    if (next.has(email)) next.delete(email)
    else next.add(email)
    setEmails([...next].join('\n'))
  }
  const visibles = existentes.filter((e) => e.includes(buscar.trim().toLowerCase()))

  const ids = { area: useId(), rol: useId(), periodo: useId(), foco: useId(), ajuste: useId(), emails: useId() }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('cloud.error'))
    } finally {
      setBusy(false)
    }
  }

  const propose = (e?: FormEvent, change?: string) => {
    e?.preventDefault()
    if (!area.trim() || busy) return
    void run(async () => {
      const r = await generar({ modo, area: area.trim(), rol: rol.trim(), periodo: periodo.trim(), foco: foco.trim(), ...(change && borrador ? { ajuste: change, previa: borrador } : {}) })
      setBorrador(r.borrador)
      setAiNote(r.nota ?? '')
      setAjuste('')
      setStep('draft')
    })
  }

  const updateComp = (i: number, patch: Partial<Competencia>) => setBorrador((b) => (b ? { ...b, competencias: b.competencias.map((c, k) => (k === i ? { ...c, ...patch } : c)) } : b))
  const cleanDraft = (): Borrador | null => {
    if (!borrador) return null
    const competencias = borrador.competencias
      .map((c, i) => ({ ...c, id: `c${i + 1}`, nombre: c.nombre.trim(), preguntas: c.preguntas.map((p) => p.trim()).filter(Boolean) }))
      .filter((c) => c.nombre && c.preguntas.length > 0)
    return competencias.length >= 2 && borrador.titulo.trim() ? { titulo: borrador.titulo.trim(), competencias } : null
  }
  const draftOk = cleanDraft() !== null

  const create = () => {
    const d = cleanDraft()
    if (!d || busy) return
    const list = [...new Set(emails.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))]
    if (list.length === 0) return setError(tr('eval.build.emailsRequired'))
    void run(async () => {
      const r = await crear({ modo, titulo: d.titulo, area: area.trim(), rol: rol.trim(), periodo: periodo.trim(), competencias: d.competencias, emails: list, notify })
      setResultados(r.resultados)
      setStep('done')
    })
  }

  const problemText = (p: ResultadoAsignacion['problema']) => tr(p === 'sin_cuenta' ? 'eval.build.noAccount' : 'eval.build.inactive')

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-text-muted underline underline-offset-2 hover:text-foreground">
        ← {tr('eval.back')}
      </button>
      <h2 className="mb-1 text-2xl">{tr('eval.build.titleBoss')}</h2>
      <p className="mb-6 text-sm text-text-muted">{tr('eval.build.ledeBoss')}</p>

      {step === 'form' && (
        <form onSubmit={propose} className="card space-y-4">
          <div>
            <label htmlFor={ids.area} className="mb-1 block text-sm font-medium">{tr('eval.build.area')}</label>
            <input id={ids.area} required value={area} onChange={(e) => setArea(e.target.value)} maxLength={200} placeholder={tr('eval.build.areaPh')} className={inputCls} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={ids.rol} className="mb-1 block text-sm font-medium">{tr('eval.build.role')}</label>
              <input id={ids.rol} value={rol} onChange={(e) => setRol(e.target.value)} maxLength={200} placeholder={tr('eval.build.rolePh')} className={inputCls} />
            </div>
            <div>
              <label htmlFor={ids.periodo} className="mb-1 block text-sm font-medium">{tr('eval.build.period')}</label>
              <input id={ids.periodo} value={periodo} onChange={(e) => setPeriodo(e.target.value)} maxLength={80} placeholder={tr('eval.build.periodPh')} className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor={ids.foco} className="mb-1 block text-sm font-medium">{tr('eval.build.focus')}</label>
            <textarea id={ids.foco} rows={3} value={foco} onChange={(e) => setFoco(e.target.value)} maxLength={600} placeholder={tr('eval.build.focusPh')} className={`${inputCls} resize-y`} />
          </div>
          <p className="text-xs text-text-muted">{tr('eval.build.noNames')}</p>
          <p role="alert" className="min-h-5 text-sm text-danger">{error}</p>
          <button type="submit" disabled={busy || !area.trim()} className="btn-primary w-full py-3 disabled:opacity-50">
            {busy ? tr('eval.build.generating') : tr('eval.build.generate')}
          </button>
        </form>
      )}

      {step === 'draft' && borrador && (
        <div className="space-y-4">
          <div className="card">
            <label htmlFor="ev-title" className="mb-1 block text-sm font-medium">{tr('eval.build.docTitle')}</label>
            <input id="ev-title" value={borrador.titulo} onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })} maxLength={200} className={inputCls} />
          </div>

          {borrador.competencias.map((c, i) => (
            <div key={i} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <label htmlFor={`c-n-${i}`} className="mb-1 block text-xs font-semibold uppercase tracking-widest text-text-muted">{tr('eval.build.competency', { n: i + 1 })}</label>
                  <input id={`c-n-${i}`} value={c.nombre} onChange={(e) => updateComp(i, { nombre: e.target.value })} maxLength={80} className={inputCls} />
                </div>
                <button type="button" onClick={() => setBorrador({ ...borrador, competencias: borrador.competencias.filter((_, k) => k !== i) })} className="mt-6 text-sm text-text-muted underline underline-offset-2 hover:text-foreground">
                  {tr('eval.build.remove')}
                </button>
              </div>
              <div>
                <label htmlFor={`c-d-${i}`} className="mb-1 block text-sm font-medium">{tr('eval.build.description')}</label>
                <textarea id={`c-d-${i}`} rows={2} value={c.descripcion} onChange={(e) => updateComp(i, { descripcion: e.target.value })} maxLength={300} className={`${inputCls} resize-y`} />
              </div>
              <div>
                <label htmlFor={`c-p-${i}`} className="mb-1 block text-sm font-medium">{tr('eval.build.questions')}</label>
                <textarea id={`c-p-${i}`} rows={3} value={c.preguntas.join('\n')} onChange={(e) => updateComp(i, { preguntas: e.target.value.split('\n') })} className={`${inputCls} resize-y`} />
                <p className="mt-1 text-xs text-text-muted">{tr('eval.build.questionsHint')}</p>
              </div>
            </div>
          ))}

          <button type="button" onClick={() => setBorrador({ ...borrador, competencias: [...borrador.competencias, { id: '', nombre: '', descripcion: '', preguntas: [''] }] })} className="btn-secondary px-5 py-2.5 text-sm">
            + {tr('eval.build.add')}
          </button>

          {aiNote && (
            <p role="status" className="rounded-xl border border-border-color bg-secondary p-3 text-sm leading-relaxed text-foreground" style={{ borderLeft: '3px solid var(--color-accent)' }}>
              {aiNote}
            </p>
          )}
          <div className="card">
            <label htmlFor={ids.ajuste} className="mb-1 block text-sm font-medium">{tr('eval.build.adjust')}</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input id={ids.ajuste} value={ajuste} onChange={(e) => setAjuste(e.target.value)} maxLength={400} placeholder={tr('eval.build.adjustPh')} className={inputCls} />
              <button type="button" disabled={busy || !ajuste.trim()} onClick={() => propose(undefined, ajuste.trim())} className="btn-secondary shrink-0 px-5 py-2.5 text-sm disabled:opacity-50">
                {busy ? tr('eval.build.generating') : tr('eval.build.apply')}
              </button>
            </div>
          </div>

          <p role="alert" className="min-h-5 text-sm text-danger">{error}</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setStep('form')} className="btn-secondary px-5 py-2.5 text-sm">{tr('eval.build.backToForm')}</button>
            <button type="button" disabled={!draftOk} onClick={() => setStep('assign')} className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50">
              {tr('eval.build.continue')}
            </button>
          </div>
        </div>
      )}

      {step === 'assign' && (
        <div className="card space-y-4">
          <div>
            <label htmlFor={ids.emails} className="mb-1 block text-sm font-medium">{tr('eval.build.emails')}</label>
            <textarea id={ids.emails} rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="persona@empresa.com" className={`${inputCls} resize-y`} />
            <p className="mt-1 text-xs text-text-muted">{tr(isAdmin ? 'eval.build.emailsHintAdmin' : 'eval.build.emailsHint')}</p>
          </div>
          {isAdmin && existentes.length > 0 && (
            <details className="rounded-xl border border-border-color p-3">
              <summary className="cursor-pointer text-sm font-medium">{tr('eval.build.pick')}</summary>
              <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder={tr('eval.build.pickSearch')} aria-label={tr('eval.build.pickSearch')} className={`${inputCls} mt-3`} />
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {visibles.map((e) => (
                  <li key={e}>
                    <label className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-primary-soft">
                      <input type="checkbox" checked={elegidos.has(e)} onChange={() => toggle(e)} className="accent-primary" />
                      {e}
                    </label>
                  </li>
                ))}
                {visibles.length === 0 && <li className="px-2 py-1 text-sm text-text-muted">{tr('eval.build.pickNone')}</li>}
              </ul>
            </details>
          )}
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-primary" />
            {tr('eval.build.notify')}
          </label>
          <p className="rounded-xl bg-primary-soft p-3 text-xs leading-relaxed text-foreground">{tr('eval.build.visibility')}</p>
          <p role="alert" className="min-h-5 text-sm text-danger">{error}</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setStep('draft')} className="btn-secondary px-5 py-2.5 text-sm">{tr('eval.build.backToDraft')}</button>
            <button type="button" disabled={busy || !emails.trim()} onClick={create} className="btn-advance px-6 py-2.5 text-sm disabled:opacity-50">
              {busy ? tr('login.sending') : tr('eval.build.assign')}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="card space-y-3">
          <h3 className="text-lg">{tr('eval.build.doneTitle')}</h3>
          <ul className="space-y-2 text-sm">
            {resultados.map((r) => (
              <li key={r.email} className="flex flex-col gap-0.5 rounded-xl border border-border-color p-3">
                <span className="font-semibold text-foreground">{r.email}</span>
                <span className="text-text-muted">{r.problema ? problemText(r.problema) : r.creada ? tr(r.avisado ? 'eval.build.createdNotified' : 'eval.build.createdNoMail') : r.avisado ? tr('eval.build.assignedNotified') : tr('eval.build.assignedNoMail')}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <button onClick={onBack} className="btn-primary px-6 py-2.5 text-sm">{tr('eval.build.finish')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

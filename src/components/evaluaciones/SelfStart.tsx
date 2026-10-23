import { useId, useState, type FormEvent } from 'react'
import { crear, generar, mias } from '../../lib/evaluaciones'
import { tr } from '../../lib/i18n'

// "Evaluarme": se piden solo el área y el cargo y se empieza. La IA arma la evaluación y la persona pasa directo
// a responderla, sin revisar una propuesta antes. Es solo suya: nadie más la ve.

const inputCls = 'w-full rounded-xl border border-border-color bg-background p-3 text-sm text-foreground outline-none focus:border-primary'

export function SelfStart({ onBack, onOpen }: { onBack: () => void; onOpen: (asignacionId: string) => void }) {
  const [area, setArea] = useState('')
  const [cargo, setCargo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const areaId = useId()
  const cargoId = useId()

  const start = async (e: FormEvent) => {
    e.preventDefault()
    const a = area.trim()
    const c = cargo.trim()
    if (!a || !c || busy) return
    setBusy(true)
    setError(null)
    try {
      const { borrador } = await generar({ modo: 'propia', area: a, rol: c, periodo: '', foco: '' })
      await crear({ modo: 'propia', titulo: borrador.titulo, area: a, rol: c, periodo: '', competencias: borrador.competencias })
      // La evaluación recién creada es la más reciente: se abre para empezar a responderla.
      const m = await mias()
      if (m.items[0]) return onOpen(m.items[0].id)
      onBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('cloud.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-text-muted underline underline-offset-2 hover:text-foreground">
        ← {tr('eval.back')}
      </button>
      <h2 className="mb-1 text-2xl">{tr('eval.build.titleSelf')}</h2>
      <p className="mb-6 text-sm text-text-muted">{tr('eval.self.lede')}</p>

      <form onSubmit={start} className="card space-y-4">
        <div>
          <label htmlFor={areaId} className="mb-1 block text-sm font-medium">{tr('eval.build.area')}</label>
          <input id={areaId} required autoFocus value={area} onChange={(e) => setArea(e.target.value)} maxLength={200} placeholder={tr('eval.build.areaPh')} className={inputCls} />
        </div>
        <div>
          <label htmlFor={cargoId} className="mb-1 block text-sm font-medium">{tr('eval.self.role')}</label>
          <input id={cargoId} required value={cargo} onChange={(e) => setCargo(e.target.value)} maxLength={200} placeholder={tr('eval.self.rolePh')} className={inputCls} />
        </div>
        <p className="text-xs text-text-muted">{tr('eval.self.private')}</p>
        <p role="alert" className="min-h-5 text-sm text-danger">{error}</p>
        <p role="status" className="min-h-5 text-sm text-text-muted">{busy ? tr('eval.self.building') : ''}</p>
        <button type="submit" disabled={busy || !area.trim() || !cargo.trim()} className="btn-advance w-full py-3 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? tr('eval.build.generating') : tr('eval.self.start')}
        </button>
      </form>
    </div>
  )
}

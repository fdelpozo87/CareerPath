import { useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import ProfessionalSection from './components/ProfessionalSection'
import CompanySection from './components/CompanySection'
import Footer from './components/Footer'
import { DiagnosisFlow } from './components/DiagnosisFlow'
import { DiscoveryFlow } from './components/DiscoveryFlow'
import { ActionPlanFlow } from './components/ActionPlanFlow'
import { CompanyFlow } from './components/CompanyFlow'
import type { DiagnosisResult } from './components/DiagnosisFlow'
import type { DiscoveryResult } from './components/DiscoveryFlow'

type View = 'landing' | 'diagnosis' | 'discovery' | 'action-plan' | 'company'

function App() {
  const [view, setView] = useState<View>('landing')
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null)
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null)

  if (view === 'diagnosis') {
    return (
      <DiagnosisFlow
        onBack={() => setView('landing')}
        onDiscovery={(result) => {
          setDiagnosisResult(result)
          setView('discovery')
        }}
      />
    )
  }

  if (view === 'discovery' && diagnosisResult) {
    return (
      <DiscoveryFlow
        diagnosisResult={diagnosisResult}
        onBack={() => setView('diagnosis')}
        onRestart={() => { setDiagnosisResult(null); setDiscoveryResult(null); setView('landing') }}
        onActionPlan={(result) => {
          setDiscoveryResult(result)
          setView('action-plan')
        }}
      />
    )
  }

  if (view === 'action-plan' && diagnosisResult && discoveryResult) {
    return (
      <ActionPlanFlow
        diagnosisResult={diagnosisResult}
        discoveryResult={discoveryResult}
        onBack={() => setView('discovery')}
        onRestart={() => { setDiagnosisResult(null); setDiscoveryResult(null); setView('landing') }}
      />
    )
  }

  if (view === 'company') {
    return <CompanyFlow onBack={() => setView('landing')} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <Header />
      <main className="flex-1">
        <Hero />
        <ProfessionalSection onStartDiagnosis={() => setView('diagnosis')} />
        <CompanySection onStart={() => setView('company')} />
      </main>
      <Footer />
    </div>
  )
}

export default App

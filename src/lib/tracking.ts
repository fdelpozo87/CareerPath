import { track } from '@vercel/analytics'

const SESSION_KEY = 'cp_session_id'

// Anonymous, sin registro: un id por sesión de navegador, no ligado a identidad real.
export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export type FunnelEvent =
  | 'diagnosis_started'
  | 'diagnosis_completed'
  | 'discovery_completed'
  | 'action_plan_completed'
  | 'action_plan_feedback'
  | 'company_analysis_completed'

export function trackEvent(event: FunnelEvent, props?: Record<string, string | number | boolean>) {
  track(event, { sessionId: getSessionId(), ...props })
}

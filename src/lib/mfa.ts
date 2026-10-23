import { getClient } from './cloud'

// Verificación en dos pasos (TOTP) del administrador, con Supabase Auth: el código de una app
// autenticadora (Google Authenticator, 1Password, Authy…). El servidor exige el nivel aal2 para
// tocar el panel; acá solo se activa y se verifica el factor.

export interface MfaState {
  /** Ya hay un factor verificado: alcanza con escribir el código. */
  factorId: string | null
}

export async function mfaState(): Promise<MfaState> {
  const c = getClient()
  if (!c) throw new Error('cloud_off')
  const { data, error } = await c.auth.mfa.listFactors()
  if (error) throw error
  const verified = data.totp.find((f) => f.status === 'verified')
  return { factorId: verified?.id ?? null }
}

export interface Enrollment {
  factorId: string
  /** SVG del código QR, listo para un <img src>. */
  qr: string
  /** La misma clave en texto, por si no se puede escanear. */
  secret: string
}

export async function enrollTotp(): Promise<Enrollment> {
  const c = getClient()
  if (!c) throw new Error('cloud_off')
  // Un intento anterior que no se terminó de verificar bloquea uno nuevo: se limpia.
  const { data: list } = await c.auth.mfa.listFactors()
  for (const f of list?.all ?? []) if (f.status === 'unverified') await c.auth.mfa.unenroll({ factorId: f.id })
  const { data, error } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Bivio ${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}` })
  if (error) throw error
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
}

/** Desactiva la verificación en dos pasos (Supabase exige que la sesión ya la haya pasado). */
export async function disableTotp(factorId: string): Promise<void> {
  const c = getClient()
  if (!c) throw new Error('cloud_off')
  const { error } = await c.auth.mfa.unenroll({ factorId })
  if (error) throw error
}

/** Nivel de la sesión: aal2 = ya pasó el código en esta sesión. */
export async function currentAal(): Promise<'aal1' | 'aal2'> {
  const c = getClient()
  if (!c) return 'aal1'
  const { data } = await c.auth.mfa.getAuthenticatorAssuranceLevel()
  return data?.currentLevel === 'aal2' ? 'aal2' : 'aal1'
}

/** Verifica el código de 6 dígitos. Si es correcto, la sesión pasa a aal2. */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const c = getClient()
  if (!c) throw new Error('cloud_off')
  const { error } = await c.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s+/g, '') })
  if (error) throw error
}

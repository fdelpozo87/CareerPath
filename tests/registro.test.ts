import { describe, expect, it } from 'vitest'
import { isNoAccountError, loginErrorKey, signupErrorKey } from '../src/lib/cloud'

describe('registros cerrados', () => {
  it('reconoce que el email no tiene cuenta, sin importar cómo lo informe Supabase', () => {
    expect(isNoAccountError({ code: 'otp_disabled' })).toBe(true)
    expect(isNoAccountError({ code: 'signup_disabled' })).toBe(true)
    expect(isNoAccountError({ code: 'user_not_found' })).toBe(true)
    expect(isNoAccountError({ message: 'Signups not allowed for otp' })).toBe(true)
  })

  it('no confunde otros errores con "no tiene cuenta" (límite de envíos, red, email inválido)', () => {
    expect(isNoAccountError({ code: 'over_email_send_rate_limit', status: 429 })).toBe(false)
    expect(isNoAccountError({ name: 'AuthRetryableFetchError', status: 0 })).toBe(false)
    expect(isNoAccountError({ code: 'validation_failed' })).toBe(false)
    expect(isNoAccountError(null)).toBe(false)
    expect(loginErrorKey({ code: 'over_email_send_rate_limit' })).toBe('login.error.rate')
  })
})

describe('signupErrorKey', () => {
  it('avisa que el registro está cerrado en vez de disimularlo', () => {
    expect(signupErrorKey({ code: 'signup_disabled' })).toBe('login.signup.closed')
    expect(signupErrorKey({ message: 'Signups not allowed for otp' })).toBe('login.signup.closed')
  })
  it('el resto de los errores se explican igual que al ingresar', () => {
    expect(signupErrorKey({ code: 'over_email_send_rate_limit', status: 429 })).toBe('login.error.rate')
    expect(signupErrorKey({ code: 'validation_failed' })).toBe('login.error.email')
  })
})

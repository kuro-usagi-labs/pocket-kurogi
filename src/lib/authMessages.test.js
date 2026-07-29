import { describe, expect, it } from 'vitest'
import {
  getInitialAuthNotice,
  isEmailVerificationError,
  toAuthMessage,
} from './authMessages'

describe('auth messages', () => {
  it('distinguishes an unverified email from invalid credentials', () => {
    const unverified = {
      status: 403,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Email not verified',
    }
    expect(isEmailVerificationError(unverified)).toBe(true)
    expect(toAuthMessage(unverified)).toContain('belum diverifikasi')
    expect(toAuthMessage({
      status: 401,
      message: 'Invalid email or password',
    })).toBe('Email atau password tidak cocok.')
  })

  it('recognizes a successful verification callback', () => {
    expect(getInitialAuthNotice('?auth=email-verified'))
      .toBe('Email berhasil diverifikasi. Silakan masuk.')
    expect(getInitialAuthNotice('?auth=email-verified&error=invalid_token'))
      .toBeNull()
  })
})

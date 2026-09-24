import { expect, it } from 'vitest'
import { assistantDiagnostic } from './assistantTelemetry.js'

it('records stages and duration without financial or credential data', () => {
  const result = assistantDiagnostic({ operation: 'correct_action', stage: 'database', outcome: 'error', startedAt: 100, statusCode: 409, text: 'gaji 100 juta', token: 'secret', message: 'sensitive', payload: { amount: 100000000 } }, 125)
  expect(result).toMatchObject({ operation: 'correct_action', stage: 'database', durationMs: 25, statusCode: 409 })
  expect(JSON.stringify(result)).not.toMatch(/gaji|secret|sensitive|100000000/)
})
it('does not log user-controlled operations or provider reasons', () => {
  const result = assistantDiagnostic({ operation: 'private text', reason: 'provider secret', startedAt: 0 }, 1)
  expect(result.operation).toBe('other')
  expect(result.reason).toBeUndefined()
})

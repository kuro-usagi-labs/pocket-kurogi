import { spawnSync } from 'node:child_process'
import { it, expect } from 'vitest'
it('fails visibly when the required database is not configured', () => {
  const result = spawnSync(process.execPath, ['scripts/require-test-database.mjs'], { env: { ...process.env, TARGET_DATABASE_URL: '' }, encoding: 'utf8' })
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('TARGET_DATABASE_URL is required')
})

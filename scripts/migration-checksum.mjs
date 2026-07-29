import crypto from 'node:crypto'

const LEGACY_COMPATIBILITY = new Map([
  [
    '20260727160000_neon_baseline.sql',
    {
      appliedChecksum: 'e96b12c10c9e5b4ca11a79a8229397c9eff4f46a9d6ab1e8e78dec179782d5b4',
      repositoryChecksum: '8f89104d42003dcee1f71c17f868408f502ac9c1b8fb4bc1ecb6983537e3a7f0',
      reason: 'Production predates the committed baseline snapshot; keep the exact known pair immutable.',
    },
  ],
])

export function normalizeMigrationSource(value) {
  return value.replace(/\r\n?/g, '\n')
}

export function migrationChecksum(value) {
  return crypto
    .createHash('sha256')
    .update(normalizeMigrationSource(value))
    .digest('hex')
}

export function migrationChecksumStatus(name, appliedChecksum, repositoryChecksum) {
  if (appliedChecksum === repositoryChecksum) return 'current'

  const compatibility = LEGACY_COMPATIBILITY.get(name)
  if (
    compatibility?.appliedChecksum === appliedChecksum
    && compatibility.repositoryChecksum === repositoryChecksum
  ) {
    return 'legacy-compatible'
  }

  return 'mismatch'
}

export function legacyMigrationCompatibility(name) {
  return LEGACY_COMPATIBILITY.get(name) ?? null
}

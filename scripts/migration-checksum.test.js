import fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  legacyMigrationCompatibility,
  migrationChecksum,
  migrationChecksumStatus,
  normalizeMigrationSource,
} from './migration-checksum.mjs'

describe('migration checksum', () => {
  it('normalizes LF, CRLF, and legacy CR line endings to one checksum', () => {
    const lf = 'select 1;\nselect 2;\n'
    const crlf = lf.replaceAll('\n', '\r\n')
    const cr = lf.replaceAll('\n', '\r')

    expect(normalizeMigrationSource(crlf)).toBe(lf)
    expect(normalizeMigrationSource(cr)).toBe(lf)
    expect(migrationChecksum(crlf)).toBe(migrationChecksum(lf))
    expect(migrationChecksum(cr)).toBe(migrationChecksum(lf))
  })

  it('accepts only the pinned production/repository pair for the legacy baseline', () => {
    const name = '20260727160000_neon_baseline.sql'
    const compatibility = legacyMigrationCompatibility(name)

    expect(migrationChecksumStatus(
      name,
      compatibility.appliedChecksum,
      compatibility.repositoryChecksum,
    )).toBe('legacy-compatible')
    expect(migrationChecksumStatus(
      name,
      compatibility.appliedChecksum,
      'changed-repository-checksum',
    )).toBe('mismatch')
    expect(migrationChecksumStatus(
      name,
      'changed-production-checksum',
      compatibility.repositoryChecksum,
    )).toBe('mismatch')
  })

  it('pins the current baseline file to the approved repository checksum', async () => {
    const name = '20260727160000_neon_baseline.sql'
    const compatibility = legacyMigrationCompatibility(name)
    const source = await fs.readFile(
      new URL(`../neon/migrations/${name}`, import.meta.url),
      'utf8',
    )

    expect(migrationChecksum(source)).toBe(compatibility.repositoryChecksum)
  })

  it('accepts identical checksums for every migration', () => {
    expect(migrationChecksumStatus('future.sql', 'same', 'same')).toBe('current')
  })
})

const { spawnSync } = require('child_process')
const path = require('path')

const npxCli = path.join(
  path.dirname(process.execPath),
  'node_modules',
  'npm',
  'bin',
  'npx-cli.js',
)

const frontendEnvKeys = [
  'VITE_NEON_AUTH_URL',
  'VITE_NEON_DATA_API_URL',
  'VITE_NEON_ANALYZE_TRANSACTION_URL',
  'VITE_NEON_TRANSCRIBE_VOICE_URL',
]

for (const key of frontendEnvKeys) {
  const value = process.env[key]

  if (!value) {
    console.error(`Missing environment variable: ${key}`)
    process.exitCode = 1
    continue
  }

  console.log(`Syncing ${key} to Vercel environments...`)

  for (const target of ['production', 'preview', 'development']) {
    const targetArgs = target === 'preview' ? [target, ''] : [target]
    const result = spawnSync(
      process.execPath,
      [
        npxCli,
        'vercel',
        'env',
        'add',
        key,
        ...targetArgs,
        '--value',
        value,
        '--force',
        '--yes',
      ],
      { encoding: 'utf8' },
    )

    if (result.status === 0) {
      console.log(`Added ${key} to ${target}`)
    } else {
      console.error(
        `Failed to add ${key} to ${target}:`,
        result.error?.message || result.stderr?.trim() || `exit code ${result.status}`,
      )
      process.exitCode = 1
    }
  }
}

if (!process.exitCode) {
  console.log('Finished uploading frontend environment variables.')
}

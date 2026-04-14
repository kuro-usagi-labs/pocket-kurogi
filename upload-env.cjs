const { execSync } = require('child_process')

const frontendEnvKeys = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
]

for (const key of frontendEnvKeys) {
  const value = process.env[key]

  if (!value) {
    console.error(`Missing environment variable: ${key}`)
    process.exitCode = 1
    continue
  }

  console.log(`Syncing ${key} to Vercel environments...`)

  try {
    execSync(`npx vercel env rm ${key} production preview development --yes`, {
      stdio: 'ignore',
    })
  } catch (_error) {
    // Ignore when the variable does not exist yet.
  }

  for (const target of ['production', 'preview', 'development']) {
    try {
      execSync(`npx vercel env add ${key} ${target}`, { input: value })
      console.log(`Added ${key} to ${target}`)
    } catch (error) {
      console.error(`Failed to add ${key} to ${target}:`, error.message)
      process.exitCode = 1
    }
  }
}

if (!process.exitCode) {
  console.log('Finished uploading frontend environment variables.')
}

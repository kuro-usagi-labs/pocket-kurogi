if (!process.env.TARGET_DATABASE_URL) {
  console.error('TARGET_DATABASE_URL is required for database integration tests. Use an isolated Neon test branch, never production.')
  process.exit(1)
}
if (process.env.TARGET_DATABASE_URL === process.env.DATABASE_URL || process.env.TARGET_DATABASE_URL === process.env.NEON_DATABASE_URL) {
  console.error('The test database must be isolated from the application database.')
  process.exit(1)
}

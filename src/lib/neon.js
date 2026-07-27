import { createClient } from '@neondatabase/neon-js'
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters'

const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL
const neonDataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL

if (!neonAuthUrl || !neonDataApiUrl) {
  throw new Error(
    'Neon belum dikonfigurasi. Isi VITE_NEON_AUTH_URL dan VITE_NEON_DATA_API_URL.',
  )
}

export const neon = createClient({
  auth: {
    adapter: BetterAuthReactAdapter(),
    url: neonAuthUrl,
  },
  dataApi: {
    url: neonDataApiUrl,
  },
})

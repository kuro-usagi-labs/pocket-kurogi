import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  build: {
    cssTarget: 'safari13',
  },
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: ['defaults', 'Safari >= 13', 'iOS >= 13'],
      modernTargets: ['Safari >= 13', 'iOS >= 13'],
      modernPolyfills: true,
      additionalLegacyPolyfills: ['core-js/proposals/global-this'],
    }),
  ],
})

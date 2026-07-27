import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  build: {
    cssTarget: 'safari13',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'neon',
              test: /node_modules[\\/]@neondatabase/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules/,
              priority: 10,
            },
          ],
        },
      },
    },
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

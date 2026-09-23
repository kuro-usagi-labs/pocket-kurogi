import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  test: { exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'] },
  build: {
    cssTarget: 'safari13',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'pdf-export',
              includeDependenciesRecursively: false,
              test: /node_modules[\\/](?:jspdf|jspdf-autotable|html2canvas|canvg|fflate|fast-png|iobuffer|pako|raf|rgbcolor|stackblur-canvas|utrie|text-segmentation|base64-arraybuffer|svg-pathdata)/,
              priority: 30,
            },
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

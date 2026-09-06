import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import checker from 'vite-plugin-checker'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Affiche les erreurs TypeScript en direct : dans le terminal ET
    // en overlay dans le navigateur, sans avoir besoin de recharger.
    checker({
      typescript: true,
      overlay: { initialIsOpen: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
})

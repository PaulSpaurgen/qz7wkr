/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Recharts dominates the bundle (~200 kB gzipped); one vendor chunk is fine for a two-page app.
  build: { chunkSizeWarningLimit: 800 },
  server: {
    proxy: { '/api': process.env.API_PROXY ?? 'http://127.0.0.1:8000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})

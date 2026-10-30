/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En desarrollo, Vite reenvía /api a la API de ASP.NET Core: frontend y API comparten origen,
// así la cookie de sesión (SameSite=Strict) y la protección CSRF funcionan igual que en producción.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.LBMETHOD_API_URL ?? 'http://localhost:5062', changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})

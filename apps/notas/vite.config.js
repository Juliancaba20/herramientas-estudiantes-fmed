import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { pluginServiceWorker } from './sw/generar.mjs'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: la app funciona igual en la raíz de un sitio o en una subcarpeta (por ejemplo /notas).
  base: './',
  plugins: [react(), pluginServiceWorker('./sw/sw.plantilla.js')],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})

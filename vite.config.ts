import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': { target: 'http://127.0.0.1:4200', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:4200', ws: true, changeOrigin: true },
    },
  },
  plugins: [react()],
})

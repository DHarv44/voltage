import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // the cloud API runs beside it in development (npm run server, port 5205)
  server: { port: 5204, strictPort: true, proxy: { '/api': 'http://localhost:5205' } },
  worker: { format: 'es' },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The /api/cmt live-rates proxy is a Vercel serverless function with no local
  // runtime, so in `npm run dev` forward /api to the deployed site. (In
  // production the function is served from the same origin.)
  server: {
    proxy: {
      '/api': {
        target: 'https://hecm-var-simulator.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths so the build works under any sub-path (e.g. GitHub Pages
  // at /inmedi-crm/) as well as at the root. Hash routing means no server config
  // is needed and refreshes never 404.
  base: './',
  plugins: [react()],
  server: { port: 5173, open: false },
})

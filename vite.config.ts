import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the same build works from a project subpath on GitHub
  // Pages and at the flowandflux.org root.
  base: './',
})

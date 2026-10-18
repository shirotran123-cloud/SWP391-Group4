import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
//
// Port 5173 is intentional, not a default left over by accident: the Google OAuth client
// used by this project has `http://localhost:5173` registered as an Authorized redirect URI
// but NOT 5174, so Google rejects the sign-in with `redirect_uri_mismatch` on any other
// port. `strictPort` makes that failure loud instead of silently moving to 5174.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
})

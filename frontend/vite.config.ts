import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
//
// The client runs on 5173. Google sign-in uses Google Identity Services (a popup that
// returns a signed ID token), so it does not depend on the port being registered as a
// redirect URI — `redirect_uri_mismatch` cannot occur. If popups are blocked, the
// redirect fallback in LoginView is the only path that needs a registered URI.
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

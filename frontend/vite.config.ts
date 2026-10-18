import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
//
// The client runs on 5174. Google OAuth requires the redirect URI to be registered in
// Google Cloud Console — 5174 must be listed under "Authorized redirect URIs" for the
// client ID in frontend/.env, otherwise Google answers `redirect_uri_mismatch`. The app
// surfaces that failure with an explicit message instead of failing silently.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 5174,
    strictPort: true,
  },
})

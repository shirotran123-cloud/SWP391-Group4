import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './responsive.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { installNgrokFetchPatch } from './config/ngrok-fetch'

// Thêm header bỏ qua trang cảnh báo của ngrok khi backend chạy qua ngrok
installNgrokFetchPatch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)


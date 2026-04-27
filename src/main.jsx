import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function renderBootFailure(error) {
  const rootElement = document.getElementById('root')

  if (typeof window !== 'undefined') {
    window.__KUROGI_BOOT_ERROR__ = true
  }

  console.error('Pocket Kurogi failed to boot:', error)

  if (!rootElement) {
    return
  }

  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f7fb;color:#111827;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;">
      <div style="width:100%;max-width:360px;border:1px solid rgba(17,24,39,.10);border-radius:24px;background:#fff;padding:22px;text-align:center;box-shadow:0 20px 60px rgba(15,23,42,.08);">
        <div style="width:48px;height:48px;border-radius:16px;background:#111827;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
          <span style="width:10px;height:10px;border-radius:999px;background:#fff;display:block;"></span>
        </div>
        <h1 style="margin:0;font-size:18px;font-weight:800;letter-spacing:-.02em;">Aplikasi gagal dibuka</h1>
        <p style="margin:10px 0 0;color:#667085;font-size:13px;line-height:1.6;font-weight:500;">Muat ulang halaman. Kalau masih terjadi, coba tutup Safari lalu buka lagi.</p>
        <button type="button" onclick="window.location.reload()" style="margin-top:18px;width:100%;border:0;border-radius:16px;background:#111827;color:#fff;padding:13px 16px;font-size:13px;font-weight:800;cursor:pointer;">Muat ulang</button>
      </div>
    </div>
  `
}

try {
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    throw new Error('Root element was not found.')
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error) {
  renderBootFailure(error)
}

// This app does not need offline caching yet.
// Clean up any existing service worker so mobile Safari does not get stuck on stale shells.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch((err) => {
        console.warn('SW cleanup failed: ', err)
      })
  })
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource-variable/space-grotesk'
import './index.css'
import App from './App.jsx'
import { initializeTheme } from './lib/theme'

initializeTheme()

function renderBootFailure(error) {
  const rootElement = document.getElementById('root')
  const isDarkMode = document.documentElement.dataset.theme === 'dark'
  const fallbackTheme = isDarkMode
    ? {
        canvas: '#111317',
        surface: '#1d2026',
        ink: '#f4f3f1',
        muted: '#a5a7ad',
        line: 'rgba(244,243,241,.10)',
        shadow: 'rgba(0,0,0,.28)',
      }
    : {
        canvas: '#f1f2f4',
        surface: '#ffffff',
        ink: '#17181b',
        muted: '#666970',
        line: 'rgba(23,24,27,.10)',
        shadow: 'rgba(31,32,38,.10)',
      }

  if (typeof window !== 'undefined') {
    window.__KUROGI_BOOT_ERROR__ = true
  }

  console.error('Pocket Kurogi failed to boot:', error)

  if (!rootElement) {
    return
  }

  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:${fallbackTheme.canvas};color:${fallbackTheme.ink};font-family:Manrope,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;">
      <div style="width:100%;max-width:360px;border:1px solid ${fallbackTheme.line};border-radius:20px;background:${fallbackTheme.surface};padding:22px;text-align:center;box-shadow:0 24px 70px ${fallbackTheme.shadow};">
        <div style="width:48px;height:48px;border-radius:16px;background:#c64224;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
          <span style="width:10px;height:10px;border-radius:999px;background:#fff;display:block;"></span>
        </div>
        <h1 style="margin:0;font-size:18px;font-weight:800;letter-spacing:-.02em;">Aplikasi gagal dibuka</h1>
        <p style="margin:10px 0 0;color:${fallbackTheme.muted};font-size:13px;line-height:1.6;font-weight:500;">Muat ulang halaman. Kalau masih terjadi, coba tutup Safari lalu buka lagi.</p>
        <button type="button" onclick="window.location.reload()" style="margin-top:18px;width:100%;border:0;border-radius:999px;background:#c64224;color:#fff;padding:13px 16px;font-size:13px;font-weight:800;cursor:pointer;">Muat ulang</button>
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

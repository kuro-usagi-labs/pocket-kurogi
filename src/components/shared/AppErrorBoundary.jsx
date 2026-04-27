import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    if (typeof window !== 'undefined') {
      window.__KUROGI_BOOT_ERROR__ = true
    }

    console.error('Pocket Kurogi crashed:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return <AppCrashFallback />
    }

    return this.props.children
  }
}

function AppCrashFallback() {
  return (
    <div className="app-min-viewport flex w-full items-center justify-center bg-champagne px-5 font-inter text-midnight">
      <div className="w-full max-w-sm rounded-[24px] border border-midnight/10 bg-white p-5 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[16px] bg-midnight">
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </div>
        <h1 className="font-jakarta text-[18px] font-extrabold tracking-[-0.02em]">
          Aplikasi perlu dimuat ulang
        </h1>
        <p className="mt-2 text-[13px] font-medium leading-relaxed text-muted">
          Ada bagian aplikasi yang gagal dibuka. Data Anda tetap aman di server.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 w-full rounded-[16px] bg-midnight px-4 py-3 font-jakarta text-[13px] font-extrabold text-white transition active:scale-[0.98]"
        >
          Muat ulang
        </button>
      </div>
    </div>
  )
}

export function isEmailVerificationError(error) {
  const code = String(error?.code || '').toLowerCase()
  const message = String(error?.message || '').toLowerCase()
  return (
    code.includes('email_not_verified') ||
    code.includes('email_not_confirmed') ||
    message.includes('email not verified') ||
    message.includes('email is not verified') ||
    message.includes('email belum diverifikasi')
  )
}

export function toAuthMessage(error, mode = 'login') {
  const message = String(error?.message || '').toLowerCase()
  const status = Number(error?.status || error?.statusCode || 0)

  if (isEmailVerificationError(error)) {
    return 'Email belum diverifikasi. Periksa inbox atau kirim ulang email verifikasi.'
  }

  if (mode === 'reset') {
    if (message.includes('token') || message.includes('expired') || message.includes('invalid')) {
      return 'Link reset tidak valid atau sudah kedaluwarsa. Minta link baru.'
    }
    return 'Password belum bisa diperbarui. Minta link baru lalu coba lagi.'
  }

  if (mode === 'forgot') {
    return 'Email reset belum bisa dikirim. Tunggu sebentar lalu coba lagi.'
  }

  if (
    status === 401 ||
    status === 403 ||
    message.includes('invalid') ||
    message.includes('password') ||
    message.includes('credential')
  ) {
    return 'Email atau password tidak cocok.'
  }

  if (message.includes('already') || message.includes('exist')) {
    return 'Email ini sudah terdaftar. Silakan masuk.'
  }

  if (message.includes('rate') || message.includes('too many')) {
    return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
  }

  return 'Proses masuk belum berhasil. Periksa data lalu coba lagi.'
}

export function getInitialAuthNotice(search = '') {
  const params = new URLSearchParams(search)
  if (params.get('auth') === 'email-verified' && !params.get('error')) {
    return 'Email berhasil diverifikasi. Silakan masuk.'
  }
  return null
}

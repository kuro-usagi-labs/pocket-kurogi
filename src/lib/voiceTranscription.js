import { invokeNeonFunction } from './neonFunctions'

const MAX_AUDIO_BYTES = 8 * 1024 * 1024

export async function transcribeVoiceNote(audioBlob) {
  if (!(audioBlob instanceof Blob)) {
    return { text: '', error: new Error('Audio tidak valid.') }
  }

  if (audioBlob.size > MAX_AUDIO_BYTES) {
    return { text: '', error: new Error('Voice note terlalu besar. Coba rekam lebih singkat.') }
  }

  const audioBase64 = await blobToBase64(audioBlob)
  const { data, error } = await invokeNeonFunction('transcribevoice', {
    audioBase64,
    mimeType: audioBlob.type || 'audio/webm',
  })

  if (error) {
    return { text: '', error }
  }

  return {
    text: String(data?.text || '').trim(),
    error: null,
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Audio tidak bisa dibaca.'))
    reader.onloadend = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',').pop() : result)
    }
    reader.readAsDataURL(blob)
  })
}

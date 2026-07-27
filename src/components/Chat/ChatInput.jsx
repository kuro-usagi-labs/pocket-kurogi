import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Mic, Paperclip, Send, X } from 'lucide-react'
import { transcribeVoiceNote } from '../../lib/voiceTranscription'

// Keep this aligned with Neon Function and database constraints.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])

export default function ChatInput({ onSend, isTyping, onNotify }) {
  const [inputValue, setInputValue] = useState('')
  const [voiceState, setVoiceState] = useState('idle')
  const [selectedImage, setSelectedImage] = useState(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioStreamRef = useRef(null)
  const recordTimeoutRef = useRef(null)
  const isVoiceBusy = voiceState !== 'idle'

  const cleanupRecording = useCallback(() => {
    window.clearTimeout(recordTimeoutRef.current)
    recordTimeoutRef.current = null
    audioStreamRef.current?.getTracks().forEach((track) => track.stop())
    audioStreamRef.current = null
    mediaRecorderRef.current = null
    audioChunksRef.current = []
  }, [])

  useEffect(() => () => {
    window.clearTimeout(recordTimeoutRef.current)
    recognitionRef.current?.stop?.()
    cleanupRecording()
  }, [cleanupRecording])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [inputValue])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if ((!inputValue.trim() && !selectedImage) || isTyping || isVoiceBusy) return
    onSend({
      text: inputValue.trim(),
      imageFile: selectedImage?.file || null,
      imagePreview: selectedImage?.previewUrl || null,
    })
    setInputValue('')
    setSelectedImage(null)
  }

  const handleComposerKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
      return
    }

    event.preventDefault()
    handleSubmit(event)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!isSupportedImage(file)) {
      onNotify?.('Format gambar belum didukung. Gunakan JPG, PNG, atau WebP.', 'error')
      e.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_BYTES) {
      onNotify?.('Ukuran gambar maksimal 4 MB.', 'error')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setSelectedImage({
        file,
        previewUrl: reader.result,
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const sendTranscript = (transcript) => {
    const cleanedTranscript = String(transcript || '').trim()
    if (!cleanedTranscript || isTyping) return

    onSend({
      text: cleanedTranscript,
      imageFile: selectedImage?.file || null,
      imagePreview: selectedImage?.previewUrl || null,
    })
    setInputValue('')
    setSelectedImage(null)
  }

  const handleMicClick = async () => {
    if (voiceState === 'listening' && recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }

    if (voiceState === 'recording' && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      return
    }

    if (isVoiceBusy || isTyping) return

    if (navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
      await startAudioRecording()
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    startSpeechRecognition(SpeechRecognition)
  }

  const startSpeechRecognition = (SpeechRecognition) => {
    if (!SpeechRecognition) {
      onNotify?.('Browser ini belum mendukung input suara.', 'info')
      return
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = 'id-ID'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setVoiceState('listening')
      onNotify?.('Saya mendengarkan. Silakan bicara.', 'info')
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInputValue(transcript)
      sendTranscript(transcript)
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error)
      setVoiceState('idle')
      onNotify?.('Input suara berhenti. Coba rekam ulang.', 'error')
    }

    recognition.onend = () => {
      setVoiceState('idle')
    }

    recognition.start()
  }

  const startAudioRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onNotify?.('Browser ini belum mendukung voice note.', 'info')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedAudioMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      audioChunksRef.current = []
      audioStreamRef.current = stream
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onerror = () => {
        cleanupRecording()
        setVoiceState('idle')
        onNotify?.('Voice note gagal direkam.', 'error')
      }

      recorder.onstop = async () => {
        window.clearTimeout(recordTimeoutRef.current)
        setVoiceState('transcribing')
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        cleanupRecording()

        if (!audioBlob.size) {
          setVoiceState('idle')
          onNotify?.('Voice note kosong. Coba rekam ulang.', 'info')
          return
        }

        const { text, error } = await transcribeVoiceNote(audioBlob)
        setVoiceState('idle')

        if (error || !text) {
          onNotify?.('Voice note belum bisa ditranskrip. Coba lagi.', 'error')
          return
        }

        setInputValue(text)
        sendTranscript(text)
      }

      recorder.start()
      setVoiceState('recording')
      onNotify?.('Merekam voice note. Tekan lagi untuk selesai.', 'info')
      recordTimeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      }, 60_000)
    } catch (error) {
      console.error('Voice recording error', error)
      cleanupRecording()
      setVoiceState('idle')
      onNotify?.('Akses mikrofon belum tersedia.', 'error')
    }
  }

  const voicePlaceholder = {
    listening: 'Mendengarkan...',
    recording: 'Merekam voice note...',
    transcribing: 'Menulis ulang suara...',
  }[voiceState] || 'Ceritakan transaksi atau tujuanmu...'

  return (
    <div className="pointer-events-none absolute bottom-[82px] left-0 z-40 flex w-full flex-col items-center px-3 sm:px-6 md:bottom-5">
      <div className="flex w-full max-w-4xl flex-col gap-2.5">
        {selectedImage && (
          <div className="pointer-events-auto relative h-24 w-24 self-end overflow-hidden rounded-[16px] border border-midnight/10 bg-white shadow-premium">
            <img src={selectedImage.previewUrl} alt="Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              aria-label="Hapus gambar"
              className="absolute right-1.5 top-1.5 rounded-full bg-midnight/80 p-1 text-white backdrop-blur-md transition-colors hover:bg-midnight"
            >
              <X size={14} strokeWidth={3} />
            </button>
          </div>
        )}

        {isVoiceBusy ? (
          <div className="pointer-events-auto self-start rounded-full border border-orange-100 bg-white px-3.5 py-2 font-jakarta text-[12px] font-extrabold text-orange-700 shadow-sm">
            {voiceState === 'transcribing'
              ? 'Memproses suara'
              : voiceState === 'recording'
                ? 'Merekam. Tekan mic untuk selesai'
                : 'Mendengarkan'}
          </div>
        ) : null}

        <div className={`glass-panel pointer-events-auto flex w-full items-end gap-1.5 rounded-[20px] p-2 shadow-[0_20px_52px_rgba(31,32,38,0.14)] transition-colors ${
          isVoiceBusy ? 'border-orange-200' : 'border-midnight/10'
        }`}>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Tambah gambar"
            disabled={isTyping || isVoiceBusy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-all hover:bg-champagne hover:text-midnight active:scale-[0.96] disabled:opacity-45 sm:h-11 sm:w-11"
          >
            <Paperclip size={21} strokeWidth={2.1} />
          </button>
          <form onSubmit={handleSubmit} className="flex flex-1 items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              aria-label="Tulis pesan"
              className="max-h-[120px] min-h-10 w-full resize-none border-0 bg-transparent px-2 py-2.5 font-inter text-[16px] font-medium leading-relaxed text-midnight outline-none placeholder:text-muted/70 focus:ring-0 sm:min-h-11 sm:text-[15px]"
              placeholder={voicePlaceholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={isVoiceBusy}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button
              type="button"
              onClick={handleMicClick}
              aria-label={isVoiceBusy ? 'Hentikan suara' : 'Input suara'}
              disabled={voiceState === 'transcribing' || isTyping}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all active:scale-[0.96] sm:h-11 sm:w-11 ${
                voiceState === 'listening' || voiceState === 'recording'
                  ? 'animate-pulse bg-red-50 text-red-500'
                  : voiceState === 'transcribing'
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-midnight hover:bg-champagne'
              }`}
            >
              <Mic size={22} strokeWidth={isVoiceBusy ? 2.8 : 2.2} />
            </button>
            <button
              type="submit"
              aria-label="Kirim"
              disabled={(!inputValue.trim() && !selectedImage) || isTyping || isVoiceBusy}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all sm:h-11 sm:w-11 ${
                (inputValue.trim() || selectedImage) && !isTyping && !isVoiceBusy
                  ? 'bg-orange-700 text-white shadow-[0_10px_24px_rgba(232,84,46,0.26)] active:scale-95'
                  : 'bg-champagne text-muted/35'
              }`}
            >
              <Send size={21} strokeWidth={2.5} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function getSupportedAudioMimeType() {
  const options = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
  ]

  return options.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function isSupportedImage(file) {
  const extension = file.name?.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
  return SUPPORTED_IMAGE_TYPES.has(file.type) || SUPPORTED_IMAGE_EXTENSIONS.has(extension)
}

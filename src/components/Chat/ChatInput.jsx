import { useState, useRef } from 'react'
import { Mic, Paperclip, Send, X } from 'lucide-react'

export default function ChatInput({ onSend, isTyping, onNotify }) {
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)

  const handleSubmit = (e) => {
    e?.preventDefault()
    if ((!inputValue.trim() && !selectedImage) || isTyping) return
    onSend({
      text: inputValue.trim(),
      imageFile: selectedImage?.file || null,
      imagePreview: selectedImage?.previewUrl || null,
    })
    setInputValue('')
    setSelectedImage(null)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

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

  const handleMicClick = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
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
      setIsListening(true)
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInputValue(transcript)
      if (transcript.trim() && !isTyping) {
        onSend({
          text: transcript.trim(),
          imageFile: selectedImage?.file || null,
          imagePreview: selectedImage?.previewUrl || null,
        })
        setInputValue('')
        setSelectedImage(null)
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
  }

  return (
    <div className="pointer-events-none absolute bottom-[88px] left-0 z-40 flex w-full flex-col items-center px-3 sm:px-8">
      <div className="flex w-full max-w-4xl flex-col gap-2.5">
        {selectedImage && (
          <div className="pointer-events-auto relative h-24 w-24 self-end overflow-hidden rounded-[18px] border border-midnight/10 bg-white shadow-lg">
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

        <div className="pointer-events-auto flex w-full items-center gap-2 rounded-[24px] border border-midnight/10 bg-white p-2 shadow-[0_16px_42px_rgba(15,23,42,0.10)]">
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
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-midnight/8 bg-white text-midnight transition-all hover:bg-champagne"
          >
            <Paperclip size={23} strokeWidth={2.1} />
          </button>
          <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
            <input
              type="text"
              className="h-12 w-full rounded-[16px] border border-midnight/8 bg-white px-4 font-inter text-[16px] font-medium text-midnight outline-none placeholder:text-muted/70 focus:border-emerald-200 focus:ring-0"
              placeholder={isListening ? 'Mendengarkan...' : 'Tulis pesan atau perintah...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isListening}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleMicClick}
              aria-label={isListening ? 'Hentikan suara' : 'Input suara'}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] transition-all ${
                isListening ? 'animate-pulse bg-red-50 text-red-500' : 'text-midnight hover:bg-champagne'
              }`}
            >
              <Mic size={24} strokeWidth={isListening ? 2.8 : 2.2} />
            </button>
            <button
              type="submit"
              aria-label="Kirim"
              disabled={(!inputValue.trim() && !selectedImage) || isTyping}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] transition-all sm:h-14 sm:w-14 ${
                (inputValue.trim() || selectedImage) && !isTyping
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 active:scale-95'
                  : 'bg-champagne text-muted/35'
              }`}
            >
              <Send size={23} strokeWidth={2.5} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

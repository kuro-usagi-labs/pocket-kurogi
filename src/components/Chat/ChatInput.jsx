import { useState, useRef } from 'react'
import { ArrowUp, Mic, X, Image as ImageIcon } from 'lucide-react'

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
    <div className="pointer-events-none absolute bottom-[78px] left-0 z-40 flex w-full flex-col items-center px-3 md:bottom-6 md:px-8">
      <div className="flex w-full max-w-[372px] flex-col gap-2.5 md:max-w-3xl">
        {selectedImage && (
          <div className="pointer-events-auto relative h-24 w-24 self-end overflow-hidden rounded-lg border border-midnight/10 bg-white shadow-lg">
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

        <div className="glass-panel pointer-events-auto flex w-full items-center gap-1.5 rounded-lg p-1.5 shadow-[0_16px_38px_rgba(17,24,39,0.12)]">
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-champagne text-muted transition-all hover:bg-cream hover:text-midnight"
          >
            <ImageIcon size={20} strokeWidth={2.1} />
          </button>
          <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-1">
            <input
              type="text"
              className="w-full border-none bg-transparent px-2 font-inter text-[14.5px] font-semibold text-midnight outline-none placeholder:text-muted/55 focus:ring-0"
              placeholder={isListening ? 'Mendengarkan...' : 'Catat atau tanya...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isListening}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleMicClick}
              aria-label={isListening ? 'Hentikan suara' : 'Input suara'}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-all ${
                isListening ? 'animate-pulse bg-red-50 text-red-500' : 'text-muted hover:bg-champagne hover:text-midnight'
              }`}
            >
              <Mic size={19} strokeWidth={isListening ? 2.8 : 2.2} />
            </button>
            <button
              type="submit"
              aria-label="Kirim"
              disabled={(!inputValue.trim() && !selectedImage) || isTyping}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-all ${
                (inputValue.trim() || selectedImage) && !isTyping
                  ? 'bg-midnight text-white shadow-lg shadow-midnight/20 active:scale-95'
                  : 'bg-champagne text-muted/35'
              }`}
            >
              <ArrowUp size={20} strokeWidth={2.5} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

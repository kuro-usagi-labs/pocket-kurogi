import { useState, useRef } from 'react'
import { Plus, ArrowUp, Mic, X, Image as ImageIcon } from 'lucide-react'

const quickSuggestions = [
  { icon: '☕', text: '45k Kopi Tunai' },
  { icon: '⛽', text: '150k Bensin BCA' },
  { icon: '💰', text: '5jt Gaji BCA' },
]

export default function ChatInput({ onSend, isTyping }) {
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const fileInputRef = useRef(null)

  const handleSubmit = (e) => {
    e?.preventDefault()
    if ((!inputValue.trim() && !selectedImage) || isTyping) return
    onSend({ text: inputValue.trim(), image: selectedImage })
    setInputValue('')
    setSelectedImage(null)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setSelectedImage(reader.result)
    }
    reader.readAsDataURL(file)
    e.target.value = '' // Reset input
  }

  const handleQuickSend = (text) => {
    if (isTyping) return
    onSend({ text, image: null })
  }

  const handleMicClick = () => {
    // Check support for speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Maaf, browser Anda tidak mendukung fitur input suara.');
      return;
    }

    if (isListening) return; // Prevent multiple instances

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
      // Auto send if confident
      if (transcript.trim() && !isTyping) {
        onSend({ text: transcript.trim(), image: selectedImage });
        setInputValue('');
        setSelectedImage(null);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }

  return (
    <div className="absolute bottom-[110px] md:bottom-8 left-0 w-full px-5 flex flex-col items-center z-40 pointer-events-none">
      {/* Quick Suggestion Pills */}
      <div className="flex gap-3 w-full max-w-sm mb-4 overflow-x-auto no-scrollbar pb-2 pt-1 pointer-events-auto px-1">
        {quickSuggestions.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickSend(item.text)}
            disabled={isTyping}
            className="shrink-0 flex items-center gap-2.5 bg-white/90 backdrop-blur-xl border border-midnight/10 shadow-[0_4px_12px_rgba(15,23,42,0.04)] pl-1.5 pr-4 py-1.5 rounded-full hover:bg-white hover:border-midnight/20 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(15,23,42,0.08)] active:scale-95 transition-all duration-300 group disabled:opacity-50"
          >
            <div className="w-7 h-7 rounded-full bg-cream border border-midnight/5 flex items-center justify-center shadow-inner group-hover:bg-[#EBE7D9] transition-colors">
              <span className="text-[12px] transform group-hover:scale-110 transition-transform duration-300">
                {item.icon}
              </span>
            </div>
            <span className="text-[11.5px] font-extrabold text-midnight font-jakarta tracking-tight">
              {item.text}
            </span>
          </button>
        ))}
      </div>

      {/* Input Form & Preview Container */}
      <div className="w-full max-w-sm flex flex-col gap-2">
        {/* Image Preview */}
        {selectedImage && (
          <div className="self-end relative w-24 h-24 rounded-2xl overflow-hidden shadow-lg border-2 border-white pointer-events-auto bg-midnight/5">
            <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-1 right-1 bg-midnight/60 text-white rounded-full p-1 backdrop-blur-md hover:bg-midnight transition-colors"
            >
              <X size={14} strokeWidth={3} />
            </button>
          </div>
        )}

        {/* Input Form */}
        <div className="w-full bg-white/95 backdrop-blur-3xl p-2 rounded-[28px] shadow-[0_20px_50px_rgba(15,23,42,0.1)] flex items-center gap-2.5 border border-midnight/10 pointer-events-auto">
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
            className="w-11 h-11 flex items-center justify-center text-midnight bg-cream rounded-full hover:bg-[#EBE7D9] transition-all shrink-0"
          >
            <Plus size={22} strokeWidth={2} />
          </button>
          <form onSubmit={handleSubmit} className="flex-1 flex items-center">
          <input
            type="text"
            className="w-full bg-transparent border-none focus:ring-0 text-midnight font-inter placeholder:text-midnight/30 px-2 text-[14.5px] outline-none font-medium"
            placeholder={isListening ? "Mendengarkan..." : "Instruksikan transaksi..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isListening}
            autoComplete="off"
          />
          <button 
            type="button" 
            onClick={handleMicClick}
            className={`mr-2 p-1 transition-all rounded-full ${
              isListening ? 'text-red-500 bg-red-50 animate-pulse' : 'text-midnight/30 hover:text-midnight/70'
            }`}
          >
            <Mic size={20} strokeWidth={isListening ? 3 : 2.5} />
          </button>
          <button
            type="submit"
            disabled={(!inputValue.trim() && !selectedImage) || isTyping}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0 ${
              (inputValue.trim() || selectedImage) && !isTyping
                ? 'bg-midnight text-white shadow-lg shadow-midnight/20 active:scale-95'
                : 'bg-ivory text-midnight/20'
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

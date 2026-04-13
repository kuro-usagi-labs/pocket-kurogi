import { Search, Bell, Menu } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function DesktopHeader() {
  const { user } = useAuth()
  
  const emailName = user?.email?.split('@')[0] || 'User'
  const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1)

  return (
    <header className="hidden md:flex justify-between items-center w-full px-12 py-6 bg-[#faf9f4]/80 backdrop-blur-xl sticky top-0 z-30 shadow-sm shadow-black/5 border-b border-black/5 font-jakarta font-medium h-[88px] shrink-0">
      <div className="flex items-center gap-8 flex-1">
        <div className="bg-black/5 rounded-full px-4 py-2 flex items-center gap-3 w-72 focus-within:bg-white focus-within:ring-1 focus-within:ring-midnight/20 transition-all">
          <Search size={16} className="text-midnight/40" />
          <input 
            type="text" 
            placeholder="Search commands..." 
            className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-midnight/40 outline-none text-midnight"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <button className="p-2 text-midnight/40 hover:text-gold transition-all">
          <Bell size={20} />
        </button>
        
        <div className="flex items-center gap-3 pl-4 border-l border-black/5">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-midnight">{displayName}</p>
            <p className="text-[10px] text-midnight/50">Wealth Client</p>
          </div>
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gold/20 flex items-center justify-center bg-ivory text-xl font-bold bg-midnight text-white shadow-inner">
            {displayName.charAt(0)}
          </div>
        </div>
      </div>
    </header>
  )
}

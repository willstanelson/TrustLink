'use client';
import { Bell, Menu } from 'lucide-react';
import { useAccount } from 'wagmi';

interface TopbarProps {
  appMode: 'xpress' | 'market';
  setAppMode: (mode: 'xpress' | 'market') => void;
  hasGlobalAlert: boolean;
}

export default function MasterTopbar({ appMode, setAppMode, hasGlobalAlert }: TopbarProps) {
  const { address, isConnected } = useAccount();
  
  const displayAddress = isConnected && address 
    ? `${address.slice(0, 4)}...${address.slice(-4)}` 
    : 'Connect';

  return (
    <header className="h-16 bg-[#0b0f19] border-b border-[#333333] flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <button className="md:hidden text-[#aaaaaa] hover:text-white" aria-label="Toggle Menu">
          <Menu className="w-6 h-6" />
        </button>

        <div className="hidden md:flex items-center gap-2 mr-8">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center">
            <span className="text-[#0b0f19] font-black text-xl leading-none tracking-tighter">TL</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight hidden lg:block">TrustLink</span>
        </div>

        <div className="flex bg-[#1e1f26] border border-[#333333] rounded-lg p-1">
          <button
            onClick={() => setAppMode('xpress')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
              appMode === 'xpress' ? 'bg-emerald-500 text-[#0b0f19] shadow-sm' : 'text-[#aaaaaa] hover:text-white'
            }`}
          >
            Xpress
          </button>
          <button
            onClick={() => setAppMode('market')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
              appMode === 'market' ? 'bg-emerald-500 text-[#0b0f19] shadow-sm' : 'text-[#aaaaaa] hover:text-white'
            }`}
          >
            Market
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-[#aaaaaa] hover:text-white transition-colors bg-[#1e1f26] rounded-full border border-[#333333]" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          {hasGlobalAlert && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-[#0b0f19] rounded-full animate-pulse"></span>
          )}
        </button>

        <div className="h-9 px-4 rounded-full bg-[#1e1f26] border border-[#333333] flex items-center gap-2 cursor-pointer hover:border-emerald-500/50 transition-colors">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
          <span className="text-white text-sm font-mono font-medium">{displayAddress}</span>
        </div>
      </div>
    </header>
  );
}
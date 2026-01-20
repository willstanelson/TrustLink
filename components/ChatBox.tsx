import React from 'react';
import { Lock, MessageSquare } from 'lucide-react';

interface ChatBoxProps {
  peerAddress: string;
}

export default function ChatBox({ peerAddress }: ChatBoxProps) {
  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700">
      {/* HEADER */}
      <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <Lock className="w-3 h-3" /> Encrypted Chat
        </span>
        <span className="text-[9px] text-slate-500 truncate max-w-[100px]">
          To: {peerAddress.slice(0,6)}...
        </span>
      </div>

      {/* BODY - PLACEHOLDER */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 opacity-50">
        <div className="bg-slate-800 p-3 rounded-full">
          <MessageSquare className="w-6 h-6 text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-300">Chat System Offline</p>
          <p className="text-[10px] text-slate-500 max-w-[150px] mx-auto mt-1">
            We are upgrading our encryption protocol. Messaging will return shortly.
          </p>
        </div>
      </div>

      {/* FOOTER - DISABLED */}
      <div className="p-3 border-t border-slate-700 bg-slate-800 flex gap-2 grayscale opacity-50 cursor-not-allowed">
        <input 
          disabled 
          placeholder="Messaging temporarily disabled..." 
          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs outline-none text-slate-500" 
        />
        <button disabled className="bg-blue-600 p-2 rounded-lg text-white">
          <div className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
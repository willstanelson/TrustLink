'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function ClaimLevelButton({ 
  currentLevel, 
  isEligible, 
  onSuccess 
}: { 
  currentLevel: number; 
  isEligible: boolean; 
  onSuccess?: () => void;
}) {
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaim = async () => {
    setIsClaiming(true);

    try {
      const res = await fetch('/api/trust/claim-level', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.details || data.error);

      toast.success(`🎉 ${data.message}`, { duration: 4000 });
      onSuccess?.(); // Refresh data

    } catch (error: any) {
      toast.error(error.message || "Failed to claim level");
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <button
      onClick={handleClaim}
      disabled={!isEligible || isClaiming}
      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2
        ${isEligible 
          ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:brightness-110 text-white shadow-lg" 
          : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"}`}
    >
      {isClaiming ? "Verifying on-chain..." : isEligible ? `✨ Claim Level ${currentLevel + 1}` : "🔒 Locked"}
    </button>
  );
}
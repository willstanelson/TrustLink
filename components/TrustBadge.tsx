import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, Award } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function TrustBadge({ address }: { address: string }) {
  const [tradeCount, setTradeCount] = useState<number | null>(null);

  useEffect(() => {
    // We don't want to query if the address is empty or missing
    if (!address || address === '0x0000000000000000000000000000000000000000') {
        setTradeCount(0);
        return;
    }

    const fetchReputation = async () => {
      // 1. Ask Supabase to count every completed order for this specific seller
      // We check BOTH seller_address (Crypto) and seller_email (Fiat)
      const { count, error } = await supabase
        .from('escrow_orders')
        .select('*', { count: 'exact', head: true })
        .or(`seller_address.ilike.${address},seller_email.ilike.${address}`)
        .in('status', ['completed', 'success']); // The two statuses that mean "Funds Released"

      if (!error && count !== null) {
        setTradeCount(count);
      } else {
        setTradeCount(0);
      }
    };

    fetchReputation();
  }, [address]);

  // Loading state (sleek pulsing effect while checking DB)
  if (tradeCount === null) {
    return <span className="animate-pulse bg-slate-800 h-5 w-20 rounded border border-slate-700"></span>;
  }

  // 🏆 GOLD TIER (10+ Trades)
  if (tradeCount >= 10) {
    return (
      <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide">
        <Award className="w-3 h-3" /> PRO ({tradeCount} TRADES)
      </div>
    );
  } 
  
  // 🛡️ BLUE TIER (1 to 9 Trades)
  else if (tradeCount > 0) {
    return (
      <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide">
        <ShieldCheck className="w-3 h-3" /> VERIFIED ({tradeCount})
      </div>
    );
  } 
  
  // ⚠️ GRAY TIER (0 Trades)
  else {
    return (
      <div className="flex items-center gap-1 bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border border-slate-700">
        <ShieldAlert className="w-3 h-3" /> NEW SELLER
      </div>
    );
  }
}
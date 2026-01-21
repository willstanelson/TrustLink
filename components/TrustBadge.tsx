import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, ShieldCheck, Star, Award, Zap } from 'lucide-react';
import { formatUnits } from 'viem';

export default function TrustBadge({ address }: { address: string }) {
  const [level, setLevel] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReputation() {
      if (!address) return;

      // 1. Fetch ALL completed sales orders (not just the count)
      const { data: orders, error } = await supabase
        .from('orders')
        .select('amount, token_symbol') // We need the amount and which coin it was
        .eq('seller_wallet', address.toLowerCase())
        .eq('status', 'COMPLETED');

      if (error) {
        console.error("Error fetching reputation:", error);
        setLoading(false);
        return;
      }

      // 2. Calculate Total Volume in USD
      let volumeUSD = 0;

      if (orders && orders.length > 0) {
        orders.forEach(order => {
          // Note: This assumes 'amount' in DB is stored as the raw number string (e.g. "1000000" for 1 USDC)
          // If your DB stores human-readable numbers (e.g. 1.0), remove the formatUnits part.
          
          let value = 0;
          
          // Logic: Convert everything to roughly USD
          if (order.token_symbol === 'ETH') {
            // Assume 1 ETH = $2500 (Static price for Badge calculation)
            // ETH has 18 decimals
            const ethAmount = parseFloat(formatUnits(BigInt(order.amount), 18));
            value = ethAmount * 2500; 
          } else {
            // Assume USDC/USDT (6 decimals) = $1
            const stableAmount = parseFloat(formatUnits(BigInt(order.amount), 6));
            value = stableAmount;
          }
          
          volumeUSD += value;
        });
      }

      setTotalVolume(volumeUSD);

      // 3. Determine Level based on VOLUME ($)
      if (volumeUSD >= 5000) setLevel(5);      // $5k+ (Legend)
      else if (volumeUSD >= 1000) setLevel(4); // $1k+ (Expert)
      else if (volumeUSD >= 200) setLevel(3);  // $200+ (Trusted - Your Target)
      else if (volumeUSD >= 50) setLevel(2);   // $50+ (Verified)
      else setLevel(1);                        // <$50 (Newbie)
      
      setLoading(false);
    }

    fetchReputation();
  }, [address]);

  if (loading) return <span className="animate-pulse bg-slate-700 w-16 h-5 rounded-full inline-block align-middle ml-2"></span>;

  // 4. Render the Badge
  const badges = {
    1: { icon: Shield, text: "New Seller", color: "text-slate-400", bg: "bg-slate-800" },
    2: { icon: ShieldCheck, text: "Verified ($50+)", color: "text-blue-400", bg: "bg-blue-900/30" },
    3: { icon: Star, text: "Trusted ($200+)", color: "text-emerald-400", bg: "bg-emerald-900/30" },
    4: { icon: Zap, text: "Expert ($1k+)", color: "text-purple-400", bg: "bg-purple-900/30" },
    5: { icon: Award, text: "Legend ($5k+)", color: "text-amber-400", bg: "bg-amber-900/30" },
  };

  const currentBadge = badges[level as keyof typeof badges];
  const Icon = currentBadge.icon;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 ${currentBadge.bg} ${currentBadge.color} text-[10px] font-bold uppercase tracking-wider ml-2`}>
      <Icon className="w-3 h-3" />
      <span>{currentBadge.text}</span>
    </div>
  );
}
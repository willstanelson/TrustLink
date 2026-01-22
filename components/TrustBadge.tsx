import { useEffect, useState } from 'react';
import { Shield, Award, Zap, Crown, User, LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// 1. Define the Levels safely
const badges: Record<string, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  NEW: { icon: User, color: 'text-slate-400', bg: 'bg-slate-800', label: 'New Member' },
  BRONZE: { icon: Shield, color: 'text-amber-700', bg: 'bg-amber-900/30', label: 'Bronze Trader' },
  SILVER: { icon: Award, color: 'text-slate-300', bg: 'bg-slate-700/50', label: 'Silver Expert' },
  GOLD: { icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-900/30', label: 'Gold Legend' },
  LEGEND: { icon: Crown, color: 'text-purple-400', bg: 'bg-purple-900/30', label: 'Trust Whale' },
};

export default function TrustBadge({ address }: { address: string }) {
  const [volume, setVolume] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrust() {
      if (!address) return;
      
      // Fetch completed orders for this address (as seller)
      const { data, error } = await supabase
        .from('escrow_orders')
        .select('amount, status')
        .eq('seller_address', address)
        .eq('status', 'completed'); // Only count completed deals

      if (error || !data) {
        setVolume(0);
      } else {
        // Calculate total volume (Simplified logic: assuming 1 ETH = $2500 for now)
        // In prod, you'd store the USD value in the DB.
        const totalEth = data.reduce((acc, order) => acc + (Number(order.amount) / 1e18), 0);
        setVolume(totalEth * 2500); // Approx USD value
      }
      setLoading(false);
    }
    fetchTrust();
  }, [address]);

  // 2. The Logic Leveler
  const getLevel = (vol: number) => {
    if (vol >= 50000) return 'LEGEND';
    if (vol >= 10000) return 'GOLD';
    if (vol >= 1000) return 'SILVER';
    if (vol >= 100) return 'BRONZE';
    return 'NEW';
  };

  if (loading) return <div className="h-4 w-12 bg-slate-800 rounded animate-pulse" />;

  const level = getLevel(volume);
  
  // 3. THE SAFETY NET (The Fix)
  // If for some reason the level doesn't exist, fallback to 'NEW'
  const currentBadge = badges[level] || badges['NEW'];
  const Icon = currentBadge.icon;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/5 ${currentBadge.bg} ${currentBadge.color}`}>
      <Icon className="w-3 h-3" />
      <span className="text-[10px] font-bold uppercase tracking-wider">{currentBadge.label}</span>
    </div>
  );
}
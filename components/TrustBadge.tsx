import { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, AlertCircle, Skull } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function TrustBadge({ address }: { address: string }) {
    const [profile, setProfile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!address) return;
        const fetchProfile = async () => {
            setIsLoading(true);
            const { data } = await supabase.from('profiles').select('*').eq('id', address.toLowerCase()).single();
            setProfile(data || { isNew: true });
            setIsLoading(false);
        };
        fetchProfile();
    }, [address]);

    if (isLoading) return <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />;

    const total = profile?.total_orders || 0;
    const success = profile?.successful_orders || 0;
    const lost = profile?.disputes_lost || 0;
    const scams = profile?.severe_strikes || 0;
    
    // 🔥 THE REPUTATION NUKE: One severe strike = 0% Trust instantly
    let score = total > 0 ? Math.round((success / total) * 100) : null;
    if (scams > 0) score = 0; 
    
    const isNew = total === 0 || score === null;

    const displayName = profile?.display_name || (address.length > 15 ? `${address.slice(0,6)}...${address.slice(-4)}` : address);
    const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${address.toLowerCase()}`;

    let badgeColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (score !== null && score < 80 && score > 0) badgeColor = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    else if (score === 0) badgeColor = "bg-red-500/20 text-red-500 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]"; // Red Alert for Scammers

    return (
        <div className="flex items-center gap-3 bg-slate-900/50 py-1.5 px-3 rounded-lg border border-slate-700/50">
            <img src={avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full bg-slate-800 border border-slate-600 object-cover" />
            <span className="font-bold text-white text-xs">{displayName}</span>
            
            {isNew ? (
                <div className="flex items-center gap-1 bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700 text-[9px] font-bold">
                    <AlertCircle className="w-2.5 h-2.5" /> NEW USER
                </div>
            ) : (
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold ${badgeColor}`} title={`${total} Total Trades, ${lost} Normal Disputes, ${scams} Scams`}>
                    {score === 0 ? <Skull className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />} 
                    TRUST: {score}%
                </div>
            )}
        </div>
    );
}
import { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function TrustBadge({ address }: { address: string }) {
    const [score, setScore] = useState<number | null>(null);
    const [totalTrades, setTotalTrades] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!address) return;

        const fetchTrustScore = async () => {
            setIsLoading(true);
            try {
                // Fetch the user's profile using their wallet address or email
                const { data, error } = await supabase
                    .from('profiles')
                    .select('total_orders, successful_orders')
                    .eq('id', address.toLowerCase())
                    .single();

                if (error || !data) {
                    // No profile found = No trades yet
                    setScore(null);
                    setTotalTrades(0);
                } else {
                    const total = Number(data.total_orders) || 0;
                    const success = Number(data.successful_orders) || 0;
                    
                    setTotalTrades(total);
                    if (total > 0) {
                        setScore(Math.round((success / total) * 100));
                    } else {
                        setScore(null);
                    }
                }
            } catch (err) {
                console.error("Error fetching trust score", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTrustScore();
    }, [address]);

    if (isLoading) {
        return <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />;
    }

    if (totalTrades === 0 || score === null) {
        return (
            <div className="flex items-center gap-1 bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700 text-[9px] font-bold">
                <AlertCircle className="w-2.5 h-2.5" />
                NEW USER
            </div>
        );
    }

    // Determine colors based on how good their score is
    let badgeColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    let iconColor = "text-emerald-400";

    if (score < 80 && score >= 50) {
        badgeColor = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
        iconColor = "text-yellow-400";
    } else if (score < 50) {
        badgeColor = "bg-red-500/20 text-red-400 border-red-500/30";
        iconColor = "text-red-400";
    }

    return (
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold transition-all cursor-help ${badgeColor}`} title={`${totalTrades} Total Trades`}>
            <ShieldCheck className={`w-2.5 h-2.5 ${iconColor}`} />
            TRUST: {score}%
        </div>
    );
}
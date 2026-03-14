'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, CheckCircle2, XCircle, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';

export default function VerificationCard({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    
    // ✅ NEXT.JS 15+ FIX: Unwrap the params Promise using React.use()
    const resolvedParams = use(params); 
    
    const [stats, setStats] = useState({ total: 0, successful: 0, lost: 0, score: 0 });
    const [isLoading, setIsLoading] = useState(true);

    const decodedId = decodeURIComponent(resolvedParams.id).toLowerCase();
    const isEmail = decodedId.includes('@');

    useEffect(() => {
        const fetchReputation = async () => {
            const { data } = await supabase.from('profiles').select('*').eq('id', decodedId).single();
            if (data) {
                const total = Number(data.total_orders) || 0;
                const success = Number(data.successful_orders) || 0;
                setStats({ total, successful: success, lost: Number(data.disputes_lost) || 0, score: total > 0 ? Math.round((success / total) * 100) : 0 });
            }
            setIsLoading(false);
        };
        fetchReputation();
    }, [decodedId]);

    if (isLoading) return <div className="min-h-screen bg-[#0f172a] flex justify-center items-center"><Loader2 className="animate-spin text-emerald-500 w-8 h-8"/></div>;

    return (
        <div className="min-h-screen bg-[#0f172a] flex flex-col items-center pt-20 px-4 font-sans">
            <button onClick={() => router.back()} className="absolute top-8 left-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-bold text-sm">
                <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="w-full max-w-md bg-slate-800/50 border border-slate-700 rounded-3xl p-8 backdrop-blur-sm shadow-2xl text-center relative overflow-hidden">
                {/* Visual Trust Indicator background glow */}
                <div className={`absolute -top-20 -left-20 w-40 h-40 blur-[80px] rounded-full ${stats.total === 0 ? 'bg-slate-500/20' : stats.score >= 80 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}></div>

                <div className="relative z-10">
                    <img 
                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${decodedId}`} 
                        alt="Avatar" 
                        className="w-24 h-24 mx-auto rounded-full bg-slate-900 border-4 border-slate-800 shadow-xl mb-4" 
                    />
                    
                    <h2 className="text-xl font-mono font-bold text-white mb-1 truncate px-4">{decodedId}</h2>
                    <p className="text-sm text-slate-400 mb-8">{isEmail ? "Fiat User" : "Crypto Wallet"}</p>

                    {stats.total === 0 ? (
                        <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6 mb-8">
                            <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                            <h3 className="font-bold text-white text-lg">New User</h3>
                            <p className="text-xs text-slate-400 mt-1">This user has not completed any escrows yet. Proceed with standard caution.</p>
                        </div>
                    ) : (
                        <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6 mb-8 text-left flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Trust Score</p>
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className={`w-6 h-6 ${stats.score >= 80 ? 'text-emerald-500' : 'text-yellow-500'}`} />
                                    <span className={`text-3xl font-extrabold ${stats.score >= 80 ? 'text-emerald-500' : 'text-yellow-500'}`}>{stats.score}%</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="flex items-center gap-1.5 justify-end text-sm text-slate-300 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> {stats.successful}</div>
                                <div className="flex items-center gap-1.5 justify-end text-sm text-slate-300"><XCircle className="w-4 h-4 text-red-500"/> {stats.lost}</div>
                            </div>
                        </div>
                    )}

                    <button 
                        onClick={() => {
                            const targetMode = isEmail ? 'fiat' : 'crypto';
                            router.push(`/dashboard?seller=${encodeURIComponent(decodedId)}&autoMode=${targetMode}`);
                        }} 
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 text-lg group"
                    >
                        Start Escrow <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
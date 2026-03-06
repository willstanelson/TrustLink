'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { 
    User, ShieldCheck, ArrowLeft, Loader2, Save, 
    Activity, CheckCircle2, XCircle
} from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
    const { user, authenticated, ready } = usePrivy();
    const router = useRouter();

    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [stats, setStats] = useState({ total: 0, successful: 0, lost: 0, score: 0 });
    const [notification, setNotification] = useState<{message: string, type: 'success'|'error'} | null>(null);

    // Get the primary identifier (Wallet for Crypto, Email for Fiat)
    const userId = user?.wallet?.address?.toLowerCase() || user?.email?.address?.toLowerCase();

    // Automatically generate a unique avatar if they don't have one
    const displayAvatar = avatarUrl || (userId ? `https://api.dicebear.com/7.x/pixel-art/svg?seed=${userId}` : '');

    useEffect(() => {
        if (!ready) return;
        if (!authenticated || !userId) {
            router.push('/'); // Kick them out if not logged in
            return;
        }
        fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authenticated, ready, userId]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const fetchProfile = async () => {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        
        if (data) {
            setDisplayName(data.display_name || '');
            setAvatarUrl(data.avatar_url || '');
            
            const total = Number(data.total_orders) || 0;
            const success = Number(data.successful_orders) || 0;
            const lost = Number(data.disputes_lost) || 0;
            
            setStats({
                total,
                successful: success,
                lost: lost,
                score: total > 0 ? Math.round((success / total) * 100) : 0
            });
        }
    };

    const saveProfile = async () => {
        if (!userId) return;
        setIsSaving(true);
        
        const { error } = await supabase.from('profiles').upsert({
            id: userId,
            display_name: displayName,
            avatar_url: avatarUrl,
            // We do NOT update stats here. Only the smart contract / backend API should update stats!
        }, { onConflict: 'id' });

        setIsSaving(false);

        if (error) {
            showToast(error.message, 'error');
        } else {
            showToast('Profile updated successfully!', 'success');
        }
    };

    if (!ready || !authenticated) return <div className="min-h-screen bg-[#0f172a] flex justify-center items-center"><Loader2 className="animate-spin text-emerald-500 w-8 h-8"/></div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white font-sans pb-20">
            {notification && (
                <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
                    <p className="text-sm font-bold">{notification.message}</p>
                </div>
            )}

            <nav className="flex items-center px-6 py-6 max-w-4xl mx-auto w-full">
                <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors font-bold text-sm">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Link>
            </nav>

            <main className="max-w-3xl mx-auto px-4 mt-4">
                <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8 backdrop-blur-sm shadow-2xl">
                    
                    {/* PROFILE HEADER */}
                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-start mb-10 pb-10 border-b border-slate-700">
                        <div className="relative group">
                            <img src={displayAvatar} alt="Avatar" className="w-32 h-32 rounded-2xl border-4 border-slate-700 object-cover shadow-xl bg-slate-900" />
                        </div>
                        
                        <div className="flex-1 w-full text-center md:text-left">
                            <h1 className="text-3xl font-extrabold mb-2">{displayName || "Anonymous User"}</h1>
                            <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 mb-4">
                                <User className="w-3.5 h-3.5 text-emerald-500" />
                                {userId}
                            </div>
                            
                            {/* TRUST SCORE METER */}
                            <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-700">
                                <div className="flex justify-between items-end mb-2">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className={`w-5 h-5 ${stats.score >= 80 ? 'text-emerald-500' : stats.score >= 50 ? 'text-yellow-500' : 'text-slate-500'}`} />
                                        <span className="font-bold text-slate-300">Trust Score</span>
                                    </div>
                                    <span className={`text-2xl font-extrabold ${stats.score >= 80 ? 'text-emerald-500' : stats.score >= 50 ? 'text-yellow-500' : 'text-slate-500'}`}>
                                        {stats.total > 0 ? `${stats.score}%` : 'N/A'}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-1000 ${stats.score >= 80 ? 'bg-emerald-500' : stats.score >= 50 ? 'bg-yellow-500' : 'bg-slate-600'}`} style={{ width: `${stats.total > 0 ? stats.score : 0}%` }}></div>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2 text-right uppercase tracking-wider">Based on {stats.total} total orders</p>
                            </div>
                        </div>
                    </div>

                    {/* EDIT PROFILE FORM */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-5">
                            <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><User className="w-5 h-5 text-emerald-500"/> Edit Identity</h3>
                            
                            <div>
                                <label className="text-xs text-slate-400 font-bold ml-1">DISPLAY NAME</label>
                                <input 
                                    value={displayName} 
                                    onChange={(e) => setDisplayName(e.target.value)} 
                                    placeholder="e.g. TrustLink Trader" 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all text-sm" 
                                />
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 font-bold ml-1">CUSTOM AVARAR URL (Optional)</label>
                                <input 
                                    value={avatarUrl} 
                                    onChange={(e) => setAvatarUrl(e.target.value)} 
                                    placeholder="https://imgur.com/your-image.png" 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all text-sm" 
                                />
                                <p className="text-[10px] text-slate-500 mt-1 ml-1">Leave blank to use your auto-generated Pixel Avatar.</p>
                            </div>

                            <button 
                                onClick={saveProfile} 
                                disabled={isSaving} 
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
                            >
                                {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <><Save className="w-5 h-5" /> Save Profile</>}
                            </button>
                        </div>

                        {/* STATS OVERVIEW */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Activity className="w-5 h-5 text-blue-500"/> Transaction History</h3>
                            
                            <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-500/20 p-2 rounded-lg"><CheckCircle2 className="w-5 h-5 text-emerald-500"/></div>
                                    <span className="font-bold text-slate-300 text-sm">Successful Escrows</span>
                                </div>
                                <span className="text-xl font-extrabold text-white">{stats.successful}</span>
                            </div>

                            <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-red-500/20 p-2 rounded-lg"><XCircle className="w-5 h-5 text-red-500"/></div>
                                    <span className="font-bold text-slate-300 text-sm">Disputes Lost</span>
                                </div>
                                <span className="text-xl font-extrabold text-white">{stats.lost}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
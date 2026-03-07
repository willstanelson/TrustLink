'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { 
    User, ShieldCheck, Loader2, Save, 
    Activity, CheckCircle2, XCircle, Search, 
    Edit3, LayoutDashboard, Award, Wallet, LogOut
} from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
    const { user, authenticated, ready, login, logout } = usePrivy();
    const router = useRouter();

    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false); // Toggle edit mode
    const [stats, setStats] = useState({ total: 0, successful: 0, lost: 0, score: 0 });
    const [notification, setNotification] = useState<{message: string, type: 'success'|'error'} | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const userId = user?.wallet?.address?.toLowerCase() || user?.email?.address?.toLowerCase();
    const displayAvatar = avatarUrl || (userId ? `https://api.dicebear.com/7.x/pixel-art/svg?seed=${userId}` : '');

    useEffect(() => {
        if (!ready) return;
        if (!authenticated || !userId) {
            router.push('/'); 
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
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) {
            setDisplayName(data.display_name || '');
            setAvatarUrl(data.avatar_url || '');
            const total = Number(data.total_orders) || 0;
            const success = Number(data.successful_orders) || 0;
            const lost = Number(data.disputes_lost) || 0;
            setStats({ total, successful: success, lost, score: total > 0 ? Math.round((success / total) * 100) : 0 });
        }
    };

    const saveProfile = async () => {
        if (!userId) return;
        setIsSaving(true);
        const { error } = await supabase.from('profiles').upsert({
            id: userId,
            display_name: displayName,
            avatar_url: avatarUrl,
        }, { onConflict: 'id' });

        setIsSaving(false);
        if (error) showToast(error.message, 'error');
        else {
            showToast('Profile updated successfully!', 'success');
            setIsEditing(false); // Close edit mode on save
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery) return;
        showToast(`Searching for ${searchQuery}... (Feature coming next!)`, 'success');
        // router.push(`/user/${searchQuery}`);
    };

    if (!ready || !authenticated) return <div className="min-h-screen bg-[#0f172a] flex justify-center items-center"><Loader2 className="animate-spin text-emerald-500 w-8 h-8"/></div>;

    return (
        <div className="min-h-screen bg-[#0f172a] text-white font-sans pb-20">
            {notification && (
                <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
                    <p className="text-sm font-bold">{notification.message}</p>
                </div>
            )}

            {/* REPOLISHED TOP NAVBAR */}
            <nav className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
                    {/* Logo & Search */}
                    <div className="flex items-center gap-8 flex-1">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center rotate-3"><ShieldCheck className="w-5 h-5 text-white" /></div>
                            <span className="text-xl font-bold hidden md:block">TrustLink</span>
                        </Link>

                        <form onSubmit={handleSearch} className="hidden md:flex items-center bg-slate-900 border border-slate-700 rounded-full px-4 py-2 w-full max-w-md focus-within:border-emerald-500 transition-all shadow-inner">
                            <Search className="w-4 h-4 text-slate-500 mr-2" />
                            <input 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search users by wallet or email..." 
                                className="bg-transparent border-none outline-none text-sm w-full text-slate-300 placeholder-slate-500"
                            />
                        </form>
                    </div>

                    {/* Navigation Links */}
                    <div className="flex items-center gap-3 md:gap-6">
                        <Link href="/dashboard" className="text-slate-400 hover:text-emerald-400 text-sm font-bold flex items-center gap-2 transition-colors"><LayoutDashboard className="w-4 h-4"/> <span className="hidden sm:inline">Dashboard</span></Link>
                        <Link href="/rewards" className="text-slate-400 hover:text-emerald-400 text-sm font-bold flex items-center gap-2 transition-colors"><Award className="w-4 h-4"/> <span className="hidden sm:inline">Rewards</span></Link>
                        
                        <div className="h-6 w-px bg-slate-700 mx-2 hidden md:block"></div>

                        <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 sm:px-4 py-2 rounded-full transition-all">
                            <span className="font-mono text-xs sm:text-sm font-bold truncate max-w-[100px] sm:max-w-[120px]">
                                {user?.email?.address ? user.email.address.split('@')[0] : (userId ? `${userId.slice(0,6)}...${userId.slice(-4)}` : "Wallet")}
                            </span>
                            <Wallet className="w-4 h-4 text-emerald-400" />
                        </button>
                        <button onClick={logout} className="text-slate-500 hover:text-red-400 transition-colors"><LogOut className="w-5 h-5" /></button>
                    </div>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-4 mt-8">
                
                {/* ABSTRACT-STYLE PROFILE BANNER */}
                <div className="bg-[#1e293b] rounded-[2rem] overflow-hidden border border-slate-800 shadow-2xl relative">
                    {/* The Banner Background (Using a cool gradient instead of an image for now) */}
                    <div className="h-48 w-full bg-gradient-to-r from-emerald-500 via-teal-600 to-slate-900 object-cover opacity-80"></div>
                    
                    <div className="px-6 sm:px-10 pb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end relative">
                        {/* Overlapping Avatar & Info */}
                        <div className="flex items-end gap-6 -mt-16 sm:-mt-20 z-10">
                            <img src={displayAvatar} alt="Avatar" className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-[6px] border-[#1e293b] bg-slate-900 object-cover shadow-xl" />
                            <div className="mb-2 sm:mb-4">
                                <h1 className="text-2xl sm:text-4xl font-extrabold text-white">{displayName || "Anonymous User"}</h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={`w-2 h-2 rounded-full ${stats.score >= 80 ? 'bg-emerald-500' : 'bg-yellow-500'}`}></div>
                                    <span className="text-slate-400 text-xs sm:text-sm font-mono">{userId}</span>
                                </div>
                            </div>
                        </div>

                        {/* Edit Button */}
                        <button 
                            onClick={() => setIsEditing(!isEditing)}
                            className="mt-6 sm:mt-0 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg"
                        >
                            <Edit3 className="w-4 h-4" /> {isEditing ? "Cancel" : "Edit Profile"}
                        </button>
                    </div>
                </div>

                {/* CONTENT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                    
                    {/* LEFT COLUMN: Edit Form OR Transaction History Tabs */}
                    <div className="lg:col-span-2">
                        {isEditing ? (
                            <div className="bg-[#1e293b] rounded-3xl p-8 border border-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                                <h3 className="text-xl font-bold flex items-center gap-2 mb-6"><User className="w-5 h-5 text-emerald-500"/> Edit Identity</h3>
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs text-slate-400 font-bold ml-1 uppercase">Display Name</label>
                                        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. TrustLink Trader" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 font-bold ml-1 uppercase">Custom Avatar URL</label>
                                        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://imgur.com/your-image.png" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all text-sm" />
                                    </div>
                                    <button onClick={saveProfile} disabled={isSaving} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-2">
                                        {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <><Save className="w-5 h-5" /> Save Changes</>}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-[#1e293b] rounded-3xl p-8 border border-slate-800 shadow-xl min-h-[300px]">
                                {/* Abstract style internal tabs */}
                                <div className="flex gap-6 border-b border-slate-700 pb-4 mb-6">
                                    <button className="text-emerald-400 font-bold border-b-2 border-emerald-400 pb-4 -mb-[18px]">Transaction History</button>
                                    <button className="text-slate-500 font-bold hover:text-slate-300 transition-colors pb-4 -mb-[18px]">Active Escrows</button>
                                </div>
                                
                                <div className="text-center text-slate-500 py-10">
                                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p className="font-bold">History view coming soon.</p>
                                    <p className="text-xs mt-1">Check your dashboard for active orders.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Trust Score & Quick Stats */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-[#1e293b] rounded-3xl p-6 border border-slate-800 shadow-xl">
                            <h3 className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-4 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500"/> Trust Score</h3>
                            <div className="flex items-end gap-2 mb-2">
                                <span className={`text-5xl font-extrabold ${stats.score >= 80 ? 'text-emerald-500' : stats.score >= 50 ? 'text-yellow-500' : 'text-slate-400'}`}>
                                    {stats.total > 0 ? `${stats.score}%` : 'N/A'}
                                </span>
                            </div>
                            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-4">
                                <div className={`h-full transition-all duration-1000 ${stats.score >= 80 ? 'bg-emerald-500' : stats.score >= 50 ? 'bg-yellow-500' : 'bg-slate-600'}`} style={{ width: `${stats.total > 0 ? stats.score : 0}%` }}></div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 text-right uppercase tracking-wider">Based on {stats.total} total orders</p>
                        </div>

                        <div className="bg-[#1e293b] rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-500/10 p-2 rounded-lg"><CheckCircle2 className="w-4 h-4 text-emerald-500"/></div>
                                    <span className="font-bold text-slate-300 text-sm">Successful</span>
                                </div>
                                <span className="text-lg font-extrabold">{stats.successful}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-red-500/10 p-2 rounded-lg"><XCircle className="w-4 h-4 text-red-500"/></div>
                                    <span className="font-bold text-slate-300 text-sm">Disputed</span>
                                </div>
                                <span className="text-lg font-extrabold">{stats.lost}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
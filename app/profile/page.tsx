'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { 
    Loader2, Save, Activity, Search, 
    Edit3, LayoutDashboard, Award, Wallet, LogOut,
    Plus, Send, Download, Mail
} from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
    const { user, authenticated, ready, logout } = usePrivy();
    const router = useRouter();

    // Profile States
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false); 
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
        }
    };

    const saveProfile = async () => {
        if (!userId) return;
        setIsSaving(true);
        const { error } = await supabase.from('profiles').upsert({
            id: userId,
            display_name: displayName,
            avatar_url: avatarUrl
        }, { onConflict: 'id' });

        setIsSaving(false);
        if (error) showToast(error.message, 'error');
        else {
            showToast('Profile updated successfully!', 'success');
            setIsEditing(false); 
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery) return;
        showToast(`Searching for ${searchQuery}...`, 'success');
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
                    <div className="flex items-center gap-8 flex-1">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center rotate-3"><Wallet className="w-5 h-5 text-white" /></div>
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
                    <div className="h-48 w-full bg-gradient-to-r from-emerald-500 via-teal-600 to-slate-900 object-cover opacity-80"></div>
                    
                    <div className="px-6 sm:px-10 pb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end relative">
                        <div className="flex items-end gap-6 -mt-16 sm:-mt-20 z-10">
                            <img src={displayAvatar} alt="Avatar" className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-[6px] border-[#1e293b] bg-slate-900 object-cover shadow-xl" />
                            <div className="mb-2 sm:mb-4">
                                <h1 className="text-2xl sm:text-4xl font-extrabold text-white">{displayName || "Anonymous User"}</h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-slate-400 text-xs sm:text-sm font-mono">{userId}</span>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsEditing(!isEditing)}
                            className="mt-6 sm:mt-0 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg"
                        >
                            <Edit3 className="w-4 h-4" /> {isEditing ? "Close Editor" : "Edit Profile"}
                        </button>
                    </div>
                </div>

                {/* CONTENT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                    
                    {/* LEFT COLUMN: Edit Form OR Transaction History Tabs */}
                    <div className="lg:col-span-2">
                        {isEditing ? (
                            <div className="bg-[#1e293b] rounded-3xl p-8 border border-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold">Edit profile</h3>
                                    <button onClick={() => setIsEditing(false)} className="text-sm border border-slate-600 px-3 py-1 rounded-full hover:bg-slate-700">Close</button>
                                </div>
                                
                                <div className="space-y-8">
                                    {/* About Section */}
                                    <section>
                                        <h4 className="text-sm font-bold mb-3">About</h4>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-400 font-mono">
                                                <span className="truncate">{userId}</span>
                                                <button className="text-xs bg-slate-800 px-2 py-1 rounded hover:text-white transition-colors">Copy</button>
                                            </div>
                                            
                                            <div className="relative">
                                                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Add username..." maxLength={30} className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all text-sm" />
                                                <span className="absolute right-4 top-3 text-xs text-slate-500">{displayName.length}/30</span>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Email Settings */}
                                    <section>
                                        <h4 className="text-sm font-bold mb-3">Email for notifications</h4>
                                        <div className="flex items-center bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-400">
                                            <Mail className="w-4 h-4 mr-2 opacity-50"/>
                                            {user?.email?.address ? `${user.email.address} (Privy)` : "No email connected"}
                                        </div>
                                        <div className="flex items-center justify-between mt-4 px-1">
                                            <span className="text-sm text-slate-300">Receive notifications and updates</span>
                                            <button 
                                                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                                                className={`w-11 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`}></div>
                                            </button>
                                        </div>
                                    </section>

                                    {/* Social Links */}
                                    <section>
                                        <h4 className="text-sm font-bold mb-3">Social links</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3">
                                                <div className="flex items-center gap-2 text-sm text-slate-300"><span className="font-bold text-white">X</span> @TrustLinkUser</div>
                                                <button className="text-xs border border-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">Disconnect</button>
                                            </div>
                                            <div className="flex items-center justify-between bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3">
                                                <div className="flex items-center gap-2 text-sm text-slate-500"><span className="font-bold text-white">Discord</span> Not connected</div>
                                                <button className="text-xs bg-white text-black font-bold px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">Connect</button>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Save Button */}
                                    <div className="pt-4 border-t border-slate-800 flex justify-center">
                                        <button onClick={saveProfile} disabled={isSaving} className="bg-white hover:bg-slate-200 text-black font-bold py-3 px-8 rounded-full transition-all shadow-lg flex items-center justify-center gap-2">
                                            {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : "Save changes"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-[#1e293b] rounded-3xl p-8 border border-slate-800 shadow-xl min-h-[300px]">
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

                    {/* RIGHT COLUMN: The Abstract Wallet Balance Card */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-3xl p-8 shadow-xl text-black">
                            <h2 className="text-5xl font-light tracking-tight mb-8">$0.00</h2>
                            
                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between text-sm border-b border-slate-100 pb-4">
                                    <span className="text-slate-500">Tokens</span>
                                    <span className="font-medium">$0.00</span>
                                </div>
                                <div className="flex justify-between text-sm pb-2">
                                    <span className="text-slate-500">NFTs</span>
                                    <span className="font-medium">$0.00</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button className="flex-1 bg-black text-white text-xs font-bold py-3 rounded-full flex items-center justify-center gap-1 hover:bg-slate-800 transition-colors">
                                    <Plus className="w-4 h-4"/> Fund
                                </button>
                                <button className="flex-1 border border-slate-200 text-xs font-bold py-3 rounded-full flex items-center justify-center gap-1 hover:bg-slate-50 transition-colors">
                                    <Send className="w-4 h-4"/> Send
                                </button>
                                <button className="flex-1 border border-slate-200 text-xs font-bold py-3 rounded-full flex items-center justify-center gap-1 hover:bg-slate-50 transition-colors">
                                    <Download className="w-4 h-4"/> Receive
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
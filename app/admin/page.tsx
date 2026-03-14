'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert, CheckCircle, XCircle, ArrowLeft, Gavel } from 'lucide-react';
import Link from 'next/link';

// 🔥 SECURITY: Only these emails/wallets can view this page!
// Add your specific admin email or wallet addresses here.
const ADMIN_IDENTITIES = [
    'willstanelson@gmail.com', '0xefd09435E4c6cB6E3d0B40EC501e4FADdCEA0698'
];

export default function AdminDashboard() {
    const { user, authenticated, ready } = usePrivy();
    const router = useRouter();
    
    const [disputedOrders, setDisputedOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [resolvingId, setResolvingId] = useState<number | null>(null);

    // 1. Strict Security Check
    const userIdentity = user?.email?.address?.toLowerCase() || user?.wallet?.address?.toLowerCase();
    const isAdmin = userIdentity && ADMIN_IDENTITIES.map(id => id.toLowerCase()).includes(userIdentity);

    useEffect(() => {
        if (!ready) return;
        if (!authenticated || !isAdmin) {
            router.push('/dashboard'); // Kick out normal users instantly
            return;
        }
        fetchDisputes();
    }, [authenticated, ready, isAdmin, router]);

    // 2. Fetch only Disputed Orders
    const fetchDisputes = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('escrow_orders')
            .select('*')
            .eq('status', 'disputed')
            .order('created_at', { ascending: false });
            
        if (data) setDisputedOrders(data);
        setIsLoading(false);
    };

    // 3. The "God Mode" Resolution Buttons
    const handleResolve = async (orderId: number, resolution: 'completed' | 'refunded') => {
        const confirmMsg = resolution === 'completed' 
            ? "WARNING: You are forcing the funds to the SELLER. Are you sure?" 
            : "WARNING: You are forcing a refund to the BUYER. Are you sure?";
            
        if (!window.confirm(confirmMsg)) return;

        setResolvingId(orderId);
        
        // Update the database to the resolved status
        const { error } = await supabase
            .from('escrow_orders')
            .update({ status: resolution })
            .eq('id', orderId);

        setResolvingId(null);
        
        if (!error) {
            alert(`Order successfully resolved as: ${resolution}`);
            fetchDisputes(); // Refresh the list
        } else {
            alert(`Error: ${error.message}`);
        }
    };

    if (!ready || isLoading) return <div className="min-h-screen bg-[#0f172a] flex justify-center items-center"><Loader2 className="animate-spin text-emerald-500 w-8 h-8"/></div>;
    
    // Safety fallback (should never render because of the router.push above)
    if (!isAdmin) return null; 

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white font-sans pb-20">
            {/* Minimal Admin Header */}
            <nav className="border-b border-red-500/20 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5"/></Link>
                        <div className="bg-red-500/20 p-2 rounded-lg border border-red-500/30"><Gavel className="w-5 h-5 text-red-400" /></div>
                        <span className="text-xl font-black tracking-tight text-white">TrustLink <span className="text-red-400 font-mono text-sm uppercase tracking-widest ml-2">Admin Terminal</span></span>
                    </div>
                    <span className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-xs font-mono text-slate-400">{userIdentity}</span>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-4 mt-10">
                <div className="mb-8 border-b border-slate-800 pb-4">
                    <h1 className="text-3xl font-extrabold flex items-center gap-3"><ShieldAlert className="w-8 h-8 text-yellow-500"/> Active Disputes</h1>
                    <p className="text-slate-400 mt-2">Review and resolve locked transactions. Actions taken here are final.</p>
                </div>

                {disputedOrders.length === 0 ? (
                    <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-3xl p-12 text-center flex flex-col items-center">
                        <CheckCircle className="w-16 h-16 text-emerald-500/50 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Zero Active Disputes</h3>
                        <p className="text-slate-400">The platform is running smoothly. All escrows are secure.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {disputedOrders.map((order) => (
                            <div key={order.id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
                                {/* Top Banner of the Card */}
                                <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-4 flex justify-between items-center">
                                    <span className="font-mono text-sm text-slate-400">Order ID: #{order.id}</span>
                                    <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase px-3 py-1 rounded-full animate-pulse">Action Required</span>
                                </div>
                                
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {/* Amount */}
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Locked Value</p>
                                        <p className="text-2xl font-black text-white">{order.paystack_ref ? '₦' : ''}{Number(order.amount).toLocaleString()}</p>
                                    </div>
                                    {/* Buyer */}
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Buyer (Paid)</p>
                                        <p className="text-sm font-mono bg-slate-900 p-2 rounded-lg border border-slate-700 text-blue-400 truncate" title={order.buyer_email || order.buyer_wallet_address}>{order.buyer_email || order.buyer_wallet_address}</p>
                                    </div>
                                    {/* Seller */}
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Seller (Waiting)</p>
                                        <p className="text-sm font-mono bg-slate-900 p-2 rounded-lg border border-slate-700 text-emerald-400 truncate" title={order.seller_email || order.seller_name}>{order.seller_email || order.seller_name}</p>
                                    </div>
                                    {/* Admin Actions */}
                                    <div className="flex flex-col gap-2 justify-center">
                                        <button 
                                            disabled={resolvingId === order.id}
                                            onClick={() => handleResolve(order.id, 'completed')}
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all flex justify-center items-center gap-2"
                                        >
                                            {resolvingId === order.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4" />} Rule for Seller
                                        </button>
                                        <button 
                                            disabled={resolvingId === order.id}
                                            onClick={() => handleResolve(order.id, 'refunded')}
                                            className="w-full bg-slate-700 hover:bg-red-600 border border-slate-600 hover:border-red-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all flex justify-center items-center gap-2"
                                        >
                                            {resolvingId === order.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <XCircle className="w-4 h-4" />} Rule for Buyer (Refund)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
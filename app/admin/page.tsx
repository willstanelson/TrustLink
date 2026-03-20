'use client';

import { useState, useMemo, useEffect } from 'react';
import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { formatEther, formatUnits } from 'viem';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/app/constants';
import { Loader2, CheckCircle, ShieldAlert, Skull, ArrowLeft, Gavel, XCircle, AlertTriangle } from 'lucide-react'; 
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// 🔒 THE ONLY IDENTITIES ALLOWED IN
const ADMIN_WALLETS = ["0xefd09435E4c6cB6E3d0B40EC501e4FADdCEA0698".toLowerCase()];
const ADMIN_EMAILS = ["willstanelson@gmail.com".toLowerCase()];

export default function AdminPage() {
  const { address, isConnected, isConnecting } = useAccount();
  const { user, authenticated, ready } = usePrivy();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<'FIAT' | 'CRYPTO'>('FIAT');

  const [fiatDisputes, setFiatDisputes] = useState<any[]>([]);
  const [isLoadingFiat, setIsLoadingFiat] = useState(true);
  const [resolvingFiatId, setResolvingFiatId] = useState<number | null>(null);

  useEffect(() => { setIsClient(true); }, []);

  const userAddress = address ? address.toLowerCase() : "";
  const userEmail = user?.email?.address?.toLowerCase() || "";
  const isAuthorized = (isConnected && ADMIN_WALLETS.includes(userAddress)) || 
                       (authenticated && ADMIN_EMAILS.includes(userEmail));

  // ==========================================
  // CRYPTO LOGIC (WAGMI)
  // ==========================================
  const { data: totalEscrows } = useReadContract({
    abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrowCount',
    query: { enabled: isAuthorized, refetchInterval: 5000 }
  });

  const count = totalEscrows ? Number(totalEscrows) : 0;
  const indexesToFetch = useMemo(() => {
    const idxs = [];
    for (let i = count; i > 0; i--) idxs.push(i);
    return idxs;
  }, [count]);

  const { data: escrowsData, refetch: refetchCrypto } = useReadContracts({
    contracts: indexesToFetch.map((id) => ({
      abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrows', args: [BigInt(id)]
    })),
    query: { enabled: isAuthorized, refetchInterval: 10000 }
  });

  // Added 'seller' to the state so we know who to nuke
  const [adminAction, setAdminAction] = useState<{ id: bigint, type: 'RELEASE' | 'REFUND' | 'NUKE' | 'DISPUTE', seller?: string } | null>(null);
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      alert("Crypto Order Action Successful!");
      setAdminAction(null);
      refetchCrypto();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  // ==========================================
  // FIAT LOGIC (SUPABASE)
  // ==========================================
  const fetchFiatDisputes = async () => {
    setIsLoadingFiat(true);
    const { data } = await supabase.from('escrow_orders').select('*').eq('status', 'disputed').order('created_at', { ascending: false });
    if (data) setFiatDisputes(data);
    setIsLoadingFiat(false);
  };

  useEffect(() => { if (isAuthorized) fetchFiatDisputes(); }, [isAuthorized]);

  const handleResolveFiat = async (order: any, resolution: 'completed' | 'refunded', isNuke: boolean = false) => {
      const confirmMsg = isNuke ? "WARNING: This will refund the buyer AND permanently drop the seller's trust score to 0%. Proceed?" : 
                         resolution === 'completed' ? "Force funds to SELLER?" : "Force standard refund to BUYER?";
      if (!window.confirm(confirmMsg)) return;

      setResolvingFiatId(order.id);

      // 🔥 FIRE THE REPUTATION NUKE
      if (isNuke) {
          const sellerId = order.seller_email?.toLowerCase() || order.seller_wallet_address?.toLowerCase();
          if (sellerId) {
              const { data } = await supabase.from('profiles').select('severe_strikes').eq('id', sellerId).single();
              await supabase.from('profiles').update({ severe_strikes: (data?.severe_strikes || 0) + 1 }).eq('id', sellerId);
          }
      }

      const { error } = await supabase.from('escrow_orders').update({ status: resolution }).eq('id', order.id);
      setResolvingFiatId(null);
      
      if (!error) {
          alert(`Fiat order resolved: ${resolution} ${isNuke ? '(Seller Nuked)' : ''}`);
          fetchFiatDisputes(); 
      } else alert(`Error: ${error.message}`);
  };

  const executeCryptoAdminAction = async () => {
    if (!adminAction) return;
    
    // 🔥 FIRE THE REPUTATION NUKE FOR CRYPTO
    if (adminAction.type === 'NUKE' && adminAction.seller) {
        const sellerId = adminAction.seller.toLowerCase();
        const { data } = await supabase.from('profiles').select('severe_strikes').eq('id', sellerId).single();
        await supabase.from('profiles').update({ severe_strikes: (data?.severe_strikes || 0) + 1 }).eq('id', sellerId);
    }

    const functionName = adminAction.type === 'RELEASE' ? 'releaseMilestone' : (adminAction.type === 'REFUND' || adminAction.type === 'NUKE') ? 'cancelOrder' : 'raiseDispute';
    const args = adminAction.type === 'RELEASE' ? [adminAction.id, BigInt(100)] : [adminAction.id];
    writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName, args: args as any });
  };

  // ==========================================
  // RENDER CHECKS
  // ==========================================
  if (!isClient || isConnecting || !ready) return <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (!isAuthorized) {
      return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4 font-sans relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black"></div>
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="bg-red-600/20 p-6 rounded-full mb-8 border-2 border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.5)] animate-pulse">
                    <Skull className="w-20 h-20 text-red-600" />
                </div>
                <h1 className="text-6xl font-black text-white mb-4 tracking-tighter uppercase">Wrong Turn.</h1>
                <p className="text-red-500 font-mono text-lg mb-8 max-w-lg font-bold">This area is restricted. If you're looking for trouble, you found it. <br/><br/><span className="text-slate-400 font-normal">Now get the f*** outta here.</span></p>
                <button onClick={() => router.push('/')} className="group relative px-8 py-4 bg-white text-black font-black text-lg uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all duration-300 skew-x-[-10deg]"><span className="block skew-x-[10deg]">Exit Immediately</span></button>
              </div>
          </div>
      );
  }

  const cryptoOrders = escrowsData ? escrowsData.map((result, index) => {
      if (result.status !== 'success') return null;
      const e = result.result as any;
      const id = indexesToFetch[index];
      const tokenAddr = String(e[3]);
      const isEth = tokenAddr === ZERO_ADDRESS;
      const totalAmount = BigInt(e[4]);
      return {
        id, buyer: String(e[1]), seller: String(e[2]),
        amount: isEth ? formatEther(totalAmount) : formatUnits(totalAmount, 6), symbol: isEth ? 'ETH' : 'USDC',
        isDisputed: e[8], isCompleted: e[9], status: e[9] ? 'COMPLETED' : e[8] ? 'DISPUTED' : 'ACTIVE'
      };
    }).filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-[#0f172a] text-white pb-20 font-sans">
      <nav className="border-b border-red-500/20 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5"/></Link>
                  <div className="bg-red-500/20 p-2 rounded-lg border border-red-500/30"><Gavel className="w-5 h-5 text-red-400" /></div>
                  <span className="text-xl font-black tracking-tight text-white hidden sm:block">TrustLink <span className="text-red-400 font-mono text-sm uppercase tracking-widest ml-2">Admin Terminal</span></span>
              </div>
              <span className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-xs font-mono text-slate-400 truncate max-w-[150px] sm:max-w-xs">{userEmail || userAddress}</span>
          </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        <div className="flex gap-6 border-b border-slate-800 mb-6 mt-8">
            <button onClick={() => setActiveTab('FIAT')} className={`text-lg font-bold pb-4 border-b-2 transition-all ${activeTab === 'FIAT' ? 'border-red-500 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Fiat Database Orders</button>
            <button onClick={() => setActiveTab('CRYPTO')} className={`text-lg font-bold pb-4 border-b-2 transition-all ${activeTab === 'CRYPTO' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Crypto Smart Contract Orders</button>
        </div>

        {/* TAB 1: FIAT DISPUTES */}
        {activeTab === 'FIAT' && (
            <div className="space-y-6">
                {isLoadingFiat ? <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin"/></div> : fiatDisputes.length === 0 ? (
                    <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-3xl p-12 text-center flex flex-col items-center">
                        <CheckCircle className="w-16 h-16 text-emerald-500/50 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Zero Fiat Disputes</h3>
                        <p className="text-slate-400">All local bank escrows are currently peaceful.</p>
                    </div>
                ) : (
                    fiatDisputes.map((order) => (
                        <div key={order.id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
                            <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-4 flex justify-between items-center">
                                <span className="font-mono text-sm text-slate-400">Order ID: #{order.id}</span>
                                <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase px-3 py-1 rounded-full animate-pulse">Action Required</span>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                                <div><p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Locked Value</p><p className="text-2xl font-black text-white">{order.paystack_ref ? '₦' : ''}{Number(order.amount).toLocaleString()}</p></div>
                                <div><p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Buyer</p><p className="text-[10px] font-mono bg-slate-900 p-2 rounded-lg border border-slate-700 text-blue-400 break-all">{order.buyer_email || order.buyer_wallet_address}</p></div>
                                <div><p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Seller</p><p className="text-[10px] font-mono bg-slate-900 p-2 rounded-lg border border-slate-700 text-emerald-400 break-all">{order.seller_email || order.seller_name}</p></div>
                                
                                <div className="col-span-1 lg:col-span-2 flex flex-col gap-2 justify-center">
                                    <button disabled={resolvingFiatId === order.id} onClick={() => handleResolveFiat(order, 'completed', false)} className="w-full bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white font-bold py-2 rounded-xl text-xs transition-all flex justify-center items-center gap-2">{resolvingFiatId === order.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <CheckCircle className="w-3 h-3" />} Rule for Seller</button>
                                    <div className="flex gap-2">
                                        <button disabled={resolvingFiatId === order.id} onClick={() => handleResolveFiat(order, 'refunded', false)} className="flex-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all flex justify-center items-center gap-1"><XCircle className="w-3 h-3" /> Std. Refund</button>
                                        <button disabled={resolvingFiatId === order.id} onClick={() => handleResolveFiat(order, 'refunded', true)} className="flex-1 bg-red-900/40 hover:bg-red-600 border border-red-500/50 text-red-400 hover:text-white font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all flex justify-center items-center gap-1 shadow-[0_0_10px_rgba(239,68,68,0.2)]"><Skull className="w-3 h-3" /> Scam: Nuke</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}

        {/* TAB 2: CRYPTO SMART CONTRACT */}
        {activeTab === 'CRYPTO' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl">
                <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold border-b border-slate-800">
                        <tr><th className="p-4">ID</th><th className="p-4">Value</th><th className="p-4">Participants</th><th className="p-4">Status</th><th className="p-4 text-right">Admin Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {cryptoOrders.length === 0 ? (
                            <tr><td colSpan={5} className="p-10 text-center text-slate-500 italic">No blockchain escrows found.</td></tr>
                        ) : (
                            cryptoOrders.map((order: any) => (
                                <tr key={order.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="p-4 font-mono text-slate-300">#{order.id}</td>
                                    <td className="p-4"><div className="font-bold">{order.amount} {order.symbol}</div></td>
                                    
                                    {/* 🔥 FIXED: FULL WALLET ADDRESSES DISPLAYED HERE */}
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1.5 font-mono">
                                            <span className="text-emerald-400/80 text-[10px] break-all">BUY: {order.buyer}</span>
                                            <span className="text-blue-400/80 text-[10px] break-all">SEL: {order.seller}</span>
                                        </div>
                                    </td>

                                    <td className="p-4"><span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${order.status === 'COMPLETED' ? 'bg-slate-800 text-slate-400 border border-slate-700' : order.status === 'DISPUTED' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>{order.status}</span></td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        {order.status === 'ACTIVE' && (<><button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'REFUND' })} className="px-3 py-1.5 bg-slate-800 hover:bg-red-900/50 border border-slate-700 hover:border-red-500 text-slate-300 hover:text-red-400 text-xs font-bold rounded-lg transition-colors">Refund</button><button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'DISPUTE' })} className="px-3 py-1.5 bg-slate-800 hover:bg-amber-900/50 border border-slate-700 hover:border-amber-500 text-slate-300 hover:text-amber-400 text-xs font-bold rounded-lg transition-colors">Dispute</button></>)}
                                        {order.status === 'DISPUTED' && (
                                            <>
                                                <button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'RELEASE' })} className="px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors">Force Release</button>
                                                <button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'REFUND', seller: order.seller })} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors">Std. Refund</button>
                                                <button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'NUKE', seller: order.seller })} className="px-3 py-1.5 bg-red-900/40 hover:bg-red-600 border border-red-500/50 text-red-400 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors shadow-[0_0_10px_rgba(239,68,68,0.2)] flex items-center gap-1"><Skull className="w-3 h-3"/> Scam: Nuke</button>
                                            </>
                                        )}
                                        {order.status === 'COMPLETED' && <span className="text-slate-600 text-xs font-bold flex items-center gap-1 justify-end"><CheckCircle className="w-3 h-3"/> Finalized</span>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        )}

      </main>

      {/* CRYPTO CONFIRMATION MODAL */}
      {adminAction && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className={`bg-slate-900 border ${adminAction.type === 'NUKE' ? 'border-red-500' : 'border-slate-700'} p-8 rounded-3xl max-w-sm w-full shadow-2xl`}>
               <h3 className="text-xl font-bold mb-2 text-white flex items-center gap-2">
                   {adminAction.type === 'NUKE' ? <Skull className="w-6 h-6 text-red-500 animate-pulse"/> : <AlertTriangle className="w-5 h-5 text-yellow-500"/>} 
                   Confirm Action
               </h3>
               <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                   Are you sure you want to execute a <span className={`font-bold text-white px-2 py-0.5 rounded mx-1 ${adminAction.type === 'NUKE' ? 'bg-red-600' : 'bg-slate-800'}`}>{adminAction.type}</span> on Smart Contract Order #{adminAction.id.toString()}?
                   {adminAction.type === 'NUKE' && <span className="block mt-2 text-red-400 font-bold">This will refund the buyer and permanently ruin the seller's trust score.</span>}
               </p>
               <div className="flex gap-3">
                   <button onClick={() => setAdminAction(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-3.5 rounded-xl font-bold text-sm transition-colors">Cancel</button>
                   <button onClick={executeCryptoAdminAction} disabled={isPending || isConfirming} className={`flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg ${adminAction.type === 'NUKE' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                       {isPending || isConfirming ? <Loader2 className="animate-spin w-4 h-4"/> : <Gavel className="w-4 h-4"/>} Execute
                   </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
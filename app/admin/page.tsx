'use client';

import { useState, useMemo, useEffect } from 'react';
import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { formatEther, formatUnits } from 'viem';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/app/constants';
import { Loader2, CheckCircle, ShieldAlert, Lock, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// 🔒 THE ONLY ADDRESS ALLOWED IN
const ADMIN_WALLET = "0xefd09435E4c6cB6E3d0B40EC501e4FADdCEA0698".toLowerCase();

export default function AdminPage() {
  const { address, isConnected, isConnecting } = useAccount();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  // Prevent Hydration Mismatch
  useEffect(() => { setIsClient(true); }, []);

  // 🔒 STRICT SECURITY CHECK
  // We calculate this immediately. No effects.
  const userAddress = address ? address.toLowerCase() : "";
  const isAuthorized = isConnected && userAddress === ADMIN_WALLET;

  // Blockchain Hooks (Only fetch if authorized to save resources)
  const { data: totalEscrows } = useReadContract({
    abi: CONTRACT_ABI,
    address: CONTRACT_ADDRESS,
    functionName: 'escrowCount',
    query: { enabled: isAuthorized, refetchInterval: 5000 }
  });

  const count = totalEscrows ? Number(totalEscrows) : 0;
  const indexesToFetch = useMemo(() => {
    const idxs = [];
    for (let i = count; i > 0; i--) idxs.push(i);
    return idxs;
  }, [count]);

  const { data: escrowsData, refetch } = useReadContracts({
    contracts: indexesToFetch.map((id) => ({
      abi: CONTRACT_ABI,
      address: CONTRACT_ADDRESS,
      functionName: 'escrows',
      args: [BigInt(id)]
    })),
    query: { enabled: isAuthorized, refetchInterval: 10000 }
  });

  const [adminAction, setAdminAction] = useState<{ id: bigint, type: 'RELEASE' | 'REFUND' | 'DISPUTE' } | null>(null);
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      alert("Success!");
      setAdminAction(null);
      refetch();
    }
  }, [isSuccess]);

  // Loading State
  if (!isClient || isConnecting) return <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  // ⛔️ ACCESS DENIED SCREEN (With Debug Info)
  if (!isAuthorized) {
      return (
          <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white p-4 font-sans">
              <div className="bg-red-500/10 p-6 rounded-full mb-6 border border-red-500/50">
                  <Lock className="w-12 h-12 text-red-500" />
              </div>
              <h1 className="text-3xl font-extrabold text-white mb-2">ACCESS DENIED</h1>
              <p className="text-slate-400 mb-8">You do not have permission to view the Command Center.</p>
              
              {/* DEBUG BOX: PROVES WHY YOU ARE BLOCKED */}
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl text-left text-sm font-mono max-w-lg w-full">
                  <div className="mb-4 pb-4 border-b border-slate-700">
                      <div className="text-slate-500 text-xs uppercase font-bold mb-1">Your Connected Wallet</div>
                      <div className={`${isConnected ? 'text-red-400' : 'text-slate-500 italic'}`}>
                        {isConnected ? address : "Not Connected"}
                      </div>
                  </div>
                  <div>
                      <div className="text-slate-500 text-xs uppercase font-bold mb-1">Required Admin Wallet</div>
                      <div className="text-emerald-500">
                        {ADMIN_WALLET}
                      </div>
                  </div>
              </div>

              <button onClick={() => router.push('/')} className="mt-8 bg-slate-800 hover:bg-slate-700 px-8 py-3 rounded-lg font-bold">Go Home</button>
          </div>
      );
  }

  // ✅ AUTHORIZED DASHBOARD
  // ... (Parsing Logic)
  const orders = escrowsData ? escrowsData.map((result, index) => {
      if (result.status !== 'success') return null;
      const e = result.result as any;
      const id = indexesToFetch[index];
      const tokenAddr = String(e[3]);
      const isEth = tokenAddr === ZERO_ADDRESS;
      const totalAmount = BigInt(e[4]);
      return {
        id,
        buyer: String(e[1]),
        seller: String(e[2]),
        amount: isEth ? formatEther(totalAmount) : formatUnits(totalAmount, 6),
        symbol: isEth ? 'ETH' : 'USDC',
        isDisputed: e[8],
        isCompleted: e[9],
        status: e[9] ? 'COMPLETED' : e[8] ? 'DISPUTED' : 'ACTIVE'
      };
    }).filter(Boolean) : [];

  const executeAdminAction = () => {
    if (!adminAction) return;
    const functionName = adminAction.type === 'RELEASE' ? 'releaseMilestone' : adminAction.type === 'REFUND' ? 'cancelOrder' : 'raiseDispute';
    const args = adminAction.type === 'RELEASE' ? [adminAction.id, BigInt(100)] : [adminAction.id];
    writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName, args: args as any });
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-10">
        <div>
           <h1 className="text-3xl font-bold flex items-center gap-3"><ShieldAlert className="text-emerald-500" /> Admin Command Center</h1>
           <p className="text-slate-400 text-sm mt-1">Logged in as: <span className="font-mono text-emerald-400">{address}</span></p>
        </div>
        <div className="flex gap-4">
           <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center"><div className="text-xs text-slate-500 font-bold uppercase">Total Volume</div><div className="text-2xl font-bold text-white">{count}</div></div>
           <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center"><div className="text-xs text-slate-500 font-bold uppercase">Disputes</div><div className="text-2xl font-bold text-red-400">{orders.filter((o:any) => o.status === 'DISPUTED').length}</div></div>
        </div>
      </div>
      
      {/* TABLE UI */}
      <div className="max-w-7xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
         <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold">
               <tr><th className="p-4">ID</th><th className="p-4">Value</th><th className="p-4">Participants</th><th className="p-4">Status</th><th className="p-4 text-right">Admin Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
               {orders.length === 0 ? (
                  <tr><td colSpan={5} className="p-10 text-center text-slate-500 italic">No orders found.</td></tr>
               ) : (
                  orders.map((order: any) => (
                     <tr key={order.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 font-mono text-slate-300">#{order.id}</td>
                        <td className="p-4"><div className="font-bold">{order.amount} {order.symbol}</div></td>
                        <td className="p-4 text-sm"><div className="flex flex-col gap-1"><span className="text-emerald-400/80 text-xs">BUY: {order.buyer.slice(0,6)}...</span><span className="text-blue-400/80 text-xs">SEL: {order.seller.slice(0,6)}...</span></div></td>
                        <td className="p-4"><span className={`px-3 py-1 rounded-full text-xs font-bold ${order.status === 'COMPLETED' ? 'bg-slate-800 text-slate-400' : order.status === 'DISPUTED' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{order.status}</span></td>
                        <td className="p-4 text-right flex justify-end gap-2">
                           {order.status === 'ACTIVE' && (<><button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'REFUND' })} className="px-3 py-1.5 bg-red-900/30 text-red-400 text-xs font-bold rounded hover:bg-red-900/50">Refund</button><button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'DISPUTE' })} className="px-3 py-1.5 bg-amber-900/30 text-amber-400 text-xs font-bold rounded hover:bg-amber-900/50">Dispute</button></>)}
                           {order.status === 'DISPUTED' && (<button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'RELEASE' })} className="px-3 py-1.5 bg-emerald-900/30 text-emerald-400 text-xs font-bold rounded hover:bg-emerald-900/50">Resolve (Release)</button>)}
                           {order.status === 'COMPLETED' && <span className="text-slate-600 text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Finalized</span>}
                        </td>
                     </tr>
                  ))
               )}
            </tbody>
         </table>
      </div>

      {adminAction && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm w-full">
               <h3 className="text-lg font-bold mb-2 text-white">Confirm Admin Action</h3>
               <p className="text-slate-400 text-sm mb-6">Are you sure you want to <span className="font-bold text-white mx-1">{adminAction.type}</span> Order #{adminAction.id.toString()}?</p>
               <div className="flex gap-3"><button onClick={() => setAdminAction(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-bold text-sm">Cancel</button><button onClick={executeAdminAction} disabled={isPending || isConfirming} className="flex-1 bg-red-600 hover:bg-red-500 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2">{isPending || isConfirming ? <Loader2 className="animate-spin w-4 h-4"/> : <ShieldAlert className="w-4 h-4"/>} Confirm</button></div>
            </div>
         </div>
      )}
    </div>
  );
}
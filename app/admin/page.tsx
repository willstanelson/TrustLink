'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { formatEther, formatUnits } from 'viem';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../constants'; // Import from parent folder
import React, { useEffect, useState, useMemo } from 'react';
import { Shield, AlertTriangle, Gavel, Loader2, CheckCircle2, X } from 'lucide-react';

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function AdminPage() {
  const { user, authenticated, login } = usePrivy();
  const { address: userAddress } = useAccount();
  const [txHash, setTxHash] = useState('');

  // 1. READ ADMIN ADDRESS (feeCollector)
  const { data: adminAddress, isLoading: adminLoading } = useReadContract({
    abi: CONTRACT_ABI,
    address: CONTRACT_ADDRESS,
    functionName: 'feeCollector',
  });

  // 2. CHECK PERMISSIONS
  const isAdmin = userAddress && adminAddress && (userAddress.toLowerCase() === (adminAddress as string).toLowerCase());

  // 3. FETCH ALL ORDERS
  const { data: totalEscrows } = useReadContract({ abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrowCount' });
  const count = totalEscrows ? Number(totalEscrows) : 0;

  // Generate indexes [1, 2, 3...]
  const indexesToFetch = useMemo(() => {
    const idxs = [];
    for (let i = 1; i <= count; i++) idxs.push(i);
    return idxs;
  }, [count]);

  const { data: escrowsData, refetch } = useReadContracts({
    contracts: indexesToFetch.map((id) => ({
      abi: CONTRACT_ABI,
      address: CONTRACT_ADDRESS,
      functionName: 'escrows',
      args: [BigInt(id)],
    })),
    query: { refetchInterval: 3000 } // Auto-refresh data
  });

  // 4. FILTER FOR DISPUTES
  const disputedOrders = useMemo(() => {
    const list: any[] = [];
    if (escrowsData) {
      escrowsData.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const escrow = result.result as any;
          // Struct: id(0), buyer(1), seller(2), token(3), total(4), locked(5), accepted(6), shipped(7), DISPUTED(8), completed(9)
          const isDisputed = escrow[8];
          const isCompleted = escrow[9];

          if (isDisputed && !isCompleted) {
            const id = indexesToFetch[index];
            const tokenAddr = String(escrow[3]);
            const isEth = tokenAddr === ZERO_ADDRESS;
            const lockedBalance = BigInt(escrow[5]);

            list.push({
              id,
              buyer: String(escrow[1]),
              seller: String(escrow[2]),
              symbol: isEth ? 'ETH' : 'USDC',
              formattedLocked: isEth ? formatEther(lockedBalance) : formatUnits(lockedBalance, 6),
            });
          }
        }
      });
    }
    return list;
  }, [escrowsData, indexesToFetch]);

  // 5. ACTIONS (RESOLVE)
  const { writeContract, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash as `0x${string}` });

  useEffect(() => {
    if (isSuccess) {
      alert("Dispute Resolved Successfully!");
      setTxHash('');
      refetch();
    }
  }, [isSuccess]);

  const handleResolve = (id: number, winner: string) => {
    if (!confirm(`Are you sure you want to award the funds to ${winner}? This cannot be undone.`)) return;
    
    writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'resolveDispute',
        args: [BigInt(id), winner as `0x${string}`]
    }, {
        onSuccess: (hash) => setTxHash(hash),
        onError: (e) => alert("Error: " + (e as any).shortMessage || e.message)
    });
  };

  // --- RENDER ---

  if (!authenticated) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><button onClick={login} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">Connect Admin Wallet</button></div>;
  }

  if (adminLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Verifying Admin Status...</div>;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-center p-4">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400">Your wallet {userAddress?.slice(0,6)}... is not the Contract Admin.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-700">
          <div className="bg-red-500/20 p-3 rounded-full"><Gavel className="w-8 h-8 text-red-500" /></div>
          <div>
            <h1 className="text-3xl font-bold">Arbitration Console</h1>
            <p className="text-slate-400 text-sm">Review and resolve disputed escrows.</p>
          </div>
        </div>

        {disputedOrders.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-10 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white">All Clear</h3>
                <p className="text-slate-400">There are no active disputes requiring your attention.</p>
            </div>
        ) : (
            <div className="space-y-4">
                {disputedOrders.map((order) => (
                    <div key={order.id} className="bg-slate-800 border border-red-500/30 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">DISPUTE ACTIVE</div>
                        
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <span className="text-xs font-mono text-slate-500">ORDER #{order.id}</span>
                                <h2 className="text-2xl font-bold text-white">{order.formattedLocked} <span className="text-base text-slate-400">{order.symbol}</span></h2>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* BUYER CARD */}
                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <p className="text-xs text-slate-400 font-bold mb-1">BUYER (Depositor)</p>
                                <p className="font-mono text-sm text-blue-300 break-all mb-4">{order.buyer}</p>
                                <button 
                                    onClick={() => handleResolve(order.id, order.buyer)}
                                    disabled={isPending}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-bold transition-all"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Refund Buyer (Winner)"}
                                </button>
                            </div>

                            {/* SELLER CARD */}
                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <p className="text-xs text-slate-400 font-bold mb-1">SELLER (Recipient)</p>
                                <p className="font-mono text-sm text-emerald-300 break-all mb-4">{order.seller}</p>
                                <button 
                                    onClick={() => handleResolve(order.id, order.seller)}
                                    disabled={isPending}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-xs font-bold transition-all"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Pay Seller (Winner)"}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
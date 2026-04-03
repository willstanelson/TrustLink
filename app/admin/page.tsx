'use client';

// ─────────────────────────────────────────────────────────────────────────────
// AdminPage.tsx  –  TrustLink Admin Terminal
//
// Security model:
//   • No admin wallets/emails exist in this file or anywhere client-side.
//   • Authorization is verified server-side on every request via /api/admin/action.
//   • All Supabase mutations go through that authenticated API route.
//   • Reads use the anon key; protect them further with Supabase RLS policies.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  useReadContract, useReadContracts,
  useWriteContract, useWaitForTransactionReceipt, useAccount,
} from 'wagmi';
import { formatEther, formatUnits } from 'viem';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/app/constants';
import {
  Loader2, CheckCircle, ArrowLeft, Gavel, XCircle,
  AlertTriangle, Copy, Banknote, Skull, ShieldOff,
  CheckCheck, Info,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

const PLASMA_CHAIN_ID  = 9746;
const ZERO_ADDRESS     = '0x0000000000000000000000000000000000000000';
const ADMIN_API        = '/api/admin/action';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type FiatOrder = {
  id: number;
  status: string;
  amount: number;
  released_amount: number | null;
  seller_bank: string | null;
  seller_name: string | null;
  seller_number: string | null;
  seller_email: string | null;
  seller_wallet_address: string | null;
  buyer_email: string | null;
  buyer_wallet_address: string | null;
  paystack_ref: string | null;
  created_at: string;
};

type CryptoOrder = {
  id: number;
  buyer: string;
  seller: string;
  amount: string;
  rawAmount: bigint;
  symbol: string;
  isDisputed: boolean;
  isCompleted: boolean;
  status: 'ACTIVE' | 'DISPUTED' | 'COMPLETED';
};

type AdminAction = {
  id: bigint;
  type: 'RELEASE' | 'REFUND' | 'NUKE' | 'DISPUTE';
  seller?: string;
  rawAmount?: bigint;          // used for RELEASE so we pass the real locked amount
};

type ConfirmConfig = {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
};

// ─────────────────────────────────────────────
// Toast system
// ─────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';
type Toast     = { id: number; type: ToastType; message: string };

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle   className="w-4 h-4 text-emerald-400 shrink-0" />,
  error:   <XCircle       className="w-4 h-4 text-red-400    shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />,
  info:    <Info          className="w-4 h-4 text-blue-400   shrink-0" />,
};
const TOAST_BORDER: Record<ToastType, string> = {
  success: 'border-emerald-500/40',
  error:   'border-red-500/40',
  warning: 'border-yellow-500/40',
  info:    'border-blue-500/40',
};

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={`pointer-events-auto flex items-start gap-3 bg-slate-900 border ${TOAST_BORDER[t.type]} rounded-xl px-4 py-3 shadow-xl cursor-pointer animate-in slide-in-from-right-5 duration-200`}
        >
          {TOAST_ICONS[t.type]}
          <p className="text-sm text-slate-200 leading-snug">{t.message}</p>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((type: ToastType, message: string, durationMs = 5000) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), durationMs);
  }, []);

  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  return { toasts, dismiss, push };
}

// ─────────────────────────────────────────────
// Confirm modal
// ─────────────────────────────────────────────
function ConfirmModal({ config, onClose }: { config: ConfirmConfig; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-black text-white text-center mb-3">{config.title}</h3>
        <div className="text-slate-400 text-sm text-center mb-6 leading-relaxed">{config.body}</div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => { onClose(); config.onConfirm(); }}
            className={`w-full py-3.5 rounded-xl font-bold transition-all text-white ${config.confirmClass ?? 'bg-red-600 hover:bg-red-500'}`}
          >
            {config.confirmLabel}
          </button>
          <button
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3.5 rounded-xl font-bold transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Copy button with inline feedback
// ─────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors flex items-center gap-1"
      title="Copy to clipboard"
    >
      {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function AdminPage() {
  const { isConnecting } = useAccount();
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();

  const { toasts, dismiss, push } = useToast();

  // Auth state – determined by the server, never by client-side wallet comparison
  const [authStatus, setAuthStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  const [activeTab, setActiveTab] = useState<'PAYOUTS' | 'DISPUTES' | 'CRYPTO'>('PAYOUTS');

  const [fiatDisputes, setFiatDisputes] = useState<FiatOrder[]>([]);
  const [fiatPayouts,  setFiatPayouts]  = useState<FiatOrder[]>([]);
  const [isLoadingFiat, setIsLoadingFiat] = useState(false);
  const [busyOrderId,   setBusyOrderId]   = useState<number | null>(null);

  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [adminAction,   setAdminAction]   = useState<AdminAction | null>(null);

  // ── Wagmi ─────────────────────────────────────────────────────────────────
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // ── Authenticated fetch helper ────────────────────────────────────────────
  const adminFetch = useCallback(
    async (body: object): Promise<Response> => {
      const token = await getAccessToken();
      return fetch(ADMIN_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    },
    [getAccessToken],
  );

  // ── Server-side auth verification on mount ────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { setAuthStatus('unauthorized'); return; }

    const verify = async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(ADMIN_API, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAuthStatus(res.ok ? 'authorized' : 'unauthorized');
      } catch {
        setAuthStatus('unauthorized');
      }
    };

    verify();
  }, [ready, authenticated, getAccessToken]);

  // ── Fiat data fetch ───────────────────────────────────────────────────────
  const fetchFiatOrders = useCallback(async () => {
    setIsLoadingFiat(true);
    const { data, error } = await supabase
      .from('escrow_orders')
      .select('*')
      .in('status', ['disputed', 'processing_payout'])
      .order('created_at', { ascending: false });

    setIsLoadingFiat(false);

    if (error) {
      push('error', `Failed to load fiat orders: ${error.message}`);
      return;
    }

    setFiatDisputes((data as FiatOrder[]).filter((o) => o.status === 'disputed'));
    setFiatPayouts((data as FiatOrder[]).filter((o) => o.status === 'processing_payout'));
  }, [push]);

  useEffect(() => {
    if (authStatus === 'authorized') fetchFiatOrders();
  }, [authStatus, fetchFiatOrders]);

  // ── Crypto contracts ──────────────────────────────────────────────────────
  const { data: totalEscrows } = useReadContract({
    abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrowCount',
    query: { enabled: authStatus === 'authorized', refetchInterval: 5000 },
  });

  const count = totalEscrows ? Number(totalEscrows) : 0;
  const indexesToFetch = useMemo(() => {
    const idxs: number[] = [];
    for (let i = count; i > 0; i--) idxs.push(i);
    return idxs;
  }, [count]);

  const { data: escrowsData, refetch: refetchCrypto } = useReadContracts({
    contracts: indexesToFetch.map((id) => ({
      abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrows', args: [BigInt(id)],
    })),
    query: { enabled: authStatus === 'authorized', refetchInterval: 10000 },
  });

  // ── Wagmi error ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (writeError) {
      push('error', (writeError as any).shortMessage ?? writeError.message);
      setAdminAction(null);
    }
  }, [writeError, push]);

  // ── On-chain success ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSuccess) return;

    // If action was NUKE, we still need to hit the server to update the trust score
    if (adminAction?.type === 'NUKE' && adminAction.seller) {
      adminFetch({ actionType: 'NUKE_CRYPTO_SELLER', sellerAddress: adminAction.seller })
        .catch((err) => console.error('Nuke profile update failed:', err));
    }

    push('success', 'On-chain action executed successfully.');
    setAdminAction(null);
    refetchCrypto();
  }, [isSuccess, adminAction, adminFetch, refetchCrypto, push]);

  // ── Fiat: resolve dispute ─────────────────────────────────────────────────
  const resolveDispute = async (
    order: FiatOrder,
    resolution: 'completed' | 'refunded',
    nuke: boolean,
  ) => {
    setBusyOrderId(order.id);
    try {
      const res = await adminFetch({
        actionType: 'RESOLVE_DISPUTE',
        orderId: order.id,
        resolution,
        nukeSellerId: nuke
          ? (order.seller_email?.toLowerCase() ?? order.seller_wallet_address?.toLowerCase())
          : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unknown error');

      push('success', `Order #${order.id} resolved as ${resolution}${nuke ? ' (seller nuked)' : ''}.`);
      fetchFiatOrders();
    } catch (err: any) {
      push('error', `Resolution failed: ${err.message}`);
    } finally {
      setBusyOrderId(null);
    }
  };

  const confirmResolveDispute = (order: FiatOrder, resolution: 'completed' | 'refunded', nuke = false) => {
    const labels = {
      seller: { label: 'Rule for Seller', body: `Release locked funds to the seller for order #${order.id}?` },
      refund:  { label: 'Issue Refund',    body: `Refund the buyer for order #${order.id}? This cannot be undone.` },
      nuke:    {
        label: 'Nuke Seller & Refund',
        body: (
          <>
            Refund the buyer <strong className="text-white">and permanently drop the seller's trust score</strong> for order #{order.id}?
            <br /><br />
            <span className="text-red-400 font-bold">This is irreversible.</span>
          </>
        ),
      },
    };
    const key = nuke ? 'nuke' : resolution === 'completed' ? 'seller' : 'refund';
    const cfg = labels[key];

    setConfirmConfig({
      title: cfg.label,
      body: cfg.body,
      confirmLabel: cfg.label,
      confirmClass: nuke ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500',
      onConfirm: () => resolveDispute(order, resolution, nuke),
    });
  };

  // ── Fiat: complete payout ─────────────────────────────────────────────────
  const completePayout = async (order: FiatOrder) => {
    setBusyOrderId(order.id);
    try {
      const res = await adminFetch({ actionType: 'COMPLETE_PAYOUT', orderId: order.id });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unknown error');

      push('success', `Order #${order.id} marked as ${json.newStatus}.`);
      fetchFiatOrders();
    } catch (err: any) {
      push('error', `Payout completion failed: ${err.message}`);
    } finally {
      setBusyOrderId(null);
    }
  };

  const confirmCompletePayout = (order: FiatOrder) => {
    const amount = Number(order.released_amount ?? order.amount).toLocaleString();
    setConfirmConfig({
      title: 'Confirm Bank Transfer',
      body: `Have you successfully transferred ₦${amount} to the seller's account? This will mark the escrow as complete.`,
      confirmLabel: 'Yes, Transfer Complete',
      confirmClass: 'bg-emerald-600 hover:bg-emerald-500',
      onConfirm: () => completePayout(order),
    });
  };

  // ── Crypto: execute admin action ──────────────────────────────────────────
  const executeCryptoAction = () => {
    if (!adminAction) return;

    const functionName =
      adminAction.type === 'RELEASE'  ? 'releaseMilestone' :
      adminAction.type === 'DISPUTE'  ? 'raiseDispute'     :
      'cancelOrder'; // REFUND + NUKE both call cancelOrder on-chain

    // RELEASE must pass the actual locked amount — not a placeholder
    const args: [bigint, bigint] | [bigint] =
      adminAction.type === 'RELEASE' && adminAction.rawAmount !== undefined
        ? [adminAction.id, adminAction.rawAmount]
        : [adminAction.id];

    writeContract({
      chainId: PLASMA_CHAIN_ID,
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName,
      args: args as any,
    });
  };

  // ── Parse crypto orders ───────────────────────────────────────────────────
  const cryptoOrders: CryptoOrder[] = useMemo(() => {
    if (!escrowsData) return [];
    return escrowsData.flatMap((result, index) => {
      if (result.status !== 'success') return [];
      const e = result.result as any;
      const id = indexesToFetch[index];
      const tokenAddr  = String(e[3]);
      const isEth      = tokenAddr === ZERO_ADDRESS;
      const rawAmount  = BigInt(e[4]);
      const isDisputed  = Boolean(e[8]);
      const isCompleted = Boolean(e[9]);

      return [{
        id,
        buyer:     String(e[1]),
        seller:    String(e[2]),
        amount:    isEth ? formatEther(rawAmount) : formatUnits(rawAmount, 6),
        rawAmount,
        symbol:    isEth ? 'ETH' : 'USDC',
        isDisputed,
        isCompleted,
        status:    isCompleted ? 'COMPLETED' : isDisputed ? 'DISPUTED' : 'ACTIVE',
      }];
    });
  }, [escrowsData, indexesToFetch]);

  // ── Render guards ─────────────────────────────────────────────────────────
  if (authStatus === 'loading' || isConnecting || !ready) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (authStatus === 'unauthorized') {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white p-8 gap-6">
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-full">
          <ShieldOff className="w-16 h-16 text-red-400" />
        </div>
        <div className="text-center max-w-sm">
          <h1 className="text-3xl font-black mb-2">Access Denied</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            You don't have permission to view this page. If you believe this is an error, contact your administrator.
          </p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-slate-700"
        >
          Return Home
        </button>
      </div>
    );
  }

  // ── Admin UI ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f172a] text-white pb-20 font-sans">

      {/* NAV */}
      <nav className="border-b border-emerald-500/20 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/30">
              <Gavel className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-xl font-black tracking-tight hidden sm:block">
              TrustLink <span className="text-emerald-400 font-mono text-sm uppercase tracking-widest ml-2">Admin Terminal</span>
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 mt-8">

        {/* TABS */}
        <div className="flex flex-wrap gap-6 border-b border-slate-800 mb-6 mt-8">
          {([
            { key: 'PAYOUTS',  label: 'Pending Payouts', count: fiatPayouts.length,  color: 'emerald' },
            { key: 'DISPUTES', label: 'Fiat Disputes',   count: fiatDisputes.length, color: 'red'     },
            { key: 'CRYPTO',   label: 'Crypto Orders',   count: 0,                   color: 'blue'    },
          ] as const).map(({ key, label, count: badgeCount, color }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`text-lg font-bold pb-4 border-b-2 transition-all flex items-center gap-2 ${
                activeTab === key
                  ? `border-${color}-500 text-${color}-400`
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
              {badgeCount > 0 && (
                <span className={`bg-${color}-500 ${color === 'red' ? 'text-white' : 'text-slate-900'} text-xs px-2 py-0.5 rounded-full`}>
                  {badgeCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: PAYOUTS ──────────────────────────────────────────────── */}
        {activeTab === 'PAYOUTS' && (
          <div className="space-y-6 animate-in fade-in">
            {isLoadingFiat ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
            ) : fiatPayouts.length === 0 ? (
              <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-3xl p-12 text-center flex flex-col items-center gap-4">
                <CheckCircle className="w-16 h-16 text-emerald-500/50" />
                <h3 className="text-xl font-bold text-white">All Caught Up!</h3>
                <p className="text-slate-400">No pending payouts to process.</p>
              </div>
            ) : (
              fiatPayouts.map((order) => {
                const amountToTransfer = Number(order.released_amount ?? order.amount);
                const isPartial = order.released_amount !== null && order.released_amount < order.amount;

                return (
                  <div key={order.id} className="bg-slate-800 border border-emerald-500/30 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                    <div className="bg-emerald-900/20 border-b border-emerald-500/20 px-6 py-4 flex justify-between items-center">
                      <span className="font-mono text-sm text-emerald-400">Order #${order.id}</span>
                      <span className="bg-emerald-500 text-slate-900 text-xs font-black uppercase px-3 py-1 rounded-full">
                        Awaiting Transfer
                      </span>
                    </div>

                    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Amount */}
                      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex flex-col justify-center">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Amount to Transfer</p>
                        <p className="text-4xl font-black text-white">₦{amountToTransfer.toLocaleString()}</p>
                        {isPartial && (
                          <p className="text-xs text-yellow-400 mt-2 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Split Release (Partial Payout)
                          </p>
                        )}
                      </div>

                      {/* Bank details */}
                      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">
                          Seller Bank Details
                        </p>
                        <div className="space-y-3">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Bank Name</p>
                            <p className="font-bold text-sm text-white">{order.seller_bank ?? 'Not provided'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Account Name</p>
                            <p className="font-bold text-sm text-white">{order.seller_name ?? 'Not provided'}</p>
                          </div>
                          <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase">Account Number</p>
                              <p className="font-mono font-bold text-emerald-400">{order.seller_number ?? 'N/A'}</p>
                            </div>
                            {order.seller_number && <CopyButton text={order.seller_number} />}
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex flex-col justify-center gap-3">
                        <p className="text-sm text-slate-400 text-center px-4 leading-relaxed">
                          Transfer the exact amount, then confirm below to complete the escrow.
                        </p>
                        <button
                          disabled={busyOrderId === order.id}
                          onClick={() => confirmCompletePayout(order)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl text-sm transition-all shadow-lg flex justify-center items-center gap-2"
                        >
                          {busyOrderId === order.id
                            ? <Loader2 className="w-5 h-5 animate-spin" />
                            : <Banknote className="w-5 h-5" />}
                          Mark as Paid & Completed
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TAB: DISPUTES ─────────────────────────────────────────────── */}
        {activeTab === 'DISPUTES' && (
          <div className="space-y-6 animate-in fade-in">
            {isLoadingFiat ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
            ) : fiatDisputes.length === 0 ? (
              <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-3xl p-12 text-center flex flex-col items-center gap-4">
                <CheckCircle className="w-16 h-16 text-emerald-500/50" />
                <h3 className="text-xl font-bold text-white">Zero Fiat Disputes</h3>
                <p className="text-slate-400">All local bank escrows are currently peaceful.</p>
              </div>
            ) : (
              fiatDisputes.map((order) => (
                <div key={order.id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
                  <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-4 flex justify-between items-center">
                    <span className="font-mono text-sm text-slate-400">Order #{order.id}</span>
                    <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase px-3 py-1 rounded-full animate-pulse">
                      Disputed
                    </span>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Locked Value</p>
                      <p className="text-2xl font-black text-white">
                        {order.paystack_ref ? '₦' : ''}{Number(order.amount).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Buyer</p>
                      <p className="text-[10px] font-mono bg-slate-900 p-2 rounded-lg border border-slate-700 text-blue-400 break-all">
                        {order.buyer_email ?? order.buyer_wallet_address ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Seller</p>
                      <p className="text-[10px] font-mono bg-slate-900 p-2 rounded-lg border border-slate-700 text-emerald-400 break-all">
                        {order.seller_email ?? order.seller_name ?? '—'}
                      </p>
                    </div>

                    <div className="col-span-1 lg:col-span-2 flex flex-col gap-2 justify-center">
                      <button
                        disabled={busyOrderId === order.id}
                        onClick={() => confirmResolveDispute(order, 'completed')}
                        className="w-full bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white font-bold py-2 rounded-xl text-xs transition-all flex justify-center items-center gap-2"
                      >
                        {busyOrderId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Rule for Seller
                      </button>
                      <div className="flex gap-2">
                        <button
                          disabled={busyOrderId === order.id}
                          onClick={() => confirmResolveDispute(order, 'refunded', false)}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all flex justify-center items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" /> Std. Refund
                        </button>
                        <button
                          disabled={busyOrderId === order.id}
                          onClick={() => confirmResolveDispute(order, 'refunded', true)}
                          className="flex-1 bg-red-900/40 hover:bg-red-600 border border-red-500/50 text-red-400 hover:text-white font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all flex justify-center items-center gap-1"
                        >
                          <Skull className="w-3 h-3" /> Scam: Nuke
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TAB: CRYPTO ───────────────────────────────────────────────── */}
        {activeTab === 'CRYPTO' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl animate-in fade-in">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-4">ID</th>
                  <th className="p-4">Value</th>
                  <th className="p-4">Participants</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {cryptoOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-500 italic">
                      No blockchain escrows found.
                    </td>
                  </tr>
                ) : (
                  cryptoOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono text-slate-300">#{order.id}</td>
                      <td className="p-4">
                        <div className="font-bold">{order.amount} {order.symbol}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1.5 font-mono">
                          <span className="text-emerald-400/80 text-[10px] break-all">BUY: {order.buyer}</span>
                          <span className="text-blue-400/80   text-[10px] break-all">SEL: {order.seller}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                          order.status === 'COMPLETED' ? 'bg-slate-800 text-slate-400 border border-slate-700' :
                          order.status === 'DISPUTED'  ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {order.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => setAdminAction({ id: BigInt(order.id), type: 'REFUND' })}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-red-900/50 border border-slate-700 hover:border-red-500 text-slate-300 hover:text-red-400 text-xs font-bold rounded-lg transition-colors"
                              >
                                Refund
                              </button>
                              <button
                                onClick={() => setAdminAction({ id: BigInt(order.id), type: 'DISPUTE' })}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-amber-900/50 border border-slate-700 hover:border-amber-500 text-slate-300 hover:text-amber-400 text-xs font-bold rounded-lg transition-colors"
                              >
                                Flag Dispute
                              </button>
                            </>
                          )}
                          {order.status === 'DISPUTED' && (
                            <>
                              <button
                                onClick={() => setAdminAction({ id: BigInt(order.id), type: 'RELEASE', rawAmount: order.rawAmount })}
                                className="px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors"
                              >
                                Force Release
                              </button>
                              <button
                                onClick={() => setAdminAction({ id: BigInt(order.id), type: 'REFUND' })}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors"
                              >
                                Std. Refund
                              </button>
                              <button
                                onClick={() => setAdminAction({ id: BigInt(order.id), type: 'NUKE', seller: order.seller, rawAmount: order.rawAmount })}
                                className="px-3 py-1.5 bg-red-900/40 hover:bg-red-600 border border-red-500/50 text-red-400 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Skull className="w-3 h-3" /> Scam: Nuke
                              </button>
                            </>
                          )}
                          {order.status === 'COMPLETED' && (
                            <span className="text-slate-600 text-xs font-bold flex items-center gap-1 justify-end">
                              <CheckCircle className="w-3 h-3" /> Finalized
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ── Crypto confirm modal ───────────────────────────────────────────── */}
      {adminAction && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className={`bg-slate-900 border ${adminAction.type === 'NUKE' ? 'border-red-500' : 'border-slate-700'} p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200`}>
            <h3 className="text-xl font-bold mb-2 text-white flex items-center gap-2">
              {adminAction.type === 'NUKE'
                ? <Skull className="w-6 h-6 text-red-500" />
                : <AlertTriangle className="w-5 h-5 text-yellow-500" />}
              Confirm On-Chain Action
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Execute a{' '}
              <span className={`font-bold text-white px-2 py-0.5 rounded mx-1 ${adminAction.type === 'NUKE' ? 'bg-red-600' : 'bg-slate-800'}`}>
                {adminAction.type}
              </span>{' '}
              on Smart Contract Order #{adminAction.id.toString()}?
              {adminAction.type === 'NUKE' && (
                <span className="block mt-2 text-red-400 font-bold">
                  This will refund the buyer and permanently lower the seller's trust score.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setAdminAction(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 py-3.5 rounded-xl font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeCryptoAction}
                disabled={isPending || isConfirming}
                className={`flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg ${
                  adminAction.type === 'NUKE' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isPending || isConfirming
                  ? <Loader2 className="animate-spin w-4 h-4" />
                  : <Gavel className="w-4 h-4" />}
                Execute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generic confirm modal ──────────────────────────────────────────── */}
      {confirmConfig && (
        <ConfirmModal config={confirmConfig} onClose={() => setConfirmConfig(null)} />
      )}

      {/* ── Toasts ────────────────────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

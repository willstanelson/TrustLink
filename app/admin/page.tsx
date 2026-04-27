'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useSwitchChain,
  useChainId,
} from 'wagmi';
import { formatEther, formatUnits } from 'viem';
import { CONTRACT_ABI, CONTRACT_ADDRESS, CHAIN_CONFIG } from '@/app/constants';
import {
  Loader2,
  CheckCircle,
  ArrowLeft,
  Gavel,
  XCircle,
  AlertTriangle,
  Copy,
  Banknote,
  Skull,
  ShieldOff,
  CheckCheck,
  Info,
  Globe,
  ChevronDown,
  Award,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ADMIN_API = '/api/admin/action';

const TAB_STYLES = {
  PAYOUTS:  { active: 'border-emerald-500 text-emerald-400', badge: 'bg-emerald-500 text-slate-900' },
  DISPUTES: { active: 'border-red-500 text-red-400',         badge: 'bg-red-500 text-white'         },
  HISTORY:  { active: 'border-slate-400 text-slate-400',     badge: 'bg-slate-500 text-white'       },
  CRYPTO:   { active: 'border-blue-500 text-blue-400',       badge: 'bg-blue-500 text-slate-900'    },
  STAKING:  { active: 'border-purple-500 text-purple-400',   badge: 'bg-purple-500 text-white'      },
} as const;

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
  rawAmount?: bigint;
};

type ConfirmConfig = {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
};

type ToastType = 'success' | 'error' | 'warning' | 'info';
type Toast = { id: number; type: ToastType; message: string };

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />,
  error: <XCircle className="w-4 h-4 text-red-400 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
};

const TOAST_BORDER: Record<ToastType, string> = {
  success: 'border-emerald-500/40',
  error: 'border-red-500/40',
  warning: 'border-yellow-500/40',
  info: 'border-blue-500/40',
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

function calculateNetPayout(grossAmount: number) {
  const platformFee = grossAmount * 0.01;

  let paystackFee = grossAmount * 0.015;
  if (grossAmount >= 2500) paystackFee += 100;
  if (paystackFee > 2000) paystackFee = 2000;

  const netPayout = grossAmount - platformFee - paystackFee;
  return { netPayout, platformFee, paystackFee };
}

export default function AdminPage() {
  const { isConnecting } = useAccount();
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();

  const { toasts, dismiss, push } = useToast();

  const { switchChain, switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const activeChainId = CHAIN_CONFIG[chainId] ? chainId : 9746;
  const activeChain = CHAIN_CONFIG[activeChainId] ?? CHAIN_CONFIG[9746];
  const [isNetworkListOpen, setIsNetworkListOpen] = useState(false);
  const networkDropdownRef = useRef<HTMLDivElement>(null);

  const [authStatus, setAuthStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');
  const [activeTab, setActiveTab] = useState<'PAYOUTS' | 'DISPUTES' | 'HISTORY' | 'CRYPTO' | 'STAKING'>('PAYOUTS');

  const [fiatDisputes, setFiatDisputes] = useState<FiatOrder[]>([]);
  const [fiatPayouts, setFiatPayouts] = useState<FiatOrder[]>([]);
  const [fiatHistory, setFiatHistory] = useState<FiatOrder[]>([]);
  const [isLoadingFiat, setIsLoadingFiat] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [adminAction, setAdminAction] = useState<AdminAction | null>(null);
  const [pendingCryptoAction, setPendingCryptoAction] = useState<AdminAction | null>(null);

  const { writeContract, data: txHash, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, isError: txErrorOccurred, error: txError } =
    useWaitForTransactionReceipt({ hash: txHash });

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
    [getAccessToken]
  );

  const fetchFiatOrders = useCallback(async () => {
    setIsLoadingFiat(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(ADMIN_API, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 403) {
          setAuthStatus('unauthorized');
          return;
        }
        throw new Error(`Server error: ${res.status}`);
      }

      const json = await res.json();
      const allOrders = (json.orders ?? []) as FiatOrder[];

      setFiatDisputes(allOrders.filter((o) => o.status === 'disputed'));
      setFiatPayouts(allOrders.filter((o) => o.status === 'processing_payout'));
      setFiatHistory(allOrders.filter((o) => o.status !== 'awaiting_payment'));

      setAuthStatus('authorized');
    } catch (err: any) {
      push('error', `Failed to load orders: ${err.message}`);
    } finally {
      setIsLoadingFiat(false);
    }
  }, [getAccessToken, push]);

  useEffect(() => {
    if (!ready || !authenticated) {
      setAuthStatus(!authenticated ? 'unauthorized' : 'loading');
      return;
    }
    fetchFiatOrders();
  }, [ready, authenticated, fetchFiatOrders]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(e.target as Node)) {
        setIsNetworkListOpen(false);
      }
    };
    if (isNetworkListOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNetworkListOpen]);

  useEffect(() => {
    if (writeError) {
      push('error', (writeError as any).shortMessage ?? writeError.message ?? 'Transaction write failed');
      setAdminAction(null);
      setPendingCryptoAction(null);
    }
  }, [writeError, push]);

  useEffect(() => {
    if (txErrorOccurred && txError) {
      push('error', (txError as any).shortMessage ?? txError.message ?? 'Transaction failed');
      setAdminAction(null);
      setPendingCryptoAction(null);
    }
  }, [txErrorOccurred, txError, push]);

  useEffect(() => {
    if (!adminAction) setPendingCryptoAction(null);
  }, [adminAction]);

  useEffect(() => {
    if (!isSuccess || !adminAction) return;

    const handlePostTx = async () => {
      if (adminAction.type === 'NUKE' && adminAction.seller) {
        try {
          await adminFetch({ actionType: 'NUKE_CRYPTO_SELLER', sellerAddress: adminAction.seller });
        } catch (err) {
          console.error('Nuke profile update failed:', err);
          push('warning', 'On-chain success, but failed to update seller profile');
        }
      }
      push('success', `Order #${adminAction.id} ${adminAction.type} executed successfully.`);
      setAdminAction(null);
      setPendingCryptoAction(null);
      refetchCrypto();
      fetchFiatOrders();
    };

    handlePostTx();
  }, [isSuccess, adminAction, adminFetch, refetchCrypto, fetchFiatOrders, push]);

  const executeWrite = useCallback((action: AdminAction) => {
    const functionName =
      action.type === 'RELEASE' ? 'releaseMilestone' :
      action.type === 'DISPUTE' ? 'raiseDispute' :
      'cancelOrder';

    const args: any[] =
      action.type === 'RELEASE' && action.rawAmount !== undefined
        ? [action.id, action.rawAmount]
        : [action.id];

    writeContract({
      chainId: activeChainId,
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName,
      args,
    });
  }, [activeChainId, writeContract]);

  useEffect(() => {
    if (pendingCryptoAction && chainId === activeChainId) {
      const action = pendingCryptoAction;
      setPendingCryptoAction(null);
      executeWrite(action);
    }
  }, [pendingCryptoAction, chainId, activeChainId, executeWrite]);

  const executeCryptoAction = useCallback(async () => {
    if (!adminAction) return;

    if (chainId !== activeChainId) {
      try {
        await switchChainAsync({ chainId: activeChainId });
        setPendingCryptoAction(adminAction);
      } catch {
        push('error', 'Failed to switch network. Please try again.');
      }
      return;
    }
    executeWrite(adminAction);
  }, [adminAction, chainId, activeChainId, switchChainAsync, executeWrite, push]);

  const { data: totalEscrows } = useReadContract({
    abi: CONTRACT_ABI,
    address: CONTRACT_ADDRESS,
    functionName: 'escrowCount',
    query: { enabled: authStatus === 'authorized', refetchInterval: 5000 },
  });

  const count = totalEscrows ? Number(totalEscrows) : 0;

  const indexesToFetch = useMemo(() => {
    const idxs: number[] = [];
    for (let i = count; i > 0 && idxs.length < 50; i--) idxs.push(i);
    return idxs;
  }, [count]);

  const { data: escrowsData, refetch: refetchCrypto } = useReadContracts({
    contracts: indexesToFetch.map((id) => ({
      abi: CONTRACT_ABI,
      address: CONTRACT_ADDRESS,
      functionName: 'escrows',
      args: [BigInt(id)],
    })),
    query: { enabled: authStatus === 'authorized', refetchInterval: 10000 },
  });

  const cryptoOrders: CryptoOrder[] = useMemo(() => {
    if (!escrowsData) return [];
    return escrowsData.flatMap((result, index) => {
      if (result.status !== 'success') return [];
      const e = result.result as any;
      const id = indexesToFetch[index];
      const tokenAddr = String(e[3]);
      const isNative = tokenAddr === ZERO_ADDRESS;
      const rawAmount = BigInt(e[4]);
      const isDisputed = Boolean(e[8]);
      const isCompleted = Boolean(e[9]);

      return [{
        id,
        buyer: String(e[1]),
        seller: String(e[2]),
        amount: isNative ? formatEther(rawAmount) : formatUnits(rawAmount, 6),
        rawAmount,
        symbol: isNative ? activeChain.nativeSymbol : 'USDC',
        isDisputed,
        isCompleted,
        status: isCompleted ? 'COMPLETED' : isDisputed ? 'DISPUTED' : 'ACTIVE',
      }];
    });
  }, [escrowsData, indexesToFetch, activeChain.nativeSymbol]);

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
    const grossAmount = Number(order.released_amount ?? order.amount);
    const { netPayout } = calculateNetPayout(grossAmount);
    const formattedNet = netPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    setConfirmConfig({
      title: 'Confirm Bank Transfer',
      body: `Have you successfully transferred ₦${formattedNet} to the seller's account? This will mark the escrow as complete.`,
      confirmLabel: 'Yes, Transfer Complete',
      confirmClass: 'bg-emerald-600 hover:bg-emerald-500',
      onConfirm: () => completePayout(order),
    });
  };

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
          ? (order.seller_wallet_address?.toLowerCase() ?? order.seller_email?.toLowerCase())
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

  const TABS = [
    { key: 'PAYOUTS' as const, label: 'Pending Payouts', count: fiatPayouts.length },
    { key: 'DISPUTES' as const, label: 'Fiat Disputes', count: fiatDisputes.length },
    { key: 'HISTORY' as const, label: 'Fiat History', count: fiatHistory.length },
    { key: 'CRYPTO' as const, label: 'Crypto Orders', count: cryptoOrders.length },
    { key: 'STAKING' as const, label: 'Proof-of-Stake', count: 0 },
  ];

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

  return (
    <div className="min-h-screen bg-[#0f172a] text-white pb-20 font-sans relative">
      
      <nav className="border-b border-emerald-500/20 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
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

        <div className="relative" ref={networkDropdownRef}>
          <button
            onClick={() => setIsNetworkListOpen(!isNetworkListOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-xs font-bold bg-slate-800 border-slate-700 text-white hover:bg-slate-700 shadow-lg"
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:block">{activeChain.name}</span>
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>

          {isNetworkListOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl z-[100] overflow-hidden shadow-xl">
              {Object.entries(CHAIN_CONFIG).map(([id, config]) => {
                const chainIdNum = Number(id);
                return (
                  <button
                    key={id}
                    onClick={() => { switchChainAsync({ chainId: chainIdNum }); setIsNetworkListOpen(false); }}
                    className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-slate-700 transition-colors flex items-center justify-between ${chainIdNum === chainId ? 'text-emerald-400 bg-slate-700/50' : 'text-slate-300'}`}
                  >
                    <span>{config.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        <div className="flex flex-wrap gap-6 border-b border-slate-800 mb-6 mt-8">
          {TABS.map(({ key, label, count: badgeCount }) => {
            const styles = TAB_STYLES[key];
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`text-lg font-bold pb-4 border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === key ? styles.active : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
                {badgeCount > 0 && <span className={`${styles.badge} text-xs px-2 py-0.5 rounded-full`}>{badgeCount}</span>}
              </button>
            );
          })}
        </div>

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
                      <span className="font-mono text-sm text-emerald-400">Order #{order.id}</span>
                      <span className="bg-emerald-500 text-slate-900 text-xs font-black uppercase px-3 py-1 rounded-full">Awaiting Transfer</span>
                    </div>

                    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex flex-col justify-center">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Net Amount to Transfer</p>

                        {(() => {
                          const { netPayout, platformFee, paystackFee } = calculateNetPayout(amountToTransfer);
                          return (
                            <>
                              <p className="text-4xl font-black text-emerald-400">₦{netPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              <div className="mt-3 pt-3 border-t border-slate-800 space-y-1">
                                <div className="flex justify-between text-xs text-slate-500"><span>Gross Deposit:</span><span>₦{amountToTransfer.toLocaleString()}</span></div>
                                <div className="flex justify-between text-xs text-red-400/70"><span>Paystack Fee:</span><span>- ₦{paystackFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between text-xs text-blue-400/70"><span>TrustLink Fee (1%):</span><span>- ₦{platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                              </div>
                            </>
                          );
                        })()}

                        {isPartial && <p className="text-xs text-yellow-400 mt-3 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Split Release (Partial Payout)</p>}
                      </div>

                      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">Seller Bank Details</p>
                        <div className="space-y-3">
                          <div><p className="text-[10px] text-slate-500 uppercase">Bank Name</p><p className="font-bold text-sm text-white">{order.seller_bank ?? 'Not provided'}</p></div>
                          <div><p className="text-[10px] text-slate-500 uppercase">Account Name</p><p className="font-bold text-sm text-white">{order.seller_name ?? 'Not provided'}</p></div>
                          <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase">Account Number</p>
                              <p className="font-mono font-bold text-emerald-400">{order.seller_number ?? 'N/A'}</p>
                            </div>
                            {order.seller_number && <CopyButton text={order.seller_number} />}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center gap-3">
                        <p className="text-sm text-slate-400 text-center px-4 leading-relaxed">Transfer the exact amount, then confirm below to complete the escrow.</p>
                        <button
                          disabled={busyOrderId === order.id}
                          onClick={() => confirmCompletePayout(order)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl text-sm transition-all shadow-lg flex justify-center items-center gap-2"
                        >
                          {busyOrderId === order.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Banknote className="w-5 h-5" />}
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
                    <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase px-3 py-1 rounded-full animate-pulse">Disputed</span>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Locked Value</p>
                      <p className="text-2xl font-black text-white">{order.paystack_ref ? '₦' : ''}{Number(order.amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Buyer</p>
                      <p className="text-[10px] font-mono bg-slate-900 p-2 rounded-lg border border-slate-700 text-blue-400 break-all">{order.buyer_email ?? order.buyer_wallet_address ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Seller</p>
                      <p className="text-[10px] font-mono bg-slate-900 p-2 rounded-lg border border-slate-700 text-emerald-400 break-all">{order.seller_email ?? order.seller_name ?? '—'}</p>
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
                        <button disabled={busyOrderId === order.id} onClick={() => confirmResolveDispute(order, 'refunded', false)} className="flex-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all flex justify-center items-center gap-1"><XCircle className="w-3 h-3" /> Std. Refund</button>
                        <button disabled={busyOrderId === order.id} onClick={() => confirmResolveDispute(order, 'refunded', true)} className="flex-1 bg-red-900/40 hover:bg-red-600 border border-red-500/50 text-red-400 hover:text-white font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all flex justify-center items-center gap-1"><Skull className="w-3 h-3" /> Scam: Nuke</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl animate-in fade-in">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Buyer</th>
                  <th className="p-4">Seller</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {fiatHistory.length === 0 ? (
                  <tr><td colSpan={5} className="p-10 text-center text-slate-500 italic">No fiat history found.</td></tr>
                ) : (
                  fiatHistory.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono text-slate-300">#{order.id}</td>
                      <td className="p-4 font-bold text-white">₦{Number(order.amount).toLocaleString()}</td>
                      <td className="p-4 text-[10px] font-mono text-blue-400 break-all">{order.buyer_email ?? order.buyer_wallet_address ?? '—'}</td>
                      <td className="p-4 text-[10px] font-mono text-emerald-400 break-all">{order.seller_email ?? order.seller_name ?? '—'}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                          ['completed', 'success'].includes(order.status) ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          order.status === 'disputed' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                          order.status === 'cancelled' || order.status === 'refunded' ? 'bg-slate-800 text-slate-400 border border-slate-700' :
                          'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                        }`}>{order.status.replace('_', ' ')}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

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
                  <tr><td colSpan={5} className="p-10 text-center text-slate-500 italic">No blockchain escrows found.</td></tr>
                ) : (
                  cryptoOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono text-slate-300">#{order.id}</td>
                      <td className="p-4"><div className="font-bold">{order.amount} {order.symbol}</div></td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1.5 font-mono">
                          <span className="text-emerald-400/80 text-[10px] break-all">BUY: {order.buyer}</span>
                          <span className="text-blue-400/80 text-[10px] break-all">SEL: {order.seller}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                          order.status === 'COMPLETED' ? 'bg-slate-800 text-slate-400 border border-slate-700' :
                          order.status === 'DISPUTED' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}>{order.status}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {order.status === 'ACTIVE' && (
                            <>
                              <button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'REFUND' })} className="px-3 py-1.5 bg-slate-800 hover:bg-red-900/50 border border-slate-700 hover:border-red-500 text-slate-300 hover:text-red-400 text-xs font-bold rounded-lg transition-colors">Refund</button>
                              <button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'DISPUTE' })} className="px-3 py-1.5 bg-slate-800 hover:bg-amber-900/50 border border-slate-700 hover:border-amber-500 text-slate-300 hover:text-amber-400 text-xs font-bold rounded-lg transition-colors">Flag Dispute</button>
                            </>
                          )}
                          {order.status === 'DISPUTED' && (
                            <>
                              <button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'RELEASE', rawAmount: order.rawAmount })} className="px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors">Force Release</button>
                              <button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'REFUND' })} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors">Std. Refund</button>
                              <button onClick={() => setAdminAction({ id: BigInt(order.id), type: 'NUKE', seller: order.seller, rawAmount: order.rawAmount })} className="px-3 py-1.5 bg-red-900/40 hover:bg-red-600 border border-red-500/50 text-red-400 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors flex items-center gap-1"><Skull className="w-3 h-3" /> Scam: Nuke</button>
                            </>
                          )}
                          {order.status === 'COMPLETED' && (
                            <span className="text-slate-600 text-xs font-bold flex items-center gap-1 justify-end"><CheckCircle className="w-3 h-3" /> Finalized</span>
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

        {activeTab === 'STAKING' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-slate-800/30 border border-dashed border-purple-500/30 rounded-3xl p-12 text-center flex flex-col items-center gap-4">
              <Award className="w-16 h-16 text-purple-500/50" />
              <h3 className="text-xl font-bold text-white">Proof-of-Stake Security Hub</h3>
              <p className="text-slate-400 max-w-md mx-auto">This environment will monitor stakers and slash fraudulent merchants. Integration for Gift Card escrow verification is pending deployment.</p>
            </div>
          </div>
        )}
      </main>

      {(isWritePending || isConfirming) && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[250] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-6 text-emerald-500" />
            <p className="text-white font-bold text-lg">Processing on-chain transaction...</p>
          </div>
        </div>
      )}

      {adminAction && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className={`bg-slate-900 border ${adminAction.type === 'NUKE' ? 'border-red-500' : 'border-slate-700'} p-8 rounded-3xl max-w-sm w-full shadow-2xl`}>
            <h3 className="text-xl font-bold mb-2 text-white flex items-center gap-2">
              {adminAction.type === 'NUKE' ? <Skull className="w-6 h-6 text-red-500" /> : <AlertTriangle className="w-5 h-5 text-yellow-500" />}
              Confirm On-Chain Action
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Execute <span className={`font-bold px-2 py-0.5 rounded ${adminAction.type === 'NUKE' ? 'bg-red-600' : 'bg-slate-800'}`}>{adminAction.type}</span> on Order #{adminAction.id.toString()}?
              {adminAction.type === 'NUKE' && <span className="block mt-3 text-red-400 font-bold">This will refund the buyer and permanently lower the seller's trust score.</span>}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAdminAction(null);
                  setPendingCryptoAction(null);
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 py-3.5 rounded-xl font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeCryptoAction}
                disabled={isWritePending || isConfirming}
                className={`flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg ${
                  adminAction.type === 'NUKE' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
                } text-white`}
              >
                {(isWritePending || isConfirming) ? <Loader2 className="animate-spin w-4 h-4" /> : <Gavel className="w-4 h-4" />}
                Execute
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmConfig && <ConfirmModal config={confirmConfig} onClose={() => setConfirmConfig(null)} />}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
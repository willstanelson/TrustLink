import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { parseUnits } from 'viem';
import {
  MessageCircle, AlertTriangle, ThumbsUp, Truck,
  CheckCheck, Loader2, BellRing, CheckCircle, XCircle, Info, Clock
} from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt, useChainId, useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '../lib/supabaseClient';
import dynamic from 'next/dynamic';
import TrustBadge from './TrustBadge';
import { CONTRACT_ABI, CONTRACT_ADDRESS, CHAIN_CONFIG } from '../app/constants';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';

const SecureChat = dynamic(() => import('./SecureChat'), {
  ssr: false,
  loading: () => <div className="hidden">Loading Chat...</div>,
});

type ToastType = 'success' | 'error' | 'warning' | 'info';

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!toasts.length || !mounted) return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={`pointer-events-auto flex items-start gap-3 bg-slate-900 border ${TOAST_BORDER[t.type]} rounded-xl px-4 py-3 shadow-xl cursor-pointer animate-in slide-in-from-right-5 duration-200`}
        >
          {TOAST_ICONS[t.type]}
          <p className="text-sm text-slate-200 leading-snug">{t.message}</p>
        </div>
      ))}
    </div>,
    document.body
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((type: ToastType, message: string, durationMs = 5000) => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), durationMs);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, dismiss, push };
}

type ConfirmConfig = {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
};

function ConfirmModal({ config, onClose }: { config: ConfirmConfig; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-sm w-full shadow-xl animate-in zoom-in-95 duration-200">
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

// FIX 1: Added `lockedBalance` to the Order type — it was missing, causing a TypeScript
//         error and potential runtime crash when the component tried to use it.
// FIX 2: Added optional `sellerEmail` field to cleanly separate a fiat seller's
//         display name (stored in `seller`) from their actual email address for
//         notifications, preventing silent notification failures.
type Order = {
  id: number | string;
  scId?: number;
  buyer: string;
  seller: string;
  sellerEmail?: string;
  amount: bigint;
  lockedBalance: bigint; // FIX 1: Was missing from the type definition
  status: string;
  token_symbol: string;
  token: string;
  isAccepted: boolean;
  isShipped: boolean;
  isDisputed: boolean;
  isCompleted: boolean;
  formattedTotal: string;
  formattedLocked: string;
  percentPaid: number;
  statusColor: string;
  type: string;
};

function parseDisplayAmount(raw: string): number | null {
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseOrderId(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function OrderCard({
  order,
  isSellerView,
  userAddress,
  onUpdate,
}: {
  order: Order;
  isSellerView: boolean;
  userAddress: string;
  onUpdate: () => void;
}) {
  const { toasts, dismiss, push } = useToast();
  const { getAccessToken } = usePrivy();

  const [showChat, setShowChat] = useState(false);
  const [releaseAmount, setReleaseAmount] = useState('');
  const [hasUnread, setHasUnread] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);

  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [showSplitWarning, setShowSplitWarning] = useState(false);
  const [pendingReleaseAmount, setPendingReleaseAmount] = useState('');

  const chatOpenRef = useRef(showChat);
  const actionRef = useRef('');

  // 👇 ADD THIS LINE TO DEFINE THE CONNECTOR 👇
  const { connector: activeConnector } = useAccount(); 

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const chainId = useChainId();
  const activeChainId = CHAIN_CONFIG[chainId] ? chainId : 9746;

  const isFiat     = order.type === 'FIAT';
  const rawOrderId = String(order.id).replace('NGN-', '');
  const dbOrderId  = parseOrderId(rawOrderId);
  const peerAddress = isSellerView ? order.buyer : order.seller;

  // FIX 2: Derive a guaranteed-valid email for peer notifications.
  //         For fiat orders, `order.seller` may be a bank account display name, not
  //         an email. Use `order.sellerEmail` when available, falling back to `order.seller`
  //         only if it contains '@' and no spaces (i.e. it looks like a real email).
  const peerEmail = isSellerView
    ? order.buyer
    : (order.sellerEmail ?? (order.seller.includes('@') && !order.seller.includes(' ') ? order.seller : undefined));

  const displayId = useMemo(() => {
    const numId = Number(rawOrderId);
    if (isNaN(numId)) return order.id;
    const scrambledHex = (numId * 83911).toString(16).toUpperCase();
    return isFiat ? `NGN-${scrambledHex}` : `ORD-${scrambledHex}`;
  }, [rawOrderId, isFiat, order.id]);

  const sendNotification = useCallback(async (to: string, subject: string, message: string) => {
    // FIX 2: Guard strictly — only send if `to` looks like a real email address
    if (!to?.includes('@') || to.includes(' ')) return;
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message }),
      });
      if (!res.ok) {
        console.error(`Notification to ${to} failed (${res.status}):`, await res.text());
      }
    } catch (err) {
      console.error('sendNotification network error:', err);
    }
  }, []);

  const executeUserAction = useCallback(async (actionType: string, payload = {}) => {
    const token = await getAccessToken();
    if (!token) throw new Error('Authentication token missing. Please refresh the page and try again.');

    // FIX 3: Throw early if dbOrderId is null rather than silently passing undefined,
    //         which would cause the server to act on an unintended order.
    if (!dbOrderId) throw new Error('Invalid order ID — cannot perform action.');

    const res = await fetch('/api/user/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ actionType, orderId: dbOrderId, payload }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');
    return data;
  }, [getAccessToken, dbOrderId]);

  useEffect(() => {
    if (writeError) {
      const msg = (writeError as any).shortMessage ?? writeError.message;
      push('error', `Transaction failed: ${msg}`);
      actionRef.current = '';
    }
  }, [writeError, push]);

  useEffect(() => {
    if (!isSuccess) return;

    if (actionRef.current === 'release' && !isFiat) {
      fetch('/api/profile/increment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer: order.buyer, seller: order.seller }),
      }).catch(err => console.error('profile/increment failed:', err));

      // FIX 2: Use peerEmail — guaranteed to be a real email — for notifications
      if (peerEmail) {
        sendNotification(
          peerEmail,
          'Funds Released!',
          `The buyer has released crypto funds from the smart contract for order ${displayId}. Check your wallet!`,
        );
      }
      push('success', 'Funds released successfully!');

    } else if (actionRef.current === 'dispute') {
      if (peerEmail) {
        sendNotification(
          peerEmail,
          'Order Disputed 🚨',
          `A dispute has been raised on-chain for order ${displayId}. An admin will review the chat logs and make a final ruling.`,
        );
      }
      push('warning', 'Dispute raised on-chain. An admin will review shortly.');

    } else if (actionRef.current === 'cancel') {
      push('info', 'Order cancelled. Locked funds will be returned to your wallet.');
    }

    actionRef.current = '';
    setTimeout(onUpdate, 2000);
  }, [isSuccess, isFiat, order.buyer, order.seller, displayId, peerEmail, sendNotification, push, onUpdate]);

  const isBusy = isPending || isConfirming || isDbLoading;

  useEffect(() => {
    chatOpenRef.current = showChat;
    if (showChat) localStorage.setItem(`chat_read_${rawOrderId}`, Date.now().toString());
  }, [showChat, rawOrderId]);

  useEffect(() => {
    if (!userAddress || !dbOrderId) return;

    const checkHistory = async () => {
      const { data } = await supabase
        .from('messages')
        .select('created_at, sender_address')
        .eq('order_id', dbOrderId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data?.length) {
        const isFromOther = data[0].sender_address.toLowerCase() !== userAddress.toLowerCase();
        const lastRead = localStorage.getItem(`chat_read_${rawOrderId}`);
        const msgTime  = new Date(data[0].created_at).getTime();
        if (isFromOther && (!lastRead || msgTime > Number(lastRead))) setHasUnread(true);
      }
    };

    checkHistory();

    const channel = supabase
      .channel(`notify-${rawOrderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${dbOrderId}` },
        (payload) => {
          if (payload.new.sender_address.toLowerCase() !== userAddress.toLowerCase()) {
            if (!chatOpenRef.current) {
              setHasUnread(true);
            } else {
              localStorage.setItem(`chat_read_${rawOrderId}`, Date.now().toString());
            }
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dbOrderId, userAddress, rawOrderId]);

  const openChat = () => {
    setHasUnread(false);
    setShowChat(true);
    localStorage.setItem(`chat_read_${rawOrderId}`, Date.now().toString());
  };

  const closeChat = () => {
    setShowChat(false);
    localStorage.setItem(`chat_read_${rawOrderId}`, Date.now().toString());
  };

  const handleAccept = async () => {
    if (!dbOrderId) { push('error', 'Invalid order ID.'); return; }
    setIsDbLoading(true);
    try {
      await executeUserAction('ACCEPT');
      sendNotification(order.buyer, 'Order Accepted!', `The seller has accepted your order (${displayId}). They are preparing your item/service.`);
      push('success', 'Order accepted.');
      onUpdate();
    } catch (error: any) {
      push('error', `Accept failed: ${error.message}`);
    } finally {
      setIsDbLoading(false);
    }
  };

  const handleMarkShipped = async () => {
    if (!dbOrderId) { push('error', 'Invalid order ID.'); return; }
    setIsDbLoading(true);
    try {
      await executeUserAction('SHIP');
      sendNotification(order.buyer, 'Order Shipped!', `The seller has marked your order (${displayId}) as shipped/delivered. Please verify and release the funds when you are satisfied.`);
      push('success', 'Order marked as shipped.');
      onUpdate();
    } catch (error: any) {
      push('error', `Shipping update failed: ${error.message}`);
    } finally {
      setIsDbLoading(false);
    }
  };

  const handleReleaseClick = (amountStr: string) => {
    if (!amountStr) return;
    const releaseNum = parseDisplayAmount(amountStr);
    const lockedNum  = parseDisplayAmount(order.formattedLocked);

    if (!releaseNum) {
      push('error', 'Release amount must be greater than zero.');
      return;
    }
    if (!lockedNum) {
      push('error', 'Could not determine locked amount. Please refresh.');
      return;
    }
    if (releaseNum > lockedNum) {
      push('error', `Cannot release more than the locked amount (${lockedNum} ${order.token_symbol}).`);
      return;
    }

    const cleanAmount = String(releaseNum);
    if (releaseNum < lockedNum) {
      setPendingReleaseAmount(cleanAmount);
      setShowSplitWarning(true);
    } else {
      executeRelease(cleanAmount);
    }
  };

  const executeRelease = async (cleanAmountStr: string) => {
    const releaseNum = parseDisplayAmount(cleanAmountStr);
    if (!releaseNum) { push('error', 'Invalid release parameters.'); return; }

    if (isFiat) {
      if (!dbOrderId) return;
      setIsDbLoading(true);
      try {
        await executeUserAction('FIAT_RELEASE', { releaseAmount: releaseNum });

        push('success', `${releaseNum} NGN released. Funds will settle in the seller's bank account within 24 hours.`);

        // FIX 2: Use peerEmail — fiat seller field is a display name, not an email
        if (peerEmail) {
          sendNotification(
            peerEmail,
            'Funds Released (Processing)!',
            `The buyer has released ${releaseNum} NGN for order ${displayId}. This payout is processing and will arrive in your bank account within 24 hours.`,
          );
        }

        if (ADMIN_EMAIL) {
          sendNotification(
            ADMIN_EMAIL,
            'ACTION REQUIRED: Manual Fiat Payout',
            `Buyer released ${releaseNum} NGN for order ${dbOrderId}. Transfer to seller once Paystack settles.`,
          );
        }

        onUpdate();
      } catch (err: any) {
        console.error('Fiat release error:', err);
        push('error', `Network error while processing release: ${err.message}`);
      } finally {
        setIsDbLoading(false);
        setReleaseAmount('');
      }
    } else {
      if (order.scId === undefined) { push('error', 'Smart contract ID missing.'); return; }

      const decimals = order.token_symbol === 'USDC' ? 6 : 18;
      setReleaseAmount('');
      actionRef.current = 'release';
      writeContract({
        chainId: activeChainId,
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'releaseMilestone',
        args: [BigInt(order.scId), parseUnits(cleanAmountStr, decimals)],
        connector: activeConnector,
      });
    }
  };

  const confirmDispute = () => {
    setConfirmConfig({
      title: 'Raise a Dispute?',
      body: (
        <>
          This will escalate order <strong className="text-white">{displayId}</strong> to an admin for review.
          <br /><br />
          <span className="text-yellow-400 font-semibold">Funds will remain locked</span> until a ruling is made.
          This action cannot be undone.
        </>
      ),
      confirmLabel: 'Yes, Raise Dispute',
      confirmClass: 'bg-red-600 hover:bg-red-500',
      onConfirm: handleDispute,
    });
  };

  const handleDispute = async () => {
    if (isFiat) {
      if (!dbOrderId) { push('error', 'Invalid order ID.'); return; }
      setIsDbLoading(true);
      try {
        await executeUserAction('DISPUTE');
        // FIX 2: Use peerEmail for fiat dispute notifications
        if (peerEmail) {
          sendNotification(peerEmail, 'Order Disputed 🚨', `A dispute has been raised on order ${displayId}. An admin will review the chat logs and make a final ruling.`);
        }
        push('warning', 'Dispute raised. An admin will review shortly.');
        onUpdate();
      } catch (err: any) {
        push('error', `Failed to raise dispute: ${err.message}`);
      } finally {
        setIsDbLoading(false);
      }
    } else {
      if (order.scId === undefined) { push('error', 'Smart contract ID missing.'); return; }
      actionRef.current = 'dispute';
      writeContract({
        chainId: activeChainId,
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'raiseDispute',
        args: [BigInt(order.scId)],
        connector: activeConnector,
      });
    }
  };

  const confirmCancel = () => {
    setConfirmConfig({
      title: 'Cancel this Order?',
      body: (
        <>
          Are you sure you want to cancel order <strong className="text-white">{displayId}</strong>?
          <br /><br />
          {isFiat
            ? 'Your funds will be returned according to the escrow policy.'
            : 'The smart contract will return your locked funds.'}
          {' '}This action <span className="text-red-400 font-semibold">cannot be undone</span>.
        </>
      ),
      confirmLabel: 'Yes, Cancel Order',
      confirmClass: 'bg-red-600 hover:bg-red-500',
      onConfirm: handleCancel,
    });
  };

  const handleCancel = async () => {
    if (isFiat) {
      if (!dbOrderId) { push('error', 'Invalid order ID.'); return; }
      setIsDbLoading(true);
      try {
        await executeUserAction('CANCEL');
        push('info', 'Order cancelled.');
        onUpdate();
      } catch (err: any) {
        push('error', `Failed to cancel order: ${err.message}`);
      } finally {
        setIsDbLoading(false);
      }
    } else {
      if (order.scId === undefined) { push('error', 'Smart contract ID missing.'); return; }
      actionRef.current = 'cancel';
      writeContract({
        chainId: activeChainId,
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'cancelOrder',
        args: [BigInt(order.scId)],
        connector: activeConnector,
      });
    }
  };

  // FIX 4: Added 'DISPUTED' to the terminal status list. Without it, both buyer and
  //         seller could still trigger dispute/cancel actions on an already-disputed order,
  //         causing duplicate DB writes and confusing UI state.
  const isTerminal = [
    'PAID',
    'COMPLETED',
    'CANCELLED',
    'PROCESSING PAYOUT',
    'DISPUTED',
  ].includes(order.status);

  // FIX 3: Capture chatOrderId so we never pass `0` to SecureChat when dbOrderId is null.
  //         `0` is a falsy-looking but technically valid number that could match real DB rows.
  const chatOrderId = dbOrderId ?? null;

  return (
    <>
      <div className={`bg-slate-800/40 border rounded-xl p-5 mb-4 transition-all relative ${showChat ? 'border-emerald-500 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]' : 'border-slate-700 hover:border-slate-600'}`}>

        {/* HEADER */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-2 items-center">
            <span className="bg-slate-800 text-slate-400 text-xs font-mono px-2 py-1 rounded">{displayId}</span>
            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${order.statusColor}`}>
              {order.status}
            </span>
          </div>
          <div className="text-right">
            <div className="text-white font-bold text-lg">
              {order.formattedLocked} <span className="text-sm text-slate-500">{order.token_symbol}</span>
            </div>
            <div className="text-xs text-slate-500">Total: {order.formattedTotal}</div>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
          <div className="bg-emerald-500 h-full transition-all" style={{ width: `${order.percentPaid}%` }} />
        </div>
        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-6">
          <span>Paid: {order.percentPaid}%</span>
          <span>Locked: {100 - order.percentPaid}%</span>
        </div>

        {/* FIAT 24-HOUR INFO BANNER */}
        {isFiat && !isTerminal && (
          <div className="flex items-start gap-2 bg-blue-900/10 border border-blue-500/20 p-3 rounded-lg mb-6">
            <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-blue-400">Fiat Settlement:</strong> Due to standard bank processing times, fiat payouts can only be completed a minimum of <strong className="text-slate-300">24 hours after the order is created</strong>, even if the buyer releases the funds earlier.
            </p>
          </div>
        )}

        {/* COUNTERPARTY */}
        <div className="flex items-center gap-2 mb-6 text-xs text-slate-400">
          <span>{isSellerView ? 'Buyer:' : 'Seller:'}</span>
          <TrustBadge address={peerAddress} />
        </div>

        {/* ACTIONS */}
        <div className="flex flex-wrap gap-3">

          <button
            onClick={openChat}
            className={`relative flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all border ${hasUnread ? 'bg-slate-700 text-white border-emerald-500' : 'bg-slate-800 text-white border-slate-600 hover:bg-slate-700'}`}
          >
            {hasUnread ? <BellRing className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> : <MessageCircle className="w-3.5 h-3.5" />}
            {showChat ? 'Chat Open' : hasUnread ? 'New Message!' : 'Chat'}
            {hasUnread && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-slate-900" />
              </span>
            )}
          </button>

          {!isTerminal && (
            <>
              {/* BUYER CONTROLS */}
              {!isSellerView && (
                <>
                  {!order.isAccepted && (
                    <button onClick={confirmCancel} disabled={isBusy} className="bg-red-500 hover:bg-red-400 text-white px-4 rounded-lg text-xs font-bold flex items-center justify-center">
                      {isBusy ? <Loader2 className="animate-spin w-4 h-4" /> : 'Cancel'}
                    </button>
                  )}

                  {order.isAccepted && !order.isShipped && (
                    <div className="flex-[2] flex gap-2">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={releaseAmount}
                        onChange={(e) => setReleaseAmount(e.target.value)}
                        className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-2 text-xs text-white focus:border-emerald-500 outline-none"
                      />
                      <button
                        onClick={() => handleReleaseClick(releaseAmount)}
                        disabled={isBusy || !releaseAmount}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center"
                      >
                        {isBusy ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : 'Split Release'}
                      </button>
                    </div>
                  )}

                  {order.isShipped && (
                    <div className="flex-[2] flex gap-2">
                      <button
                        onClick={() => handleReleaseClick(order.formattedLocked)}
                        disabled={isBusy}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold py-3 flex items-center justify-center"
                      >
                        {isBusy ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : 'Release Full Amount'}
                      </button>
                    </div>
                  )}

                  {order.isAccepted && (
                    <button onClick={confirmDispute} disabled={isBusy} className="bg-red-900/20 text-red-400 border border-red-900/30 px-3 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}

              {/* SELLER CONTROLS */}
              {isSellerView && (
                <>
                  {!order.isAccepted && (
                    <button onClick={handleAccept} disabled={isBusy} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                      {isBusy ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : <><ThumbsUp className="w-3.5 h-3.5" /> Accept Order</>}
                    </button>
                  )}
                  {order.isAccepted && !order.isShipped && (
                    <button onClick={handleMarkShipped} disabled={isBusy} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                      {isBusy ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : <><Truck className="w-3.5 h-3.5" /> Mark Shipped</>}
                    </button>
                  )}
                  {order.isShipped && (
                    <div className="flex-[2] bg-slate-700 text-slate-400 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                      <CheckCheck className="w-3.5 h-3.5" /> Shipped – Waiting
                    </div>
                  )}
                  <button onClick={confirmDispute} disabled={isBusy} className="bg-red-900/20 text-red-400 border border-red-900/30 px-3 rounded-lg">
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* FIX 3: Only render SecureChat when chatOrderId is a valid non-null number,
                   preventing a silent `orderId=0` query against the database. */}
        {chatOrderId !== null && (
          <SecureChat
            isOpen={showChat}
            onClose={closeChat}
            peerAddress={peerAddress}
            orderId={chatOrderId}
          />
        )}
      </div>

      {confirmConfig && (
        <ConfirmModal config={confirmConfig} onClose={() => setConfirmConfig(null)} />
      )}

      {showSplitWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/50 p-6 rounded-3xl max-w-sm w-full shadow-[0_0_50px_rgba(239,68,68,0.15)] relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full mb-4 mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-black text-white text-center mb-2">Split Release Warning</h3>
            <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed px-2">
              You are about to release{' '}
              <strong className="text-white bg-slate-800 px-2 py-0.5 rounded">
                {pendingReleaseAmount} {isFiat ? 'NGN' : order.token_symbol}
              </strong>{' '}
              while keeping the rest locked in escrow.
              <br /><br />
              <span className="text-red-400 font-bold uppercase tracking-wider text-xs">High Risk Action</span>
              <br />
              If the seller vanishes after this payment, your remaining funds are safe, but{' '}
              <span className="text-white underline">you cannot claw back this partial payment.</span>
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowSplitWarning(false); executeRelease(pendingReleaseAmount); }}
                className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all"
              >
                I Understand, Release Funds
              </button>
              <button
                onClick={() => setShowSplitWarning(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3.5 rounded-xl font-bold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

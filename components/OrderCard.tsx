'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { formatUnits, parseUnits } from 'viem';
import {
  MessageCircle, AlertTriangle, ThumbsUp, Truck,
  CheckCheck, Loader2, BellRing, CheckCircle, XCircle, Info, Clock
} from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt, useChainId, useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import dynamic from 'next/dynamic';
import TrustBadge from './TrustBadge';
import { CONTRACT_ABI, CONTRACT_ADDRESS, CHAIN_CONFIG } from '../app/constants';
import { useAuth } from '../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';

const TERMINAL_STATUSES = new Set([
  'PAID', 'COMPLETED', 'CANCELLED', 'PROCESSING PAYOUT', 'DISPUTED',
]);

// ─── Safe localStorage ────────────────────────────────────────────────────────
const safeLocalStorage = {
  get: (key: string): string | null =>
    typeof window !== 'undefined' ? localStorage.getItem(key) : null,
  set: (key: string, value: string): void => {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  },
};

// ─── Lazy-loaded SecureChat ───────────────────────────────────────────────────
const SecureChat = dynamic(() => import('./SecureChat'), {
  ssr: false,
  loading: () => <div className="hidden">Loading Chat…</div>,
});

// ─── Toast System ─────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

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

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!toasts.length || !mounted) return null;

  return createPortal(
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
    </div>,
    document.body,
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((type: ToastType, message: string, durationMs = 5000) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, type, message }]);

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, durationMs);

    timers.current.set(id, timer);
  }, []);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, []);

  return { toasts, dismiss, push };
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
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
            onClick={() => {
              onClose();
              config.onConfirm();
            }}
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

// ─── Types & Helpers ──────────────────────────────────────────────────────────
type Order = {
  id: number | string;
  scId?: number;
  buyer: string;
  buyerEmail?: string;
  seller: string;
  sellerEmail?: string;
  amount: bigint;
  lockedBalance: bigint;
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
  gc_image_url?: string;
};

function parseDisplayAmount(raw: string | number): number | null {
  const cleaned = String(raw).replace(/[, ]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseOrderId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function getTokenDecimals(symbol: string): number {
  return symbol === 'USDC' ? 6 : 18;
}

// ─── New Component Helpers ────────────────────────────────────────────────────

/**
 * Strips anything that isn't a digit or a single decimal point.
 * Keeps the raw string intact for downstream parseUnits calls while
 * preventing garbage characters from entering state.
 */
function sanitizeAmountInput(raw: string) {
  const stripped = raw.replace(/[^0-9.]/g, '');
  const parts = stripped.split('.');
  // Collapse multiple decimal points: "1.2.3" → "1.23"
  return parts.length > 2
    ? `${parts[0]}.${parts.slice(1).join('')}`
    : stripped;
}

/**
 * UI-only validation using parseFloat.
 * Never pass the result of this into a smart contract call —
 * JS doubles lose precision on highly fractional token amounts.
 */
function isValidReleaseAmount(rawString: string, lockedAmount: string) {
  if (!rawString || rawString === '.') return false;
  const n = parseFloat(rawString);
  return !isNaN(n) && n > 0 && n <= parseFloat(lockedAmount);
}

// ─── SplitReleaseControl ──────────────────────────────────────────────────────

function SplitReleaseControl({ 
  lockedAmount, 
  isBusy, 
  onRelease 
}: { 
  lockedAmount: string; 
  isBusy: boolean; 
  onRelease: (amount: string) => void;
}) {
  const [releaseAmount, setReleaseAmount] = useState('');

  const isValid = useMemo(
    () => isValidReleaseAmount(releaseAmount, lockedAmount),
    [releaseAmount, lockedAmount]
  );
  const isDisabled = isBusy || !isValid;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setReleaseAmount(sanitizeAmountInput(e.target.value));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    await onRelease(releaseAmount);
    setReleaseAmount('');
  }, [isValid, releaseAmount, onRelease]);

  const maxDisplay = useMemo(() => {
    const n = parseFloat(lockedAmount);
    if (isNaN(n)) return lockedAmount;
    return n.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });
  }, [lockedAmount]);

  return (
    <div className="flex-[2] flex gap-2 items-start">
      <div className="flex flex-col gap-1">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={releaseAmount}
          onChange={handleChange}
          aria-label="Partial release amount"
          aria-describedby="split-release-hint"
          disabled={isBusy}
          className="w-24 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-xs text-white
                     focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors tabular-nums"
        />
        <span
          id="split-release-hint"
          className="text-[10px] text-slate-500 pl-1 tabular-nums leading-none"
        >
          max {maxDisplay}
        </span>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isDisabled}
        className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700
                   text-white rounded-lg text-xs font-bold py-3
                   flex items-center justify-center gap-1.5
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {isBusy
          ? <Loader2 className="animate-spin w-4 h-4" aria-hidden="true" />
          : 'Split Release'}
      </button>
    </div>
  );
}

// ─── BuyerControls ────────────────────────────────────────────────────────────

type BuyerControlsProps = {
  order: {
    isAccepted: boolean;
    isShipped: boolean;
    isGiftCard: boolean;
    lockedAmount: string;
  };
  isBusy: boolean;
  onCancel: () => void;
  onRelease: (amount: string) => void;
  onDispute: () => void;
};

function BuyerControls({ order, isBusy, onCancel, onRelease, onDispute }: BuyerControlsProps) {
  const canCancel    = !order.isAccepted;
  const isDelivering = order.isAccepted && !order.isShipped;
  const isDelivered  = order.isShipped;
  const canDispute   = order.isAccepted;

  const handleFullRelease = useCallback(() => {
    onRelease(order.lockedAmount);
  }, [onRelease, order.lockedAmount]);

  return (
    <>
      {canCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={isBusy}
          aria-label="Cancel order"
          className="bg-red-500 hover:bg-red-400 active:bg-red-600
                     text-white px-4 py-3 rounded-lg text-xs font-bold
                     flex items-center justify-center gap-1.5
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isBusy
            ? <Loader2 className="animate-spin w-4 h-4" aria-hidden="true" />
            : 'Cancel'}
        </button>
      )}

      {isDelivering && (
        <>
          {!order.isGiftCard && (
            <SplitReleaseControl
              lockedAmount={order.lockedAmount}
              isBusy={isBusy}
              onRelease={onRelease}
            />
          )}

          {order.isGiftCard && (
            <div
              role="status"
              aria-label="Waiting for seller to deliver gift card"
              className="flex-[2] bg-slate-700/60 text-slate-400 py-3 rounded-lg text-xs font-bold
                         flex items-center justify-center gap-2
                         border border-slate-600/50 cursor-not-allowed select-none"
            >
              <Clock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              Waiting for delivery
            </div>
          )}
        </>
      )}

      {isDelivered && (
        <button
          type="button"
          onClick={handleFullRelease}
          disabled={isBusy}
          className="flex-[2] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700
                     text-white rounded-lg text-xs font-bold py-3
                     flex items-center justify-center gap-1.5
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isBusy
            ? <Loader2 className="animate-spin w-4 h-4" aria-hidden="true" />
            : order.isGiftCard ? 'Release gift card' : 'Release full amount'}
        </button>
      )}

      {canDispute && (
        <button
          type="button"
          onClick={onDispute}
          disabled={isBusy}
          aria-label="Open a dispute"
          title="Open a dispute"
          className="bg-red-900/20 hover:bg-red-900/30 active:bg-red-900/40
                     text-red-400 border border-red-900/30
                     px-3 py-3 rounded-lg
                     flex items-center justify-center
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <AlertTriangle className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
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
  const {
    id,
    scId,
    buyer,
    buyerEmail,
    seller,
    sellerEmail,
    lockedBalance,
    status,
    token_symbol,
    formattedLocked,
    formattedTotal,
    percentPaid,
    statusColor,
    type,
    gc_image_url,
    isAccepted,
    isShipped,
    isCompleted,
  } = order;

  const { toasts, dismiss, push } = useToast();
  const { getAccessToken } = usePrivy();
  const { supabase } = useAuth();

  const [showChat, setShowChat] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [showSplitWarning, setShowSplitWarning] = useState(false);
  const [pendingReleaseAmount, setPendingReleaseAmount] = useState('');

  const chatOpenRef = useRef(showChat);
  const actionRef = useRef<string>('');

  const { connector: activeConnector } = useAccount();
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const chainId = useChainId();
  const activeChainId = CHAIN_CONFIG[chainId] ? chainId : (Object.keys(CHAIN_CONFIG).map(Number)[0] ?? chainId);

  const isFiat = type === 'FIAT';
  const isGiftCard = type === 'GIFTCARD';
  const isOffChain = isFiat || isGiftCard;

  const rawOrderId = String(id).replace('NGN-', '').replace('GC-', '');
  const dbOrderId = parseOrderId(rawOrderId);

  const peerAddress = isSellerView ? buyer : seller;
  const peerEmail = isSellerView
    ? (buyerEmail ?? (buyer.includes('@') && !buyer.includes(' ') ? buyer : undefined))
    : (sellerEmail ?? (seller.includes('@') && !seller.includes(' ') ? seller : undefined));

  const displayId = useMemo(() => {
    const numId = Number(rawOrderId);
    if (isNaN(numId)) return id;
    const scrambledHex = (numId * 83911).toString(16).toUpperCase();
    if (isFiat) return `NGN-${scrambledHex}`;
    if (isGiftCard) return `GC-${scrambledHex}`;
    return `ORD-${scrambledHex}`;
  }, [rawOrderId, isFiat, isGiftCard, id]);

  const isTerminal = TERMINAL_STATUSES.has(status);
  const isBusy = isPending || isConfirming || isDbLoading;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const sendNotification = useCallback(async (to: string, subject: string, message: string) => {
    if (!to?.includes('@') || to.includes(' ')) return;
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message }),
      });
    } catch (err) {
      console.error('sendNotification failed:', err);
    }
  }, []);

  const executeUserAction = useCallback(
    async (actionType: string, payload: Record<string, unknown> = {}) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication token missing.');
      if (!dbOrderId) throw new Error('Invalid order ID.');

      const res = await fetch('/api/user/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ actionType, orderId: dbOrderId, payload }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      return data;
    },
    [getAccessToken, dbOrderId]
  );

  // ── Transaction Effects ────────────────────────────────────────────────────
  useEffect(() => {
    if (!writeError) return;
    const msg = (writeError as any).shortMessage ?? writeError.message;
    push('error', `Transaction failed: ${msg}`);
    actionRef.current = '';
  }, [writeError, push]);

  useEffect(() => {
    if (!isSuccess) return;

    const completedAction = actionRef.current;
    actionRef.current = '';

    if (!completedAction) return;

    const handleSuccess = async () => {
      if (completedAction === 'release' && !isOffChain) {
        push('info', 'Verifying transaction on-chain…');
        try {
          const token = await getAccessToken();
          const response = await fetch('/api/escrow/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ orderId: dbOrderId, scId, chainId: activeChainId }),
          });

          const result = await response.json();

          fetch('/api/profile/increment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ buyer, seller }),
          }).catch(console.error);

          if (peerEmail) {
            sendNotification(peerEmail, 'Funds Released!', `Funds released for order ${displayId}.`);
          }

          push(result.success ? 'success' : 'warning', result.success ? 'Funds released successfully!' : 'Funds released, sync delayed.');
          onUpdate();
        } catch (err) {
          push('warning', 'Funds released, but UI sync failed. Please refresh.');
        }
      } else if (completedAction === 'dispute') {
        push('warning', 'Dispute raised on-chain. Admin will review shortly.');
        onUpdate();
      } else if (completedAction === 'cancel') {
        push('info', 'Order cancelled. Funds will be returned.');
        onUpdate();
      }
    };

    handleSuccess();
  }, [isSuccess, isOffChain, getAccessToken, dbOrderId, scId, activeChainId, peerEmail, sendNotification, displayId, buyer, seller, push, onUpdate]);

  // ── Chat Logic ─────────────────────────────────────────────────────────────
  useEffect(() => {
    chatOpenRef.current = showChat;
    if (showChat) safeLocalStorage.set(`chat_read_${rawOrderId}`, Date.now().toString());
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
        const lastRead = safeLocalStorage.get(`chat_read_${rawOrderId}`);
        const msgTime = new Date(data[0].created_at).getTime();

        if (isFromOther && (!lastRead || msgTime > Number(lastRead))) {
          setHasUnread(true);
        }
      }
    };

    checkHistory();

    const channel = supabase
      .channel(`notify-${rawOrderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `order_id=eq.${dbOrderId}`,
        },
        (payload) => {
          if (payload.new.sender_address.toLowerCase() !== userAddress.toLowerCase()) {
            if (!chatOpenRef.current) setHasUnread(true);
            else safeLocalStorage.set(`chat_read_${rawOrderId}`, Date.now().toString());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dbOrderId, userAddress, rawOrderId, supabase]);

  const openChat = useCallback(() => {
    setHasUnread(false);
    setShowChat(true);
    safeLocalStorage.set(`chat_read_${rawOrderId}`, Date.now().toString());
  }, [rawOrderId]);

  const closeChat = useCallback(() => {
    setShowChat(false);
    safeLocalStorage.set(`chat_read_${rawOrderId}`, Date.now().toString());
  }, [rawOrderId]);

  // ── Core Actions ───────────────────────────────────────────────────────────
  const handleAccept = useCallback(async () => {
    setIsDbLoading(true);
    try {
      if (isGiftCard) {
        const token = await getAccessToken();
        const res = await fetch('/api/giftcard/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
          body: JSON.stringify({ order_id: dbOrderId }),
        });
        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Failed to accept');
      } else {
        await executeUserAction('ACCEPT');
      }

      if (peerEmail) sendNotification(peerEmail, 'Order Accepted!', `Seller accepted order ${displayId}.`);
      push('success', 'Order accepted successfully.');
      onUpdate();
    } catch (error: unknown) {
      push('error', `Accept failed: ${(error as Error).message}`);
    } finally {
      setIsDbLoading(false);
    }
  }, [isGiftCard, dbOrderId, getAccessToken, executeUserAction, peerEmail, sendNotification, displayId, push, onUpdate]);

  const handleMarkShipped = useCallback(async () => {
    if (!dbOrderId) return;
    setIsDbLoading(true);
    try {
      await executeUserAction('SHIP');
      if (peerEmail) sendNotification(peerEmail, 'Order Shipped!', `Seller marked order ${displayId} as shipped.`);
      push('success', 'Order marked as shipped.');
      onUpdate();
    } catch (error: unknown) {
      push('error', `Shipping update failed: ${(error as Error).message}`);
    } finally {
      setIsDbLoading(false);
    }
  }, [dbOrderId, executeUserAction, peerEmail, sendNotification, displayId, push, onUpdate]);

  const handleRevealCode = useCallback(async () => {
    if (isRevealing) return;
    setIsRevealing(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/giftcard/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ order_id: dbOrderId }),
      });
      const data = await res.json();
      if (data.status && data.code) {
        setRevealedCode(data.code);
        push('success', 'Gift card code revealed successfully');
      } else {
        push('error', data.message || 'Failed to reveal code');
      }
    } catch {
      push('error', 'Network error while revealing code');
    } finally {
      setIsRevealing(false);
    }
  }, [dbOrderId, getAccessToken, push]);

  const executeRelease = useCallback(async (cleanAmountStr: string) => {
    const releaseNum = parseDisplayAmount(cleanAmountStr);
    if (!releaseNum) {
      push('error', 'Invalid release amount.');
      return;
    }

    if (isOffChain) {
      setIsDbLoading(true);
      try {
        if (isGiftCard) {
          const token = await getAccessToken();
          const res = await fetch('/api/giftcard/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
            body: JSON.stringify({ order_id: dbOrderId }),
          });
          const data = await res.json();
          if (!res.ok || !data.status) throw new Error(data.message || 'Release failed');

          push('success', 'Gift Card released successfully!');
          if (peerEmail) {
            sendNotification(peerEmail, 'Gift Card Released!', `Buyer released escrow for order ${displayId}.`);
          }
        } else {
          await executeUserAction('FIAT_RELEASE', { releaseAmount: releaseNum });
          push('success', `${releaseNum} NGN released.`);
          if (peerEmail) sendNotification(peerEmail, 'Funds Released!', `Buyer released ${releaseNum} NGN for order ${displayId}.`);
          if (ADMIN_EMAIL) {
            sendNotification(ADMIN_EMAIL, 'ACTION REQUIRED: Manual Fiat Payout', `Buyer released ${releaseNum} NGN for order ${dbOrderId}.`);
          }
        }
        onUpdate();
      } catch (err: unknown) {
        push('error', `Release failed: ${(err as Error).message}`);
      } finally {
        setIsDbLoading(false);
      }
    } else {
      if (scId === undefined) return;
      actionRef.current = 'release';
      const decimals = getTokenDecimals(token_symbol);
      writeContract({
        chainId: activeChainId,
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'releaseMilestone',
        args: [BigInt(scId), parseUnits(cleanAmountStr, decimals)],
        connector: activeConnector,
      });
    }
  }, [isOffChain, isGiftCard, dbOrderId, getAccessToken, peerEmail, sendNotification, displayId, executeUserAction, scId, token_symbol, activeChainId, activeConnector, writeContract, push, onUpdate]);

  const handleReleaseClick = useCallback((amountStr: string) => {
    if (!amountStr) return;
    const releaseNum = parseDisplayAmount(amountStr);
    if (!releaseNum) {
      push('error', 'Release amount must be greater than zero.');
      return;
    }

    const cleanAmount = String(releaseNum);

    if (isGiftCard) {
      executeRelease(cleanAmount); // Full release only
      return;
    }

    // Fiat & Crypto - allow split
    if (isOffChain) {
      const lockedNum = parseDisplayAmount(formattedLocked);
      if (lockedNum === null) return;

      if (releaseNum > lockedNum) {
        push('error', `Cannot release more than locked amount (${lockedNum} ${token_symbol}).`);
        return;
      }

      if (releaseNum < lockedNum) {
        setPendingReleaseAmount(cleanAmount);
        setShowSplitWarning(true);
      } else {
        executeRelease(cleanAmount);
      }
    } else {
      const decimals = getTokenDecimals(token_symbol);
      const releaseUnits = parseUnits(cleanAmount, decimals);

      if (releaseUnits > lockedBalance) {
        push('error', `Cannot release more than locked amount.`);
        return;
      }

      if (releaseUnits < lockedBalance) {
        setPendingReleaseAmount(cleanAmount);
        setShowSplitWarning(true);
      } else {
        executeRelease(cleanAmount);
      }
    }
  }, [isGiftCard, isOffChain, formattedLocked, lockedBalance, token_symbol, push, executeRelease]);

  const handleDispute = useCallback(async () => {
    if (isOffChain) {
      setIsDbLoading(true);
      try {
        await executeUserAction('DISPUTE');
        if (peerEmail) sendNotification(peerEmail, 'Order Disputed 🚨', `Dispute raised on order ${displayId}.`);
        push('warning', 'Dispute raised. Admin will review shortly.');
        onUpdate();
      } catch (err: unknown) {
        push('error', `Dispute failed: ${(err as Error).message}`);
      } finally {
        setIsDbLoading(false);
      }
    } else {
      if (scId === undefined) return;
      actionRef.current = 'dispute';
      writeContract({
        chainId: activeChainId,
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'raiseDispute',
        args: [BigInt(scId)],
        connector: activeConnector,
      });
    }
  }, [isOffChain, executeUserAction, peerEmail, sendNotification, displayId, push, onUpdate, scId, activeChainId, activeConnector, writeContract]);

  const confirmDispute = useCallback(() => {
    setConfirmConfig({
      title: 'Raise Dispute?',
      body: <>Escalate order <strong>{displayId}</strong> to admin review.<br /><br />Funds remain locked until ruling.</>,
      confirmLabel: 'Yes, Raise Dispute',
      confirmClass: 'bg-red-600 hover:bg-red-500',
      onConfirm: handleDispute,
    });
  }, [displayId, handleDispute]);

  const handleCancel = useCallback(async () => {
    if (isOffChain) {
      setIsDbLoading(true);
      try {
        await executeUserAction('CANCEL');
        push('info', 'Order cancelled.');
        onUpdate();
      } catch (err: unknown) {
        push('error', `Cancel failed: ${(err as Error).message}`);
      } finally {
        setIsDbLoading(false);
      }
    } else {
      if (scId === undefined) return;
      actionRef.current = 'cancel';
      writeContract({
        chainId: activeChainId,
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'cancelOrder',
        args: [BigInt(scId)],
        connector: activeConnector,
      });
    }
  }, [isOffChain, executeUserAction, push, onUpdate, scId, activeChainId, activeConnector, writeContract]);

  const confirmCancel = useCallback(() => {
    setConfirmConfig({
      title: 'Cancel Order?',
      body: <>Cancel order <strong>{displayId}</strong>? This action cannot be undone.</>,
      confirmLabel: 'Yes, Cancel Order',
      confirmClass: 'bg-red-600 hover:bg-red-500',
      onConfirm: handleCancel,
    });
  }, [displayId, handleCancel]);

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className={`bg-slate-800/40 border rounded-xl p-5 mb-4 transition-all relative ${showChat ? 'border-emerald-500 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]' : 'border-slate-700 hover:border-slate-600'}`}>
        
        {/* HEADER */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-2 items-center">
            <span className="bg-slate-800 text-slate-400 text-xs font-mono px-2 py-1 rounded">
              {displayId}
            </span>
            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${statusColor}`}>
              {status}
            </span>
          </div>
          <div className="text-right">
            <div className="text-white font-bold text-lg">
              {formattedLocked} <span className="text-sm text-slate-500">{token_symbol}</span>
            </div>
            <div className="text-xs text-slate-500">Total: {formattedTotal}</div>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
          <div
            className="bg-emerald-500 h-full transition-all"
            style={{ width: `${percentPaid}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-6">
          <span>Paid: {percentPaid}%</span>
          <span>Locked: {100 - percentPaid}%</span>
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
          {/* Chat button */}
          <button
            onClick={openChat}
            className={`relative flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all border ${
              hasUnread
                ? 'bg-slate-700 text-white border-emerald-500'
                : 'bg-slate-800 text-white border-slate-600 hover:bg-slate-700'
            }`}
          >
            {hasUnread ? (
              <BellRing className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <MessageCircle className="w-3.5 h-3.5" />
            )}
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
              {/* ── Buyer controls ── */}
              {!isSellerView && (
                <BuyerControls
                  order={{
                    isAccepted: order.isAccepted,
                    isShipped: order.isShipped,
                    isGiftCard: isGiftCard,
                    // Convert the locked amount to a clean, comma-free raw string for the component
                    lockedAmount: isOffChain 
                      ? String(parseDisplayAmount(order.formattedLocked) || 0)
                      : formatUnits(order.lockedBalance, getTokenDecimals(order.token_symbol))
                  }}
                  isBusy={isBusy}
                  onCancel={confirmCancel}
                  onRelease={handleReleaseClick} 
                  onDispute={confirmDispute}
                />
              )}

              {/* ── Seller controls ── */}
              {isSellerView && (
                <>
                  {!isAccepted && (
                    <button onClick={handleAccept} disabled={isBusy} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                      {isBusy ? <Loader2 className="animate-spin w-4 h-4" /> : <><ThumbsUp className="w-3.5 h-3.5" /> Accept Order</>}
                    </button>
                  )}

                  {isAccepted && !isShipped && (
                    <button onClick={handleMarkShipped} disabled={isBusy} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                      {isBusy ? <Loader2 className="animate-spin w-4 h-4" /> : <><Truck className="w-3.5 h-3.5" /> Mark Shipped</>}
                    </button>
                  )}

                  {isShipped && (
                    <div className="flex-[2] bg-slate-700 text-slate-400 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                      <CheckCheck className="w-3.5 h-3.5" /> Shipped – Waiting Release
                    </div>
                  )}

                  <button onClick={confirmDispute} disabled={isBusy} className="bg-red-900/20 text-red-400 border border-red-900/30 px-3 rounded-lg flex items-center justify-center disabled:opacity-50">
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Gift Card Reveal Section */}
        {isGiftCard && (status === 'COMPLETED' || isCompleted) && isSellerView && (
          <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg flex flex-col gap-3">
            
            {revealedCode ? (
              // 🟢 WHAT THEY SEE AFTER CLICKING REVEAL
              <>
                <div className="flex justify-between items-center bg-slate-900 p-3 rounded border border-emerald-500/30">
                  <span className="font-mono text-emerald-400 font-bold tracking-widest">{revealedCode}</span>
                  <button onClick={() => navigator.clipboard.writeText(revealedCode).then(() => push('success', 'Copied!'))} className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded hover:bg-emerald-500/20 transition-colors">
                    Copy Code
                  </button>
                </div>

                {/* Only show the image link AFTER the code is revealed */}
                {gc_image_url && (
                  <>
                    <hr className="border-slate-700" />
                    <a href={gc_image_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center justify-center gap-2 bg-slate-900/50 py-2.5 rounded hover:bg-slate-900 transition-colors border border-slate-700/50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      View Physical Card Image
                    </a>
                  </>
                )}
              </>
            ) : (
              // 🔴 WHAT THEY SEE BEFORE CLICKING REVEAL
              <button onClick={handleRevealCode} disabled={isRevealing} className="w-full py-3 bg-indigo-600/20 text-indigo-400 font-bold text-sm rounded-lg hover:bg-indigo-600/30 transition-colors disabled:opacity-50 border border-indigo-500/30">
                {isRevealing ? 'Decrypting Secure Vault...' : 'Reveal Gift Card Code & Image'}
              </button>
            )}
          </div>
        )}

        {dbOrderId !== null && showChat && (
          <SecureChat isOpen={showChat} onClose={closeChat} peerAddress={peerAddress} orderId={dbOrderId} />
        )}
      </div>

      {confirmConfig && <ConfirmModal config={confirmConfig} onClose={() => setConfirmConfig(null)} />}

      {showSplitWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/50 p-6 rounded-3xl max-w-sm w-full shadow-xl">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <h3 className="text-xl font-black text-center mb-4">Split Release Warning</h3>
            <p className="text-slate-400 text-center mb-6">
              You are releasing <strong>{pendingReleaseAmount} {token_symbol}</strong> while keeping the rest locked.<br /><br />
              This action is irreversible.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setShowSplitWarning(false); executeRelease(pendingReleaseAmount); }} className="bg-red-600 hover:bg-red-500 py-3 rounded-xl font-bold">
                I Understand - Release Funds
              </button>
              <button onClick={() => setShowSplitWarning(false)} className="bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold">
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
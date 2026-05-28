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
  'PAID',
  'COMPLETED',
  'CANCELLED',
  'PROCESSING PAYOUT',
  'DISPUTED',
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

// ─── Toast system ─────────────────────────────────────────────────────────────

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
    document.body,
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  // Map from id → timer so we can clear by id and prune cleanly
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (type: ToastType, message: string, durationMs = 5000) => {
      const id = ++counter.current;
      setToasts(prev => [...prev, { id, type, message }]);
      const timer = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        timers.current.delete(id); // prune after auto-dismiss
      }, durationMs);
      timers.current.set(id, timer);
    },
    [],
  );

  // Cleanup all on unmount
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    [],
  );

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

function ConfirmModal({
  config,
  onClose,
}: {
  config: ConfirmConfig;
  onClose: () => void;
}) {
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strips commas and whitespace before parsing so that locale-formatted strings
 * like "1,234.56" are handled correctly. Uses parseFloat (not Number()) so that
 * scientific-notation strings like "1.5e3" and plain decimals both work.
 */
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

// ─── Component ────────────────────────────────────────────────────────────────

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
  const { supabase } = useAuth();

  const [showChat, setShowChat] = useState(false);
  const [releaseAmount, setReleaseAmount] = useState('');
  const [hasUnread, setHasUnread] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);

  // Gift Card reveal state
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);

  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [showSplitWarning, setShowSplitWarning] = useState(false);
  const [pendingReleaseAmount, setPendingReleaseAmount] = useState('');

  const chatOpenRef = useRef(showChat);

  // Snapshot-safe action tracking — read once at the top of the isSuccess
  // handler to avoid stale closure issues across async awaits.
  const actionRef = useRef('');

  const { connector: activeConnector } = useAccount();
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const chainId = useChainId();
  const activeChainId = CHAIN_CONFIG[chainId]
    ? chainId
    : (Object.keys(CHAIN_CONFIG).map(Number)[0] ?? chainId);

  const isFiat     = order.type === 'FIAT';
  const isGiftCard = order.type === 'GIFTCARD';
  const isOffChain = isFiat || isGiftCard;

  const rawOrderId = String(order.id).replace('NGN-', '').replace('GC-', '');
  const dbOrderId  = parseOrderId(rawOrderId);

  const peerAddress = isSellerView ? order.buyer : order.seller;

  const peerEmail = isSellerView
    ? (order.buyerEmail  ?? (order.buyer.includes('@')  && !order.buyer.includes(' ')  ? order.buyer  : undefined))
    : (order.sellerEmail ?? (order.seller.includes('@') && !order.seller.includes(' ') ? order.seller : undefined));

  const displayId = useMemo(() => {
    const numId = Number(rawOrderId);
    if (isNaN(numId)) return order.id;
    const scrambledHex = (numId * 83_911).toString(16).toUpperCase();
    if (isFiat)     return `NGN-${scrambledHex}`;
    if (isGiftCard) return `GC-${scrambledHex}`;
    return `ORD-${scrambledHex}`;
  }, [rawOrderId, isFiat, isGiftCard, order.id]);

  const isTerminal = TERMINAL_STATUSES.has(order.status);

  // ── Notifications ──────────────────────────────────────────────────────────

  const sendNotification = useCallback(
    async (to: string, subject: string, message: string) => {
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
    },
    [],
  );

  // ── Authenticated action helper ────────────────────────────────────────────

  const executeUserAction = useCallback(
    async (actionType: string, payload: Record<string, unknown> = {}) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication token missing. Please refresh and try again.');
      if (!dbOrderId) throw new Error('Invalid order ID — cannot perform action.');

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
    [getAccessToken, dbOrderId],
  );

  // ── On-chain tx error ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!writeError) return;
    const msg = (writeError as { shortMessage?: string }).shortMessage ?? writeError.message;
    push('error', `Transaction failed: ${msg}`);
    actionRef.current = '';
  }, [writeError, push]);

  // ── On-chain tx success ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSuccess) return;

    // Snapshot immediately — async work below must not re-read actionRef
    // after a re-render could have cleared it.
    const completedAction = actionRef.current;
    actionRef.current = '';

    const handleSuccess = async () => {
      if (completedAction === 'release' && !isOffChain) {
        push('info', 'Verifying transaction on-chain…');
        try {
          const token = await getAccessToken();
          if (!token) throw new Error('Auth token missing');

          const response = await fetch('/api/escrow/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              orderId: dbOrderId,
              scId: order.scId,
              chainId: activeChainId,
            }),
          });

          const result = await response.json();

          // Fire-and-forget: increment trade counters
          fetch('/api/profile/increment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ buyer: order.buyer, seller: order.seller }),
          }).catch(err => console.error('profile/increment failed:', err));

          if (peerEmail) {
            sendNotification(
              peerEmail,
              'Funds Released!',
              `The buyer has released crypto funds from the smart contract for order ${displayId}. Check your wallet!`,
            );
          }

          if (result.success) {
            push('success', 'Funds released successfully!');
          } else {
            push('warning', 'Funds released, but status sync delayed. Refresh in a moment.');
          }
          onUpdate();
        } catch (err) {
          console.error('Sync failed:', err);
          push('warning', 'Funds released, but UI sync failed. Please refresh manually.');
        }

      } else if (completedAction === 'dispute') {
        try {
          const token = await getAccessToken();
          if (token) {
            const response = await fetch('/api/escrow/sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                orderId: dbOrderId,
                scId: order.scId,
                chainId: activeChainId,
              }),
            });
            const result = await response.json();
            if (result.success) onUpdate();
          }
        } catch (err) {
          console.error('Dispute sync failed:', err);
        }

        if (peerEmail) {
          sendNotification(
            peerEmail,
            'Order Disputed 🚨',
            `A dispute has been raised on-chain for order ${displayId}.`,
          );
        }
        push('warning', 'Dispute raised on-chain. An admin will review shortly.');

      } else if (completedAction === 'cancel') {
        push('info', 'Order cancelled. Locked funds will be returned to your wallet.');
        onUpdate();
      }
    };

    handleSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);
  // Intentional: values used inside handleSuccess are captured via closures or
  // the completedAction snapshot. Adding them to deps would cause double-fires.

  const isBusy = isPending || isConfirming || isDbLoading;

  // ── Chat read tracking ─────────────────────────────────────────────────────

  useEffect(() => {
    chatOpenRef.current = showChat;
    if (showChat) safeLocalStorage.set(`chat_read_${rawOrderId}`, Date.now().toString());
  }, [showChat, rawOrderId]);

  // ── Unread message detection ───────────────────────────────────────────────

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
        const lastRead    = safeLocalStorage.get(`chat_read_${rawOrderId}`);
        const msgTime     = new Date(data[0].created_at).getTime();
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
        payload => {
          if (payload.new.sender_address.toLowerCase() !== userAddress.toLowerCase()) {
            if (!chatOpenRef.current) {
              setHasUnread(true);
            } else {
              safeLocalStorage.set(`chat_read_${rawOrderId}`, Date.now().toString());
            }
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dbOrderId, userAddress, rawOrderId, supabase]);

  // ── Chat helpers ───────────────────────────────────────────────────────────

  const openChat = useCallback(() => {
    setHasUnread(false);
    setShowChat(true);
    safeLocalStorage.set(`chat_read_${rawOrderId}`, Date.now().toString());
  }, [rawOrderId]);

  const closeChat = useCallback(() => {
    setShowChat(false);
    safeLocalStorage.set(`chat_read_${rawOrderId}`, Date.now().toString());
  }, [rawOrderId]);

  // ── Accept ─────────────────────────────────────────────────────────────────

  const handleAccept = useCallback(async () => {
    setIsDbLoading(true);
    try {
      if (isGiftCard) {
        const token = await getAccessToken();
        const res = await fetch('/api/giftcard/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ order_id: dbOrderId }),
        });
        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Failed to accept order');
      } else {
        if (!dbOrderId) throw new Error('Invalid order ID.');
        await executeUserAction('ACCEPT');
      }
      if (peerEmail) {
        sendNotification(
          peerEmail,
          'Order Accepted!',
          `The seller has accepted your order (${displayId}). They are preparing your item/service.`,
        );
      }
      push('success', 'Order accepted.');
      onUpdate();
    } catch (error: unknown) {
      push('error', `Accept failed: ${(error as Error).message}`);
    } finally {
      setIsDbLoading(false);
    }
  }, [isGiftCard, dbOrderId, getAccessToken, executeUserAction, peerEmail, sendNotification, displayId, push, onUpdate]);

  // ── Mark Shipped ───────────────────────────────────────────────────────────

  const handleMarkShipped = useCallback(async () => {
    if (!dbOrderId) { push('error', 'Invalid order ID.'); return; }
    setIsDbLoading(true);
    try {
      await executeUserAction('SHIP');
      if (peerEmail) {
        sendNotification(
          peerEmail,
          'Order Shipped!',
          `The seller has marked your order (${displayId}) as shipped/delivered. Please verify and release funds when satisfied.`,
        );
      }
      push('success', 'Order marked as shipped/delivered.');
      onUpdate();
    } catch (error: unknown) {
      push('error', `Shipping update failed: ${(error as Error).message}`);
    } finally {
      setIsDbLoading(false);
    }
  }, [dbOrderId, executeUserAction, peerEmail, sendNotification, displayId, push, onUpdate]);

  // ── Gift Card Reveal ───────────────────────────────────────────────────────

  const handleRevealCode = useCallback(async () => {
    setIsRevealing(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/giftcard/reveal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ order_id: dbOrderId }),
      });
      const data = await res.json();
      if (data.status) {
        setRevealedCode(data.code);
        push('success', 'Code revealed successfully');
      } else {
        push('error', data.message || 'Failed to reveal code');
      }
    } catch {
      push('error', 'Network error while revealing code');
    } finally {
      setIsRevealing(false);
    }
  }, [dbOrderId, getAccessToken, push]);

// ── Release ────────────────────────────────────────────────────────────────

  const handleReleaseClick = useCallback(
    (amountStr: string) => {
      if (!amountStr) return;
      const releaseNum = parseDisplayAmount(amountStr);
      if (!releaseNum) {
        push('error', 'Release amount must be greater than zero.');
        return;
      }

      const cleanAmount = String(releaseNum);

      if (isOffChain) {
        // 🚀 FIX: Web2 Logic (Gift Cards & Fiat) — Compare flat numbers
        const lockedNum = parseDisplayAmount(order.formattedLocked);
        if (lockedNum === null) {
          push('error', 'Could not determine locked amount. Please refresh.');
          return;
        }
        
        if (releaseNum > lockedNum) {
          push('error', `Cannot release more than the locked amount (${lockedNum} ${order.token_symbol}).`);
          return;
        }

        if (releaseNum < lockedNum) {
          setPendingReleaseAmount(cleanAmount);
          setShowSplitWarning(true);
        } else {
          executeRelease(cleanAmount);
        }
      } else {
        // 🛡️ Web3 Logic (Crypto) — Compare exact BigInts to prevent precision loss
        const decimals = getTokenDecimals(order.token_symbol);
        const releaseUnits = parseUnits(cleanAmount, decimals);

        if (releaseUnits > order.lockedBalance) {
          const lockedFormatted = formatUnits(order.lockedBalance, decimals);
          push('error', `Cannot release more than the locked amount (${lockedFormatted} ${order.token_symbol}).`);
          return;
        }

        if (releaseUnits < order.lockedBalance) {
          setPendingReleaseAmount(cleanAmount);
          setShowSplitWarning(true);
        } else {
          executeRelease(cleanAmount);
        }
      }
    },
    [isOffChain, order.formattedLocked, order.lockedBalance, order.token_symbol, push, executeRelease],
  );
  
  const executeRelease = useCallback(
    async (cleanAmountStr: string) => {
      const releaseNum = parseDisplayAmount(cleanAmountStr);
      if (!releaseNum) { push('error', 'Invalid release parameters.'); return; }

      if (isOffChain) {
        if (!dbOrderId) { push('error', 'Invalid order ID.'); return; }
        setIsDbLoading(true);
        try {
          if (isGiftCard) {
            const token = await getAccessToken();
            const res = await fetch('/api/giftcard/release', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ order_id: dbOrderId }),
            });
            const data = await res.json();
            if (!res.ok || !data.status) throw new Error(data.message || 'Release failed');
            push('success', 'Gift Card released! The code is now revealed to the seller.');
            if (peerEmail) {
              sendNotification(
                peerEmail,
                'Gift Card Released!',
                `The buyer has released the escrow for order ${displayId}. You can now view the decrypted Gift Card code in your dashboard.`,
              );
            }
          } else {
            await executeUserAction('FIAT_RELEASE', { releaseAmount: releaseNum });
            push('success', `${releaseNum} NGN released. Funds will settle in the seller's bank within 24 hours.`);
            if (peerEmail) {
              sendNotification(
                peerEmail,
                'Funds Released (Processing)!',
                `The buyer has released ${releaseNum} NGN for order ${displayId}. Payout will arrive within 24 hours.`,
              );
            }
            if (ADMIN_EMAIL) {
              sendNotification(
                ADMIN_EMAIL,
                'ACTION REQUIRED: Manual Fiat Payout',
                `Buyer released ${releaseNum} NGN for order ${dbOrderId}. Transfer to seller once Paystack settles.`,
              );
            }
          }
          onUpdate();
        } catch (err: unknown) {
          console.error('Release error:', err);
          push('error', `Release failed: ${(err as Error).message}`);
        } finally {
          setIsDbLoading(false);
          setReleaseAmount('');
        }
      } else {
        if (order.scId === undefined) { push('error', 'Smart contract ID missing.'); return; }
        setReleaseAmount('');
        actionRef.current = 'release';
        const decimals = getTokenDecimals(order.token_symbol);
        writeContract({
          chainId: activeChainId,
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'releaseMilestone',
          args: [BigInt(order.scId), parseUnits(cleanAmountStr, decimals)],
          connector: activeConnector,
        });
      }
    },
    [
      isOffChain, isGiftCard, dbOrderId, getAccessToken, peerEmail, sendNotification,
      displayId, executeUserAction, order.scId, order.token_symbol, activeChainId,
      activeConnector, writeContract, push, onUpdate,
    ],
  );

  // ── Dispute ────────────────────────────────────────────────────────────────

  const handleDispute = useCallback(async () => {
    if (isOffChain) {
      if (!dbOrderId) { push('error', 'Invalid order ID.'); return; }
      setIsDbLoading(true);
      try {
        await executeUserAction('DISPUTE');
        if (peerEmail) {
          sendNotification(
            peerEmail,
            'Order Disputed 🚨',
            `A dispute has been raised on order ${displayId}. An admin will review the chat logs and make a final ruling.`,
          );
        }
        push('warning', 'Dispute raised. An admin will review shortly.');
        onUpdate();
      } catch (err: unknown) {
        push('error', `Failed to raise dispute: ${(err as Error).message}`);
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
  }, [
    isOffChain, dbOrderId, executeUserAction, peerEmail, sendNotification,
    displayId, push, onUpdate, order.scId, activeChainId, activeConnector, writeContract,
  ]);

  const confirmDispute = useCallback(() => {
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
  }, [displayId, handleDispute]);

  // ── Cancel ─────────────────────────────────────────────────────────────────

  const handleCancel = useCallback(async () => {
    if (isOffChain) {
      if (!dbOrderId) { push('error', 'Invalid order ID.'); return; }
      setIsDbLoading(true);
      try {
        await executeUserAction('CANCEL');
        push('info', 'Order cancelled.');
        onUpdate();
      } catch (err: unknown) {
        push('error', `Failed to cancel order: ${(err as Error).message}`);
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
  }, [
    isOffChain, dbOrderId, executeUserAction, push, onUpdate,
    order.scId, activeChainId, activeConnector, writeContract,
  ]);

  const confirmCancel = useCallback(() => {
    setConfirmConfig({
      title: 'Cancel this Order?',
      body: (
        <>
          Are you sure you want to cancel order <strong className="text-white">{displayId}</strong>?
          <br /><br />
          {isOffChain
            ? 'Your funds will be returned according to the escrow policy.'
            : 'The smart contract will return your locked funds.'}
          {' '}This action <span className="text-red-400 font-semibold">cannot be undone</span>.
        </>
      ),
      confirmLabel: 'Yes, Cancel Order',
      confirmClass: 'bg-red-600 hover:bg-red-500',
      onConfirm: handleCancel,
    });
  }, [displayId, isOffChain, handleCancel]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className={`bg-slate-800/40 border rounded-xl p-5 mb-4 transition-all relative ${
          showChat
            ? 'border-emerald-500 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]'
            : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        {/* HEADER */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-2 items-center">
            <span className="bg-slate-800 text-slate-400 text-xs font-mono px-2 py-1 rounded">
              {displayId}
            </span>
            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${order.statusColor}`}>
              {order.status}
            </span>
          </div>
          <div className="text-right">
            <div className="text-white font-bold text-lg">
              {order.formattedLocked}{' '}
              <span className="text-sm text-slate-500">{order.token_symbol}</span>
            </div>
            <div className="text-xs text-slate-500">Total: {order.formattedTotal}</div>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
          <div
            className="bg-emerald-500 h-full transition-all"
            style={{ width: `${order.percentPaid}%` }}
          />
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
              <strong className="text-blue-400">Fiat Settlement:</strong> Bank processing means fiat
              payouts can only complete a minimum of{' '}
              <strong className="text-slate-300">24 hours after order creation</strong>, even if the
              buyer releases funds earlier.
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
                <>
                  {!order.isAccepted && (
                    <button
                      onClick={confirmCancel}
                      disabled={isBusy}
                      className="bg-red-500 hover:bg-red-400 text-white px-4 rounded-lg text-xs font-bold flex items-center justify-center disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 className="animate-spin w-4 h-4" /> : 'Cancel'}
                    </button>
                  )}

                  {order.isAccepted && !order.isShipped && (
                    <div className="flex-[2] flex gap-2">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={releaseAmount}
                        onChange={e => setReleaseAmount(e.target.value)}
                        className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-2 text-xs text-white focus:border-emerald-500 outline-none"
                      />
                      <button
                        onClick={() => handleReleaseClick(releaseAmount)}
                        disabled={isBusy || !releaseAmount}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center disabled:opacity-50"
                      >
                        {isBusy ? (
                          <Loader2 className="animate-spin w-4 h-4 mx-auto" />
                        ) : (
                          'Split Release'
                        )}
                      </button>
                    </div>
                  )}

                  {order.isShipped && (
                    <div className="flex-[2] flex gap-2">
                      <button
                        onClick={() => handleReleaseClick(order.formattedLocked)}
                        disabled={isBusy}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold py-3 flex items-center justify-center disabled:opacity-50"
                      >
                        {isBusy ? (
                          <Loader2 className="animate-spin w-4 h-4 mx-auto" />
                        ) : (
                          'Release Full Amount'
                        )}
                      </button>
                    </div>
                  )}

                  {order.isAccepted && (
                    <button
                      onClick={confirmDispute}
                      disabled={isBusy}
                      className="bg-red-900/20 text-red-400 border border-red-900/30 px-3 rounded-lg flex items-center justify-center disabled:opacity-50"
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}

              {/* ── Seller controls ── */}
              {isSellerView && (
                <>
                  {!order.isAccepted && (
                    <button
                      onClick={handleAccept}
                      disabled={isBusy}
                      className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="animate-spin w-4 h-4 mx-auto" />
                      ) : (
                        <><ThumbsUp className="w-3.5 h-3.5" /> Accept Order</>
                      )}
                    </button>
                  )}
                  {order.isAccepted && !order.isShipped && (
                    <button
                      onClick={handleMarkShipped}
                      disabled={isBusy}
                      className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="animate-spin w-4 h-4 mx-auto" />
                      ) : (
                        <><Truck className="w-3.5 h-3.5" /> Mark Shipped</>
                      )}
                    </button>
                  )}
                  {order.isShipped && (
                    <div className="flex-[2] bg-slate-700 text-slate-400 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                      <CheckCheck className="w-3.5 h-3.5" /> Shipped – Waiting
                    </div>
                  )}
                  <button
                    onClick={confirmDispute}
                    disabled={isBusy}
                    className="bg-red-900/20 text-red-400 border border-red-900/30 px-3 rounded-lg flex items-center justify-center disabled:opacity-50"
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Gift Card Reveal & Image Section */}
        {isGiftCard && (order.status === 'COMPLETED' || order.isCompleted) && isSellerView && (
          <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg flex flex-col gap-3">
            {/* Image link */}
            {order.gc_image_url ? (
              <a
                href={order.gc_image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                View Uploaded Gift Card Image
              </a>
            ) : (
              <span className="text-sm text-slate-500">No image uploaded</span>
            )}

            <hr className="border-slate-700" />

            {/* Code reveal */}
            {revealedCode ? (
              <div className="flex justify-between items-center bg-slate-900 p-3 rounded border border-emerald-500/30">
                <span className="font-mono text-emerald-400 font-bold tracking-widest">
                  {revealedCode}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard
                      .writeText(revealedCode)
                      .then(() => push('success', 'Copied to clipboard!'))
                      .catch(() => push('error', 'Copy failed — select code manually'));
                  }}
                  className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded hover:bg-emerald-500/20 transition-colors"
                >
                  Copy Code
                </button>
              </div>
            ) : (
              <button
                onClick={handleRevealCode}
                disabled={isRevealing}
                className="w-full py-2 bg-indigo-600/20 text-indigo-400 font-bold text-sm rounded hover:bg-indigo-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRevealing ? 'Decrypting Code…' : 'Reveal Gift Card Code'}
              </button>
            )}
          </div>
        )}

        {/* Only mount SecureChat when actually open — avoids spurious Supabase WS connections */}
        {dbOrderId !== null && showChat && (
          <SecureChat
            isOpen={showChat}
            onClose={closeChat}
            peerAddress={peerAddress}
            orderId={dbOrderId}
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
              <span className="text-red-400 font-bold uppercase tracking-wider text-xs">
                High Risk Action
              </span>
              <br />
              If the seller vanishes after this payment, your remaining funds are safe, but{' '}
              <span className="text-white underline">you cannot claw back this partial payment.</span>
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowSplitWarning(false);
                  executeRelease(pendingReleaseAmount);
                }}
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

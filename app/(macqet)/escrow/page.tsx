'use client';

import WalletModal from '@/components/WalletModal';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import {
  useReadContract,
  useReadContracts,
  useAccount,
  useSwitchChain,
  useBalance,
  useChainId,
} from 'wagmi';
import {
  createWalletClient,
  createPublicClient,
  custom,
  parseUnits,
  formatEther,
  formatUnits,
  isAddress,
} from 'viem';
import { CONTRACT_ABI, CONTRACT_ADDRESS, CHAIN_CONFIG, DEFAULT_CHAIN_ID, SUPPORTED_CHAIN_IDS } from '@/app/constants';
import React, {
  useEffect,
  useState,
  useMemo,
  Suspense,
  useCallback,
  useRef,
} from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { useLiveRates } from '@/lib/rates';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  Loader2,
  RefreshCcw,
  AlertTriangle,
  Wallet,
  ChevronDown,
  X,
  CheckCircle2,
  Banknote,
  Bitcoin,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  UserCheck,
  Search,
  Mail,
  Globe,
  Gift,
  ShieldCheck,
  Clock,
  Plus,
  ThumbsUp,
  Truck,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  XCircle,
  Coins,
  Eye,
  EyeOff,
} from 'lucide-react';

const SecureChat = dynamic(() => import('@/components/SecureChat'), {
  ssr: false,
});

// ─── Constants ───────────────────────────────────────────────────────────────

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const POLL_INTERVAL_DB = 8_000;
const POLL_INTERVAL_CHAIN = 60_000;

function parseDbOrderId(rawId: string | number): number {
  const clean = String(rawId).replace('NGN-', '').replace('GC-', '');
  const n = Number(clean);
  return isNaN(n) ? 0 : n;
}

const ERC20_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ─── Utility helpers ──────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function sanitize(value: string, maxLen = 200): string {
  return value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, maxLen).trim();
}

function isSafePaystackUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'checkout.paystack.com' || parsed.hostname.endsWith('.paystack.com'))
    );
  } catch {
    return false;
  }
}

// ─── Split Release Milestone Modal Component ──────────────────────────────────

function SplitReleaseModal({
  order,
  onClose,
  onConfirm,
  rates,
  activeCurrencySymbol,
}: {
  order: any;
  onClose: () => void;
  onConfirm: (order: any, amount: number) => Promise<void>;
  rates: Record<string, number>;
  activeCurrencySymbol: string;
}) {
  const [amountStr, setAmountStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cleanTotalStr = String(order.formattedTotal || '0').replace(/,/g, '');
  const cleanLockedStr = String(order.formattedLocked || order.formattedTotal || '0').replace(/,/g, '');
  const totalAmount = parseFloat(cleanTotalStr) || 0;
  const remainingAmount = parseFloat(cleanLockedStr) || 0;

  const tokenSymbol = order.token_symbol || (order.type === 'FIAT' ? 'NGN' : activeCurrencySymbol);

  const parsedAmount = parseFloat(amountStr);
  const isPositive = !isNaN(parsedAmount) && parsedAmount > 0;
  const isTooHigh = !isNaN(parsedAmount) && parsedAmount >= remainingAmount;
  const isValid = isPositive && !isTooHigh && parsedAmount < remainingAmount;

  // Live USD valuation for input amount
  let usdValue = '';
  if (isPositive) {
    if (order.type === 'FIAT') {
      const ngnRate = rates['NGN'] || 0;
      if (ngnRate > 0) {
        const val = parsedAmount / ngnRate;
        usdValue = val < 0.01 && val > 0 ? '<$0.01' : `$${val.toFixed(2)}`;
      }
    } else if (tokenSymbol === 'USDC' || order.type === 'GIFTCARD') {
      usdValue = `$${parsedAmount.toFixed(2)}`;
    } else {
      const tokenPrice = rates[tokenSymbol] ?? rates[activeCurrencySymbol] ?? 0;
      const val = parsedAmount * tokenPrice;
      usdValue = val < 0.01 && val > 0 ? '<$0.01' : `$${val.toFixed(2)}`;
    }
  }

  const handlePercentage = (pct: number) => {
    const val = remainingAmount * pct;
    const decimals = order.type === 'FIAT' ? 2 : tokenSymbol === 'USDC' ? 2 : 6;
    const cleanVal = parseFloat(val.toFixed(decimals));
    if (cleanVal < remainingAmount) {
      setAmountStr(String(cleanVal));
    }
  };

  const handleConfirm = async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(order, parsedAmount);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="split-release-title"
      className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-[#161b30] border border-[#232a45] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#232a45]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 id="split-release-title" className="text-base font-bold text-white leading-tight">
                Split Release Milestone
              </h3>
              <p className="text-xs text-slate-400">Partial payment to the seller</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Overview (Total Locked & Remaining Balance) */}
        <div className="bg-[#0b0e1b] border border-[#232a45] rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Locked
              </div>
              <div className="text-base font-bold text-white mt-0.5">
                {order.type === 'FIAT' ? '₦' : ''}
                {order.formattedTotal} {tokenSymbol}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-violet-400 uppercase tracking-wider">
                Remaining Balance
              </div>
              <div className="text-base font-bold text-violet-300 mt-0.5">
                {order.type === 'FIAT' ? '₦' : ''}
                {order.formattedLocked || order.formattedTotal} {tokenSymbol}
              </div>
            </div>
          </div>

          {/* Mini progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Released: {totalAmount > 0 ? Math.max(0, Math.round(((totalAmount - remainingAmount) / totalAmount) * 100)) : 0}%</span>
              <span>Locked: {totalAmount > 0 ? Math.min(100, Math.round((remainingAmount / totalAmount) * 100)) : 100}%</span>
            </div>
            <div className="w-full bg-[#161b30] h-1.5 rounded-full overflow-hidden border border-[#232a45]">
              <div
                className="bg-violet-500 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${totalAmount > 0 ? Math.max(0, Math.min(100, Math.round(((totalAmount - remainingAmount) / totalAmount) * 100))) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Amount Input with Validation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="split-amount-input" className="text-xs font-semibold text-slate-300">
              Amount to Release
            </label>
            {usdValue && (
              <span className="text-[11px] font-mono text-emerald-400">
                ≈ {usdValue}
              </span>
            )}
          </div>

          <div className="relative">
            <input
              id="split-amount-input"
              type="number"
              step="any"
              min="0"
              max={remainingAmount}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder={`0.00 (${tokenSymbol})`}
              className={`w-full bg-[#0b0e1b] border rounded-xl py-2.5 pl-3.5 pr-20 text-sm font-semibold text-white focus:outline-none transition-all placeholder:text-slate-600 ${
                isTooHigh
                  ? 'border-red-500/70 focus:border-red-500'
                  : 'border-[#232a45] focus:border-violet-500'
              }`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono pointer-events-none">
              {tokenSymbol}
            </div>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-2 pt-1">
            {[0.25, 0.5, 0.75].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handlePercentage(pct)}
                className="flex-1 py-1 px-2 rounded-lg text-xs font-semibold bg-[#0b0e1b] hover:bg-slate-800 text-slate-300 border border-[#232a45] hover:border-violet-500/50 transition-all"
              >
                {pct * 100}%
              </button>
            ))}
          </div>

          {/* Validation Helper / Error Text */}
          {isTooHigh && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>
                Split release is for partial payments only. To release 100% of the funds, use the final &apos;Release Escrow&apos; button after delivery is completed.
              </span>
            </div>
          )}
        </div>

        {/* Explicit Safety Warning */}
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>
            ⚠️ Warning: Partial releases transfer funds directly to the seller&apos;s wallet immediately. TrustLink cannot reverse or dispute amounts that have already been released.
          </span>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1 bg-[#0b0e1b] hover:bg-slate-800 text-slate-300 py-3 rounded-xl font-bold text-sm border border-[#232a45] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isValid || isSubmitting}
            onClick={handleConfirm}
            className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-violet-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Releasing…</span>
              </>
            ) : (
              <span>Confirm Partial Release</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Transaction Detail Modal Component ───────────────────────────────────────

function OrderDetailModal({
  order,
  onClose,
  onOpenChat,
  onAccept,
  onMarkShipped,
  onRelease,
  onSplitRelease,
  onCancel,
  onDispute,
  actionLoadingId,
  rates,
  activeCurrencySymbol,
  unreadCount,
}: {
  order: any;
  onClose: () => void;
  onOpenChat: (order: any) => void;
  onAccept: (order: any) => Promise<void>;
  onMarkShipped: (order: any) => Promise<void>;
  onRelease: (order: any) => void;
  onSplitRelease: (order: any) => void;
  onCancel: (order: any) => void;
  onDispute: (order: any) => void;
  actionLoadingId: string | number | null;
  rates: Record<string, number>;
  activeCurrencySymbol: string;
  unreadCount: number;
}) {
  const [copiedAddress, setCopiedAddress] = useState(false);

  const isBuying = order.direction === 'BUYING';
  const isSeller = order.direction === 'SELLING';
  const isBuyer = isBuying;

  const normStatus = String(order.status || '').toLowerCase().trim();
  const isCancelled = order.isCancelled || normStatus === 'cancelled' || normStatus === 'canceled' || normStatus === 'refunded';
  const isCompleted = !isCancelled && (order.isCompleted || ['COMPLETED', 'PAID', 'SUCCESS'].includes(String(order.status).toUpperCase()));
  const isDisputed = !isCancelled && (order.isDisputed || order.status === 'DISPUTED');
  const isAccepted = !isCancelled && !!order.isAccepted;
  const isShipped = !isCancelled && !!order.isShipped;
  const isBusy = actionLoadingId === order.id;

  const isUnaccepted = !isAccepted && !isCompleted && !isDisputed && !isCancelled && (
    normStatus === 'secured' ||
    normStatus === 'waiting_acceptance' ||
    normStatus === 'waiting acceptance' ||
    normStatus === 'in escrow' ||
    normStatus === 'pending'
  );

  const cleanTotalStr = String(order.formattedTotal || '0').replace(/,/g, '');
  const cleanLockedStr = String(order.formattedLocked || order.formattedTotal || '0').replace(/,/g, '');
  const remainingAmountNum = parseFloat(cleanLockedStr) || 0;
  const hasRemainingFunds = remainingAmountNum > 0;

  const rawId = String(order.id);
  const cleanRef = rawId.startsWith('NGN-')
    ? `TXN#${rawId.replace('NGN-', '').padStart(6, '0').slice(-6)}`
    : rawId.startsWith('GC-')
    ? `GC#${rawId.replace('GC-', '').padStart(6, '0').slice(-6)}`
    : `ORD#${rawId.padStart(6, '0').slice(-6).toUpperCase()}`;

  const methodLabel =
    order.type === 'CRYPTO' ? 'Crypto Escrow' : order.type === 'FIAT' ? 'Bank Transfer' : 'Gift Card';

  let displayAmount = '';
  let usdValuation = '';
  let platformFee = '';

  if (order.type === 'FIAT') {
    const rawVal = parseFloat(String(order.formattedTotal || '0').replace(/,/g, ''));
    displayAmount = `₦${order.formattedTotal}`;
    const ngnRate = rates['NGN'] || 0;
    if (ngnRate > 0 && !isNaN(rawVal)) {
      const usd = rawVal / ngnRate;
      usdValuation = usd < 0.01 && usd > 0 ? '<$0.01' : `$${usd.toFixed(2)}`;
    } else {
      usdValuation = '—';
    }
    platformFee = `0.5% (₦${(rawVal * 0.005).toLocaleString('en-US', { maximumFractionDigits: 2 })})`;
  } else if (order.type === 'GIFTCARD') {
    displayAmount = `$${order.formattedTotal}`;
    usdValuation = `$${order.formattedTotal}`;
    platformFee = '$0.00 (Zero fee)';
  } else {
    // Crypto
    displayAmount =
      order.token_symbol === 'USDC'
        ? `$${order.formattedTotal} USDC`
        : `${order.formattedTotal} ${order.token_symbol || activeCurrencySymbol}`;
    const rawVal = parseFloat(String(order.formattedTotal || '0'));
    if (!isNaN(rawVal)) {
      if (order.token_symbol === 'USDC') {
        usdValuation = `$${rawVal.toFixed(2)}`;
        platformFee = `$${(rawVal * 0.005).toFixed(4)} USDC (0.5%)`;
      } else {
        const sym = order.token_symbol || activeCurrencySymbol;
        const tokenPrice = rates[sym] ?? rates[activeCurrencySymbol] ?? 0;
        const usd = rawVal * tokenPrice;
        usdValuation = usd < 0.01 && usd > 0 ? '<$0.01' : `$${usd.toFixed(2)}`;
        platformFee = `0.5% (${(rawVal * 0.005).toFixed(6)} ${sym})`;
      }
    }
  }

  const counterpartyRole = isBuying ? 'Seller' : 'Buyer';
  const myRole = isBuying ? 'Buyer' : 'Seller';
  const counterpartyEmail = isBuying ? order.sellerEmail : order.buyerEmail;
  const counterpartyWallet = isBuying ? (order.seller || '') : (order.buyer || '');

  const createdDate = order.timestamp
    ? new Date(order.timestamp).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-[#161b30] border border-[#232a45] rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header: Order Reference ID, Status Badge, Close button */}
        <div className="flex items-center justify-between pb-4 border-b border-[#232a45]">
          <div className="flex items-center gap-3">
            <span
              id="order-modal-title"
              className="font-mono text-base font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-xl"
            >
              {cleanRef}
            </span>
            {isCancelled ? (
              isBuyer ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancelled (Refunded)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-700/30 text-slate-400 border border-slate-600/30">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancelled by Buyer</span>
                </span>
              )
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed</span>
              </span>
            ) : isDisputed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Disputed</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-3.5 h-3.5" />
                <span>In Escrow</span>
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Breakdown */}
        <div className="bg-[#0b0e1b] border border-[#232a45] rounded-2xl p-4 space-y-3">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Financial Breakdown ({methodLabel})
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-400">Locked Amount</div>
              <div className="text-lg font-bold text-white tracking-tight mt-0.5">
                {displayAmount}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Live USD Valuation</div>
              <div className="text-lg font-bold text-emerald-400 tracking-tight mt-0.5">
                {usdValuation}
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-[#232a45]/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">Platform Protocol Fee</span>
            <span className="text-slate-300 font-medium">{platformFee}</span>
          </div>
        </div>

        {/* Counterparty Section */}
        <div className="bg-[#0b0e1b] border border-[#232a45] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Counterparty Details
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
              You: {myRole} • Peer: {counterpartyRole}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Email Address</span>
              <span className="text-slate-200 font-medium">
                {counterpartyEmail || 'Not provided'}
              </span>
            </div>

            <div>
              <div className="text-slate-400 mb-1">Wallet Address</div>
              {counterpartyWallet ? (
                <div className="flex items-center justify-between bg-[#161b30] border border-[#232a45] rounded-xl px-3 py-2">
                  <span className="font-mono text-slate-300 text-[11px] truncate max-w-[280px]">
                    {counterpartyWallet}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(counterpartyWallet);
                      setCopiedAddress(true);
                      setTimeout(() => setCopiedAddress(false), 2000);
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded transition-colors flex items-center gap-1 text-[10px]"
                    title="Copy Address"
                  >
                    {copiedAddress ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-slate-500">Not connected</span>
              )}
            </div>
          </div>
        </div>

        {/* Deal Timeline */}
        <div className="bg-[#0b0e1b] border border-[#232a45] rounded-2xl p-4 space-y-2">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Deal Timeline
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-slate-400">Created Timestamp</div>
              <div className="text-slate-200 font-medium mt-0.5">{createdDate}</div>
            </div>
            <div>
              <div className="text-slate-400">Current State</div>
              <div className="text-slate-200 font-medium mt-0.5 capitalize">
                {isCancelled
                  ? (isBuyer ? 'Cancelled & Refunded' : 'Cancelled by Buyer')
                  : order.status.toLowerCase().replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="pt-2 border-t border-[#232a45] space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Chat Button */}
            <button
              type="button"
              onClick={() => onOpenChat(order)}
              className="relative flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-[#0b0e1b] hover:bg-slate-800 text-slate-200 border border-[#232a45] transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <span>Chat</span>
              {unreadCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* If order is Cancelled, disable/hide all action buttons and render status notice */}
            {isCancelled ? (
              <div className="flex-1 py-2 px-3 rounded-xl text-xs text-center font-semibold text-slate-400 bg-[#0b0e1b] border border-[#232a45]">
                {isBuyer ? 'Cancelled & Refunded' : 'Cancelled by Buyer'}
              </div>
            ) : (
              <>
                {/* 2. Split Release Button (for Buyer when order is accepted and funds remain locked) */}
                {isBuyer && isAccepted && !isCompleted && !isDisputed && hasRemainingFunds && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onSplitRelease(order)}
                    className="border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5"
                  >
                    <Coins className="w-4 h-4 text-violet-400" />
                    <span>Split Release</span>
                  </button>
                )}

                {/* 3. Contextual Primary Actions */}
                {isSeller && !isAccepted && !isCompleted && !isDisputed && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={async () => {
                      await onAccept(order);
                      onClose();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 shadow-md"
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                    <span>Accept Order</span>
                  </button>
                )}

                {isSeller && isAccepted && !isShipped && !isCompleted && !isDisputed && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={async () => {
                      await onMarkShipped(order);
                      onClose();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 shadow-md"
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                    <span>Mark as Shipped</span>
                  </button>
                )}

                {/* Primary 100% Release Escrow Button strictly reserved for when order is Shipped */}
                {isBuyer && isShipped && !isCompleted && !isDisputed && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onRelease(order)}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50 shadow-md"
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Release Escrow</span>
                  </button>
                )}

                {/* Waiting indicators & Cancel Escrow Button */}
                {isBuyer && isUnaccepted && (
                  <>
                    <div className="flex-1 py-2 px-3 rounded-xl text-xs text-center text-slate-400 bg-[#0b0e1b] border border-[#232a45]">
                      Waiting for Seller
                    </div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onCancel(order)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancel Escrow</span>
                    </button>
                  </>
                )}

                {isBuyer && isAccepted && !isShipped && !isCompleted && !isDisputed && (
                  <div className="flex-1 py-2 px-3 rounded-xl text-xs text-center text-slate-400 bg-[#0b0e1b] border border-[#232a45]">
                    Waiting for Delivery
                  </div>
                )}

                {isSeller && isShipped && !isCompleted && !isDisputed && (
                  <div className="flex-1 py-2 px-3 rounded-xl text-xs text-center text-slate-400 bg-[#0b0e1b] border border-[#232a45]">
                    Waiting for Release
                  </div>
                )}

                {/* 4. Dispute Button (Replaces Cancel Escrow once order is accepted) */}
                {!isCompleted && !isDisputed && isAccepted && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onDispute(order)}
                    className="p-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Raise Dispute"
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* 4. Direct Link: Go to Trade Room */}
          <Link
            href={`/trade/${order.id}`}
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-all"
          >
            <span>Go to Trade Room</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

interface BankItem {
  id?: number | string;
  name: string;
  code: string;
  slug?: string;
}

/**
 * Normalizes digital bank/fintech NIBSS codes to Paystack expected resolution codes.
 * - OPay: NIBSS 50572 / 100004 / OPAY -> Paystack 999992
 * - PalmPay: NIBSS 090275 / 100033 / PALMPAY -> Paystack 999991
 * - Moniepoint: NIBSS 090405 / MONIEPOINT -> Paystack 50515
 * - Kuda Bank: NIBSS 090267 / KUDA -> Paystack 50211
 */
function normalizeFintechBankCode(code: string): string {
  if (!code) return '';
  const trimmed = String(code).trim().toUpperCase();
  switch (trimmed) {
    case '50572':
    case '100004':
    case 'OPAY':
      return '999992';
    case '090275':
    case '100033':
    case 'PALMPAY':
      return '999991';
    case '090405':
    case 'MONIEPOINT':
      return '50515';
    case '090267':
    case 'KUDA':
      return '50211';
    default:
      return String(code).trim();
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

function MainDashboard() {
  const router = useRouter();
  const { supabase, sessionReady, sessionLoading, sessionError, refreshSession } = useAuth();
  const { login, authenticated, ready, user, linkEmail, getAccessToken } = usePrivy();

  // Flicker-Free Route Guard: If unauthenticated, redirect directly to /login
  useEffect(() => {
    if (ready && !authenticated) {
      router.replace('/login');
    }
  }, [ready, authenticated, router]);

  const [banks, setBanks] = useState<BankItem[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchBanks() {
      try {
        const res = await fetch('/api/banks');
        const json = await res.json();
        if (!cancelled && Array.isArray(json?.data)) {
          const mappedBanks: BankItem[] = json.data.map((b: any, idx: number) => {
            const code = normalizeFintechBankCode(b.code);
            const slug = b.slug || b.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `bank-${idx}`;
            const id = b.id != null ? String(b.id) : slug;
            return {
              ...b,
              id,
              slug,
              code,
              name: b.name,
            };
          });
          setBanks(mappedBanks);
        }
      } catch (err) {
        console.error('Error loading banks:', err);
      } finally {
        if (!cancelled) setIsLoadingBanks(false);
      }
    }
    fetchBanks();
    return () => { cancelled = true; };
  }, []);

  const { switchChain, error: switchError } = useSwitchChain();
  const searchParams = useSearchParams();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();

  const activeEmail = user?.email?.address || user?.google?.email || user?.apple?.email || user?.discord?.email;

  const [mode, setMode] = useState<'crypto' | 'fiat' | 'giftcard'>('crypto');
  const [orderFilter, setOrderFilter] = useState<'all' | 'crypto' | 'fiat' | 'giftcard'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<any | null>(null);
  const [splitReleaseOrder, setSplitReleaseOrder] = useState<any | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [trustLevel, setTrustLevel] = useState<number | null>(null);

  const [sellerAddress, setSellerAddress] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const [isTokenListOpen, setIsTokenListOpen] = useState(false);
  const [isNetworkListOpen, setIsNetworkListOpen] = useState(false);
  const [isWriting, setIsWriting] = useState(false);

  const [fiatAmount, setFiatAmount] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [fiatDescription, setFiatDescription] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankItem | null>(null);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);
  const [isLookingUpSeller, setIsLookingUpSeller] = useState(false);

  const [gcSellerAddress, setGcSellerAddress] = useState('');
  const [gcAmount, setGcAmount] = useState('');
  const [gcBrand, setGcBrand] = useState('');
  const [gcCode, setGcCode] = useState('');
  const [gcImage, setGcImage] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [dbOrders, setDbOrders] = useState<Record<number, any>>({});
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Live exchange rates from hook (XPL, BNB, POL, ETH, OP, USDC, NGN)
  const { rates, stale } = useLiveRates();

  // Balance Visibility / Privacy Toggles (Decoupled & Independent)
  const [showLockedBalance, setShowLockedBalance] = useState<boolean>(true);
  const [showWalletBalance, setShowWalletBalance] = useState<boolean>(true);

  useEffect(() => {
    try {
      const storedLocked = localStorage.getItem('trustlink_show_locked_balance');
      if (storedLocked !== null) {
        setShowLockedBalance(storedLocked === 'true');
      }
      const storedWallet = localStorage.getItem('trustlink_show_wallet_balance');
      if (storedWallet !== null) {
        setShowWalletBalance(storedWallet === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleShowLockedBalance = useCallback(() => {
    setShowLockedBalance((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('trustlink_show_locked_balance', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleShowWalletBalance = useCallback(() => {
    setShowWalletBalance((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('trustlink_show_wallet_balance', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Interactive Trade Action States
  const [activeChatOrder, setActiveChatOrder] = useState<any | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    body: React.ReactNode;
    confirmLabel: string;
    confirmClass?: string;
    onConfirm: () => void;
  } | null>(null);

  // Unread Message Tracking for Deal Chat Buttons
  const [unreadMap, setUnreadMap] = useState<Record<string | number, number>>({});
  const activeChatOrderRef = useRef<any | null>(null);
  useEffect(() => {
    activeChatOrderRef.current = activeChatOrder;
  }, [activeChatOrder]);

  const networkDropdownRef = useRef<HTMLDivElement>(null);

  const chainId = useChainId();
  const isUnsupportedNetwork = authenticated && !CHAIN_CONFIG[chainId];
  const activeChainId = CHAIN_CONFIG[chainId] ? chainId : DEFAULT_CHAIN_ID;
  const activeChain = CHAIN_CONFIG[activeChainId] ?? CHAIN_CONFIG[DEFAULT_CHAIN_ID];
  const activeCurrencySymbol = activeChain.nativeCurrency?.symbol || activeChain.nativeSymbol || 'XPL';

  const ASSETS = useMemo(
    () => [
      {
        symbol: activeCurrencySymbol,
        name: activeChain.name,
        type: 'native' as const,
        icon: 'bg-purple-600',
        address: ZERO_ADDRESS,
        decimals: activeChain.nativeCurrency?.decimals || 18,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        type: 'erc20' as const,
        icon: 'bg-blue-600',
        address: activeChain.usdcAddress,
        decimals: 6,
      },
    ],
    [activeChain, activeCurrencySymbol]
  );

  const selectedAsset = ASSETS[selectedAssetIndex];

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setNotification({ message: sanitize(message, 300), type });
  }, []);

  const sendEmailNotification = useCallback(
    async (to: string, subject: string, message: string) => {
      if (!isValidEmail(to)) return;
      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: sanitize(to, 254),
            subject: sanitize(subject, 200),
            message: sanitize(message, 2000),
          }),
        });
      } catch (err) {
        console.error('Failed to send email notification', err);
      }
    },
    []
  );

  const showToastRef = useRef(showToast);
  const sendEmailRef = useRef(sendEmailNotification);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);
  useEffect(() => { sendEmailRef.current = sendEmailNotification; }, [sendEmailNotification]);

  const prevFirstWalletRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const firstWallet = wallets[0];
    if (!firstWallet) return;
    if (firstWallet.address === prevFirstWalletRef.current) return;
    prevFirstWalletRef.current = firstWallet.address;
    setActiveWallet(firstWallet);
  }, [wallets, setActiveWallet]);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  useEffect(() => {
    if (switchError) showToastRef.current(switchError.message, 'error');
  }, [switchError]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(e.target as Node)) {
        setIsNetworkListOpen(false);
      }
    }
    if (isNetworkListOpen) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isNetworkListOpen]);

  const { address: wagmiAddress } = useAccount();
  const userAddress = wagmiAddress || user?.wallet?.address;

  useEffect(() => {
    if (!sessionReady || !userAddress) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('current_trust_level')
      .ilike('wallet_address', userAddress)
      .single()
      .then(({ data }) => {
        if (!cancelled) setTrustLevel(data?.current_trust_level ?? 0);
      });
    return () => { cancelled = true; };
  }, [sessionReady, userAddress, supabase]);

  // Query both native balance and USDC balance
  const { data: usdcBalance, refetch: refetchUsdc } = useBalance({
    address: userAddress as `0x${string}`,
    token: activeChain.usdcAddress,
    query: { enabled: !!userAddress },
  });

  const { data: nativeBalance, refetch: refetchNative } = useBalance({
    address: userAddress as `0x${string}`,
    query: { enabled: !!userAddress },
  });

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: ASSETS[1].address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress as `0x${string}`, CONTRACT_ADDRESS] : undefined,
    query: { enabled: !!userAddress && selectedAsset.type === 'erc20' },
  });

  const { data: totalEscrows, refetch: refetchTotalEscrows } = useReadContract({
    abi: CONTRACT_ABI,
    address: CONTRACT_ADDRESS,
    functionName: 'escrowCount',
  });
  const count = totalEscrows ? Number(totalEscrows) : 0;

  const indexesToFetch = useMemo(() => {
    if (count === 0) return [];
    const idxs: number[] = [];
    for (let i = count; i > 0 && idxs.length < 20; i--) idxs.push(i);
    return idxs;
  }, [count]);

  const { data: escrowsData, refetch: refetchOrders } = useReadContracts({
    contracts: indexesToFetch.map((id) => ({
      abi: CONTRACT_ABI,
      address: CONTRACT_ADDRESS,
      functionName: 'escrows',
      args: [BigInt(id)],
    })),
    query: { refetchInterval: 30_000 },
  });

  const fetchDbOrders = useCallback(async () => {
    if (!sessionReady) return;
    const { data, error } = await supabase.from('escrow_orders').select('*');
    if (error) {
      console.error('fetchDbOrders error:', error);
      return;
    }
    if (data) {
      const map: Record<number, any> = {};
      data.forEach((row: any) => { map[row.id] = row; });
      setDbOrders(map);
    }
  }, [supabase, sessionReady]);

  const handleRefresh = useCallback(async () => {
    refetchTotalEscrows();
    refetchOrders();
    refetchUsdc();
    refetchNative();
    if (selectedAsset.type === 'erc20') refetchAllowance?.();
    await fetchDbOrders();
  }, [refetchTotalEscrows, refetchOrders, refetchUsdc, refetchNative, refetchAllowance, selectedAsset.type, fetchDbOrders]);

  useEffect(() => {
    if (sessionReady) fetchDbOrders();
  }, [sessionReady, fetchDbOrders]);

  useEffect(() => {
    if (!sessionReady) return;
    const id = setInterval(fetchDbOrders, POLL_INTERVAL_DB);
    return () => clearInterval(id);
  }, [sessionReady, fetchDbOrders]);

  useEffect(() => {
    const id = setInterval(() => {
      refetchTotalEscrows();
      refetchOrders();
    }, POLL_INTERVAL_CHAIN);
    return () => clearInterval(id);
  }, [refetchTotalEscrows, refetchOrders]);

  useEffect(() => {
    if (activeEmail) setBuyerEmail(activeEmail);
  }, [activeEmail]);

  const resolveBankAccount = useCallback(async (account: string, bank: string) => {
    setIsResolving(true);
    setResolveError('');
    setAccountName('');

    if (account === '9999999999') {
      const t = setTimeout(() => {
        setAccountName('Test Mode User (Bypassed)');
        setIsResolving(false);
      }, 800);
      return () => clearTimeout(t);
    }

    try {
      const normalizedBank = normalizeFintechBankCode(bank);
      const queryParams = new URLSearchParams({
        account_number: account.trim(),
        bank_code: normalizedBank,
      });

      const response = await fetch(
        `/api/resolve-account?${queryParams.toString()}`
      );
      const data = await response.json();
      if (!response.ok || !data.status) throw new Error(data.error || data.message || 'Verification failed');
      const resolvedName = data.data?.account_name || data.account_name;
      if (resolvedName) setAccountName(resolvedName);
      else throw new Error('Account name not found');
    } catch (err: any) {
      setResolveError(err.message || 'Verification failed');
    } finally {
      setIsResolving(false);
    }
  }, []);

  useEffect(() => {
    if (autoFilled) return;
    const trimmedAccount = accountNumber.trim();
    const effectiveCode = normalizeFintechBankCode(selectedBank?.code || bankCode);

    if (trimmedAccount.length === 10 && effectiveCode) {
      resolveBankAccount(trimmedAccount, effectiveCode);
    } else {
      if (trimmedAccount.length < 10) {
        setAccountName('');
        setResolveError('');
      }
    }
  }, [accountNumber, bankCode, selectedBank, resolveBankAccount, autoFilled]);

  // ── Seller Profile Bank Auto-fill Lookup ──
  const performSellerLookup = useCallback(
    async (emailToLookup: string) => {
      const trimmed = emailToLookup.trim();
      if (!isValidEmail(trimmed)) return;

      try {
        setIsLookingUpSeller(true);
        const token = await getAccessToken();
        if (!token) return;

        const res = await fetch(
          `/api/profile/lookup?email=${encodeURIComponent(trimmed)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();

        if (res.ok && data.success && data.profile) {
          const rawCode = data.profile.bank_code || '';
          const normalizedCode = normalizeFintechBankCode(rawCode);
          const savedBankName = data.profile.bank_name || '';

          setBankCode(normalizedCode);
          setAccountNumber(data.profile.account_number || '');
          setAccountName(data.profile.account_name || '');
          setResolveError('');

          if (banks.length > 0) {
            const match = banks.find(
              (b) =>
                (normalizedCode && normalizeFintechBankCode(b.code) === normalizedCode) ||
                (savedBankName && b.name.toLowerCase() === savedBankName.toLowerCase())
            );
            if (match) {
              setSelectedBank(match);
              setSelectedBankId(String(match.id || match.slug));
            }
          }

          setAutoFilled(true);
          showToastRef.current("Seller's bank details auto-filled!", 'success');
        }
      } catch (err: any) {
        console.error('Auto-fill lookup failed', err);
      } finally {
        setIsLookingUpSeller(false);
      }
    },
    [getAccessToken, banks]
  );

  // Debounced auto-lookup whenever a valid seller email is typed
  useEffect(() => {
    if (mode !== 'fiat') return;
    const trimmed = sellerEmail.trim();
    if (!isValidEmail(trimmed)) return;

    const timer = setTimeout(() => {
      performSellerLookup(trimmed);
    }, 600);

    return () => clearTimeout(timer);
  }, [sellerEmail, mode, performSellerLookup]);

  // Synchronize selectedBank with loaded banks if bankCode is present
  useEffect(() => {
    if (banks.length > 0 && bankCode && !selectedBankId) {
      const match = banks.find((b) => normalizeFintechBankCode(b.code) === normalizeFintechBankCode(bankCode));
      if (match) {
        setSelectedBank(match);
        setSelectedBankId(String(match.id || match.slug));
      }
    }
  }, [banks, bankCode, selectedBankId]);

  useEffect(() => {
    const trxref = searchParams.get('trxref') || searchParams.get('reference');
    if (!trxref || !sessionReady) return;

    setMode('fiat');
    let cancelled = false;

    fetch('/api/paystack/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: sanitize(trxref, 100) }),
    })
      .then((r) => r.json())
      .then(async (data) => {
        if (cancelled) return;
        if (data.status) {
          setShowSuccessModal(true);
          const { data: orderData } = await supabase.from('escrow_orders').select('seller_email, amount').eq('paystack_ref', trxref).single();
          if (orderData?.seller_email && isValidEmail(orderData.seller_email)) {
            sendEmailRef.current(
              orderData.seller_email,
              'New Escrow Order Secured! 💰',
              `Great news! A buyer has securely locked ₦${Number(orderData.amount).toLocaleString()} in TrustLink for a Bank Transfer order. Please log in to your dashboard to view and accept the order.`
            );
          }
        } else {
          showToastRef.current('Payment was cancelled or failed.', 'error');
        }
        fetchDbOrders();
        router.replace('/escrow');
      })
      .catch((err) => {
        if (!cancelled) showToastRef.current(err.message || 'Verification error', 'error');
      });

    return () => { cancelled = true; };
  }, [searchParams, supabase, sessionReady, fetchDbOrders, router]);

  const networkAlerts = useMemo(() => {
    const alerts: Record<number, number> = {};
    if (!userAddress && !activeEmail) return alerts;
    const myAddress = userAddress?.toLowerCase();
    const myEmail = activeEmail?.toLowerCase();

    Object.values(dbOrders || {}).forEach((db: any) => {
      if (db.paystack_ref) return;
      const normStatus = String(db.status || '').toLowerCase().trim();
      if (
        db.isCompleted ||
        normStatus === 'completed' ||
        normStatus === 'cancelled' ||
        normStatus === 'canceled' ||
        normStatus === 'refunded'
      ) {
        return;
      }

      const buyerAddr = db.buyer_wallet_address?.toLowerCase();
      const sellerAddr = db.seller_address?.toLowerCase();
      const buyerEmail = db.buyer_email?.toLowerCase();
      const sellerEmail = db.seller_email?.toLowerCase();

      const isBuyer = (myAddress && buyerAddr === myAddress) || (myEmail && buyerEmail === myEmail);
      const isSeller = (myAddress && sellerAddr === myAddress) || (myEmail && sellerEmail === myEmail);

      const sellerNeedsToAccept = isSeller && (normStatus === 'secured' || normStatus === 'waiting_acceptance' || !db.isAccepted);
      const buyerNeedsToRelease = isBuyer && normStatus === 'shipped';

      if (!sellerNeedsToAccept && !buyerNeedsToRelease) return;

      let targetChainId: number | null = db.chain_id ? Number(db.chain_id) : null;
      if (!targetChainId && db.network) {
        const chainEntry = Object.entries(CHAIN_CONFIG).find(
          ([, cfg]) => cfg.name.toLowerCase() === db.network.toLowerCase() || cfg.nativeSymbol.toLowerCase() === db.network.toLowerCase() || cfg.nativeCurrency?.symbol.toLowerCase() === db.network.toLowerCase()
        );
        if (chainEntry) targetChainId = Number(chainEntry[0]);
      }

      if (targetChainId) {
        alerts[targetChainId] = (alerts[targetChainId] || 0) + 1;
      }
    });

    return alerts;
  }, [dbOrders, userAddress, activeEmail]);

  const totalActionableOrders = useMemo(() => Object.values(networkAlerts).reduce((s, n) => s + n, 0), [networkAlerts]);

  const actionableOrdersCount = useMemo(() => {
    const allOrders = Object.values(dbOrders || {}) as any[];
    const myAddress = userAddress?.toLowerCase();
    const myEmail = activeEmail?.toLowerCase();

    const actionable = allOrders.filter((order) => {
      // 1. Strict Chain Match: only match if chain_id matches activeChainId
      if (order.chain_id && order.chain_id !== activeChainId) return false;

      // 2. Normalization: ignore all finalized deals (completed, cancelled, refunded)
      const normStatus = String(order.status || '').toLowerCase().trim();
      if (
        order.isCompleted ||
        normStatus === 'completed' ||
        normStatus === 'cancelled' ||
        normStatus === 'canceled' ||
        normStatus === 'refunded'
      ) {
        return false;
      }

      // 3. User Identity Check (address or email)
      const buyerAddr = order.buyer_wallet_address?.toLowerCase();
      const sellerAddr = order.seller_address?.toLowerCase();
      const buyerEmail = order.buyer_email?.toLowerCase();
      const sellerEmail = order.seller_email?.toLowerCase();

      const isBuyer = (myAddress && buyerAddr === myAddress) || (myEmail && buyerEmail === myEmail);
      const isSeller = (myAddress && sellerAddr === myAddress) || (myEmail && sellerEmail === myEmail);

      // 4. Actionable Criteria
      const sellerNeedsToAccept = isSeller && (normStatus === 'secured' || normStatus === 'waiting_acceptance' || !order.isAccepted);
      const buyerNeedsToRelease = isBuyer && normStatus === 'shipped';

      return sellerNeedsToAccept || buyerNeedsToRelease;
    });

    return actionable.length;
  }, [dbOrders, activeChainId, userAddress, activeEmail]);

  const { myBuyingOrders, mySellingOrders } = useMemo(() => {
    const buying: any[] = [];
    const selling: any[] = [];

    const dbByKey = new Map<string, any[]>();
    Object.values(dbOrders).forEach((db: any) => {
      if (db.paystack_ref) return;
      if (db.trade_type === 'GIFT_CARD') return;
      const key = `${db.buyer_wallet_address?.toLowerCase()}|${db.seller_address?.toLowerCase()}|${Number(db.amount)}`;
      const bucket = dbByKey.get(key) ?? [];
      bucket.push(db);
      dbByKey.set(key, bucket);
    });

    const usedDbIds = new Set<number>();

    if (escrowsData && userAddress) {
      escrowsData.forEach((result, index) => {
        if (result.status !== 'success' || !result.result) return;

        const escrow = result.result as any;
        const scId = indexesToFetch[index];
        const buyer = String(escrow[1]);
        const seller = String(escrow[2]);
        const tokenAddr = String(escrow[3]);
        const totalAmount = BigInt(escrow[4]);
        const lockedBalance = BigInt(escrow[5]);
        const chainDisputed = escrow[8];
        const chainCompleted = escrow[9];

        const isNative = tokenAddr === ZERO_ADDRESS;
        const formattedAmt = isNative ? formatEther(totalAmount) : formatUnits(totalAmount, 6);

        const key = `${buyer.toLowerCase()}|${seller.toLowerCase()}|${Number(formattedAmt)}`;
        const candidates = (dbByKey.get(key) ?? [])
          .filter((db) => !usedDbIds.has(db.id))
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

        const dbOrder = candidates[0];
        if (dbOrder) usedDbIds.add(dbOrder.id);

        const dbId = dbOrder ? dbOrder.id : scId;
        const dbStatusNorm = String(dbOrder?.status || '').toLowerCase().trim();
        const isDbCancelled = dbStatusNorm === 'cancelled' || dbStatusNorm === 'canceled' || dbStatusNorm === 'refunded';

        const isAccepted = !isDbCancelled && (dbOrder?.status === 'accepted' || dbOrder?.status === 'shipped' || !!escrow[6]);
        const isShipped = !isDbCancelled && (dbOrder?.status === 'shipped' || !!escrow[7]);

        const paidAmount = totalAmount - lockedBalance;
        const percentPaid = totalAmount > BigInt(0) ? Number((paidAmount * BigInt(100)) / totalAmount) : 0;

        let status = 'ACTIVE';
        let statusColor = 'bg-emerald-500/20 text-emerald-400';
        if (isDbCancelled) {
          status = 'CANCELLED';
          statusColor = 'bg-slate-700/30 text-slate-400 border border-slate-600/30';
        } else if (chainCompleted) {
          status = 'COMPLETED';
          statusColor = 'bg-slate-700 text-slate-300';
        } else if (chainDisputed) {
          status = 'DISPUTED';
          statusColor = 'bg-red-500/20 text-red-400';
        } else if (!isAccepted) {
          status = 'WAITING ACCEPTANCE';
          statusColor = 'bg-yellow-500/20 text-yellow-400';
        } else if (isShipped) {
          status = 'SHIPPED';
          statusColor = 'bg-blue-500/20 text-blue-400';
        }

        const orderType = dbOrder?.trade_type === 'GIFT_CARD' ? 'GIFTCARD' : 'CRYPTO';

        const order = {
          id: dbId, scId, buyer, seller,
          sellerEmail: dbOrder?.seller_email ?? undefined,
          buyerEmail: dbOrder?.buyer_email ?? undefined,
          token: tokenAddr, amount: totalAmount, lockedBalance,
          isAccepted, isShipped,
          isDisputed: !isDbCancelled && chainDisputed,
          isCompleted: isDbCancelled ? false : chainCompleted,
          isCancelled: isDbCancelled,
          status, statusColor,
          token_symbol: isNative ? activeCurrencySymbol : 'USDC',
          formattedTotal: formattedAmt,
          formattedLocked: isDbCancelled ? '0' : isNative ? formatEther(lockedBalance) : formatUnits(lockedBalance, 6),
          percentPaid: isDbCancelled ? 0 : percentPaid,
          type: orderType,
          timestamp: dbOrder?.created_at ? new Date(dbOrder.created_at).getTime() : Number(scId),
        };

        const buyerLower = buyer.toLowerCase();
        const sellerLower = seller.toLowerCase();
        const addrLower = userAddress.toLowerCase();
        if (buyerLower === addrLower) buying.push(order);
        if (sellerLower === addrLower) selling.push(order);
      });
    }

    const myEmail = activeEmail?.toLowerCase();
    const myWallet = userAddress?.toLowerCase();

    Object.values(dbOrders).forEach((dbOrder: any) => {
      if (!dbOrder.paystack_ref) return;
      const currentStatus = (dbOrder.status?.toLowerCase() || 'pending').trim();
      if (currentStatus === 'awaiting_payment' || currentStatus === 'failed') return;
      const isFiatCancelled = currentStatus === 'cancelled' || currentStatus === 'canceled' || currentStatus === 'refunded';

      const isMyEmailAsBuyer = myEmail && dbOrder.buyer_email?.toLowerCase() === myEmail;
      const isMyWalletAsBuyer = myWallet && dbOrder.buyer_wallet_address?.toLowerCase() === myWallet;
      const isMyEmailAsSeller = myEmail && dbOrder.seller_email?.toLowerCase() === myEmail;

      if (!isMyEmailAsBuyer && !isMyWalletAsBuyer && !isMyEmailAsSeller) return;

      let fiatStatusColor = 'bg-yellow-500/20 text-yellow-400';
      if (isFiatCancelled) fiatStatusColor = 'bg-slate-700/30 text-slate-400 border border-slate-600/30';
      else if (['success', 'completed'].includes(currentStatus)) fiatStatusColor = 'bg-slate-700 text-slate-300';
      else if (currentStatus === 'disputed') fiatStatusColor = 'bg-red-500/20 text-red-400';
      else if (currentStatus === 'shipped') fiatStatusColor = 'bg-blue-500/20 text-blue-400';
      else if (['accepted', 'partially_released', 'processing_payout', 'secured'].includes(currentStatus))
        fiatStatusColor = 'bg-emerald-500/20 text-emerald-400';

      const totalAmt = Number(dbOrder.amount || 0);
      const releasedAmt = Number(dbOrder.released_amount || 0);
      const lockedAmt = isFiatCancelled ? 0 : totalAmt - releasedAmt;
      const isFullyPaid = !isFiatCancelled && ['success', 'completed'].includes(currentStatus);
      const percentPaid = isFiatCancelled ? 0 : isFullyPaid ? 100 : totalAmt > 0 ? Math.round((releasedAmt / totalAmt) * 100) : 0;

      const fiatOrderObj = {
        id: `NGN-${dbOrder.id}`, buyer: dbOrder.buyer_email,
        seller: dbOrder.seller_name || dbOrder.seller_email || '',
        sellerEmail: dbOrder.seller_email ?? undefined,
        amount: BigInt(0), lockedBalance: BigInt(0),
        formattedTotal: totalAmt.toLocaleString(), formattedLocked: lockedAmt.toLocaleString(),
        token_symbol: 'NGN', token: '',
        status: isFiatCancelled ? 'CANCELLED' : isFullyPaid ? 'PAID' : currentStatus.toUpperCase().replace(/_/g, ' '),
        statusColor: fiatStatusColor, percentPaid, type: 'FIAT',
        timestamp: dbOrder.created_at ? new Date(dbOrder.created_at).getTime() : dbOrder.id,
        isAccepted: !isFiatCancelled && ['accepted', 'partially_released', 'shipped', 'success', 'completed', 'processing_payout'].includes(currentStatus),
        isShipped: !isFiatCancelled && ['shipped', 'success', 'completed', 'processing_payout'].includes(currentStatus),
        isCompleted: isFullyPaid,
        isCancelled: isFiatCancelled,
        isDisputed: !isFiatCancelled && currentStatus === 'disputed',
      };

      if (isMyEmailAsBuyer || isMyWalletAsBuyer) buying.push(fiatOrderObj);
      if (isMyEmailAsSeller) selling.push(fiatOrderObj);
    });

    Object.values(dbOrders).forEach((dbOrder: any) => {
      if (dbOrder.trade_type !== 'GIFT_CARD') return;
      if (usedDbIds.has(dbOrder.id)) return; 

      const currentStatus = (dbOrder.status?.toLowerCase() || 'secured').trim();
      const isGcCancelled = currentStatus === 'cancelled' || currentStatus === 'canceled' || currentStatus === 'refunded';

      const isMyEmailAsBuyer  = myEmail  && dbOrder.buyer_email?.toLowerCase()  === myEmail;
      const isMyWalletAsBuyer = myWallet && dbOrder.buyer_wallet_address?.toLowerCase() === myWallet;
      const isMyEmailAsSeller = myEmail  && dbOrder.seller_email?.toLowerCase() === myEmail;

      if (!isMyEmailAsBuyer && !isMyWalletAsBuyer && !isMyEmailAsSeller) return;

      let gcStatusColor = 'bg-yellow-500/20 text-yellow-400'; 
      if (isGcCancelled)
        gcStatusColor = 'bg-slate-700/30 text-slate-400 border border-slate-600/30';
      else if (['success', 'completed'].includes(currentStatus))
        gcStatusColor = 'bg-slate-700 text-slate-300';
      else if (currentStatus === 'disputed')
        gcStatusColor = 'bg-red-500/20 text-red-400';
      else if (currentStatus === 'shipped')
        gcStatusColor = 'bg-blue-500/20 text-blue-400';
      else if (['accepted', 'secured'].includes(currentStatus))
        gcStatusColor = 'bg-emerald-500/20 text-emerald-400';

      const isCompleted = !isGcCancelled && ['success', 'completed'].includes(currentStatus);

      const gcOrderObj = {
        id:             `GC-${dbOrder.id}`,
        buyer:          dbOrder.buyer_email || dbOrder.buyer_wallet_address || '',
        seller:         dbOrder.seller_email || dbOrder.seller_identifier   || '',
        sellerEmail:    dbOrder.seller_email    ?? undefined,
        buyerEmail:     dbOrder.buyer_email     ?? undefined,
        amount:         BigInt(0),
        lockedBalance:  BigInt(0),
        formattedTotal:  String(dbOrder.amount ?? 0),
        formattedLocked: (isCompleted || isGcCancelled) ? '0' : String(dbOrder.amount ?? 0),
        token_symbol:   `${dbOrder.gc_brand ?? ''} GC`.trim(),
        token:          '',
        status:         isGcCancelled ? 'CANCELLED' : isCompleted ? 'COMPLETED' : currentStatus.toUpperCase().replace(/_/g, ' '),
        statusColor:    gcStatusColor,
        percentPaid:    isCompleted ? 100 : 0,
        type:           'GIFTCARD',
        timestamp:      dbOrder.created_at
                          ? new Date(dbOrder.created_at).getTime()
                          : dbOrder.id,
        isAccepted:  !isGcCancelled && ['accepted', 'shipped', 'success', 'completed'].includes(currentStatus),
        isShipped:   !isGcCancelled && ['shipped',  'success', 'completed'].includes(currentStatus),
        isCompleted,
        isCancelled: isGcCancelled,
        isDisputed:  !isGcCancelled && currentStatus === 'disputed',
        gcBrand:     dbOrder.gc_brand     ?? '',
        gc_image_url:  dbOrder.gc_image_url ?? '',
      };

      if (isMyEmailAsBuyer || isMyWalletAsBuyer) buying.push(gcOrderObj);
      if (isMyEmailAsSeller) selling.push(gcOrderObj);
    });

    buying.sort((a, b) => b.timestamp - a.timestamp);
    selling.sort((a, b) => b.timestamp - a.timestamp);

    return { myBuyingOrders: buying, mySellingOrders: selling };
  }, [escrowsData, userAddress, indexesToFetch, dbOrders, activeEmail, activeCurrencySymbol]);

  // Unified all orders for history table & metrics
  const allUserOrders = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string | number>();

    myBuyingOrders.forEach((o) => {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        list.push({ ...o, direction: 'BUYING' });
      }
    });

    mySellingOrders.forEach((o) => {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        list.push({ ...o, direction: 'SELLING' });
      }
    });

    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return list;
  }, [myBuyingOrders, mySellingOrders]);

  const {
    totalUsdLocked,
    totalLockedNative,
    totalLockedUsdc,
    totalLockedNgn,
    activeDealsCount,
    completedDealsCount,
  } = useMemo(() => {
    let usdLocked = 0;
    let nativeLocked = 0;
    let usdcLocked = 0;
    let ngnLocked = 0;
    let activeDeals = 0;
    let completedDeals = 0;

    allUserOrders.forEach((order) => {
      const normStatus = String(order.status || '').toLowerCase().trim();
      const isCancelled = order.isCancelled || normStatus === 'cancelled' || normStatus === 'canceled' || normStatus === 'refunded';
      const isCompleted = !isCancelled && (!!order.isCompleted || ['COMPLETED', 'PAID', 'SUCCESS'].includes(order.status));
      const isDisputed = !isCancelled && (!!order.isDisputed || order.status === 'DISPUTED');

      if (isCancelled) {
        return;
      }

      if (isCompleted) {
        completedDeals++;
      } else if (!isDisputed && order.status !== 'FAILED') {
        activeDeals++;

        if (order.type === 'FIAT') {
          const rawLocked = String(order.formattedLocked || order.formattedTotal || '0').replace(/,/g, '');
          const val = parseFloat(rawLocked);
          if (!isNaN(val) && val > 0) {
            ngnLocked += val;
            const ngnRate = rates['NGN'] || 0;
            if (ngnRate > 0) {
              usdLocked += val / ngnRate;
            }
          }
        } else if (order.type === 'GIFTCARD') {
          const val = parseFloat(String(order.formattedLocked || order.formattedTotal || '0'));
          if (!isNaN(val) && val > 0) usdLocked += val;
        } else {
          // Crypto (USDC or native token)
          const val = parseFloat(String(order.formattedLocked || order.formattedTotal || '0'));
          if (!isNaN(val) && val > 0) {
            if (order.token_symbol === 'USDC') {
              usdcLocked += val;
              usdLocked += val;
            } else {
              nativeLocked += val;
              const sym = order.token_symbol || activeCurrencySymbol;
              const tokenPrice = rates[sym] ?? rates[activeCurrencySymbol] ?? 0;
              usdLocked += val * tokenPrice;
            }
          }
        }
      }
    });

    return {
      totalUsdLocked: usdLocked,
      totalLockedNative: nativeLocked,
      totalLockedUsdc: usdcLocked,
      totalLockedNgn: ngnLocked,
      activeDealsCount: activeDeals,
      completedDealsCount: completedDeals,
    };
  }, [allUserOrders, rates, activeCurrencySymbol]);

  // Filtered orders for the History Table combining Category Tab and Search Query
  const displayedOrders = useMemo(() => {
    return allUserOrders.filter((order) => {
      // 1. Category tab filter
      const filterKey = orderFilter.toLowerCase();
      const orderTradeType = String(order.trade_type || order.type || '').toUpperCase();
      const matchesCategory =
        filterKey === 'all' ||
        (filterKey === 'crypto' && orderTradeType === 'CRYPTO') ||
        ((filterKey === 'fiat' || filterKey === 'bank transfer') && orderTradeType === 'FIAT') ||
        ((filterKey === 'giftcard' || filterKey === 'gift card') && (orderTradeType === 'GIFT_CARD' || orderTradeType === 'GIFTCARD'));

      if (!matchesCategory) return false;

      // 2. Search filter
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const idStr = String(order.id || '').toLowerCase();
      const rawId = idStr.replace('ngn-', '').replace('gc-', '');
      const refStr = `ord#${rawId.padStart(6, '0')}`;
      const txnStr = `txn#${rawId.padStart(6, '0')}`;
      const gcStr = `gc#${rawId.padStart(6, '0')}`;
      const buyerEmail = String(order.buyer_email || order.buyerEmail || (String(order.buyer).includes('@') ? order.buyer : '') || '').toLowerCase();
      const sellerEmail = String(order.seller_email || order.sellerEmail || (String(order.seller).includes('@') ? order.seller : '') || '').toLowerCase();
      const buyerAddress = String(order.buyer_wallet_address || order.buyer || '').toLowerCase();
      const sellerAddress = String(order.seller_address || order.seller || '').toLowerCase();
      const status = String(order.status || '').toLowerCase();
      const amount = String(order.amount || order.formattedTotal || '').toLowerCase();
      const token = String(order.token_symbol || '').toLowerCase();
      const tradeType = String(order.trade_type || order.type || '').toLowerCase();
      const methodLabel = order.type === 'CRYPTO' ? 'crypto' : order.type === 'FIAT' ? 'bank fiat' : 'gift card';
      const direction = String(order.direction || '').toLowerCase();

      return (
        idStr.includes(q) ||
        refStr.includes(q) ||
        txnStr.includes(q) ||
        gcStr.includes(q) ||
        buyerEmail.includes(q) ||
        sellerEmail.includes(q) ||
        buyerAddress.includes(q) ||
        sellerAddress.includes(q) ||
        status.includes(q) ||
        amount.includes(q) ||
        token.includes(q) ||
        tradeType.includes(q) ||
        methodLabel.includes(q) ||
        direction.includes(q)
      );
    });
  }, [allUserOrders, orderFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, orderFilter, pageSize]);

  const totalOrders = displayedOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedOrders = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return displayedOrders.slice(start, start + pageSize);
  }, [displayedOrders, safeCurrentPage, pageSize]);

  const filteredHistory = paginatedOrders;

  // Real Token Valuation & Rate Fetching (Card 2)
  const activeNativeSymbol = activeCurrencySymbol;
  const nativePriceUSD = rates[activeNativeSymbol] || 0;

  const nativeVal = nativeBalance ? parseFloat(formatEther(nativeBalance.value)) : 0;
  const usdcVal = usdcBalance ? parseFloat(formatUnits(usdcBalance.value, 6)) : 0;
  const aggregatedWalletUsd = (nativeVal * nativePriceUSD) + usdcVal;

  const walletHeadline = !userAddress
    ? '$0.00'
    : aggregatedWalletUsd > 0 && aggregatedWalletUsd < 0.01
    ? '<$0.01'
    : `$${aggregatedWalletUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Card 1 Headlines & Subtexts (Locked in Escrow Micro-Amount Formatting)
  const lockedHeadline = totalUsdLocked > 0 && totalUsdLocked < 0.01
    ? '<$0.01'
    : totalUsdLocked > 0
    ? `$${totalUsdLocked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00';

  const lockedSubtext = activeDealsCount === 0
    ? 'No active escrows'
    : totalLockedNative > 0
    ? `${totalLockedNative.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${activeCurrencySymbol} in ${activeDealsCount} deal${activeDealsCount === 1 ? '' : 's'}`
    : totalLockedUsdc > 0
    ? `${totalLockedUsdc.toFixed(2)} USDC in ${activeDealsCount} deal${activeDealsCount === 1 ? '' : 's'}`
    : totalLockedNgn > 0
    ? `₦${totalLockedNgn.toLocaleString()} NGN in ${activeDealsCount} deal${activeDealsCount === 1 ? '' : 's'}`
    : `In ${activeDealsCount} active deal${activeDealsCount === 1 ? '' : 's'}`;

  const greetingName = useMemo(() => {
    if (user?.google?.name) return user.google.name;
    if (activeEmail) return activeEmail.split('@')[0];
    if (userAddress) return `${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`;
    return 'Trader';
  }, [user, activeEmail, userAddress]);

  async function resolveSellerAddress(raw: string): Promise<string | null> {
    const trimmed = raw.trim();
    if (isAddress(trimmed)) return trimmed;

    if (isValidEmail(trimmed)) {
      showToastRef.current('Resolving email to secure wallet...', 'info');
      try {
        const res = await fetch('/api/privy/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        });
        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Resolution failed');
        if (!isAddress(data.address)) throw new Error('Resolved address is invalid');
        showToastRef.current(`Found wallet: ${data.address.slice(0, 6)}...${data.address.slice(-4)}`, 'success');
        return data.address as string;
      } catch (err: any) {
        showToastRef.current(err.message, 'error');
        return null;
      }
    }
    showToastRef.current('Invalid Wallet Address or Email', 'error');
    return null;
  }

  const handleCryptoTransaction = async () => {
    if (isUnsupportedNetwork) {
      showToastRef.current('Please switch to a supported network first.', 'error');
      return;
    }
    if (!sellerAddress.trim() || !amountInput) return;

    const finalSellerAddress = await resolveSellerAddress(sellerAddress);
    if (!finalSellerAddress) return;

    if (finalSellerAddress.toLowerCase() === userAddress?.toLowerCase()) {
      showToastRef.current('You cannot create an order with yourself.', 'error');
      return;
    }

    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToastRef.current('Please enter a valid amount.', 'error');
      return;
    }

    setIsWriting(true);
    try {
      const wallet = wallets[0];
      if (!wallet) throw new Error('Wallet not connected');

      await wallet.switchChain(activeChainId);
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({ account: wallet.address as `0x${string}`, chain: activeChain.viemChain, transport: custom(provider) });
      const publicClient = createPublicClient({ chain: activeChain.viemChain, transport: custom(provider) });

      const isNative = selectedAsset.type === 'native';
      const amountWei = parseUnits(amountInput, selectedAsset.decimals);
      const symbolLabel = isNative ? activeCurrencySymbol : 'USDC';

      if (!isNative) {
        const currentAllowance = usdcAllowance ? BigInt(String(usdcAllowance)) : BigInt(0);
        if (currentAllowance < amountWei) {
          showToastRef.current('Approving USDC… Please wait.', 'info');
          const approveHash = await walletClient.writeContract({ address: selectedAsset.address as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACT_ADDRESS, amountWei] });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
          refetchAllowance?.();
          showToastRef.current('USDC Approved. Securing escrow…', 'info');
        }
      }

      showToastRef.current('Awaiting wallet confirmation…', 'info');
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'createEscrow',
        args: [finalSellerAddress as `0x${string}`, selectedAsset.address as `0x${string}`, amountWei],
        value: isNative ? amountWei : BigInt(0),
      });

      showToastRef.current('Transaction submitted. Waiting for confirmation…', 'info');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        const sellerEmailIfProvided = isValidEmail(sellerAddress.trim()) ? sellerAddress.trim() : null;

        const res = await fetch('/api/escrow/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyer_wallet_address: userAddress, seller_address: finalSellerAddress,
            buyer_email: buyerEmail || null, seller_email: sellerEmailIfProvided,
            amount: amountInput, token_symbol: symbolLabel, network: activeChain.name, status: 'secured',
          }),
        });
        const data = await res.json();

        if (data.status === 'error') {
          showToastRef.current('Escrow secured on-chain, but dashboard sync is delayed.', 'warning');
        } else {
          showToastRef.current('Escrow Created Successfully!', 'success');
          if (sellerEmailIfProvided) {
            sendEmailRef.current(sellerEmailIfProvided, `New Escrow Order on ${activeChain.name}! 💰`, `Great news! A buyer has securely locked ${amountInput} ${symbolLabel} in TrustLink.\n\nIMPORTANT: This order was created on the ${activeChain.name} network. Please ensure your wallet is connected to ${activeChain.name} in your TrustLink dashboard to view and accept the order.`);
          }
        }
        setSellerAddress('');
        setAmountInput('');
        setIsCreateModalOpen(false);
        handleRefresh();
      } else { throw new Error('Transaction reverted on chain.'); }
    } catch (err: any) {
      showToastRef.current(err.shortMessage || err.message || 'Transaction Error', 'error');
    } finally { setIsWriting(false); }
  };

  const handleFiatTransaction = async () => {
    const effectiveCode = selectedBank?.code || bankCode;
    if (!fiatAmount || !accountNumber || !effectiveCode || !buyerEmail || !sellerEmail) { showToastRef.current('Please fill all fields', 'error'); return; }
    if (!isValidEmail(buyerEmail) || !isValidEmail(sellerEmail)) { showToastRef.current('Invalid email address', 'error'); return; }
    
    if (buyerEmail.trim().toLowerCase() === sellerEmail.trim().toLowerCase()) { 
      showToastRef.current('You cannot create an order with yourself.', 'error'); 
      return; 
    }

    if (!accountName) { showToastRef.current('Please wait for bank verification to complete', 'error'); return; }
    
    const parsedFiat = parseFloat(fiatAmount);
    if (isNaN(parsedFiat) || parsedFiat <= 0) { showToastRef.current('Please enter a valid amount', 'error'); return; }

    try {
      showToastRef.current('Initializing Secure Checkout…', 'info');
      const response = await fetch('/api/paystack/initiate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: fiatAmount, email: buyerEmail, seller_email: sellerEmail,
          seller_bank: selectedBank?.name || banks.find((b) => b.code === effectiveCode)?.name || effectiveCode,
          seller_number: accountNumber, seller_name: accountName,
          description: sanitize(fiatDescription || 'Escrow Payment', 500), buyer_wallet: userAddress,
        }),
      });

      const data = await response.json();
      if (!data.status) throw new Error(data.message || 'Payment initialization failed');

      const authUrl = data?.data?.authorization_url;
      if (!isSafePaystackUrl(authUrl)) throw new Error('Invalid payment redirect URL');

      setIsCreateModalOpen(false);
      showToastRef.current('Redirecting to Paystack…', 'success');
      setTimeout(() => { window.location.href = authUrl; }, 1000);
    } catch (err: any) { showToastRef.current(err.message || 'Payment Error', 'error'); }
  };

  const handleGiftCardTransaction = async () => {
    if (trustLevel === null || trustLevel < 3) {
      showToastRef.current('Level 3 required to use Gift Card escrow.', 'error');
      return;
    }

    if (!gcSellerAddress.trim() || !gcAmount || !gcBrand || !gcCode) {
      showToastRef.current("Please fill all Gift Card details.", 'error');
      return;
    }
    if (!gcImage) {
      showToastRef.current("Please upload an image of the physical gift card.", 'error');
      return;
    }

    const parsedGc = parseFloat(gcAmount);
    if (isNaN(parsedGc) || parsedGc <= 0) {
      showToastRef.current('Please enter a valid amount.', 'error');
      return;
    }

    const sellerIdentifier = gcSellerAddress.trim();
    const gcSellerEmail = isValidEmail(sellerIdentifier) ? sellerIdentifier : null;

    if (gcSellerEmail && activeEmail && gcSellerEmail.toLowerCase() === activeEmail.toLowerCase()) {
      showToastRef.current('You cannot create an order with yourself.', 'error');
      return;
    }

    setIsWriting(true);
    let uploadedFileName: string | undefined;
    
    try {
      showToastRef.current('Uploading card image…', 'info');
      const fileExt = gcImage.name.split('.').pop() ?? 'jpg';
      const fileName = `gc-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      uploadedFileName = fileName;

      const { error: uploadError } = await supabase.storage
        .from('gift-card-images')
        .upload(fileName, gcImage, { upsert: false });
      if (uploadError) throw new Error('Image upload failed: ' + uploadError.message);

      const { data: publicUrlData } = supabase.storage
        .from('gift-card-images')
        .getPublicUrl(fileName);

      const fullImageUrl = publicUrlData.publicUrl;

      showToastRef.current('Encrypting gift card code…', 'info');
      const token = await getAccessToken();
      const response = await fetch('/api/giftcard/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          buyer_email:       buyerEmail || null,
          buyer_wallet:      userAddress || null,
          seller_email:      gcSellerEmail,
          seller_identifier: sellerIdentifier,
          gc_brand:          sanitize(gcBrand, 50),
          gc_amount:         gcAmount,
          gc_code:           sanitize(gcCode, 200),
          gc_image_url:      fullImageUrl,
          trade_type:        'GIFT_CARD',
          status:            'secured',
        }),
      });

      const responseData = await response.json();
      if (!responseData.status) throw new Error(responseData.message || 'Failed to create gift card escrow');

      if (gcSellerEmail) {
        sendEmailRef.current(
          gcSellerEmail,
          'New Gift Card Escrow Order! 🎁',
          `Great news! A buyer has secured a $${gcAmount} ${gcBrand} Gift Card in TrustLink for your service.\n\nThe card code has been encrypted and locked. Please log in to your TrustLink dashboard to view and accept the order.\n\nThe code will only be revealed to you once you deliver the service and the buyer releases the escrow.`
        );
      }

      setShowSuccessModal(true);
      setIsCreateModalOpen(false);
      setGcSellerAddress('');
      setGcAmount('');
      setGcBrand('');
      setGcCode('');
      setGcImage(null);
      setFileInputKey(prev => prev + 1);
      handleRefresh();

    } catch (err: any) {
      if (uploadedFileName) {
        supabase.storage.from('gift-card-images').remove([uploadedFileName]).catch(() => {});
      }
      showToastRef.current(err.message || 'Transaction Error', 'error');
    } finally {
      setIsWriting(false);
    }
  };

  // ─── Trade Actions ──────────────────────────────────────────────────────────

  const handleAccept = async (item: any) => {
    const dbId = parseDbOrderId(item.id);
    setActionLoadingId(item.id);
    try {
      const isGiftCard = item.type === 'GIFTCARD';
      if (isGiftCard) {
        const token = await getAccessToken();
        const res = await fetch('/api/giftcard/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ order_id: dbId }),
        });
        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Failed to accept gift card order');
      } else {
        const token = await getAccessToken();
        const res = await fetch('/api/user/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ actionType: 'ACCEPT', orderId: dbId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to accept order');
      }

      const peerEmail = item.direction === 'BUYING' ? item.sellerEmail : item.buyerEmail;
      if (peerEmail) {
        sendEmailRef.current(peerEmail, 'Order Accepted! 🤝', `Your order #${item.id} has been accepted by the seller.`);
      }

      showToastRef.current('Order accepted successfully!', 'success');
      handleRefresh();
    } catch (err: any) {
      showToastRef.current(err.message || 'Failed to accept order', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkShipped = async (item: any) => {
    const dbId = parseDbOrderId(item.id);
    setActionLoadingId(item.id);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/user/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ actionType: 'SHIP', orderId: dbId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark as shipped');

      const peerEmail = item.direction === 'BUYING' ? item.sellerEmail : item.buyerEmail;
      if (peerEmail) {
        sendEmailRef.current(peerEmail, 'Order Shipped / Delivered! 🚚', `Seller marked order #${item.id} as shipped/delivered.`);
      }

      showToastRef.current('Order marked as shipped!', 'success');
      handleRefresh();
    } catch (err: any) {
      showToastRef.current(err.message || 'Failed to mark as shipped', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRelease = async (item: any) => {
    const dbId = parseDbOrderId(item.id);
    setActionLoadingId(item.id);
    try {
      const isGiftCard = item.type === 'GIFTCARD';
      const isFiat = item.type === 'FIAT';

      if (isGiftCard) {
        const token = await getAccessToken();
        const res = await fetch('/api/giftcard/release', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ order_id: dbId }),
        });
        const data = await res.json();
        if (!res.ok || !data.status) throw new Error(data.message || 'Failed to release gift card');
        showToastRef.current('Gift card escrow released successfully!', 'success');
      } else if (isFiat) {
        const token = await getAccessToken();
        const rawAmount = String(item.formattedLocked || item.formattedTotal || '0').replace(/,/g, '');
        const releaseAmount = parseFloat(rawAmount);
        const res = await fetch('/api/user/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            actionType: 'FIAT_RELEASE',
            orderId: dbId,
            payload: { releaseAmount },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to release fiat escrow');
        showToastRef.current('Fiat payout initiated! Funds will settle to seller.', 'success');
      } else {
        // On-chain Crypto release
        const scId = item.scId ?? dbId;
        const wallet = wallets[0];
        if (!wallet) throw new Error('Wallet not connected');

        await wallet.switchChain(activeChainId);
        const provider = await wallet.getEthereumProvider();
        const walletClient = createWalletClient({
          account: wallet.address as `0x${string}`,
          chain: activeChain.viemChain,
          transport: custom(provider),
        });
        const publicClient = createPublicClient({
          chain: activeChain.viemChain,
          transport: custom(provider),
        });

        const isNative = item.token === ZERO_ADDRESS || item.token_symbol === activeCurrencySymbol;
        const decimals = isNative ? 18 : 6;
        const cleanLocked = String(item.formattedLocked || item.formattedTotal || '0');
        const amountWei = parseUnits(cleanLocked, decimals);

        showToastRef.current('Confirm release in your wallet…', 'info');
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'releaseMilestone',
          args: [BigInt(scId), amountWei],
        });

        showToastRef.current('Transaction submitted. Awaiting confirmation…', 'info');
        await publicClient.waitForTransactionReceipt({ hash });

        // Database status sync:
        // Once waitForTransactionReceipt succeeds on-chain:
        // Immediately execute the Supabase update (or call internal API route) to update the order record:
        // status = 'completed', updated_at = new Date().toISOString(), released_amount = order.amount
        const releaseAmountVal = item.amount ? String(item.amount) : cleanLocked.replace(/,/g, '');

        let dbUpdated = false;
        try {
          const token = await getAccessToken();
          const actionRes = await fetch('/api/user/action', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              actionType: 'CRYPTO_RELEASE',
              orderId: dbId,
              payload: { releaseAmount: releaseAmountVal },
            }),
          });
          if (actionRes.ok) {
            dbUpdated = true;
          } else {
            console.warn('Action API release update returned non-ok status');
          }
        } catch (apiErr) {
          console.warn('Action API release error:', apiErr);
        }

        // Direct Supabase update safeguard if API did not write
        if (!dbUpdated && supabase && dbId) {
          try {
            await supabase
              .from('escrow_orders')
              .update({
                status: 'completed',
                updated_at: new Date().toISOString(),
                released_amount: releaseAmountVal,
              })
              .eq('id', dbId);
            dbUpdated = true;
          } catch (sbErr) {
            console.error('Direct Supabase write error:', sbErr);
          }
        }

        // Optimistically update local dbOrders state so actionable notifications immediately clear
        setDbOrders((prev) => {
          if (!prev || !prev[dbId]) return prev;
          return {
            ...prev,
            [dbId]: {
              ...prev[dbId],
              status: 'completed',
              isCompleted: true,
              updated_at: new Date().toISOString(),
              released_amount: releaseAmountVal,
            },
          };
        });

        // Also trigger on-chain contract state sync endpoint
        try {
          const token = await getAccessToken();
          await fetch('/api/escrow/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ orderId: dbId, scId, chainId: activeChainId }),
          });
        } catch (syncErr) {
          console.warn('Sync delayed:', syncErr);
        }

        fetch('/api/profile/increment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ buyer: item.buyer, seller: item.seller }),
        }).catch(console.error);

        showToastRef.current('Funds released successfully!', 'success');
      }

      const peerEmail = item.direction === 'BUYING' ? item.sellerEmail : item.buyerEmail;
      if (peerEmail) {
        sendEmailRef.current(peerEmail, 'Escrow Funds Released! 💰', `Buyer has released the escrow funds for order #${item.id}.`);
      }

      setSelectedOrderForModal(null);
      await handleRefresh();
    } catch (err: any) {
      showToastRef.current(err.shortMessage || err.message || 'Failed to release escrow', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDispute = async (item: any) => {
    const dbId = parseDbOrderId(item.id);
    setActionLoadingId(item.id);
    try {
      const isOffChain = item.type === 'FIAT' || item.type === 'GIFTCARD';
      if (isOffChain) {
        const token = await getAccessToken();
        const res = await fetch('/api/user/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ actionType: 'DISPUTE', orderId: dbId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to open dispute');
      } else {
        const scId = item.scId ?? dbId;
        const wallet = wallets[0];
        if (!wallet) throw new Error('Wallet not connected');

        await wallet.switchChain(activeChainId);
        const provider = await wallet.getEthereumProvider();
        const walletClient = createWalletClient({
          account: wallet.address as `0x${string}`,
          chain: activeChain.viemChain,
          transport: custom(provider),
        });
        const publicClient = createPublicClient({
          chain: activeChain.viemChain,
          transport: custom(provider),
        });

        showToastRef.current('Confirm dispute in your wallet…', 'info');
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'raiseDispute',
          args: [BigInt(scId)],
        });

        showToastRef.current('Transaction submitted. Awaiting confirmation…', 'info');
        await publicClient.waitForTransactionReceipt({ hash });
      }

      const peerEmail = item.direction === 'BUYING' ? item.sellerEmail : item.buyerEmail;
      if (peerEmail) {
        sendEmailRef.current(peerEmail, 'Dispute Raised 🚨', `A dispute has been raised on order #${item.id}. Admin mediation initiated.`);
      }

      showToastRef.current('Dispute opened. Admin mediator notified.', 'warning');
      handleRefresh();
    } catch (err: any) {
      showToastRef.current(err.shortMessage || err.message || 'Failed to open dispute', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (item: any) => {
    const dbId = parseDbOrderId(item.id);
    setActionLoadingId(item.id);
    try {
      const isOffChain = item.type === 'FIAT' || item.type === 'GIFTCARD';
      if (isOffChain) {
        const token = await getAccessToken();
        const res = await fetch('/api/user/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ actionType: 'CANCEL', orderId: dbId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to cancel escrow');
        showToastRef.current('Escrow cancelled. Locked funds returned.', 'success');
      } else {
        const scId = item.scId ?? dbId;
        const wallet = wallets[0];
        if (!wallet) throw new Error('Wallet not connected');

        await wallet.switchChain(activeChainId);
        const provider = await wallet.getEthereumProvider();
        const walletClient = createWalletClient({
          account: wallet.address as `0x${string}`,
          chain: activeChain.viemChain,
          transport: custom(provider),
        });
        const publicClient = createPublicClient({
          chain: activeChain.viemChain,
          transport: custom(provider),
        });

        showToastRef.current('Confirm cancellation in your wallet…', 'info');
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'cancelOrder',
          args: [BigInt(scId)],
        });

        showToastRef.current('Transaction submitted. Awaiting confirmation…', 'info');
        await publicClient.waitForTransactionReceipt({ hash });

        // Update DB state
        try {
          const token = await getAccessToken();
          await fetch('/api/user/action', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ actionType: 'CANCEL', orderId: dbId }),
          });
        } catch (dbErr) {
          console.warn('DB cancel sync:', dbErr);
        }

        showToastRef.current('Escrow cancelled! Locked funds returned to your wallet.', 'success');
      }

      const peerEmail = item.direction === 'BUYING' ? item.sellerEmail : item.buyerEmail;
      if (peerEmail) {
        sendEmailRef.current(
          peerEmail,
          'Escrow Order Cancelled 🚫',
          `Buyer has cancelled escrow order #${item.id}. Funds returned to buyer's wallet.`
        );
      }

      handleRefresh();
    } catch (err: any) {
      showToastRef.current(err.shortMessage || err.message || 'Failed to cancel escrow', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSplitRelease = async (item: any, releaseAmount: number) => {
    const dbId = parseDbOrderId(item.id);
    setActionLoadingId(item.id);
    try {
      const isFiat = item.type === 'FIAT';
      if (isFiat) {
        const token = await getAccessToken();
        const res = await fetch('/api/user/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            actionType: 'FIAT_RELEASE',
            orderId: dbId,
            payload: { releaseAmount, isPartial: true },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to release partial funds');
        showToastRef.current(`Partial release of ₦${releaseAmount.toLocaleString()} initiated!`, 'success');
      } else {
        // On-chain Crypto milestone release
        const scId = item.scId ?? dbId;
        const wallet = wallets[0];
        if (!wallet) throw new Error('Wallet not connected');

        await wallet.switchChain(activeChainId);
        const provider = await wallet.getEthereumProvider();
        const walletClient = createWalletClient({
          account: wallet.address as `0x${string}`,
          chain: activeChain.viemChain,
          transport: custom(provider),
        });
        const publicClient = createPublicClient({
          chain: activeChain.viemChain,
          transport: custom(provider),
        });

        const isNative = item.token === ZERO_ADDRESS || item.token_symbol === activeCurrencySymbol;
        const decimals = isNative ? 18 : 6;
        const amountWei = parseUnits(String(releaseAmount), decimals);

        showToastRef.current('Confirm partial release in your wallet…', 'info');
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'releaseMilestone',
          args: [BigInt(scId), amountWei],
        });

        showToastRef.current('Transaction submitted. Awaiting confirmation…', 'info');
        await publicClient.waitForTransactionReceipt({ hash });

        const cleanLockedNum = parseFloat(String(item.formattedLocked || item.formattedTotal || '0').replace(/,/g, '')) || 0;
        const isFullRelease = releaseAmount >= cleanLockedNum;
        const newStatus = isFullRelease ? 'completed' : 'partially_released';

        let dbUpdated = false;
        try {
          const token = await getAccessToken();
          const actionRes = await fetch('/api/user/action', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              actionType: 'CRYPTO_RELEASE',
              orderId: dbId,
              payload: {
                releaseAmount,
                isPartial: !isFullRelease,
              },
            }),
          });
          if (actionRes.ok) {
            dbUpdated = true;
          }
        } catch (apiErr) {
          console.warn('API partial release update error:', apiErr);
        }

        if (!dbUpdated && supabase && dbId) {
          try {
            await supabase
              .from('escrow_orders')
              .update({
                status: newStatus,
                updated_at: new Date().toISOString(),
                released_amount: releaseAmount,
              })
              .eq('id', dbId);
          } catch (e) {
            console.warn('Direct partial release update error:', e);
          }
        }

        setDbOrders((prev) => {
          if (!prev || !prev[dbId]) return prev;
          return {
            ...prev,
            [dbId]: {
              ...prev[dbId],
              status: newStatus,
              isCompleted: isFullRelease,
              updated_at: new Date().toISOString(),
              released_amount: releaseAmount,
            },
          };
        });

        // Also trigger on-chain contract state sync endpoint
        try {
          const token = await getAccessToken();
          await fetch('/api/escrow/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ orderId: dbId, scId, chainId: activeChainId }),
          });
        } catch (syncErr) {
          console.warn('Sync delayed:', syncErr);
        }

        fetch('/api/profile/increment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ buyer: item.buyer, seller: item.seller }),
        }).catch(console.error);

        showToastRef.current(
          isFullRelease
            ? 'Full escrow funds released successfully!'
            : `Partial release of ${releaseAmount} ${item.token_symbol} confirmed!`,
          'success'
        );
      }

      const peerEmail = item.direction === 'BUYING' ? item.sellerEmail : item.buyerEmail;
      if (peerEmail) {
        sendEmailRef.current(
          peerEmail,
          'Milestone Payment Released! 💰',
          `Buyer has released a partial milestone payment of ${releaseAmount} ${item.token_symbol} on order #${item.id}.`
        );
      }

      setSelectedOrderForModal(null);
      await handleRefresh();
    } catch (err: any) {
      showToastRef.current(err.shortMessage || err.message || 'Failed to release milestone', 'error');
      throw err;
    } finally {
      setActionLoadingId(null);
    }
  };

  const openChat = useCallback((item: any) => {
    setActiveChatOrder(item);
    const dbId = parseDbOrderId(item.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`chat_last_read_${dbId}`, Date.now().toString());
      localStorage.setItem(`chat_last_read_${item.id}`, Date.now().toString());
    }
    setUnreadMap((prev) => ({
      ...prev,
      [dbId]: 0,
      [item.id]: 0,
    }));

    // Mark messages as read in Supabase
    if (userAddress) {
      supabase
        .from('messages')
        .update({ read: true })
        .eq('order_id', dbId)
        .neq('sender_address', userAddress)
        .then(() => {}, () => {});
    }
  }, [userAddress, supabase]);

  // ── Unread Messages Tracking for Deal Chat ──
  const fetchUnreadMessages = useCallback(async () => {
    if (!sessionReady || !userAddress) return;

    const orderIds = allUserOrders
      .map((o) => parseDbOrderId(o.id))
      .filter((id): id is number => typeof id === 'number' && id > 0);

    if (orderIds.length === 0) return;

    try {
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('id, order_id, sender_address, created_at, read')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (error || !msgs) return;

      const counts: Record<string | number, number> = {};
      msgs.forEach((m: any) => {
        const isFromOther = m.sender_address?.toLowerCase() !== userAddress.toLowerCase();
        if (!isFromOther) return;

        const lastRead = Number(typeof window !== 'undefined' ? localStorage.getItem(`chat_last_read_${m.order_id}`) : 0) || 0;
        const msgTime = new Date(m.created_at).getTime();
        const isUnread = !m.read && (!lastRead || msgTime > lastRead);

        if (isUnread) {
          counts[m.order_id] = (counts[m.order_id] || 0) + 1;
        }
      });

      setUnreadMap(counts);
    } catch (err) {
      console.warn('Failed to fetch unread messages', err);
    }
  }, [sessionReady, userAddress, allUserOrders, supabase]);

  useEffect(() => {
    fetchUnreadMessages();
  }, [fetchUnreadMessages]);

  useEffect(() => {
    if (!sessionReady || !userAddress) return;

    const channel = supabase
      .channel('escrow-chat-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload: any) => {
          const newMsg = payload.new;
          if (!newMsg?.order_id) return;

          const isFromOther = newMsg.sender_address?.toLowerCase() !== userAddress.toLowerCase();
          if (!isFromOther) return;

          const currentOpenOrderId = activeChatOrderRef.current
            ? parseDbOrderId(activeChatOrderRef.current.id)
            : null;

          if (currentOpenOrderId === newMsg.order_id) {
            if (typeof window !== 'undefined') {
              localStorage.setItem(`chat_last_read_${newMsg.order_id}`, Date.now().toString());
            }
            if (userAddress) {
              supabase
                .from('messages')
                .update({ read: true })
                .eq('id', newMsg.id)
                .then(() => {}, () => {});
            }
          } else {
            setUnreadMap((prev) => ({
              ...prev,
              [newMsg.order_id]: (prev[newMsg.order_id] || 0) + 1,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionReady, userAddress, supabase]);

  const hasEmailLinked = !!(user?.email?.address || user?.google?.email || user?.apple?.email || user?.discord?.email);
  const isGiftCardLocked = trustLevel === null || trustLevel < 3;

  if (!ready || !authenticated || sessionLoading) {
    return (
      <div className="min-h-screen bg-[#060812] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin mb-4" />
        <p className="text-slate-400 font-mono text-sm animate-pulse">Securing session…</p>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-[#060812] flex flex-col items-center justify-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-slate-300 font-mono text-sm mb-6 max-w-sm text-center">{sanitize(sessionError, 200)}</p>
        <button type="button" onClick={refreshSession} className="px-6 py-3 bg-[#161b30] hover:bg-slate-800 border border-[#232a45] text-violet-400 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2">
          <RefreshCcw className="w-4 h-4" /> Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen px-6 lg:px-10 py-8 bg-[#060812] text-white space-y-8 font-sans">
      <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />

      {/* ── Success Modal ── */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#161b30] border border-[#232a45] p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-3">
              {mode === 'giftcard' ? 'Gift Card Secured! 🎁' : 'Payment Successful!'}
            </h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              {mode === 'giftcard'
                ? 'Your gift card code has been encrypted and locked in escrow. The seller has been notified and will deliver the service before the code is revealed.'
                : 'Your fiat payment has been securely locked in escrow. The seller has been notified via email.'}
            </p>
            <button type="button" onClick={() => setShowSuccessModal(false)} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-violet-600/20">
              View My Orders
            </button>
          </div>
        </div>
      )}

      {/* ── Notification Toast ── */}
      {notification && (
        <div role="alert" aria-live="polite" className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md max-w-sm ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : notification.type === 'info' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : notification.type === 'warning' ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : notification.type === 'info' ? <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm font-bold truncate">{notification.message}</p>
        </div>
      )}

      {/* ── Header Row ── */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Hello, {greetingName}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Here&apos;s an overview of your active escrow activities.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              {/* Network Selector Pill */}
              <div className="relative" ref={networkDropdownRef}>
                <button
                  type="button"
                  aria-label="Select network"
                  aria-expanded={isNetworkListOpen}
                  onClick={() => setIsNetworkListOpen((v) => !v)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    isUnsupportedNetwork
                      ? 'bg-red-500/10 border-red-500 text-red-400'
                      : 'bg-[#161b30] border-[#232a45] text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <Globe className="w-4 h-4 text-slate-400" aria-hidden />
                  <span className="inline-block max-w-[120px] sm:max-w-none truncate">
                    {isUnsupportedNetwork ? 'Unsupported' : activeChain.name}
                  </span>
                  {actionableOrdersCount > 0 && (
                    <span
                      aria-label={`${actionableOrdersCount} actions required`}
                      className="flex items-center justify-center bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                    >
                      {actionableOrdersCount}
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden />
                </button>

                {isNetworkListOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#161b30] border border-[#232a45] rounded-xl z-[100] overflow-hidden shadow-2xl">
                    {SUPPORTED_CHAIN_IDS.map((chainIdNum) => {
                      const config = CHAIN_CONFIG[chainIdNum];
                      if (!config) return null;
                      return (
                        <button
                          key={chainIdNum}
                          type="button"
                          onClick={() => {
                            switchChain({ chainId: chainIdNum });
                            setIsNetworkListOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center justify-between ${
                            chainIdNum === chainId ? 'text-violet-400 bg-violet-500/10' : 'text-slate-300'
                          }`}
                        >
                          <span>{config.name}</span>
                          {networkAlerts[chainIdNum] > 0 && (
                            <span className="flex items-center justify-center bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full">
                              {networkAlerts[chainIdNum]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Primary CTA (Single Clean Icon + Label, no duplicate plus) */}
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-violet-600/20 transition-all flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Escrow</span>
              </button>
            </div>
          </div>

          {/* ── 4-Card Metric Ribbon ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 w-full">
            {/* Card 1: Locked in Escrow */}
            <div className="bg-[#161b30] border border-[#232a45] rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-400">Locked in Escrow</span>
                  <button
                    type="button"
                    onClick={toggleShowLockedBalance}
                    className="text-slate-400 hover:text-white transition-colors p-1 rounded-md"
                    title={showLockedBalance ? "Hide balance" : "Show balance"}
                    aria-label={showLockedBalance ? "Hide balance" : "Show balance"}
                  >
                    {showLockedBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  {showLockedBalance ? lockedHeadline : '••••••'}
                </div>
                <div className="text-xs text-slate-400 mt-1 truncate" title={showLockedBalance ? lockedSubtext : undefined}>
                  {showLockedBalance ? lockedSubtext : '••••••'}
                </div>
              </div>
            </div>

            {/* Card 2: Wallet Balance (Aggregated USD valuation + native breakdown) */}
            <div className="bg-[#161b30] border border-[#232a45] rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-400">Wallet Balance</span>
                  <button
                    type="button"
                    onClick={toggleShowWalletBalance}
                    className="text-slate-400 hover:text-white transition-colors p-1 rounded-md"
                    title={showWalletBalance ? "Hide balance" : "Show balance"}
                    aria-label={showWalletBalance ? "Hide balance" : "Show balance"}
                  >
                    {showWalletBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {stale && (
                    <span
                      title="Market data cached · Updating..."
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse"
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>Market data cached · Updating...</span>
                    </span>
                  )}
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  {showWalletBalance ? walletHeadline : '••••••'}
                </div>
                <div className="text-xs text-slate-400 mt-1 truncate">
                  {showWalletBalance
                    ? (userAddress
                      ? `Available on ${activeChain.name}`
                      : 'Connect wallet to view')
                    : '••••••'}
                </div>
              </div>
            </div>

            {/* Card 3: Active Deals */}
            <div className="bg-[#161b30] border border-[#232a45] rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-400">Active Deals</span>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  {activeDealsCount}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {activeDealsCount === 1 ? '1 deal in progress' : `${activeDealsCount} deals in progress`}
                </div>
              </div>
            </div>

            {/* Card 4: Completed Escrows */}
            <div className="bg-[#161b30] border border-[#232a45] rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-400">Completed Escrows</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  {completedDealsCount}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  All-time released orders
                </div>
              </div>
            </div>
          </div>

          {/* ── Nexar-Style History Data Table ── */}
          <div className="bg-[#161b30] border border-[#232a45] rounded-2xl p-6 w-full space-y-4">
            {/* Table Header Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Left: Title & Inline Search Box */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">History</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                    {displayedOrders.length}
                  </span>
                </div>
                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search orders, addresses..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-[#0b0e1b] border border-[#232a45] rounded-xl text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Right: Page size selector + Category filter tabs + Refresh */}
              <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                <div className="flex items-center gap-1.5 bg-[#0b0e1b] border border-[#232a45] rounded-xl px-2.5 py-1.5 text-xs">
                  <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Show</span>
                  <select
                    aria-label="Select page size"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-transparent text-slate-200 text-xs font-semibold outline-none cursor-pointer"
                  >
                    <option value={5} className="bg-[#161b30] text-slate-200">5 / page</option>
                    <option value={10} className="bg-[#161b30] text-slate-200">10 / page</option>
                    <option value={20} className="bg-[#161b30] text-slate-200">20 / page</option>
                  </select>
                </div>

                <div className="flex items-center bg-[#0b0e1b] border border-[#232a45] rounded-xl p-1 text-xs font-semibold">
                  {(
                    [
                      { key: 'all', label: 'All' },
                      { key: 'crypto', label: 'Crypto' },
                      { key: 'fiat', label: 'Bank Transfer' },
                      { key: 'giftcard', label: 'Gift Card' },
                    ] as const
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setOrderFilter(key)}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        orderFilter === key ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  aria-label="Refresh history"
                  onClick={handleRefresh}
                  className="p-2 text-slate-400 hover:text-white bg-[#0b0e1b] border border-[#232a45] rounded-xl transition-all"
                  title="Refresh history"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-[#232a45] text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                    <th scope="col" className="py-3 px-4">Date</th>
                    <th scope="col" className="py-3 px-4">Type</th>
                    <th scope="col" className="py-3 px-4">Amount</th>
                    <th scope="col" className="py-3 px-4">Title / Counterparty</th>
                    <th scope="col" className="py-3 px-4">Status</th>
                    <th scope="col" className="py-3 px-4 text-right">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232a45]/60">
                  {filteredHistory.map((item) => {
                    const formattedDate = item.timestamp
                      ? new Date(item.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : '—';

                    const isBuying = item.direction === 'BUYING';
                    const methodLabel = item.type === 'CRYPTO' ? 'Crypto' : item.type === 'FIAT' ? 'Bank' : 'Gift Card';

                    let displayAmount = '';
                    if (item.type === 'FIAT') {
                      displayAmount = `₦${item.formattedTotal}`;
                    } else if (item.type === 'GIFTCARD') {
                      displayAmount = `$${item.formattedTotal}`;
                    } else {
                      displayAmount = item.token_symbol === 'USDC' ? `$${item.formattedTotal}` : `${item.formattedTotal} ${item.token_symbol}`;
                    }

                    const counterparty = isBuying
                      ? (item.sellerEmail || (item.seller?.startsWith('0x') ? `${item.seller.slice(0, 6)}…${item.seller.slice(-4)}` : item.seller) || 'Seller')
                      : (item.buyerEmail || (item.buyer?.startsWith('0x') ? `${item.buyer.slice(0, 6)}…${item.buyer.slice(-4)}` : item.buyer) || 'Buyer');
                    const roleLabel = isBuying ? 'Seller' : 'Buyer';

                    const normStatus = String(item.status || '').toLowerCase().trim();
                    const isCancelled = item.isCancelled || normStatus === 'cancelled' || normStatus === 'canceled' || normStatus === 'refunded';
                    const isCompleted = !isCancelled && (item.isCompleted || ['COMPLETED', 'PAID', 'SUCCESS'].includes(item.status));
                    const isDisputed = !isCancelled && (item.isDisputed || item.status === 'DISPUTED');
                    const isAccepted = !isCancelled && !!item.isAccepted;
                    const isUnaccepted = !isAccepted && !isCompleted && !isDisputed && !isCancelled && (
                      normStatus === 'secured' ||
                      normStatus === 'waiting acceptance' ||
                      normStatus === 'waiting_acceptance' ||
                      normStatus === 'in escrow' ||
                      normStatus === 'pending'
                    );

                    const rawId = String(item.id);
                    const cleanRef = rawId.startsWith('NGN-')
                      ? `TXN#${rawId.replace('NGN-', '').padStart(6, '0').slice(-6)}`
                      : rawId.startsWith('GC-')
                      ? `GC#${rawId.replace('GC-', '').padStart(6, '0').slice(-6)}`
                      : `ORD#${rawId.padStart(6, '0').slice(-6).toUpperCase()}`;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedOrderForModal(item)}
                        className="cursor-pointer hover:bg-[#1c233e] transition-colors group"
                      >
                        {/* 1. Date */}
                        <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                          {formattedDate}
                        </td>

                        {/* 2. Type */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                              isBuying
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {isBuying ? (
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                            <span>{isBuying ? 'Buying' : 'Selling'} ({methodLabel})</span>
                          </span>
                        </td>

                        {/* 3. Amount */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-white tracking-tight text-sm">
                            {displayAmount}
                          </span>
                        </td>

                        {/* 4. Title / Counterparty */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col leading-tight">
                            <span className="font-medium text-slate-200 truncate max-w-[200px]" title={counterparty}>
                              {counterparty}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                              Counterparty: {roleLabel}
                            </span>
                          </div>
                        </td>

                        {/* 5. Status & Actions */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isCancelled ? (
                            isBuying ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Cancelled (Refunded)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-700/30 text-slate-400 border border-slate-600/30">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Cancelled by Buyer</span>
                              </span>
                            )
                          ) : isCompleted ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Completed</span>
                            </span>
                          ) : isDisputed ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Disputed</span>
                            </span>
                          ) : isUnaccepted ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Clock className="w-3 h-3" />
                                <span>Waiting for Seller</span>
                              </span>
                              {isBuying && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmConfig({
                                      title: 'Cancel Escrow?',
                                      body: 'Cancel this escrow and return your locked funds to your wallet?',
                                      confirmLabel: 'Yes, Cancel Escrow',
                                      confirmClass: 'bg-red-600 hover:bg-red-500',
                                      onConfirm: () => handleCancel(item),
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all"
                                  title="Cancel Escrow"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Cancel</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock className="w-3 h-3" />
                              <span>{item.isShipped ? 'Shipped' : item.isAccepted ? 'In Progress' : 'In Escrow'}</span>
                            </span>
                          )}
                        </td>

                        {/* 6. Reference */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-violet-400 group-hover:text-violet-300 transition-colors">
                            <span>{cleanRef}</span>
                            <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {displayedOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 px-4 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-[#0b0e1b] border border-[#232a45] flex items-center justify-center text-slate-500">
                            <Search className="w-6 h-6 text-slate-500" />
                          </div>
                          <p className="text-sm font-semibold text-white">
                            {searchQuery.trim() !== ''
                              ? `No transactions found matching "${searchQuery}".`
                              : 'No transactions found'}
                          </p>
                          <p className="text-xs text-slate-400 max-w-xs">
                            {searchQuery.trim() !== ''
                              ? 'Try searching with another order ID, email, or wallet address.'
                              : 'Start a new escrow transaction to see your ledger here.'}
                          </p>
                          {searchQuery.trim() !== '' && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="mt-1 px-3 py-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg transition-all"
                            >
                              Clear search
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#232a45]">
                <div className="text-xs text-slate-400">
                  Showing <span className="font-semibold text-slate-200">{totalOrders === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-semibold text-slate-200">{Math.min(totalOrders, safeCurrentPage * pageSize)}</span> of{' '}
                  <span className="font-semibold text-slate-200">{totalOrders}</span> orders
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-[#0b0e1b] hover:bg-slate-800 border border-[#232a45] rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-xl text-xs font-semibold transition-all ${
                          page === safeCurrentPage
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800 bg-[#0b0e1b] border border-[#232a45]'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-[#0b0e1b] hover:bg-slate-800 border border-[#232a45] rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

      {/* ── Transaction Detail Modal (OrderDetailModal) ── */}
      {selectedOrderForModal && (
        <OrderDetailModal
          order={selectedOrderForModal}
          onClose={() => setSelectedOrderForModal(null)}
          onOpenChat={(ord) => {
            setSelectedOrderForModal(null);
            openChat(ord);
          }}
          onAccept={handleAccept}
          onMarkShipped={handleMarkShipped}
          onRelease={(ord) => {
            setSelectedOrderForModal(null);
            setConfirmConfig({
              title: 'Release Escrow Funds?',
              body: (
                <span>
                  Are you sure you want to release{' '}
                  <strong className="text-white">
                    {ord.type === 'FIAT'
                      ? `₦${ord.formattedLocked || ord.formattedTotal}`
                      : `${ord.formattedLocked || ord.formattedTotal} ${ord.token_symbol}`}
                  </strong>{' '}
                  to the seller? This action will finalize the transaction.
                </span>
              ),
              confirmLabel: 'Yes, Release Escrow',
              confirmClass: 'bg-violet-600 hover:bg-violet-500',
              onConfirm: () => handleRelease(ord),
            });
          }}
          onSplitRelease={(ord) => {
            setSelectedOrderForModal(null);
            setSplitReleaseOrder(ord);
          }}
          onCancel={(ord) => {
            setSelectedOrderForModal(null);
            setConfirmConfig({
              title: 'Cancel Escrow?',
              body: 'Cancel this escrow and return your locked funds to your wallet?',
              confirmLabel: 'Yes, Cancel Escrow',
              confirmClass: 'bg-red-600 hover:bg-red-500',
              onConfirm: () => handleCancel(ord),
            });
          }}
          onDispute={(ord) => {
            setSelectedOrderForModal(null);
            const rawId = String(ord.id);
            const cleanRef = rawId.startsWith('NGN-')
              ? `TXN#${rawId.replace('NGN-', '').padStart(6, '0').slice(-6)}`
              : rawId.startsWith('GC-')
              ? `GC#${rawId.replace('GC-', '').padStart(6, '0').slice(-6)}`
              : `ORD#${rawId.padStart(6, '0').slice(-6).toUpperCase()}`;
            setConfirmConfig({
              title: 'Raise Dispute?',
              body: (
                <span>
                  Escalate order <strong className="text-white">{cleanRef}</strong> to admin review. Funds will remain securely locked until admin resolution.
                </span>
              ),
              confirmLabel: 'Yes, Raise Dispute',
              confirmClass: 'bg-red-600 hover:bg-red-500',
              onConfirm: () => handleDispute(ord),
            });
          }}
          actionLoadingId={actionLoadingId}
          rates={rates}
          activeCurrencySymbol={activeCurrencySymbol}
          unreadCount={unreadMap[selectedOrderForModal.id] || unreadMap[parseDbOrderId(selectedOrderForModal.id)] || 0}
        />
      )}

      {/* ── Split Release Milestone Modal ── */}
      {splitReleaseOrder && (
        <SplitReleaseModal
          order={splitReleaseOrder}
          onClose={() => setSplitReleaseOrder(null)}
          onConfirm={handleSplitRelease}
          rates={rates}
          activeCurrencySymbol={activeCurrencySymbol}
        />
      )}

      {/* ── SecureChat Floating Widget Modal ── */}
      {activeChatOrder && (
        <SecureChat
          isOpen={!!activeChatOrder}
          onClose={() => setActiveChatOrder(null)}
          peerAddress={
            activeChatOrder.direction === 'BUYING'
              ? (activeChatOrder.seller || activeChatOrder.sellerEmail || '')
              : (activeChatOrder.buyer || activeChatOrder.buyerEmail || '')
          }
          orderId={parseDbOrderId(activeChatOrder.id)}
          context="escrow"
        />
      )}

      {/* ── Confirmation Modal ── */}
      {confirmConfig && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#161b30] border border-[#232a45] p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white text-center mb-2">{confirmConfig.title}</h3>
            <div className="text-slate-400 text-sm text-center mb-6 leading-relaxed">{confirmConfig.body}</div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const fn = confirmConfig.onConfirm;
                  setConfirmConfig(null);
                  fn();
                }}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all text-white ${confirmConfig.confirmClass ?? 'bg-red-600 hover:bg-red-500'}`}
              >
                {confirmConfig.confirmLabel}
              </button>
              <button
                type="button"
                onClick={() => setConfirmConfig(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-bold text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Escrow Modal ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-xl bg-[#161b30] border border-[#232a45] p-6 sm:p-8 rounded-3xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#232a45]">
              <div>
                <h2 className="text-xl font-bold text-white">Create New Escrow</h2>
                <p className="text-xs text-slate-400 mt-0.5">Secure funds in trust until conditions are met</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white bg-[#0b0e1b] hover:bg-slate-800 rounded-xl transition-colors border border-[#232a45]"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switch Tabs */}
            <div className="bg-[#0b0e1b] p-1 rounded-xl flex mb-6 border border-[#232a45] overflow-x-auto no-scrollbar" role="tablist">
              {(
                [
                  { key: 'crypto',   label: 'Crypto',        Icon: Bitcoin  },
                  { key: 'fiat',     label: 'Bank Transfer', Icon: Banknote },
                  { key: 'giftcard', label: 'Gift Card',     Icon: Gift     },
                ] as const
              ).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => setMode(key)}
                  className={`flex-1 min-w-max px-3 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    mode === key ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden /> {label}
                </button>
              ))}
            </div>

            {/* ── CRYPTO form ── */}
            {mode === 'crypto' && (
              <div className="space-y-4">
                <div className="relative">
                  <label className="text-xs text-slate-400 ml-1 font-bold">SELECT ASSET</label>
                  <button
                    type="button"
                    aria-label="Select token"
                    aria-expanded={isTokenListOpen}
                    onClick={() => setIsTokenListOpen((v) => !v)}
                    className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-3 mt-1 flex justify-between items-center hover:border-slate-600 transition-all text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full ${selectedAsset.icon} flex items-center justify-center text-[8px]`} aria-hidden>
                        {selectedAsset.symbol[0]}
                      </div>
                      <span className="font-semibold">{selectedAsset.symbol}</span>
                      <span className="text-xs text-slate-500">({selectedAsset.name})</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-500" aria-hidden />
                  </button>
                  {isTokenListOpen && (
                    <div className="absolute top-full w-full mt-2 bg-[#161b30] border border-[#232a45] rounded-xl z-20 overflow-hidden shadow-xl">
                      {ASSETS.map((a, index) => (
                        <div
                          key={a.symbol}
                          role="option"
                          aria-selected={selectedAssetIndex === index}
                          tabIndex={0}
                          onClick={() => { setSelectedAssetIndex(index); setIsTokenListOpen(false); }}
                          className="p-3 hover:bg-slate-800 cursor-pointer flex items-center gap-3 text-sm font-medium transition-colors"
                        >
                          <div className={`w-6 h-6 rounded-full ${a.icon} flex items-center justify-center text-[10px]`} aria-hidden>
                            {a.symbol[0]}
                          </div>
                          <span>{a.name} ({a.symbol})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="crypto-seller" className="text-xs text-slate-400 ml-1 font-bold">SELLER ADDRESS OR EMAIL</label>
                  <input
                    id="crypto-seller"
                    value={sellerAddress}
                    onChange={(e) => setSellerAddress(e.target.value)}
                    placeholder="0x… or seller@email.com"
                    autoComplete="off"
                    className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-3 mt-1 outline-none focus:border-violet-500 transition-all text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="crypto-amount" className="text-xs text-slate-400 ml-1 font-bold">AMOUNT</label>
                  <input
                    id="crypto-amount"
                    type="number"
                    min="0"
                    step="any"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-3 mt-1 outline-none focus:border-violet-500 transition-all text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCryptoTransaction}
                  disabled={isWriting || (!isUnsupportedNetwork && (!sellerAddress.trim() || !amountInput))}
                  className={`w-full py-3.5 rounded-xl font-bold mt-4 flex items-center justify-center gap-2 transition-all text-sm ${
                    isUnsupportedNetwork
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white shadow-lg shadow-violet-600/20'
                  }`}
                >
                  {isWriting ? <Loader2 className="animate-spin w-5 h-5" /> : isUnsupportedNetwork ? 'Network Unsupported' : 'Secure Cryptocurrency'}
                </button>
              </div>
            )}

            {/* ── FIAT form ── */}
            {mode === 'fiat' && (
              <div className="space-y-4">
                {!hasEmailLinked ? (
                  <div className="flex flex-col items-center justify-center p-6 bg-[#0b0e1b] border border-[#232a45] rounded-2xl text-center gap-4">
                    <div className="w-14 h-14 bg-blue-500/20 border border-blue-500/30 rounded-full flex items-center justify-center mb-1">
                      <Mail className="w-6 h-6 text-blue-400" aria-hidden />
                    </div>
                    <h3 className="text-base font-bold text-white">Email Verification Required</h3>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                      To use Bank Transfer escrows, you must link an email address to your account.
                    </p>
                    <button
                      type="button"
                      onClick={linkEmail}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl transition-all w-full flex items-center justify-center gap-2 text-xs shadow-lg shadow-blue-500/20"
                    >
                      Link Email Address <ArrowRight className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1 bg-[#0b0e1b] border border-[#232a45] rounded-xl px-3 py-3 flex items-center justify-center gap-2 cursor-not-allowed opacity-80">
                        <span className="text-sm font-bold">NGN</span>
                        <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center text-[8px] text-white">₦</div>
                      </div>
                      <div className="col-span-2">
                        <label htmlFor="fiat-amount" className="sr-only">Amount in NGN</label>
                        <input
                          id="fiat-amount"
                          type="number"
                          min="0"
                          step="any"
                          value={fiatAmount}
                          onChange={(e) => setFiatAmount(e.target.value)}
                          placeholder="Amount in NGN (e.g. 5000)"
                          className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-3 outline-none focus:border-violet-500 transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="opacity-70 cursor-not-allowed">
                      <label htmlFor="fiat-buyer-email" className="text-xs text-slate-400 ml-1 font-bold flex items-center gap-1.5">
                        YOUR EMAIL <Lock className="w-3 h-3 text-slate-500" aria-hidden />
                      </label>
                      <input
                        id="fiat-buyer-email"
                        readOnly
                        value={buyerEmail}
                        autoComplete="email"
                        className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-3 mt-1 outline-none text-slate-400 cursor-not-allowed text-sm"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label htmlFor="fiat-seller-email" className="text-xs text-violet-400 ml-1 font-bold">
                          SELLER&apos;S TRUSTLINK EMAIL
                        </label>
                        {isLookingUpSeller && (
                          <span className="text-[10px] text-violet-400 flex items-center gap-1 font-medium animate-in fade-in">
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> Finding seller payout details…
                          </span>
                        )}
                      </div>
                      <input
                        id="fiat-seller-email"
                        type="email"
                        autoComplete="email"
                        value={sellerEmail}
                        onChange={(e) => {
                          setSellerEmail(e.target.value);
                          setAutoFilled(false);
                        }}
                        onBlur={() => {
                          if (isValidEmail(sellerEmail.trim())) {
                            performSellerLookup(sellerEmail.trim());
                          }
                        }}
                        placeholder="seller@email.com"
                        className="w-full bg-[#0b0e1b] border border-violet-500/40 rounded-xl px-4 py-3 mt-1 outline-none focus:border-violet-500 transition-all text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 ml-1 font-bold">SELLER BANK DETAILS</label>
                      <div className="flex flex-col gap-2 mt-1">
                        <label htmlFor="fiat-bank" className="sr-only">Select Bank</label>
                        <select
                          id="fiat-bank"
                          value={selectedBankId}
                          onChange={(e) => {
                            const chosenId = e.target.value;
                            setSelectedBankId(chosenId);
                            setAutoFilled(false);
                            const bankObj = banks.find(
                              (b) => String(b.id || b.slug) === chosenId
                            );
                            setSelectedBank(bankObj || null);
                            if (bankObj) {
                              setBankCode(bankObj.code);
                            } else {
                              setBankCode('');
                            }
                            setResolveError('');
                          }}
                          className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-3 outline-none focus:border-violet-500 transition-all text-sm appearance-none"
                        >
                          <option value="">{isLoadingBanks ? 'Loading banks…' : 'Select Bank'}</option>
                          {banks.map((b, idx) => {
                            const optionValue = String(b.id || b.slug);
                            return (
                              <option key={`${b.code}-${b.id || idx}`} value={optionValue}>
                                {b.name}
                              </option>
                            );
                          })}
                        </select>
                        <div className="relative">
                          <label htmlFor="fiat-acct-no" className="sr-only">Account Number</label>
                          <input
                            id="fiat-acct-no"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={10}
                            autoComplete="off"
                            value={accountNumber}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setAccountNumber(val);
                              setAutoFilled(false);
                              if (val.length !== 10) {
                                setAccountName('');
                                setResolveError('');
                              }
                            }}
                            placeholder="Account Number (10 digits)"
                            className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-3 outline-none focus:border-violet-500 transition-all text-sm"
                          />
                          {isResolving && (
                            <div className="absolute right-4 top-3.5">
                              <Loader2 className="animate-spin w-4 h-4 text-violet-500" aria-label="Verifying account…" />
                            </div>
                          )}
                        </div>
                        <div aria-live="polite" className={`w-full bg-[#0b0e1b] border ${accountName ? 'border-emerald-500/30 bg-emerald-500/10' : resolveError ? 'border-red-500/30 bg-red-500/10' : 'border-[#232a45]'} rounded-xl px-4 py-3 transition-all flex items-center gap-2 min-h-[46px]`}>
                          {accountName ? (
                            <>
                              <div className="bg-emerald-500 rounded-full p-0.5"><CheckCircle2 className="w-3 h-3 text-white" aria-hidden /></div>
                              <span className="text-xs font-bold text-emerald-400 tracking-wide">{accountName}</span>
                            </>
                          ) : resolveError ? (
                            <>
                              <div className="bg-red-500 rounded-full p-0.5"><X className="w-3 h-3 text-white" aria-hidden /></div>
                              <span className="text-xs font-bold text-red-400 tracking-wide">{resolveError}</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500 italic flex items-center gap-2">
                              <UserCheck className="w-3.5 h-3.5" aria-hidden /> Account Name will appear here
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="fiat-description" className="text-xs text-slate-400 ml-1 font-bold">DESCRIPTION</label>
                      <textarea
                        id="fiat-description"
                        value={fiatDescription}
                        onChange={(e) => setFiatDescription(e.target.value)}
                        placeholder="What are you paying for?"
                        maxLength={500}
                        className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-3 mt-1 outline-none focus:border-violet-500 transition-all h-20 resize-none text-sm"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleFiatTransaction}
                      disabled={!fiatAmount || !accountName || !buyerEmail || !sellerEmail}
                      className="w-full bg-violet-600 hover:bg-violet-500 py-3.5 rounded-xl font-bold mt-2 disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-violet-600/20"
                    >
                      <span>Secure Bank Transfer</span>
                      <ArrowRight className="w-4 h-4" aria-hidden />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── GIFT CARD form ── */}
            {mode === 'giftcard' && (
              <div className="relative">
                <div className={`space-y-4 transition-all duration-300 ${isGiftCardLocked ? 'blur-md pointer-events-none opacity-40 select-none' : ''}`} aria-hidden={isGiftCardLocked}>
                  <div>
                    <label htmlFor="gc-seller" className="text-xs text-slate-400 ml-1 font-bold">SELLER ADDRESS OR EMAIL</label>
                    <input
                      id="gc-seller"
                      value={gcSellerAddress}
                      onChange={(e) => setGcSellerAddress(e.target.value)}
                      placeholder="0x… or seller@email.com"
                      className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-3 mt-1 outline-none focus:border-violet-500 transition-all text-sm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="gc-brand" className="text-xs text-slate-400 ml-1 font-bold">BRAND</label>
                      <select
                        id="gc-brand"
                        value={gcBrand}
                        onChange={(e) => setGcBrand(e.target.value)}
                        className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-3 mt-1 outline-none focus:border-violet-500 transition-all text-sm appearance-none"
                      >
                        <option value="">Select Brand</option>
                        <option value="Apple">Apple / iTunes</option>
                        <option value="Steam">Steam</option>
                        <option value="Amazon">Amazon</option>
                        <option value="Razer">Razer Gold</option>
                        <option value="Vanilla">Vanilla Visa</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="gc-amount" className="text-xs text-slate-400 ml-1 font-bold">CARD VALUE (USD)</label>
                      <input
                        id="gc-amount"
                        type="number"
                        min="0"
                        value={gcAmount}
                        onChange={(e) => setGcAmount(e.target.value)}
                        placeholder="e.g. 100"
                        className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-3 mt-1 outline-none focus:border-violet-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="gc-code" className="text-xs text-slate-400 ml-1 font-bold">GIFT CARD CODE (Encrypted upon save)</label>
                    <input
                      id="gc-code"
                      type="text"
                      value={gcCode}
                      onChange={(e) => setGcCode(e.target.value)}
                      placeholder="Enter the alphanumeric code"
                      className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-3 mt-1 outline-none focus:border-violet-500 transition-all font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="gc-image" className="text-xs text-slate-400 ml-1 font-bold">UPLOAD PHYSICAL CARD IMAGE</label>
                    <input
                      key={fileInputKey}
                      id="gc-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setGcImage(e.target.files?.[0] || null)}
                      className="w-full bg-[#0b0e1b] border border-[#232a45] rounded-xl px-4 py-2 mt-1 outline-none text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-violet-500/20 file:text-violet-400 hover:file:bg-violet-500/30 transition-all cursor-pointer"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleGiftCardTransaction}
                    disabled={isWriting || !gcSellerAddress.trim() || !gcAmount || !gcBrand || !gcCode || !gcImage}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white py-3.5 rounded-xl font-bold mt-2 flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 text-sm"
                  >
                    {isWriting ? <Loader2 className="animate-spin w-5 h-5" /> : 'Encrypt & Secure Gift Card'}
                  </button>
                </div>

                {isGiftCardLocked && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-6 bg-[#0b0e1b]/80 rounded-2xl backdrop-blur-sm">
                    {trustLevel === null ? (
                      <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-4" aria-label="Loading trust level" />
                    ) : (
                      <>
                        <div className="w-14 h-14 bg-[#161b30] rounded-full flex items-center justify-center mb-4 border border-[#232a45] shadow-xl">
                          <Lock className="w-7 h-7 text-slate-400" aria-hidden />
                        </div>
                        <h3 className="text-base font-bold text-white mb-1">Level 3 Required</h3>
                        <p className="text-xs text-slate-300 max-w-xs">
                          Gift Card trading is locked to prevent fraud. Complete more standard trades to reach Trust Level 3 and unlock this feature.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#060812] flex items-center justify-center"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>}>
      <MainDashboard />
    </Suspense>
  );
}
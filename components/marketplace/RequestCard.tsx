'use client';

import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { MessageSquare, Check, X, ShieldAlert, Coins, Loader2, ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface RequestCardProps {
  request: {
    id: number;
    buyer_wallet_address: string;
    seller_wallet_address: string;
    category: 'digital' | 'physical' | 'services';
    subcategory: string | null;
    description: string | null;
    proposed_amount: number;
    counter_amount: number | null;
    status: 'pending' | 'accepted' | 'countered' | 'rejected' | 'expired';
    converted_escrow_order_id: number | null;
    created_at: string;
    updated_at: string;
  };
  currentUserWallet: string;
  onActionSuccess: () => void;
  onOpenChat: (id: number) => void;
}

export default function RequestCard({
  request,
  currentUserWallet,
  onActionSuccess,
  onOpenChat,
}: RequestCardProps) {
  const { getAccessToken } = usePrivy();
  const [isCounterOpen, setIsCounterOpen] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null); // 'accept' | 'reject' | 'counter' | null

  const isSeller = request.seller_wallet_address.toLowerCase() === currentUserWallet.toLowerCase();
  const partnerShort = isSeller
    ? `${request.buyer_wallet_address.slice(0, 6)}…${request.buyer_wallet_address.slice(-4)}`
    : `${request.seller_wallet_address.slice(0, 6)}…${request.seller_wallet_address.slice(-4)}`;

  const currentPrice = request.counter_amount ?? request.proposed_amount;

  const handleAction = async (action: 'accept' | 'reject' | 'counter') => {
    setIsLoading(action);
    try {
      const token = await getAccessToken();
      const body: Record<string, any> = { action };
      if (action === 'counter') {
        const val = parseFloat(counterPrice);
        if (isNaN(val) || val <= 0) {
          toast.error('Please enter a valid counter amount');
          setIsLoading(null);
          return;
        }
        body.counter_amount = val;
      }

      const res = await fetch(`/api/marketplace/request/${request.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action} request`);
      }

      toast.success(
        action === 'accept'
          ? 'Request accepted! Escrow order created.'
          : action === 'reject'
            ? 'Request rejected'
            : 'Counter proposal sent'
      );
      setIsCounterOpen(false);
      onActionSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setIsLoading(null);
    }
  };

  const statusColors = {
    pending: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    countered: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    accepted: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rejected: 'text-red-400 bg-red-500/10 border-red-500/20',
    expired: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700/80 transition-all flex flex-col justify-between">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start gap-2">
          <div>
            <span className="text-[10px] text-slate-500 font-mono">REQ #{request.id}</span>
            <h4 className="text-sm font-bold text-white mt-0.5">
              {isSeller ? `Request from ${partnerShort}` : `Requested from ${partnerShort}`}
            </h4>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColors[request.status]}`}>
            {request.status}
          </span>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-850 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
            {request.category}
          </span>
          {request.subcategory && (
            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-500 text-[10px]">
              {request.subcategory}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-900/60">
          {request.description}
        </p>

        {/* Pricing Info */}
        <div className="flex justify-between items-center bg-slate-950/80 p-3 rounded-xl border border-slate-900">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {request.status === 'countered' ? 'Countered Price' : 'Proposed Price'}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-sm font-black text-white">${currentPrice.toFixed(2)}</span>
            {request.counter_amount !== null && request.status !== 'countered' && (
              <span className="text-[10px] text-slate-500 line-through">
                (${request.proposed_amount.toFixed(2)})
              </span>
            )}
          </div>
        </div>

        {/* Counter input field */}
        {isCounterOpen && (
          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">$</span>
              <input
                type="number"
                step="any"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
                placeholder="Enter counter amount"
                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsCounterOpen(false)}
                className="flex-1 py-1 rounded bg-slate-800 text-[10px] font-bold text-slate-400 hover:text-white"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('counter')}
                className="flex-1 py-1 rounded bg-orange-600 hover:bg-orange-500 text-[10px] font-bold text-slate-950 flex items-center justify-center gap-1"
                type="button"
                disabled={isLoading !== null}
              >
                {isLoading === 'counter' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  'Send Counter'
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-5 border-t border-slate-900 pt-4">
        {/* Chat always available */}
        <button
          onClick={() => onOpenChat(request.id)}
          className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all border border-slate-800 flex items-center justify-center gap-1.5"
          type="button"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Negotiate</span>
        </button>

        {/* Accepted escrow link */}
        {request.status === 'accepted' && request.converted_escrow_order_id && (
          <Link
            href={`/trade/${request.converted_escrow_order_id}`}
            className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Escrow Room</span>
          </Link>
        )}

        {/* Seller Specific Controls */}
        {isSeller && ['pending', 'countered'].includes(request.status) && !isCounterOpen && (
          <div className="flex gap-1.5 flex-1">
            <button
              onClick={() => handleAction('reject')}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all flex items-center justify-center"
              title="Reject"
              type="button"
              disabled={isLoading !== null}
            >
              <X className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsCounterOpen(true)}
              className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-orange-400 hover:text-orange-300 text-xs font-bold transition-all border border-slate-800 flex items-center justify-center gap-1"
              type="button"
              disabled={isLoading !== null}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Counter</span>
            </button>

            <button
              onClick={() => handleAction('accept')}
              className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1"
              type="button"
              disabled={isLoading !== null}
            >
              {isLoading === 'accept' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Accept</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface RequestFlowProps {
  vendorAddress: string;
  vendorName: string;
  vendorCategory: 'digital' | 'physical' | 'services' | null;
  vendorSubcategory: string | null;
  onClose: () => void;
  onSuccess: (requestId: number) => void;
}

export default function RequestFlow({
  vendorAddress,
  vendorName,
  vendorCategory,
  vendorSubcategory,
  onClose,
  onSuccess,
}: RequestFlowProps) {
  const { getAccessToken } = usePrivy();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Please describe what you need');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid proposed amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/marketplace/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          seller_wallet_address: vendorAddress,
          category: vendorCategory || 'digital',
          subcategory: vendorSubcategory || '',
          description: description.trim(),
          proposed_amount: numAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create request');
      }

      toast.success('Request sent successfully!');
      onSuccess(data.request_id);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-slate-950/20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-lg tracking-tight">
              New Request to {vendorName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-all"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Vendor Category Tags */}
          <div className="flex gap-2">
            {vendorCategory && (
              <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider">
                {vendorCategory}
              </span>
            )}
            {vendorSubcategory && (
              <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-850 text-slate-400 text-xs">
                {vendorSubcategory}
              </span>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Request Details / Terms
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g., I want to buy a $100 Steam Gift Card. Or: I need coding assistance for my Next.js page. Please specify what you want and how you want to transact."
              rows={4}
              maxLength={1000}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-xl text-sm text-slate-300 placeholder-slate-650 outline-none resize-none transition-all"
              required
            />
            <span className="text-[10px] text-slate-500 block text-right">
              {description.length}/1000 characters
            </span>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Proposed Price (USD / Fiat equivalent)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 font-bold text-sm">
                $
              </span>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
                className="w-full pl-9 pr-4 py-3.5 bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-xl text-sm text-slate-300 placeholder-slate-600 outline-none transition-all"
                required
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Enter the initial proposed amount. The vendor can accept, reject, or counter this amount.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-3">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white text-sm font-bold transition-all border border-slate-800"
              type="button"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

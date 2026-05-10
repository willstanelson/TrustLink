'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { Clock, ShieldAlert, CheckCircle2, Lock, Copy } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TradeRoom() {
  const params = useParams();
  const orderId = params.orderId as string;

  const { ready, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const queryClient = useQueryClient();

  const userWallet = wallets[0]?.address?.toLowerCase();

  // ✅ FIXED: All four missing state declarations added
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [decryptedCode, setDecryptedCode] = useState<string>('');
  const [giftCardInput, setGiftCardInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 1. Secure Initial Fetch
  const { data: order, isLoading } = useQuery({
    queryKey: ['escrow_order', orderId],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch('/api/escrow/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch order');
      }
      return res.json();
    },
    enabled: !!orderId && ready,
  });

  const isBuyer = userWallet === order?.buyer_wallet_address?.toLowerCase();
  const isSeller = userWallet === order?.seller_address?.toLowerCase();

  // 2. Realtime Subscription
  useEffect(() => {
    if (!orderId || (!isBuyer && !isSeller)) return;

    const channel = supabase
      .channel(`trade_${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'escrow_orders', filter: `id=eq.${orderId}` },
        (payload) => {
          queryClient.setQueryData(['escrow_order', orderId], payload.new);
          if (payload.new.status === 'code_revealed' && isBuyer) toast.success('Seller revealed the code!');
          if (payload.new.status === 'completed') toast.success('Trade Completed!');
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId, queryClient, isBuyer, isSeller]);

  // 3. Countdown Timer
  useEffect(() => {
    if (order?.status !== 'code_revealed' || !order.code_revealed_at) return;

    const interval = setInterval(() => {
      const revealedTime = new Date(order.code_revealed_at).getTime();
      const distance = (revealedTime + 2 * 60 * 60 * 1000) - Date.now();

      if (distance <= 0) {
        setTimeLeft('00:00:00 (Expired)');
        clearInterval(interval);
      } else {
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order?.status, order?.code_revealed_at]);

  // 4. Decryption Auto-Fetch
  useEffect(() => {
    async function fetchDecryptedCode() {
      if (order?.status === 'code_revealed' && isBuyer && !decryptedCode) {
        try {
          const token = await getAccessToken();
          const res = await fetch('/api/escrow/decrypt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ orderId }),
          });
          const data = await res.json();
          if (res.ok && data.code) setDecryptedCode(data.code);
        } catch (err) {
          toast.error("Failed to decrypt the gift card code.");
        }
      }
    }
    fetchDecryptedCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status, isBuyer, orderId, decryptedCode]);

  // 5. Handlers
  const handleRevealCode = async () => {
    if (!giftCardInput) return toast.error('Please enter the code');
    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/escrow/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId, plainTextCode: giftCardInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Code secured and revealed.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAction = async (endpoint: string) => {
    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/escrow/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Action successful.`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!ready || isLoading) return (
    <div className="p-10 flex justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );
  if (!order) return <div className="p-10 text-center text-gray-500">Order not found.</div>;

  const isExpired = timeLeft.includes('Expired');

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

      {/* LEFT COLUMN: THE STATE MACHINE */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-600" /> Trade Action Panel
          </h2>

          {order.status === 'locked' && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
              {isSeller ? (
                <div className="space-y-4">
                  <p className="text-indigo-900 font-medium">Buyer secured the crypto. Provide the Gift Card code.</p>
                  <input
                    type="text"
                    placeholder="e.g. AQB1-8273-XYZ9..."
                    className="w-full px-4 py-3 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-600 outline-none bg-white"
                    value={giftCardInput}
                    onChange={(e) => setGiftCardInput(e.target.value)}
                  />
                  <button
                    onClick={handleRevealCode}
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Securing...' : 'Reveal Code'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                  <p className="text-indigo-900 font-medium">Waiting for seller to reveal code...</p>
                </div>
              )}
            </div>
          )}

          {order.status === 'code_revealed' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 flex flex-col items-center justify-center">
                <Clock className="w-8 h-8 text-orange-500 mb-2" />
                <p className="text-sm text-orange-800 font-semibold uppercase tracking-wider">Time Remaining</p>
                <p className="text-3xl font-mono font-bold text-orange-600 mt-1">{timeLeft || '--:--:--'}</p>
              </div>

              {isBuyer && (
                <div className="space-y-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Decrypted Code</p>
                      <p className="font-mono text-lg text-gray-900 bg-white px-3 py-1 rounded border border-gray-200 shadow-inner">
                        {decryptedCode || 'Decrypting...'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (decryptedCode) {
                          navigator.clipboard.writeText(decryptedCode);
                          toast.success('Code copied!');
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-indigo-600 transition"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleAction('buyer-release')}
                      disabled={isSubmitting}
                      className="bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                    >
                      Code Works (Release)
                    </button>
                    <button
                      onClick={() => handleAction('dispute')}
                      disabled={isSubmitting}
                      className="bg-red-50 text-red-600 border border-red-200 py-3 rounded-lg font-semibold hover:bg-red-100 transition disabled:opacity-50"
                    >
                      Dispute Trade
                    </button>
                  </div>
                </div>
              )}

              {isSeller && (
                <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200 space-y-4">
                  <p className="text-gray-600">Waiting for buyer to redeem and release funds.</p>
                  <button
                    onClick={() => handleAction('force-release')}
                    disabled={!isExpired || isSubmitting}
                    className={`w-full py-3 rounded-lg font-semibold transition ${isExpired ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    Force Release Escrow
                  </button>
                  {!isExpired && <p className="text-xs text-gray-400">Available when timer expires</p>}
                </div>
              )}
            </div>
          )}

          {['completed', 'resolved'].includes(order.status) && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-900">Trade Completed</h3>
            </div>
          )}

          {order.status === 'disputed' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
              <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-red-900">Trade Disputed</h3>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: DETAILS & CHAT */}
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4">Trade Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Order ID</span>
              <span className="font-mono text-gray-900">{order.id.split('-')[0]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold text-gray-900">{order.crypto_amount} {order.token_symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fiat Value</span>
              <span className="text-gray-900">₦{Number(order.fiat_amount).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl flex flex-col h-[400px] shadow-sm overflow-hidden">
          <div className="bg-white border-b border-gray-200 p-4">
            <h3 className="font-bold text-gray-900">Encrypted Chat</h3>
          </div>
          <div className="flex-1 p-4 flex items-center justify-center text-center">
            <p className="text-gray-400 text-sm max-w-[200px]">XMTP Chat Component injected here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
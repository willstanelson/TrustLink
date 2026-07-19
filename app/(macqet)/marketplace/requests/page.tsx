'use client';

import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/context/AuthContext';
import { Store, ArrowLeft, Loader2, Sparkles, MessageSquare, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import RequestCard from '@/components/marketplace/RequestCard';
import SecureChat from '@/components/SecureChat';
import toast from 'react-hot-toast';

export default function RequestsBoardPage() {
  const { getAccessToken } = usePrivy();
  const { sessionReady, walletAddress } = useAuth();

  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');

  // Chat Widget State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatRequestId, setChatRequestId] = useState<number | undefined>(undefined);
  const [chatPeerAddress, setChatPeerAddress] = useState<string>('');

  const fetchRequests = async () => {
    if (!sessionReady) return;
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/marketplace/request', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setRequests(data.requests || []);
      } else {
        throw new Error(data.error || 'Failed to load requests');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [sessionReady]);

  const handleOpenChat = (requestId: number) => {
    const req = requests.find((r) => r.id === requestId);
    if (!req || !walletAddress) return;

    const peer =
      req.buyer_wallet_address.toLowerCase() === walletAddress.toLowerCase()
        ? req.seller_wallet_address
        : req.buyer_wallet_address;

    setChatRequestId(requestId);
    setChatPeerAddress(peer);
    setChatOpen(true);
  };

  // Filter requests based on tab selection
  const filteredRequests = requests.filter((r) => {
    if (!walletAddress) return false;
    const isSent = r.buyer_wallet_address.toLowerCase() === walletAddress.toLowerCase();
    return activeTab === 'sent' ? isSent : !isSent;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white font-sans pb-24">
      {/* Header */}
      <div className="border-b border-slate-900 bg-slate-950/40 py-8 px-6 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link href="/marketplace" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-emerald-400 text-xs font-bold transition-all mb-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Marketplace</span>
            </Link>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-400" />
              <span>Proposals & Negotiations Board</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Negotiate terms, adjust proposed prices, and accept requests to open the Escrow room.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 space-y-6">
        
        {/* Tab switchers */}
        <div className="flex border-b border-slate-900 gap-6">
          <button
            onClick={() => setActiveTab('sent')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 ${
              activeTab === 'sent'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            My Proposals Sent ({requests.filter(r => r.buyer_wallet_address.toLowerCase() === walletAddress?.toLowerCase()).length})
          </button>
          <button
            onClick={() => setActiveTab('received')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 ${
              activeTab === 'received'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Proposals Received ({requests.filter(r => r.seller_wallet_address.toLowerCase() === walletAddress?.toLowerCase()).length})
          </button>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : filteredRequests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredRequests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                currentUserWallet={walletAddress || ''}
                onActionSuccess={fetchRequests}
                onOpenChat={handleOpenChat}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 bg-[#111827]/40 border border-slate-900 rounded-3xl p-6">
            <AlertCircle className="w-10 h-10 text-slate-655" />
            <div>
              <h4 className="font-bold text-white text-sm">No Proposals Found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {activeTab === 'sent'
                  ? 'Initiate a request to a vendor from their profile page to get started.'
                  : 'Proposals sent to your business by prospective buyers will display here.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Embedded SecureChat pointing to the active requestId */}
      {chatOpen && chatRequestId !== undefined && (
        <SecureChat
          peerAddress={chatPeerAddress}
          requestId={chatRequestId}
          context="marketplace_request"
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}

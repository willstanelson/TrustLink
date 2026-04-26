'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/context/AuthContext';

export default function ProfilePage() {
  const { user, getAccessToken } = usePrivy();
  // 🚀 FIX 1: Tapping into our custom securely authenticated client
  const { supabase, walletAddress, sessionReady } = useAuth();
  
  const [stats, setStats] = useState({ completed: 0, disputed: 0 });
  
  // Bank Details State
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 🚀 FIX 2 & 3: Gated fetch with safe .ilike string interpolation
  const fetchProfileData = useCallback(async () => {
    if (!walletAddress || !sessionReady) return;

    // Fetch Stats from Escrow Orders safely ignoring checksum casing
    const { data: orders } = await supabase
      .from('escrow_orders')
      .select('status')
      .or(`seller_address.ilike.${walletAddress},buyer_wallet_address.ilike.${walletAddress}`);

    if (orders) {
      const completed = orders.filter(o => o.status === 'completed').length;
      const disputed = orders.filter(o => o.status === 'disputed').length;
      setStats({ completed, disputed });
    }

    // Fetch existing Bank Details
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .ilike('wallet_address', walletAddress)
      .single();

    if (profile) {
      setBankName(profile.bank_name || '');
      setAccountNumber(profile.account_number || '');
      setAccountName(profile.account_name || '');
    }
  }, [walletAddress, sessionReady, supabase]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication required");

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bankName, accountNumber, accountName })
      });

      const data = await res.json();
      if (data.success) {
        setMessage('Bank details saved successfully!');
      } else {
        setMessage(data.error || 'Failed to save details');
      }
    } catch (err) {
      console.error(err);
      setMessage('An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return <div className="p-8 text-white">Loading profile...</div>;

  const email = user.email?.address || 'No email linked';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 text-slate-200">
      <h1 className="text-3xl font-bold text-white">Profile Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* IDENTITY CARD */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-emerald-400 mb-4">Identity</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Email Address</p>
              <p className="font-mono text-sm mt-1">{email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Connected Wallet</p>
              <p className="font-mono text-sm mt-1">{walletAddress || 'Not connected'}</p>
            </div>
          </div>
        </div>

        {/* REPUTATION STATS */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-emerald-400 mb-4">Reputation</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
              <p className="text-xs text-slate-400 uppercase">Completed Trades</p>
              <p className="text-2xl font-black text-white mt-2">{stats.completed}</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
              <p className="text-xs text-slate-400 uppercase">Disputes</p>
              <p className="text-2xl font-black text-red-400 mt-2">{stats.disputed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* FIAT PAYOUT DETAILS (NGN) */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-emerald-400 mb-2">Fiat Payout Details</h2>
        <p className="text-sm text-slate-400 mb-6">Enter your bank details to receive NGN withdrawals from fiat escrow.</p>
        
        <form onSubmit={handleSaveBankDetails} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs text-slate-400 uppercase mb-1">Bank Name</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Guarantee Trust Bank"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 uppercase mb-1">Account Number</label>
            <input 
              type="text" 
              required
              placeholder="0123456789"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 uppercase mb-1">Account Name</label>
            <input 
              type="text" 
              required
              placeholder="John Doe"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm font-bold ${message.includes('success') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {message}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Bank Details'}
          </button>
        </form>
      </div>
    </div>
  );
}
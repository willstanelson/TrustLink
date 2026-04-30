'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, getAccessToken } = usePrivy();
  const { supabase, walletAddress, sessionReady } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ completed: 0, disputed: 0 });
  
  // Bank Details State
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  //  Dynamic Banks State
  const [banks, setBanks] = useState<{code: string, name: string}[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);

  // Fetch Banks from Paystack
  useEffect(() => {
    const loadBanks = async () => {
      try {
        const res = await fetch('https://api.paystack.co/bank?country=nigeria');
        const json = await res.json();
        if (json.status) {
          // Sort alphabetically for better UX
          const sorted = json.data.sort((a: any, b: any) => a.name.localeCompare(b.name));
          setBanks(sorted);
        }
      } catch (err) {
        console.error("Error fetching banks:", err);
      } finally {
        setIsLoadingBanks(false);
      }
    };
    loadBanks();
  }, []);

  const fetchProfileData = useCallback(async () => {
    if (!walletAddress || !sessionReady) return;
    
    setIsLoading(true);
    try {
      const { data: orders } = await supabase
        .from('escrow_orders')
        .select('status')
        .or(`seller_address.ilike.${walletAddress},buyer_wallet_address.ilike.${walletAddress}`);

      if (orders) {
        const completed = orders.filter(o => o.status === 'completed').length;
        const disputed = orders.filter(o => o.status === 'disputed').length;
        setStats({ completed, disputed });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .ilike('wallet_address', walletAddress)
        .single();

      if (profile) {
        setBankName(profile.bank_name || '');
        setBankCode(profile.bank_code || ''); // 🚀 Now pulling the vital bank_code
        setAccountNumber(profile.account_number || '');
        setAccountName(profile.account_name || '');
      }
    } finally {
      setIsLoading(false);
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
        body: JSON.stringify({ bankName, bankCode, accountNumber, accountName }) // 🚀 Sending bankCode to backend
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

  // 🚀 Loading State UI
  if (isLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
    </div>
  );

  if (!user) return <div className="p-8 text-white">Loading identity...</div>;

  const email = user.email?.address || 'No email linked';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] pt-12 pb-12 px-4 sm:px-6 text-white font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* ... rest of your code ... */}
        
        {/* 🚀 Back Navigation */}
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 text-sm font-bold transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Profile Settings</h1>
            <p className="text-sm text-slate-400 mt-1">Manage your identity and fiat withdrawal details.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* IDENTITY CARD */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500 opacity-50"></div>
            <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              Identity
            </h2>
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Email Address</p>
                <p className="font-mono text-sm text-slate-300 bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">{email}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Connected Wallet</p>
                <p className="font-mono text-xs text-slate-300 bg-slate-900/50 p-3 rounded-xl border border-slate-800/50 truncate" title={walletAddress || ''}>
                  {walletAddress || 'Not connected'}
                </p>
              </div>
            </div>
          </div>

          {/* REPUTATION STATS */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-50"></div>
            <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Reputation
            </h2>
            <div className="grid grid-cols-2 gap-4 h-[calc(100%-44px)]">
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50 flex flex-col justify-center items-center text-center">
                <p className="text-3xl font-black text-white">{stats.completed}</p>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-1">Completed</p>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50 flex flex-col justify-center items-center text-center">
                <p className="text-3xl font-black text-white">{stats.disputed}</p>
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mt-1">Disputes</p>
              </div>
            </div>
          </div>
        </div>

        {/* FIAT PAYOUT DETAILS (NGN) */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden mt-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-blue-500 opacity-50"></div>
          
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
              Fiat Payout Details
            </h2>
            <p className="text-xs text-slate-400 mt-1">Your verified NGN bank details for fiat escrow withdrawals.</p>
          </div>
          
          <form onSubmit={handleSaveBankDetails} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Bank Name</label>
                {/* 🚀 Updated Select Input using dynamic banks */}
                <select
                  required
                  value={bankCode}
                  onChange={(e) => {
                    setBankCode(e.target.value);
                    setBankName(banks.find(b => b.code === e.target.value)?.name || '');
                  }}
                  className="w-full bg-slate-900/80 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3.5 text-sm text-white transition-all outline-none appearance-none"
                >
                  <option value="" disabled className="text-slate-500">
                    {isLoadingBanks ? "Loading banks..." : "Select your bank..."}
                  </option>
                  {banks.map(b => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Account Number</label>
                <input 
                  type="text" 
                  required
                  placeholder="0123456789"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-600 transition-all outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Account Name</label>
              <input 
                type="text" 
                required
                placeholder="John Doe"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-600 transition-all outline-none"
              />
            </div>

            {message && (
              <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${message.includes('success') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {message.includes('success') ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                )}
                {message}
              </div>
            )}

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={isSaving}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.99] shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                {isSaving ? 'Saving Details...' : 'Save Bank Details'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ReputationCard from '@/components/ReputationCard';

export default function ProfilePage() {
  const { user, getAccessToken } = usePrivy();
  const { supabase, walletAddress, sessionReady } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ completed: 0, disputed: 0 });
  const [profileData, setProfileData] = useState<any>(null); 
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [banks, setBanks] = useState<{code: string, name: string}[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);

  // Fetch Banks from API
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const res = await fetch('/api/banks'); 
        const json = await res.json();
        if (json && json.data) setBanks(json.data); 
      } catch (error) {
        console.error("Error loading banks:", error);
      } finally {
        setIsLoadingBanks(false);
      }
    };
    fetchBanks();
  }, []);

  // Securely Fetch Profile Data + Escrow Stats
  const fetchProfileData = useCallback(async () => {
    if (!walletAddress || !sessionReady) return;
    
    setIsLoading(true);
    try {
      // 1. Fetch Escrow Stats (Public/Accessible via anon key if RLS allows)
      const { data: orders } = await supabase
        .from('escrow_orders')
        .select('status')
        .or(`seller_address.ilike.${walletAddress},buyer_wallet_address.ilike.${walletAddress}`);

      if (orders) {
        const completed = orders.filter(o => o.status === 'completed').length;
        const disputed = orders.filter(o => o.status === 'disputed').length;
        setStats({ completed, disputed });
      }

      // 2. Secure Profile Fetch via Next.js Backend
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok && data.profile) {
        setProfileData(data.profile);
        setBankName(data.profile.bank_name || '');
        setBankCode(data.profile.bank_code || ''); 
        setAccountNumber(data.profile.account_number || '');
        setAccountName(data.profile.account_name || '');
        setRecoveryAttempted(false); // Reset breaker on success
      } 
      else if (res.status === 404 && data.code === 'PGRST116') {
        // 🛡️ SELF-HEALING PROTOCOL
        if (recoveryAttempted) {
          console.error("Recovery failed. Please contact support.");
          setProfileData(null); 
          return;
        }

        console.log("Missing profile detected. Executing background sync...");
        setRecoveryAttempted(true);
        
        // Ping the sync API to heal the database
        await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        // 🚀 Inline re-fetch to avoid stale React closures
        const retryRes = await fetch('/api/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const retryData = await retryRes.json();

        if (retryRes.ok && retryData.profile) {
          setProfileData(retryData.profile);
          setBankName(retryData.profile.bank_name || '');
          setBankCode(retryData.profile.bank_code || ''); 
          setAccountNumber(retryData.profile.account_number || '');
          setAccountName(retryData.profile.account_name || '');
        } else {
          setProfileData(null); // Force error UI if the retry still failed
        }
      }
    } catch (err) {
      console.error("Failed to load profile data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, sessionReady, supabase, getAccessToken, recoveryAttempted]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  // Securely Save Bank Details
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
        body: JSON.stringify({ bankName, bankCode, accountNumber, accountName })
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

  if (isLoading && !recoveryAttempted) return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
    </div>
  );

  if (!user) return <div className="p-8 text-white">Loading identity...</div>;

  // Safely extract the email from any connected OAuth provider
  const email = 
    user.email?.address || 
    user.google?.email || 
    user.discord?.email || 
    user.apple?.email || 
    user.twitter?.email || 
    'No email linked';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] pt-12 pb-12 px-4 sm:px-6 text-white font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 text-sm font-bold transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

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

          {/* REPUTATION CARD */}
          {profileData ? (
            <ReputationCard profile={profileData} />
          ) : (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center text-center gap-3">
              {recoveryAttempted ? (
                <>
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-full">⚠️</div>
                  <p className="text-amber-400 text-sm font-bold">Profile Data Missing</p>
                  <p className="text-slate-500 text-xs">We attempted recovery but could not sync your data. Please contact support.</p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                  <p className="text-slate-500 text-sm">Loading reputation data...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FIAT PAYOUT DETAILS */}
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
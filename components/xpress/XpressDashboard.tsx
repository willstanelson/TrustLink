'use client';
import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, ArrowRight, Search, RefreshCcw, ChevronDown } from 'lucide-react';
// import OrderCard from '@/components/OrderCard'; // Make sure your OrderCard is imported

export default function XpressDashboard() {
  const [tradeMode, setTradeMode] = useState<'crypto' | 'fiat' | 'giftcard'>('crypto');
  const [searchQuery, setSearchQuery] = useState('');
  const [networkFilter, setNetworkFilter] = useState('all');
  
  // Dummy profile data
  const userProfile = {
    name: "William",
    trustScore: 60,
    joined: "October 2023",
    wallet: "0x992...7A33",
    emailVerified: false,
    phoneVerified: false,
    kycLevel1: true
  };

  const handleRefresh = () => {
    console.log("Refreshing orders...");
    // Add your refetch logic here
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

      {/* Profile & KYC Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1e1f26] border border-[#333333] rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 font-bold text-2xl">
              {userProfile.name[0]}
            </div>
            <div>
              <h2 className="text-white font-bold text-xl">{userProfile.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-emerald-400 text-sm font-medium">Trust Score: {userProfile.trustScore}</span>
                <span className="text-[#555555] text-sm">• Joined {userProfile.joined}</span>
              </div>
            </div>
          </div>
          <div className="text-sm space-y-1 text-[#aaaaaa]">
            <p>Wallet: <span className="text-white font-mono">{userProfile.wallet}</span></p>
            <p>Email: {userProfile.emailVerified ? <span className="text-emerald-400">Verified</span> : <span className="text-red-400">Unverified</span>}</p>
            <p>Phone: {userProfile.phoneVerified ? <span className="text-emerald-400">Verified</span> : <span className="text-red-400">Unverified</span>}</p>
          </div>
        </div>

        <div className="bg-[#1e1f26] border border-[#333333] rounded-xl p-6 flex flex-col justify-center items-center text-center">
          {userProfile.kycLevel1 ? (
            <>
              <ShieldCheck className="w-10 h-10 text-emerald-500 mb-3" />
              <h3 className="text-white font-bold">Tier 1 KYC Verified</h3>
              <p className="text-[#aaaaaa] text-xs mt-1 mb-4">You are cleared for P2P Escrow.</p>
              <button className="text-emerald-400 hover:text-emerald-300 text-sm font-bold flex items-center gap-1 transition-colors">
                Upgrade to Tier 2 <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
              <h3 className="text-white font-bold">Complete KYC</h3>
              <p className="text-[#aaaaaa] text-xs mt-1 mb-3">Required to create escrows.</p>
              <button className="bg-emerald-500 text-[#0b0f19] px-4 py-1.5 rounded-lg text-sm font-bold w-full">Verify Identity</button>
            </>
          )}
        </div>
      </div>

      {/* Trade Mode Toggle */}
      <div className="mt-8 bg-[#0b0f19] border border-[#333333] rounded-xl overflow-hidden">
        <div className="flex border-b border-[#333333] bg-[#1e1f26]">
          {['crypto', 'fiat', 'giftcard'].map((mode) => (
            <button
              key={mode}
              onClick={() => setTradeMode(mode as any)}
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                tradeMode === mode ? 'text-emerald-400 border-b-2 border-emerald-500 bg-[#0b0f19]' : 'text-[#aaaaaa] hover:text-[#eeeeee]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="p-6 md:p-8">
          {/* THE RESTORED RICH UTILITY BAR */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aaaaaa]" />
              <input 
                type="search"
                placeholder="Search orders by ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0b0f19] border border-[#333333] text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-[#555555]"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-auto min-w-[160px]">
                <select 
                  value={networkFilter}
                  onChange={(e) => setNetworkFilter(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-[#333333] text-white text-sm rounded-lg pl-4 pr-10 py-2.5 focus:border-emerald-500 focus:outline-none appearance-none cursor-pointer"
                  disabled={tradeMode !== 'crypto'}
                >
                  <option value="all">All Networks</option>
                  <option value="bsc">Binance Smart Chain</option>
                  <option value="ethereum">Ethereum</option>
                  <option value="polygon">Polygon</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aaaaaa] pointer-events-none" />
              </div>
              <button 
                onClick={handleRefresh}
                className="p-2.5 bg-[#1e1f26] border border-[#333333] rounded-lg text-[#aaaaaa] hover:text-white hover:border-[#555555] transition-colors"
                aria-label="Refresh orders"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ORDER LIST HEADER */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              Showing {tradeMode === 'crypto' ? 'Cryptocurrency' : tradeMode === 'fiat' ? 'Bank Transfer' : 'Gift Card'} Orders
            </span>
          </div>

          {/* ACTIVE ORDERS AREA */}
          <div className="space-y-4">
            {/* Map your OrderCards here just like in page(23).tsx */}
            
            <div className="text-[#aaaaaa] text-center py-16 italic border border-dashed border-[#333333] rounded-xl flex flex-col items-center justify-center bg-[#0b0f19]/50">
              <Search className="w-8 h-8 text-[#444444] mb-3" />
              No active <span className="capitalize mx-1 font-medium">{tradeMode === 'crypto' ? 'Cryptocurrency' : tradeMode === 'fiat' ? 'Bank Transfer' : 'Gift Card'}</span> orders found.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
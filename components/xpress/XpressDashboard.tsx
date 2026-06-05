'use client';
import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, ArrowRight } from 'lucide-react';

export default function XpressDashboard() {
  const [tradeMode, setTradeMode] = useState<'crypto' | 'fiat' | 'giftcard'>('crypto');
  
  // Dummy data representing the UI logic
  const userProfile = {
    name: "William",
    trustScore: 60,
    joined: "October 2023",
    wallet: "0x992...7A33",
    emailVerified: false,
    phoneVerified: false,
    kycLevel1: true
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

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

      <div className="mt-8 bg-[#0b0f19] border border-[#333333] rounded-xl overflow-hidden">
        <div className="flex border-b border-[#333333] bg-[#1e1f26]">
          {['crypto', 'fiat', 'giftcard'].map((mode) => (
            <button
              key={mode}
              onClick={() => setTradeMode(mode as any)}
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                tradeMode === mode ? 'text-emerald-400 border-b-2 border-emerald-500 bg-[#0b0f19]' : 'text-[#aaaaaa] hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="p-8 text-center text-[#aaaaaa]">
          <p>Your {tradeMode.toUpperCase()} escrow creation form goes here.</p>
        </div>
      </div>
    </div>
  );
}
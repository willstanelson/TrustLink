'use client';

import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import VendorOnboarding from '@/components/marketplace/VendorOnboarding';
import toast from 'react-hot-toast';

export default function OnboardVendorPage() {
  const { sessionReady, walletAddress } = useAuth();
  const { getAccessToken } = usePrivy();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function checkVendorStatus() {
      if (!walletAddress || !sessionReady) return;
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && res.ok) {
          if (data.profile?.is_vendor) {
            toast.error('You are already registered as a vendor.');
            router.replace('/marketplace');
          }
        }
      } catch (err) {
        console.error('Error checking vendor status:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    checkVendorStatus();
    return () => { cancelled = true; };
  }, [walletAddress, sessionReady, getAccessToken, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white font-sans pb-24">
      {/* Navigation Header */}
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-8">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 text-xs font-bold transition-all mb-6">
          <ArrowLeft className="w-4.5 h-4.5" />
          <span>Back to Marketplace</span>
        </Link>
      </div>

      <div className="px-4 sm:px-6">
        <VendorOnboarding onSuccess={() => router.replace('/marketplace')} />
      </div>
    </div>
  );
}

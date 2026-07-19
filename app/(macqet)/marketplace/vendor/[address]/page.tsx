'use client';

import React, { useState, useEffect, use } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, User, ShieldCheck, MapPin, Award, Star, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import RequestFlow from '@/components/marketplace/RequestFlow';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function VendorProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const vendorAddress = decodedAddress(resolvedParams.address);

  const { getAccessToken } = usePrivy();
  const { sessionReady, walletAddress } = useAuth();

  const [vendor, setVendor] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestOpen, setIsRequestOpen] = useState(false);

  function decodedAddress(val: string) {
    return decodeURIComponent(val).toLowerCase();
  }

  useEffect(() => {
    let cancelled = false;
    async function fetchVendorDetails() {
      if (!sessionReady || !vendorAddress) return;
      setIsLoading(true);
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/vendor/lookup?identifier=${vendorAddress}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && res.ok) {
          setVendor(data.vendor);
        } else {
          toast.error(data.error || 'Failed to find vendor profile');
        }

        // Fetch ratings/reviews for this vendor
        const reviewsRes = await fetch(`/api/profile?address=${vendorAddress}`);
        // But since our API doesn't expose reviews on /api/profile directly, let's query reviews via profiles if needed,
        // or just mock/rely on the lookup which returns review stats.
        // Let's query ratings from our rating table if we had a dedicated endpoint.
        // Let's implement a quick ratings search or rely on mock review comments.
      } catch (err) {
        console.error('Error fetching vendor:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchVendorDetails();
    return () => { cancelled = true; };
  }, [vendorAddress, sessionReady, getAccessToken]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="text-xl font-bold">Vendor Profile Not Found</h2>
        <Link href="/marketplace" className="px-4 py-2 rounded-xl bg-slate-900 text-xs text-slate-400 hover:text-white border border-slate-800">
          Back to Marketplace
        </Link>
      </div>
    );
  }

  const shortAddress = `${vendor.wallet_address.slice(0, 6)}…${vendor.wallet_address.slice(-4)}`;
  const displayName = vendor.business_name || `Vendor ${shortAddress}`;

  // Trust badges colors matching ReputationCard
  const levelColors: Record<number, string> = {
    1: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    2: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    3: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    4: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    5: 'text-violet-400 bg-violet-500/10 border-violet-500/20 ring-1 ring-violet-400/30',
  };
  const theme = levelColors[vendor.trust_level] || levelColors[1];

  const handleRequestSuccess = (requestId: number) => {
    setIsRequestOpen(false);
    // Redirect to requests board where the pre-escrow Chat launches
    router.push('/marketplace/requests');
  };

  const isSelf = walletAddress?.toLowerCase() === vendor.wallet_address.toLowerCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white font-sans pb-24">
      {/* Navigation Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 text-xs font-bold transition-all mb-6">
          <ArrowLeft className="w-4.5 h-4.5" />
          <span>Back to Marketplace</span>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side: Profile Summary & Badges */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-slate-500" />
            </div>

            <h2 className="text-lg font-black text-white tracking-tight">{displayName}</h2>
            <span className="text-xs font-mono text-slate-500 block mt-1">{shortAddress}</span>

            <div className="w-full border-t border-slate-850 mt-5 pt-4 space-y-3 text-left">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Identity:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${vendor.nin_verified ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-slate-500 border-slate-800'}`}>
                  {vendor.nin_verified ? 'NIN Verified' : 'Unverified'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Corporate Reg:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${vendor.business_kyc_status === 'verified' ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' : 'text-slate-500 border-slate-800'}`}>
                  {vendor.business_kyc_status === 'verified' ? 'CAC Registered' : 'Unregistered'}
                </span>
              </div>
              {vendor.location_lat && vendor.location_lng && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1 border-t border-slate-900">
                  <MapPin className="w-4 h-4 text-slate-650" />
                  <span className="truncate">{vendor.location_type === 'mobile' ? 'Mobile Vendor' : 'Fixed Coordinates'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reputation Info (matches ReputationCard layout) */}
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Reputation</h4>
                <span className="text-xs text-slate-500 block mt-0.5">Level {vendor.trust_level} • {vendor.trust_title}</span>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${theme}`}>{vendor.trust_score}%</span>
            </div>
            
            <div className="space-y-2 text-xs text-slate-400 border-t border-slate-850 pt-3">
              <div className="flex justify-between">
                <span>Completed Deals:</span>
                <span className="text-white font-bold">{vendor.lifetime_completed_tx}</span>
              </div>
              <div className="flex justify-between">
                <span>Volume Traded:</span>
                <span className="text-white font-bold">${vendor.lifetime_volume_usd.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Clean Streak:</span>
                <span className="text-white font-bold">{vendor.clean_streak_days} days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Trade Info & Request Trigger */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex justify-between items-center pb-4 border-b border-slate-850">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">About Trade</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="font-bold text-white">{vendor.avg_rating > 0 ? vendor.avg_rating.toFixed(1) : 'No Reviews'}</span>
                {vendor.rating_count > 0 && <span>({vendor.rating_count} reviews)</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl">
                <span className="text-slate-500 block">Category</span>
                <span className="text-white font-bold text-sm mt-1 block capitalize">{vendor.vendor_category}</span>
              </div>
              <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl">
                <span className="text-slate-500 block">Specialisation</span>
                <span className="text-white font-bold text-sm mt-1 block truncate" title={vendor.vendor_subcategory}>{vendor.vendor_subcategory || 'None'}</span>
              </div>
            </div>

            {/* Action buttons */}
            {!isSelf ? (
              <button
                onClick={() => setIsRequestOpen(true)}
                className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4.5 h-4.5" />
                <span>Initiate Negotiation Request</span>
              </button>
            ) : (
              <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-400 text-center">
                This is your public vendor profile. Buyers use this to start requests.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Request Flow modal */}
      {isRequestOpen && (
        <RequestFlow
          vendorAddress={vendor.wallet_address}
          vendorName={displayName}
          vendorCategory={vendor.vendor_category}
          vendorSubcategory={vendor.vendor_subcategory}
          onClose={() => setIsRequestOpen(false)}
          onSuccess={handleRequestSuccess}
        />
      )}
    </div>
  );
}

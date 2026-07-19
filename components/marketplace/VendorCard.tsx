'use client';

import React from 'react';
import { Star, ShieldCheck, MapPin, Store, ArrowRight, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

interface VendorCardProps {
  vendor: {
    wallet_address: string;
    business_name: string | null;
    vendor_category: 'digital' | 'physical' | 'services' | null;
    vendor_subcategory: string | null;
    is_vendor: boolean;
    business_kyc_status: 'unverified' | 'pending' | 'verified';
    nin_verified: boolean;
    location_lat: number | null;
    location_lng: number | null;
    location_type: 'fixed' | 'mobile';
    current_trust_level: number;
    lifetime_completed_tx: number;
    lifetime_disputed_tx: number;
    lifetime_volume_usd: number;
    unique_buyers: number;
    staked_amount_usd: number;
    clean_streak_days: number;
    kyc_completed: boolean;
    created_at: string;
    trust_score: number;
    trust_level: number;
    trust_title: string;
    avg_rating: number;
    rating_count: number;
    distance_km: number | null;
  };
}

export default function VendorCard({ vendor }: VendorCardProps) {
  const levelColors: Record<number, string> = {
    1: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    2: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    3: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    4: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    5: 'text-violet-400 bg-violet-500/10 border-violet-500/20 ring-1 ring-violet-400/30',
  };

  const badgeTheme = levelColors[vendor.trust_level] || levelColors[1];
  const shortAddress = `${vendor.wallet_address.slice(0, 6)}…${vendor.wallet_address.slice(-4)}`;
  const displayName = vendor.business_name || `Vendor ${shortAddress}`;

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between">
      <div>
        {/* Top Info Header */}
        <div className="flex justify-between items-start mb-3 gap-2">
          <div>
            <h3 className="font-bold text-white text-base tracking-tight truncate max-w-[170px]" title={displayName}>
              {displayName}
            </h3>
            <span className="text-xs font-mono text-slate-500">{shortAddress}</span>
          </div>

          <div className={`px-2.5 py-1 rounded-lg text-xs font-black border flex items-center gap-1 ${badgeTheme}`}>
            <span>{vendor.trust_score}%</span>
            {vendor.trust_level === 5 && <span className="text-amber-400">👑</span>}
          </div>
        </div>

        {/* Rating + Proximity */}
        <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-white font-bold">{vendor.avg_rating > 0 ? vendor.avg_rating.toFixed(1) : 'No reviews'}</span>
            {vendor.rating_count > 0 && <span>({vendor.rating_count})</span>}
          </div>

          {vendor.distance_km !== null && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>{vendor.distance_km} km away</span>
            </div>
          )}
        </div>

        {/* Category Badge & Badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {vendor.vendor_category && (
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] uppercase font-bold tracking-wider">
              {vendor.vendor_category}
            </span>
          )}
          {vendor.vendor_subcategory && (
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 text-[10px] truncate max-w-[120px]" title={vendor.vendor_subcategory}>
              {vendor.vendor_subcategory}
            </span>
          )}
        </div>

        {/* Verification Checks */}
        <div className="space-y-1.5 mb-5 border-t border-slate-800/80 pt-3">
          <div className="flex items-center gap-1.5 text-xs">
            {vendor.nin_verified ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-slate-600" />
            )}
            <span className={vendor.nin_verified ? 'text-emerald-400/90 font-medium' : 'text-slate-500'}>
              NIN Verified
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {vendor.business_kyc_status === 'verified' ? (
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-slate-600" />
            )}
            <span className={vendor.business_kyc_status === 'verified' ? 'text-cyan-400/90 font-medium' : 'text-slate-500'}>
              CAC Registered
            </span>
          </div>
        </div>
      </div>

      <Link
        href={`/marketplace/vendor/${vendor.wallet_address}`}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-white text-xs font-bold transition-all"
      >
        <span>View Profile</span>
        <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
      </Link>
    </div>
  );
}

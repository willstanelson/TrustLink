'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/context/AuthContext';
import { Store, UserPlus, Sparkles, Navigation, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import CategoryBrowser from '@/components/marketplace/CategoryBrowser';
import VendorSearch from '@/components/marketplace/VendorSearch';
import VendorCard from '@/components/marketplace/VendorCard';
import toast from 'react-hot-toast';

export default function MarketplacePage() {
  const { authenticated, getAccessToken } = usePrivy();
  const { sessionReady, walletAddress } = useAuth();

  const [activeCategory, setActiveCategory] = useState<'digital' | 'physical' | 'services' | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Location/Geo coordinates state for ranking
  const [buyerLat, setBuyerLat] = useState<number | null>(null);
  const [buyerLng, setBuyerLng] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);

  // Vendor lists & profile statuses
  const [vendors, setVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [isVendorLoading, setIsVendorLoading] = useState(true);

  // Fetch current user profile to see if they're a vendor
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
          setIsVendor(data.profile?.is_vendor ?? false);
        }
      } catch (err) {
        console.error('Error checking vendor status:', err);
      } finally {
        if (!cancelled) setIsVendorLoading(false);
      }
    }
    checkVendorStatus();
    return () => { cancelled = true; };
  }, [walletAddress, sessionReady, getAccessToken]);

  // Request browser geolocation for proximity sorting
  const handleGetProximity = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBuyerLat(position.coords.latitude);
        setBuyerLng(position.coords.longitude);
        setLocationLabel('GPS Proximity Active');
        setIsLocating(false);
        toast.success('Nearby sorting active!');
      },
      (error) => {
        console.error('Proximity error:', error);
        toast.error('Failed to get location coordinates');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  // Perform search query
  const performSearch = useCallback(async () => {
    if (!sessionReady) return;
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      if (activeCategory) params.append('category', activeCategory);
      if (activeSubcategory) params.append('subcategory', activeSubcategory);
      if (searchQuery) params.append('query', searchQuery);
      if (buyerLat !== null) params.append('lat', buyerLat.toString());
      if (buyerLng !== null) params.append('lng', buyerLng.toString());

      const res = await fetch(`/api/vendor/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setVendors(data.vendors || []);
      } else {
        throw new Error(data.error || 'Failed to fetch vendors');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error searching vendors');
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, activeSubcategory, searchQuery, buyerLat, buyerLng, sessionReady, getAccessToken]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);

  const handleSelectCategory = (cat: 'digital' | 'physical' | 'services' | null, sub: string | null) => {
    setActiveCategory(cat);
    setActiveSubcategory(sub);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white font-sans pb-24">
      {/* ── Top Header Section ── */}
      <div className="border-b border-slate-900 bg-slate-950/40 py-8 px-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                Bendansalet
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1 tracking-tight">
              Trust-Based Marketplace
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Connect directly with verified local and digital service vendors. All negotiations and escrow payments remain fully in-platform.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Proximity button */}
            <button
              onClick={handleGetProximity}
              className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${
                buyerLat !== null
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
              }`}
              disabled={isLocating}
            >
              {isLocating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              <span>{locationLabel || 'Sort by Proximity'}</span>
            </button>

            {/* Become a vendor link */}
            {!isVendorLoading && !isVendor && (
              <Link
                href="/marketplace/onboard"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register Business</span>
              </Link>
            )}

            {/* Vendor Requests Room shortcut */}
            <Link
              href="/marketplace/requests"
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all"
            >
              Requests Board
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 space-y-8">
        {/* Search */}
        <div className="max-w-3xl">
          <VendorSearch onSearch={setSearchQuery} isLoading={isLoading} />
        </div>

        {/* Category Browsing */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Browse categories
          </h3>
          <CategoryBrowser
            activeCategory={activeCategory}
            activeSubcategory={activeSubcategory}
            onSelect={handleSelectCategory}
          />
        </div>

        {/* Search Results */}
        <div className="space-y-4 pt-4 border-t border-slate-900">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {isLoading ? 'Searching Vendors...' : `Available Vendors (${vendors.length})`}
            </h3>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : vendors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {vendors.map((vendor) => (
                <VendorCard key={vendor.wallet_address} vendor={vendor} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 bg-[#111827]/40 border border-slate-900 rounded-3xl p-6">
              <AlertCircle className="w-10 h-10 text-slate-650" />
              <div>
                <h4 className="font-bold text-white text-sm">No Vendors Found</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Try adjusting your filters, clearing your search query, or selecting another category.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

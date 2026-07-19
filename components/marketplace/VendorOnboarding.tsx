'use client';

import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ShieldCheck, HelpCircle, ArrowRight, Loader2, Sparkles, Building, MapPin, CheckCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import LocationPicker from './LocationPicker';

interface VendorOnboardingProps {
  onSuccess: () => void;
}

export default function VendorOnboarding({ onSuccess }: VendorOnboardingProps) {
  const { getAccessToken } = usePrivy();
  
  // Steps: 1 = vNIN, 2 = Biz Details + Location, 3 = Optional CAC, 4 = Final Confirmation
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form States
  const [vnin, setVnin] = useState('');
  const [vninVerified, setVninVerified] = useState(false);
  const [verifiedName, setVerifiedName] = useState({ firstName: '', lastName: '' });

  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState<'digital' | 'physical' | 'services'>('digital');
  const [subcategory, setSubcategory] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationType, setLocationType] = useState<'fixed' | 'mobile'>('fixed');

  const [rcNumber, setRcNumber] = useState('');
  const [companyType, setCompanyType] = useState<string>('BUSINESS_NAME');
  const [cacVerified, setCacVerified] = useState(false);

  // ── Step 1: Verify vNIN
  const handleVerifyVnin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanVnin = vnin.trim();
    if (!/^[A-Za-z0-9]{16}$/.test(cleanVnin)) {
      toast.error('vNIN must be exactly 16 alphanumeric characters');
      return;
    }

    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/kyc/verify-nin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vnin: cleanVnin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'vNIN verification failed');
      }

      setVninVerified(true);
      setVerifiedName({
        firstName: data.profile?.firstName || '',
        lastName: data.profile?.lastName || '',
      });
      toast.success('NIN Verified successfully');
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during verification');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: Location and Categories
  const handleLocationSelect = (latitude: number, longitude: number) => {
    setLat(latitude);
    setLng(longitude);
  };

  const handleNextStep2 = () => {
    if (!subcategory.trim()) {
      toast.error('Please enter a subcategory / specialisation');
      return;
    }
    if (lat === null || lng === null) {
      toast.error('Please select your business location coordinates');
      return;
    }
    setStep(3);
  };

  // ── Step 3: Optional CAC Verification
  const handleVerifyCac = async () => {
    const rc = rcNumber.trim();
    if (!rc) {
      toast.error('Please enter your RC number');
      return;
    }

    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/kyc/verify-cac', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rc_number: rc,
          company_type: companyType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'CAC verification failed');
      }

      setCacVerified(true);
      if (data.business?.registered_name) {
        setBusinessName(data.business.registered_name);
      }
      toast.success('CAC Verified successfully!');
      setStep(4);
    } catch (err: any) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 4: Final Vendor Registration Submit
  const handleFinalRegister = async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/vendor/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vendor_category: category,
          vendor_subcategory: subcategory.trim(),
          business_name: businessName.trim() || null,
          location_lat: lat,
          location_lng: lng,
          location_type: locationType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      toast.success('Vendor onboarding complete!');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-[#111827] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      
      {/* Step Indicator Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-black text-white tracking-tight">Become a Vendor</h2>
        </div>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Step {step} of 4
        </span>
      </div>

      {/* STEP 1: vNIN Verification */}
      {step === 1 && (
        <form onSubmit={handleVerifyVnin} className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Verify your Identity
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Nigeria's NIMC mandates using a <strong className="text-white">Virtual NIN (vNIN)</strong> for secure verification. Your raw 11-digit NIN is never processed or stored.
            </p>
          </div>

          <div className="p-4 bg-slate-950/80 border border-slate-900 rounded-2xl space-y-3 text-xs leading-relaxed text-slate-400">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-300">How to generate a vNIN:</p>
                <ul className="list-disc pl-4 mt-1.5 space-y-1 text-slate-400">
                  <li>Open the NIMC Mobile App and navigate to "Get Virtual NIN"</li>
                  <li>Alternatively, dial <strong className="text-white">*346*3*YOUR_NIN*655555#</strong> on your NIMC-registered mobile number</li>
                  <li>You will receive a 16-character alphanumeric token (valid for 72 hours)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Enter 16-character vNIN Token
            </label>
            <input
              type="text"
              maxLength={16}
              value={vnin}
              onChange={(e) => setVnin(e.target.value.toUpperCase())}
              placeholder="e.g. AB12CD34EF56GH78"
              className="w-full bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white font-mono placeholder-slate-650 outline-none transition-all"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying Token...
              </>
            ) : (
              <>
                <span>Verify Identity</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 2: Categories, Business Info & Location */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Business Configuration
            </h3>
            <p className="text-xs text-slate-400">
              Provide your business name, primary trade category, and location coordinates.
            </p>
          </div>

          <div className="space-y-4">
            {/* Optional Business Name */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Business Name (Optional)
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Tudors Digital Exchange"
                className="w-full bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-650 outline-none transition-all"
              />
            </div>

            {/* Category selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-xl px-3 py-3 text-sm text-white outline-none"
                >
                  <option value="digital">Digital Assets</option>
                  <option value="physical">Physical Goods</option>
                  <option value="services">Services</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Location Mobility
                </label>
                <select
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-xl px-3 py-3 text-sm text-white outline-none"
                >
                  <option value="fixed">Fixed Address</option>
                  <option value="mobile">Roaming Mobile</option>
                </select>
              </div>
            </div>

            {/* Subcategory */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Specialisation / Subcategory
              </label>
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="e.g. Gift Cards, POS Out, Logistics, Shoes"
                className="w-full bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-650 outline-none transition-all"
                required
              />
            </div>

            {/* Location Picker */}
            <LocationPicker onLocationSelect={handleLocationSelect} initialLat={lat} initialLng={lng} />
          </div>

          <div className="flex gap-3 pt-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold text-slate-400"
              type="button"
            >
              Back
            </button>
            <button
              onClick={handleNextStep2}
              className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Optional CAC Verification */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Building className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                CAC Business Verification (Optional)
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Verify your business with the Corporate Affairs Commission (CAC) to gain a CAC Verification Badge. This is completely optional and does not block registration.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                RC Registration Number
              </label>
              <input
                type="text"
                value={rcNumber}
                onChange={(e) => setRcNumber(e.target.value)}
                placeholder="e.g. RC1234567"
                className="w-full bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-650 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Business Type
              </label>
              <select
                value={companyType}
                onChange={(e) => setCompanyType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-xl px-3 py-3 text-sm text-white outline-none"
              >
                <option value="BUSINESS_NAME">Business Name</option>
                <option value="COMPANY">Private Limited Company (LTD)</option>
                <option value="INCORPORATED_TRUSTEES">NGO / Trust</option>
                <option value="LIMITED_PARTNERSHIP">Limited Partnership</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-3">
            <button
              onClick={() => setStep(2)}
              className="py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold text-slate-400 text-center"
              type="button"
              disabled={isLoading}
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex-1 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-white text-xs font-bold transition-all border border-slate-750"
              disabled={isLoading}
            >
              Skip Verification
            </button>
            <button
              onClick={handleVerifyCac}
              className="flex-1 py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-1.5"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Business'
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Final Confirmation */}
      {step === 4 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">All Set!</h3>
              <p className="text-xs text-slate-400 mt-1">Review your onboarding profile configuration below.</p>
            </div>
          </div>

          <div className="p-5 bg-slate-950/80 border border-slate-900 rounded-2xl text-xs space-y-3">
            <div className="flex justify-between border-b border-slate-900 pb-2">
              <span className="text-slate-500">Identity:</span>
              <span className="text-white font-bold">{verifiedName.firstName} {verifiedName.lastName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-900 pb-2">
              <span className="text-slate-500">Business Name:</span>
              <span className="text-white font-bold">{businessName || 'Not Set'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-900 pb-2">
              <span className="text-slate-500">Trade:</span>
              <span className="text-white font-bold">{category} / {subcategory}</span>
            </div>
            <div className="flex justify-between border-b border-slate-900 pb-2">
              <span className="text-slate-500">Coordinates:</span>
              <span className="text-white font-bold font-mono">{lat?.toFixed(4)}, {lng?.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">CAC Registered:</span>
              <span className={cacVerified ? 'text-cyan-400 font-bold' : 'text-slate-500'}>
                {cacVerified ? 'Verified' : 'No'}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              onClick={() => setStep(3)}
              className="flex-1 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold text-slate-400"
              type="button"
              disabled={isLoading}
            >
              Back
            </button>
            <button
              onClick={handleFinalRegister}
              className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Register Business'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ShieldCheck, AlertCircle, Loader2, CreditCard, UserCheck, Shield } from 'lucide-react';

interface KYCVerificationProps {
  onSuccess?: () => void;
  initialMode?: 'bvn' | 'vnin';
}

export default function KYCVerification({ onSuccess, initialMode = 'bvn' }: KYCVerificationProps) {
  const { getAccessToken, user } = usePrivy();
  
  const [mode, setMode] = useState<'bvn' | 'vnin'>(initialMode);
  const [bvn, setBvn] = useState('');
  const [vnin, setVnin] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);

  const handleVerifyBvn = async () => {
    if (!/^\d{11}$/.test(bvn)) {
      setErrorMessage('BVN must be exactly 11 numeric digits.');
      setStatus('error');
      return;
    }

    if (!user?.wallet?.address) {
      setErrorMessage('Please connect your Web3 wallet first.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMessage('Authentication token missing. Please log in again.');
        setStatus('error');
        return;
      }

      const res = await fetch('/api/kyc/verify-bvn', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ bvn }) 
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('success');
        setVerifiedName(`${data.profile.firstName} ${data.profile.lastName}`);
        if (onSuccess) {
          setTimeout(() => onSuccess(), 1500);
        }
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'BVN verification failed. Please check digits.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Network error during BVN verification. Please check your connection.');
    }
  };

  const handleVerifyVnin = async () => {
    const cleanVnin = vnin.trim().toUpperCase();
    if (!/^[A-Z0-9]{16}$/.test(cleanVnin)) {
      setErrorMessage('vNIN must be a 16-character alphanumeric token.');
      setStatus('error');
      return;
    }

    if (!user?.wallet?.address) {
      setErrorMessage('Please connect your Web3 wallet first.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMessage('Authentication token missing. Please log in again.');
        setStatus('error');
        return;
      }

      const res = await fetch('/api/kyc/verify-nin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ vnin: cleanVnin }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('success');
        const fullName = `${data.profile?.firstName || ''} ${data.profile?.lastName || ''}`.trim();
        setVerifiedName(fullName || 'Verified Citizen');
        if (onSuccess) {
          setTimeout(() => onSuccess(), 1500);
        }
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Virtual NIN verification failed. Verify your token validity.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Network error during NIN verification. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="p-8 bg-[#1e1f26]/95 border border-[#47cf73]/30 rounded-xl max-w-md w-full flex flex-col items-center justify-center text-center space-y-4 shadow-2xl mx-auto">
        <div className="w-16 h-16 bg-[#47cf73]/20 rounded-full flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-[#47cf73]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white mb-1">
            {mode === 'bvn' ? 'BVN Verified' : 'vNIN Verified'}
          </h3>
          <p className="text-sm text-[#aaaaaa]">
            Identity confirmed for <span className="text-white font-medium">{verifiedName ?? 'Verified User'}</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 bg-[#12182b] border border-[#232c4a] rounded-3xl max-w-md w-full shadow-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">TrustLink KYC Verification</h3>
          <p className="text-xs text-slate-400">Upgrade your trust score & deal limits</p>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-2 gap-2 bg-[#0e1424] p-1 rounded-xl border border-[#1e2742] mb-5">
        <button
          type="button"
          onClick={() => { setMode('bvn'); setErrorMessage(null); }}
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mode === 'bvn'
              ? 'bg-emerald-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>BVN (11 Digits)</span>
        </button>

        <button
          type="button"
          onClick={() => { setMode('vnin'); setErrorMessage(null); }}
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mode === 'vnin'
              ? 'bg-emerald-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Virtual NIN (16 Chars)</span>
        </button>
      </div>

      {mode === 'bvn' ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Enter your 11-digit Bank Verification Number. TrustLink does not store this number; it is verified securely via Dojah.
          </p>

          <div className="relative">
            <input 
              type="tel" 
              inputMode="numeric"
              placeholder="Enter 11-digit BVN" 
              value={bvn}
              onChange={(e) => setBvn(e.target.value.replace(/\D/g, ''))} 
              disabled={status === 'loading'}
              maxLength={11}
              className="w-full bg-[#0b0f19] border border-[#232c4a] focus:border-emerald-500 outline-none text-white px-4 py-3 pr-16 rounded-xl transition-all disabled:opacity-50 font-mono text-base tracking-widest placeholder:tracking-normal placeholder:text-slate-500 text-sm"
              aria-label="Bank Verification Number"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-slate-500">
              {bvn.length}/11
            </div>
          </div>

          {status === 'error' && errorMessage && (
            <div className="flex items-center gap-2.5 text-red-400 text-xs bg-red-500/10 p-3 rounded-xl border border-red-500/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="font-medium">{errorMessage}</p>
            </div>
          )}

          <button 
            type="button"
            onClick={handleVerifyBvn}
            disabled={status === 'loading' || bvn.length !== 11}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            {status === 'loading' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Verifying BVN…</>
            ) : 'Verify BVN Identity'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Enter your 16-character Virtual NIN token generated via the NIMC Mobile ID App or USSD (<span className="text-white font-mono">*346*3*NIN*OTP#</span>).
          </p>

          <div className="relative">
            <input 
              type="text" 
              placeholder="e.g. 1AB23CD45EF67GH8" 
              value={vnin}
              onChange={(e) => setVnin(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} 
              disabled={status === 'loading'}
              maxLength={16}
              className="w-full bg-[#0b0f19] border border-[#232c4a] focus:border-emerald-500 outline-none text-white px-4 py-3 pr-16 rounded-xl transition-all disabled:opacity-50 font-mono text-base tracking-wider placeholder:tracking-normal placeholder:text-slate-500 text-sm uppercase"
              aria-label="Virtual NIN Token"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-slate-500">
              {vnin.length}/16
            </div>
          </div>

          <div className="bg-[#0e1424] border border-[#1e2742] rounded-xl p-3 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p>
              <strong>NDPA Data Minimization:</strong> Your vNIN token is used strictly for real-time verification and is never stored in the database.
            </p>
          </div>

          {status === 'error' && errorMessage && (
            <div className="flex items-center gap-2.5 text-red-400 text-xs bg-red-500/10 p-3 rounded-xl border border-red-500/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="font-medium">{errorMessage}</p>
            </div>
          )}

          <button 
            type="button"
            onClick={handleVerifyVnin}
            disabled={status === 'loading' || vnin.length !== 16}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            {status === 'loading' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Verifying Virtual NIN…</>
            ) : 'Verify vNIN Token'}
          </button>
        </div>
      )}
    </div>
  );
}
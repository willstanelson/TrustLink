'use client';
import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

interface KYCVerificationProps {
  onSuccess?: () => void;
}

export default function KYCVerification({ onSuccess }: KYCVerificationProps) {
  const { getAccessToken, user } = usePrivy();
  
  const [bvn, setBvn] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!/^\d{11}$/.test(bvn)) {
      setErrorMessage('BVN must be exactly 11 digits.');
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
          setTimeout(() => onSuccess(), 1500); // Allow success UI to display before closing
        }
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Verification failed. Please try again.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage('Network error. Please check your connection.');
    }
  };

  if (status === 'success') {
    return (
      <div className="p-8 bg-[#1e1f26]/95 border border-[#47cf73]/30 rounded-xl max-w-md w-full flex flex-col items-center justify-center text-center space-y-4 shadow-2xl mx-auto">
        <div className="w-16 h-16 bg-[#47cf73]/20 rounded-full flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-[#47cf73]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Identity Verified</h3>
          <p className="text-sm text-[#aaaaaa]">
            Secure session established for <span className="text-white font-medium">{verifiedName ?? 'Verified User'}</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#1e1f26]/95 backdrop-blur-sm border border-[#333333] rounded-xl max-w-md w-full shadow-2xl mx-auto">
      <h3 className="text-xl font-bold text-white mb-2">Identity Verification</h3>
      <p className="text-sm text-[#aaaaaa] mb-6 leading-relaxed">
        Enter your 11-digit BVN to securely verify your identity. TrustLink does not store this number.
      </p>
      
      <div className="space-y-5">
        <div className="relative">
          <input 
            type="tel" 
            inputMode="numeric"
            placeholder="Enter 11-digit BVN" 
            value={bvn}
            onChange={(e) => setBvn(e.target.value.replace(/\D/g, ''))} 
            disabled={status === 'loading'}
            maxLength={11}
            className="w-full bg-[#0b0f19] border border-[#444444] focus:border-[#ffdd40] focus:ring-1 focus:ring-[#ffdd40] outline-none text-white px-4 py-3.5 pr-16 rounded-lg transition-all disabled:opacity-50 font-mono text-lg tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
            aria-label="Bank Verification Number"
            aria-invalid={status === 'error'}
            aria-describedby={status === 'error' ? "bvn-error" : undefined}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-[#aaaaaa]">
            {bvn.length}/11
          </div>
        </div>

        {status === 'error' && errorMessage && (
          <div id="bvn-error" className="flex items-center gap-3 text-[#f44336] text-sm bg-[#f44336]/10 p-3.5 rounded-lg border border-[#f44336]/20" role="alert">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        <button 
          onClick={handleVerify}
          disabled={status === 'loading' || bvn.length !== 11}
          className="w-full flex items-center justify-center gap-2 bg-[#ffdd40] hover:bg-white text-black font-bold py-3.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Verifying Connection...</>
          ) : 'Verify Identity'}
        </button>
      </div>
    </div>
  );
}
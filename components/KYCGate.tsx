'use client';
import { useEffect, useState, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createClient } from '@supabase/supabase-js';
import KYCVerification from './KYCVerification';
import { Loader2 } from 'lucide-react';

export default function KYCGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  
  const walletAddress = user?.wallet?.address;

  const supabase = useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  useEffect(() => {
    async function checkKycStatus() {
      if (!ready) return;
      
      if (!authenticated || !walletAddress) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('kyc_completed')
        .eq('wallet_address', walletAddress)
        .single();

      if (!error && data) {
        setIsVerified(data.kyc_completed);
      } else {
        setIsVerified(false);
      }
      setLoading(false);
    }

    checkKycStatus();
  }, [ready, authenticated, walletAddress, supabase]);

  const handleKycSuccess = async () => {
    if (!walletAddress) return;
    
    // Anti-Race-Condition: Wait 500ms for Supabase DB to reflect the backend write
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data } = await supabase
      .from('profiles')
      .select('kyc_completed')
      .eq('wallet_address', walletAddress)
      .single();
      
    // Unlock modal
    setIsVerified(data?.kyc_completed ?? true);
  };

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#ffdd40]" />
      </div>
    );
  }

  if (authenticated && isVerified === false) {
    return (
      <>
        <div className="pointer-events-none blur-sm select-none opacity-50 transition-all duration-500">
          {children}
        </div>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f19]/80 backdrop-blur-md">
          <div className="w-full max-w-md px-4 animate-in fade-in zoom-in-95 duration-300">
            <p className="text-center text-sm font-bold text-[#ffdd40] mb-4 tracking-widest uppercase">
              Action Required
            </p>
            <KYCVerification onSuccess={handleKycSuccess} />
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
}
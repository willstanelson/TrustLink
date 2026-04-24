'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { usePrivy } from '@privy-io/react-auth';

interface AuthContextType {
  supabase: SupabaseClient;
  walletAddress: string | null;
  emailAddress: string | null;
  sessionReady: boolean;
  sessionLoading: boolean;
  sessionError: string | null;
  sessionToken: string | null;
  refreshSession: () => Promise<void>;
}

const supabaseBase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { authenticated, getAccessToken } = usePrivy();
  const [supabase, setSupabase] = useState<SupabaseClient>(supabaseBase);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [emailAddress, setEmailAddress] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const bootstrapSession = useCallback(async () => {
    if (!authenticated) {
      setSupabase(supabaseBase);
      setWalletAddress(null);
      setEmailAddress(null);
      setSessionToken(null);
      setSessionReady(false);
      setSessionLoading(false);
      setSessionError(null);
      return;
    }

    setSessionLoading(true);
    setSessionError(null); // Clear previous errors on retry
    
    try {
      const privyToken = await getAccessToken();
      if (!privyToken) throw new Error('No Privy token available');

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${privyToken}` }
      });

      if (!res.ok) throw new Error('Session exchange failed');

      const { token, walletAddress: wallet, emailAddress: email } = await res.json();

      const authenticatedClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: { Authorization: `Bearer ${token}` }
          }
        }
      );

      authenticatedClient.realtime.setAuth(token);

      setSupabase(authenticatedClient);
      setWalletAddress(wallet);
      setEmailAddress(email);
      setSessionToken(token);
      setSessionReady(true);
      setSessionError(null);
    } catch (err) {
      console.error('Failed to bootstrap session:', err);
      setSessionReady(false);
      setSessionError('Failed to secure session. Please check your connection and try again.');
    } finally {
      setSessionLoading(false);
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    if (!sessionReady) return;

    const REFRESH_INTERVAL = (60 - 5) * 60 * 1000; // 55 minutes
    const timer = setTimeout(() => {
      console.log("Refreshing Supabase JWT...");
      bootstrapSession();
    }, REFRESH_INTERVAL);

    return () => clearTimeout(timer); 
  }, [sessionReady, bootstrapSession]);

  return (
    <AuthContext.Provider value={{ supabase, walletAddress, emailAddress, sessionReady, sessionLoading, sessionError, sessionToken, refreshSession: bootstrapSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
import { createClient } from '@supabase/supabase-js';
import { PrivyClient, WalletWithMetadata } from '@privy-io/server-auth';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
  throw new Error('Missing Privy environment variables');
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

// ── Original Wallet Helper (Keeps existing crypto routes safe) ──
export async function getVerifiedWallet(req: Request): Promise<string> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');

  const privyToken = authHeader.split(' ')[1];
  const claims = await privy.verifyAuthToken(privyToken);
  const privyUser = await privy.getUser(claims.userId);

  const wallet = privyUser.linkedAccounts.find(
    (a): a is WalletWithMetadata => a.type === 'wallet'
  );

  if (!wallet?.address) throw new Error('No wallet found');
  return wallet.address.toLowerCase();
}

// ── NEW: Unified Identity Helper for Web2/Web3 Hybrid Routes ──
export async function getVerifiedIdentity(req: Request): Promise<{ wallet: string | null, email: string | null }> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');

  const privyToken = authHeader.split(' ')[1];
  
  // 1. Verify the token cryptographically (throws if invalid/forged)
  const claims = await privy.verifyAuthToken(privyToken);
  
  // 2. Fetch the full user profile from Privy
  const privyUser = await privy.getUser(claims.userId);

  // 3. Extract Wallet (if one exists)
  const walletAccount = privyUser.linkedAccounts.find(
    (a): a is WalletWithMetadata => a.type === 'wallet'
  );
  const wallet = walletAccount?.address ? walletAccount.address.toLowerCase() : null;

  // 4. Extract Email (Checking native email or OAuth providers)
  const emailRaw = 
    privyUser.email?.address || 
    privyUser.google?.email || 
    privyUser.apple?.email || 
    privyUser.discord?.email || 
    null;
    
  const email = emailRaw ? emailRaw.toLowerCase() : null;

  // Return both identifiers safely
  return { wallet, email };
}
// app/api/auth/sync/route.ts
import { PrivyClient, User, WalletWithMetadata } from '@privy-io/server-auth';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function extractWalletFromPrivyUser(user: User): string | null {
  if (user.wallet?.address) {
    return user.wallet.address.trim().toLowerCase();
  }
  const walletAccount = user.linkedAccounts?.find(
    (a): a is WalletWithMetadata => a.type === 'wallet'
  );
  if (walletAccount?.address) {
    return walletAccount.address.trim().toLowerCase();
  }
  return null;
}

function extractEmailFromPrivyUser(user: User): string | null {
  // 1. Direct typed account properties on Privy User
  const directEmail =
    user.email?.address ||
    user.google?.email ||
    user.apple?.email ||
    user.discord?.email ||
    user.github?.email ||
    user.linkedin?.email;

  if (directEmail && typeof directEmail === 'string' && directEmail.trim()) {
    return directEmail.trim().toLowerCase();
  }

  // 2. Linked accounts array fallback (email OTP, Google/Apple/social OAuth)
  if (Array.isArray(user.linkedAccounts)) {
    for (const account of user.linkedAccounts) {
      if (account.type === 'email' && 'address' in account && account.address) {
        return account.address.trim().toLowerCase();
      }
      if ('email' in account && (account as any).email && typeof (account as any).email === 'string') {
        return (account as any).email.trim().toLowerCase();
      }
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // 1. Verify token securely
    const privy = new PrivyClient(
      (process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '').trim(),
      (process.env.PRIVY_APP_SECRET || '').trim()
    );
    const verifiedClaims = await privy.verifyAuthToken(token);

    // 2. Extract Web3 Wallet & User Identifiers
    const user = await privy.getUser(verifiedClaims.userId);
    const walletAddress = extractWalletFromPrivyUser(user);

    if (!walletAddress) {
      return NextResponse.json({ error: 'No wallet found' }, { status: 400 });
    }

    const emailAddress = extractEmailFromPrivyUser(user);

    // 3. Admin DB connection
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4. Safe Upsert: Initialize default profile row if it does not exist
    const baseProfile: Record<string, any> = {
      wallet_address: walletAddress,
      kyc_completed: false,
      profile_completed: false,
      current_trust_level: 0,
      tx_this_level: 0,
      volume_this_level: 0,
      lifetime_completed_tx: 0,
      lifetime_disputed_tx: 0,
      lifetime_volume_usd: 0,
      unique_buyers: 0,
      staked_amount_usd: 0,
      clean_streak_days: 0,
    };

    if (emailAddress) {
      baseProfile.email_address = emailAddress;
    }

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(baseProfile, { onConflict: 'wallet_address', ignoreDuplicates: true });

    if (upsertError) throw upsertError;

    // 5. If Privy provides an email, ensure email_address column is updated on existing rows too
    if (emailAddress) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          email_address: emailAddress,
          updated_at: new Date().toISOString(),
        })
        .ilike('wallet_address', walletAddress);

      if (updateError) {
        console.error('Failed to update email_address on profile sync:', updateError);
      }
    }

    return NextResponse.json({ success: true, message: 'Sync complete' });
  } catch (err: any) {
    console.error('Sync Error:', err);
    return NextResponse.json({ error: 'Failed to sync profile' }, { status: 500 });
  }
}


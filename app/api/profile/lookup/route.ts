import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient, WalletWithMetadata } from '@privy-io/server-auth';

const privy = new PrivyClient(
  (process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '').trim(),
  (process.env.PRIVY_APP_SECRET || '').trim()
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  // 1. Strict Authentication: Verify caller is a logged-in TrustLink user
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await privy.verifyAuthToken(authHeader.split(' ')[1]);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email query parameter required' }, { status: 400 });
    }

    // Explicit lowercase normalization
    const normalizedEmail = email.trim().toLowerCase();

    // 2. Query the profiles table searching by email_address with lowercase normalization
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('bank_name, bank_code, account_number, account_name, wallet_address')
      .ilike('email_address', normalizedEmail)
      .maybeSingle();

    // 3. Fallback: If direct email matching returns nothing, query Privy server SDK, extract wallet address, and query profiles by wallet_address
    if (!profile) {
      try {
        const privyUser = await privy.getUserByEmail(normalizedEmail);
        const walletAddress =
          privyUser?.wallet?.address ||
          privyUser?.linkedAccounts?.find(
            (a): a is WalletWithMetadata => a.type === 'wallet'
          )?.address;

        if (walletAddress) {
          const normalizedWallet = walletAddress.trim().toLowerCase();
          const { data: profileByWallet } = await supabaseAdmin
            .from('profiles')
            .select('bank_name, bank_code, account_number, account_name, wallet_address')
            .ilike('wallet_address', normalizedWallet)
            .maybeSingle();

          if (profileByWallet) {
            profile = profileByWallet;

            // Auto-backfill email_address into profiles table for future queries
            await supabaseAdmin
              .from('profiles')
              .update({
                email_address: normalizedEmail,
                updated_at: new Date().toISOString(),
              })
              .ilike('wallet_address', normalizedWallet);
          }
        }
      } catch (privyErr) {
        console.warn('Privy fallback lookup notice:', privyErr);
      }
    }

    if (!profile || !profile.bank_code || !profile.account_number) {
      return NextResponse.json({ error: 'No payout details saved for seller' }, { status: 404 });
    }

    // Return required payout credentials
    return NextResponse.json({
      success: true,
      profile: {
        bank_name: profile.bank_name,
        bank_code: profile.bank_code,
        account_number: profile.account_number,
        account_name: profile.account_name,
        wallet_address: profile.wallet_address,
      },
    });
  } catch (error: any) {
    console.error('Lookup error:', error);
    return NextResponse.json({ error: 'Failed to look up profile' }, { status: 500 });
  }
}
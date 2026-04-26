import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient, WalletWithMetadata } from '@privy-io/server-auth';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
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

    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    // 2. Ask Privy for the target user's wallet using their email
    const privyUser = await privy.getUserByEmail(email);
    if (!privyUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const wallet = privyUser.linkedAccounts.find(
      (a): a is WalletWithMetadata => a.type === 'wallet'
    );
    if (!wallet?.address) return NextResponse.json({ error: 'No wallet linked' }, { status: 404 });

    // 3. Look up the bank details in Supabase safely
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('bank_code, account_number, account_name')
      .ilike('wallet_address', wallet.address)
      .single();

    if (!profile) return NextResponse.json({ error: 'No bank details saved' }, { status: 404 });

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error('Lookup error:', error);
    return NextResponse.json({ error: 'Failed to look up profile' }, { status: 500 });
  }
}
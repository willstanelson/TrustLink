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

export async function POST(req: Request) {
  try {
    // 1. Strict Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const privyToken = authHeader.split(' ')[1];
    let callerWallet: string;

    try {
      const claims = await privy.verifyAuthToken(privyToken);
      const privyUser = await privy.getUser(claims.userId);
      const wallet = privyUser.linkedAccounts.find(
        (a): a is WalletWithMetadata => a.type === 'wallet'
      );
      callerWallet = wallet?.address?.toLowerCase() ?? '';
      if (!callerWallet) throw new Error('No wallet');
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { bankName, accountNumber, accountName } = body;

    if (!bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Missing bank details' }, { status: 400 });
    }

    // 2. Upsert the Bank Details into the Profiles table
    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({ 
        wallet_address: callerWallet, 
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        updated_at: new Date().toISOString()
      }, { onConflict: 'wallet_address' });

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Bank details updated successfully' });
  } catch (error: any) {
    console.error('Profile Update Error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
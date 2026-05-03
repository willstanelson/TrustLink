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

// 🚀 THE FIX: Extracted DRY Auth Helper
async function getVerifiedWallet(req: Request): Promise<string> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const privyToken = authHeader.split(' ')[1];
  const claims = await privy.verifyAuthToken(privyToken);
  const privyUser = await privy.getUser(claims.userId);
  const wallet = privyUser.linkedAccounts.find(
    (a): a is WalletWithMetadata => a.type === 'wallet'
  );
  
  const callerWallet = wallet?.address?.toLowerCase();
  if (!callerWallet) throw new Error('No wallet');
  
  return callerWallet;
}

// ==========================================
// SECURE PROFILE FETCH
// ==========================================
export async function GET(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .ilike('wallet_address', callerWallet)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: "Profile not found", code: 'PGRST116' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No wallet') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Profile Fetch Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ==========================================
// SECURE BANK UPDATE WITH VALIDATION
// ==========================================
export async function POST(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);
    const body = await req.json();
    const { bankName, bankCode, accountNumber, accountName } = body;

    // 🚀 THE FIX: Strict Input Validation
    if (!bankName || !bankCode || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Missing bank details' }, { status: 400 });
    }
    
    // Validate Nigerian NUBAN (Exactly 10 digits)
    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Account number must be exactly 10 digits' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({ 
        wallet_address: callerWallet, 
        bank_name: bankName,
        bank_code: bankCode,
        account_number: accountNumber,
        account_name: accountName,
        updated_at: new Date().toISOString()
      }, { onConflict: 'wallet_address' });

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Bank details updated successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No wallet') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('Profile Update Error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
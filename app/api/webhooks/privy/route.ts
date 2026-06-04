import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

type LinkedAccount = { type: string; address?: string };

export async function POST(request: Request) {
  try {
    const { 
      SUPABASE_URL, 
      SUPABASE_SERVICE_ROLE_KEY, 
      PRIVY_APP_ID, 
      PRIVY_APP_SECRET, 
      PRIVY_WEBHOOK_SECRET 
    } = process.env;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PRIVY_APP_ID || !PRIVY_APP_SECRET || !PRIVY_WEBHOOK_SECRET) {
      console.error('CRITICAL: Missing webhook environment variables.');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Strict Webhook Signature Verification
    const svix_id = request.headers.get('svix-id') ?? '';
    const svix_timestamp = request.headers.get('svix-timestamp') ?? '';
    const svix_signature = request.headers.get('svix-signature') ?? '';
    
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    const body = await request.text(); 

    try {
      await privy.verifyWebhook(body, headers as any, PRIVY_WEBHOOK_SECRET);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);

    if (payload.type === 'user.created') {
      // Strongly typed linked accounts
      const trustedWallet = payload.data?.linked_accounts?.find(
        (a: LinkedAccount) => a.type === 'wallet'
      )?.address;

      if (trustedWallet) {
        await supabase.from('profiles').upsert({
          wallet_address: trustedWallet,
          kyc_completed: false,
          profile_completed: false,
          current_trust_level: 0,
          lifetime_completed_tx: 0,
          lifetime_disputed_tx: 0,
          lifetime_volume_usd: 0.00,
          tx_this_level: 0,
          volume_this_level: 0.00,
          clean_streak_days: 0,
          staked_amount_usd: 0.00
        }, { onConflict: 'wallet_address', ignoreDuplicates: true });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Privy Webhook Error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const bvnSchema = z.object({
  bvn: z.string().regex(/^\d{11}$/, 'BVN must be exactly 11 digits')
});

export async function POST(request: Request) {
  try {
    const { 
      PRIVY_APP_ID, 
      PRIVY_APP_SECRET, 
      SUPABASE_URL, 
      SUPABASE_SERVICE_ROLE_KEY,
      DOJAH_APP_ID,
      DOJAH_SECRET_KEY
    } = process.env;

    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DOJAH_APP_ID || !DOJAH_SECRET_KEY) {
      console.error('CRITICAL: Server misconfiguration. Missing ENV vars.');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    // 1. Inline Initialization 
    const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const ratelimit = new Ratelimit({ 
      redis: Redis.fromEnv(), 
      limiter: Ratelimit.slidingWindow(5, '1 m'), 
      analytics: true 
    });

    // 2. Privy Auth Guard
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) return NextResponse.json({ error: 'Missing authentication token.' }, { status: 401 });

    let verifiedClaims;
    try {
      verifiedClaims = await privy.verifyAuthToken(token);
    } catch (error) {
      console.error('Privy token verification failed:', error);
      return NextResponse.json({ error: 'Invalid or expired authentication session.' }, { status: 401 });
    }

    const privyUser = await privy.getUser(verifiedClaims.userId);
    const trustedWallet = privyUser.wallet?.address;

    if (!trustedWallet) {
      return NextResponse.json({ error: 'A connected wallet is required for KYC.' }, { status: 400 });
    }

    // 3. Input Validation
    const body = await request.json();
    const parsed = bvnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { bvn } = parsed.data;

    // 4. Rate Limiting (by Privy ID)
    const { success: rateLimitSuccess } = await ratelimit.limit(verifiedClaims.userId);
    if (!rateLimitSuccess) {
      return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
    }

    // 5. Supabase Pre-Flight Check
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('kyc_completed')
      .eq('wallet_address', trustedWallet) 
      .single();

    if (existingProfile?.kyc_completed) {
      return NextResponse.json({ error: 'This wallet is already verified.' }, { status: 409 });
    }

    // 6. Dojah Fetch
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const DOJAH_BASE = process.env.DOJAH_BASE_URL ?? 'https://sandbox.dojah.io';
    const response = await fetch(`${DOJAH_BASE}/api/v1/kyc/bvn/full?bvn=${bvn}`, {
      headers: {
        Authorization: DOJAH_SECRET_KEY,
        AppId: DOJAH_APP_ID,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error('Dojah error:', await response.json().catch(() => ({})));
      return NextResponse.json({ error: 'Verification failed with identity provider.' }, { status: 502 });
    }

    const data = await response.json();
    const { firstName, lastName } = data.entity;

    // 7. Supabase Upsert (Self-Healing + Atomic)
    const { error: dbError } = await supabase
      .from('profiles')
      .upsert(
        {
          wallet_address:        trustedWallet,
          kyc_completed:         true,
          profile_completed:     false,
          current_trust_level:   0,
          lifetime_completed_tx: 0,
          lifetime_disputed_tx:  0,
          lifetime_volume_usd:   0.00,
          tx_this_level:         0,
          volume_this_level:     0.00,
          clean_streak_days:     0,
          staked_amount_usd:     0.00,
        },
        { onConflict: 'wallet_address' }
      );

    if (dbError) {
      console.error('Supabase upsert error:', dbError);
      return NextResponse.json({ error: 'Failed to update profile record.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: { firstName, lastName } });

  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Provider timeout. Please try again later.' }, { status: 504 });
    }
    console.error('Internal KYC Error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
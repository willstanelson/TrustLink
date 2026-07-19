// app/api/kyc/verify-nin/route.ts
// Virtual NIN (vNIN) verification via Dojah
// The vNIN is a 16-character alphanumeric token the user generates via the NIMC
// mobile app or USSD (*346*3*NIN*OTP#). It is valid for 72 hours.
//
// NDPA COMPLIANCE: The vNIN string is used ONLY for the Dojah API call and is
// NEVER stored in the database. Only the Dojah transaction reference (from the
// response) is stored for audit. The profiles row gets nin_verified: true.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const vninSchema = z.object({
  vnin: z.string().regex(/^[A-Za-z0-9]{16}$/, 'vNIN must be a 16-character alphanumeric token'),
});

export async function POST(request: Request) {
  try {
    const {
      PRIVY_APP_ID,
      PRIVY_APP_SECRET,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      DOJAH_APP_ID,
      DOJAH_SECRET_KEY,
    } = process.env;

    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DOJAH_APP_ID || !DOJAH_SECRET_KEY) {
      console.error('CRITICAL: Server misconfiguration. Missing ENV vars.');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    // 1. Inline Initialization (matches verify-bvn pattern)
    const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
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

    let privyUser;
    try {
      privyUser = await privy.getUser(verifiedClaims.userId);
    } catch (error) {
      console.error('Failed to fetch Privy user:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve user profile.' },
        { status: 503 }
      );
    }
    const trustedWallet = privyUser.wallet?.address;

    // 3. Input Validation
    const body = await request.json();
    const parsed = vninSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { vnin } = parsed.data;

    // 4. Rate Limiting (by Privy ID)
    const { success: rateLimitSuccess } = await ratelimit.limit(`nin:${verifiedClaims.userId}`);
    if (!rateLimitSuccess) {
      return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
    }

    // 5. Pre-flight: check if already NIN-verified
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('nin_verified')
      .eq('wallet_address', trustedWallet)
      .single();

    if (existingProfile?.nin_verified) {
      return NextResponse.json({ error: 'This wallet already has a verified NIN.' }, { status: 409 });
    }

    // 6. Dojah vNIN Verification
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const DOJAH_BASE = process.env.DOJAH_BASE_URL ?? 'https://sandbox.dojah.io';
    const response = await fetch(`${DOJAH_BASE}/api/v1/kyc/vnin?vnin=${vnin}`, {
      headers: {
        Authorization: DOJAH_SECRET_KEY,
        AppId: DOJAH_APP_ID,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('Dojah vNIN error:', errorBody);
      return NextResponse.json({ error: 'NIN verification failed with identity provider.' }, { status: 502 });
    }

    const data = await response.json();

    // NDPA: Extract only what we need, discard the vNIN immediately
    // The vNIN variable goes out of scope after this function returns
    const verifiedName = {
      firstName: data.entity?.firstname || data.entity?.firstName || '',
      lastName: data.entity?.surname || data.entity?.lastName || '',
    };

    // 7. Update profile — set nin_verified = true
    // We do NOT store the vNIN or raw NIN. Only the fact that verification passed.
    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        nin_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', trustedWallet);

    if (dbError) {
      console.error('Supabase update error:', dbError);
      return NextResponse.json({ error: 'Failed to update profile record.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'NIN verified successfully',
      profile: verifiedName,
    });

  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Provider timeout. Please try again later.' }, { status: 504 });
    }
    console.error('Internal NIN Verification Error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

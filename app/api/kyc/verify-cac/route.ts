// app/api/kyc/verify-cac/route.ts
// CAC (Corporate Affairs Commission) verification via Dojah
// Optional additive verification — never blocks vendor listing.
// Requires both rc_number and company_type.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const cacSchema = z.object({
  rc_number: z.string().min(5, 'RC number required'),
  company_type: z.enum([
    'BUSINESS_NAME',
    'COMPANY',
    'INCORPORATED_TRUSTEES',
    'LIMITED_PARTNERSHIP',
    'LIMITED_LIABILITY_PARTNERSHIP',
  ]),
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
    const parsed = cacSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { rc_number, company_type } = parsed.data;

    // 4. Rate Limiting (by Privy ID)
    const { success: rateLimitSuccess } = await ratelimit.limit(`cac:${verifiedClaims.userId}`);
    if (!rateLimitSuccess) {
      return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
    }

    // 5. Pre-flight: check if already CAC-verified
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('business_kyc_status')
      .eq('wallet_address', trustedWallet)
      .single();

    if (existingProfile?.business_kyc_status === 'verified') {
      return NextResponse.json({ error: 'Business is already CAC-verified.' }, { status: 409 });
    }

    // 6. Set status to pending before the API call
    await supabase
      .from('profiles')
      .update({ business_kyc_status: 'pending', updated_at: new Date().toISOString() })
      .eq('wallet_address', trustedWallet);

    // 7. Dojah CAC Verification
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const DOJAH_BASE = process.env.DOJAH_BASE_URL ?? 'https://sandbox.dojah.io';
    const response = await fetch(
      `${DOJAH_BASE}/api/v1/kyc/cac/basic?rc_number=${encodeURIComponent(rc_number)}&company_type=${encodeURIComponent(company_type)}`,
      {
        headers: {
          Authorization: DOJAH_SECRET_KEY,
          AppId: DOJAH_APP_ID,
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('Dojah CAC error:', errorBody);

      // Revert pending status on failure
      await supabase
        .from('profiles')
        .update({ business_kyc_status: 'unverified', updated_at: new Date().toISOString() })
        .eq('wallet_address', trustedWallet);

      return NextResponse.json({ error: 'CAC verification failed with identity provider.' }, { status: 502 });
    }

    const data = await response.json();
    const registeredName = data.entity?.registered_name || data.entity?.registeredName || '';

    // 8. Update profile — mark as verified, store business name from CAC
    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        business_kyc_status: 'verified',
        business_name: registeredName || undefined, // Only overwrite if CAC returned a name
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', trustedWallet);

    if (dbError) {
      console.error('Supabase update error:', dbError);
      return NextResponse.json({ error: 'Failed to update profile record.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'CAC verification successful',
      business: { registered_name: registeredName },
    });

  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Provider timeout. Please try again later.' }, { status: 504 });
    }
    console.error('Internal CAC Verification Error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

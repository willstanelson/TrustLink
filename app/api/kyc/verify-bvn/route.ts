import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const bvnSchema = z.object({
  bvn: z.string().regex(/^\d{11}$/, 'BVN must be exactly 11 digits')
});

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { DOJAH_APP_ID, DOJAH_SECRET_KEY } = process.env;
    if (!DOJAH_APP_ID || !DOJAH_SECRET_KEY) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const body = await request.json();
    const parsed = bvnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'anonymous_ip';
    
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute.' },
        { status: 429 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://sandbox.dojah.io/api/v1/kyc/bvn/full?bvn=${parsed.data.bvn}`,
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
      const err = await response.json().catch(() => ({}));
      console.error('Dojah error', err);
      return NextResponse.json(
        { error: 'Verification failed with identity provider.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const { firstName, lastName } = data.entity;

    await db.user.update({
      where: { id: session.user.id },
      data: { isKycVerified: true, kycVerifiedAt: new Date() },
    });

    return NextResponse.json({ success: true, profile: { firstName, lastName } });

  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Provider timeout. Please try again later.' }, { status: 504 });
    }
    console.error('Internal KYC Error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
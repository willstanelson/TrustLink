// app/api/vendor/lookup/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient, WalletWithMetadata } from '@privy-io/server-auth';
import { calculateTrustStats } from '@/lib/trust';
import { VENDOR_SELECT_CLAUSE, serializeVendorProfile } from '@/lib/vendor-serializer';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  // 1. Auth Guard
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
    const identifier = searchParams.get('identifier')?.trim();

    if (!identifier) {
      return NextResponse.json({ error: 'identifier param required (wallet address or email)' }, { status: 400 });
    }

    let walletAddress = identifier;

    // If it's an email, resolve to wallet via Privy
    if (identifier.includes('@')) {
      try {
        const privyUser = await privy.getUserByEmail(identifier);
        if (!privyUser) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        const wallet = privyUser.linkedAccounts.find(
          (a): a is WalletWithMetadata => a.type === 'wallet'
        );
        if (!wallet?.address) {
          return NextResponse.json({ error: 'No wallet linked to this email' }, { status: 404 });
        }
        walletAddress = wallet.address;
      } catch {
        return NextResponse.json({ error: 'Failed to resolve email' }, { status: 500 });
      }
    }

    // 2. Fetch vendor profile — ONLY safe fields
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select(VENDOR_SELECT_CLAUSE)
      .ilike('wallet_address', walletAddress)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // 3. Fetch ratings
    const { data: ratingsData } = await supabaseAdmin
      .from('ratings')
      .select('stars')
      .ilike('rated_wallet_address', walletAddress);

    const ratingCount = ratingsData?.length ?? 0;
    const avgRating = ratingCount > 0
      ? ratingsData!.reduce((sum: number, r: any) => sum + r.stars, 0) / ratingCount
      : 0;

    // 4. Compute trust stats
    const trustStats = calculateTrustStats(profile);

    const serialized = serializeVendorProfile(profile);
    return NextResponse.json({
      vendor: {
        ...serialized,
        trust_score: trustStats?.score ?? 0,
        trust_level: trustStats?.level ?? 0,
        trust_title: trustStats?.title ?? 'Unknown',
        avg_rating: Math.round(avgRating * 10) / 10,
        rating_count: ratingCount,
      },
    });
  } catch (error: any) {
    console.error('Vendor lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// app/api/vendor/search/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { z } from 'zod';
import { calculateTrustStats } from '@/lib/trust';
import {
  VENDOR_SELECT_CLAUSE,
  serializeVendorProfile,
  haversineDistanceKm,
} from '@/lib/vendor-serializer';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SearchSchema = z.object({
  category: z.enum(['digital', 'physical', 'services']).optional(),
  subcategory: z.string().max(100).optional(),
  query: z.string().max(200).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export async function GET(req: Request) {
  // 1. Auth Guard — caller must be a logged-in TrustLink user
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
    const parsed = SearchSchema.safeParse({
      category: searchParams.get('category') || undefined,
      subcategory: searchParams.get('subcategory') || undefined,
      query: searchParams.get('query') || undefined,
      lat: searchParams.get('lat') || undefined,
      lng: searchParams.get('lng') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { category, subcategory, query, lat, lng } = parsed.data;

    // 2. Build query — only select safe fields
    let dbQuery = supabaseAdmin
      .from('profiles')
      .select(VENDOR_SELECT_CLAUSE)
      .eq('is_vendor', true);

    if (category) {
      dbQuery = dbQuery.eq('vendor_category', category);
    }

    if (subcategory) {
      dbQuery = dbQuery.ilike('vendor_subcategory', `%${subcategory}%`);
    }

    if (query) {
      // Search by business name or wallet address (never banking data)
      dbQuery = dbQuery.or(
        `business_name.ilike.%${query}%,wallet_address.ilike.%${query}%`
      );
    }

    const { data: vendors, error } = await dbQuery.limit(50);

    if (error) {
      console.error('Vendor search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    if (!vendors || vendors.length === 0) {
      return NextResponse.json({ vendors: [], total: 0 });
    }

    // 3. Fetch average ratings for all returned vendors
    const walletAddresses = vendors.map((v: any) => v.wallet_address);
    const { data: ratingsData } = await supabaseAdmin
      .from('ratings')
      .select('rated_wallet_address, stars')
      .in('rated_wallet_address', walletAddresses);

    const ratingMap = new Map<string, { sum: number; count: number }>();
    if (ratingsData) {
      for (const r of ratingsData) {
        const key = r.rated_wallet_address?.toLowerCase();
        if (!key) continue;
        const existing = ratingMap.get(key) || { sum: 0, count: 0 };
        existing.sum += r.stars;
        existing.count += 1;
        ratingMap.set(key, existing);
      }
    }

    // 4. Compute trust score + geo-distance + rating, then rank
    const enrichedVendors = vendors.map((vendor: any) => {
      const trustStats = calculateTrustStats(vendor);
      const trustScore = trustStats?.score ?? 0;

      const walletKey = vendor.wallet_address?.toLowerCase();
      const ratingInfo = ratingMap.get(walletKey);
      const avgRating = ratingInfo ? ratingInfo.sum / ratingInfo.count : 0;
      const ratingCount = ratingInfo?.count ?? 0;

      let distanceKm: number | undefined;
      if (lat !== undefined && lng !== undefined && vendor.location_lat && vendor.location_lng) {
        distanceKm = haversineDistanceKm(lat, lng, vendor.location_lat, vendor.location_lng);
      }

      // Blended ranking: 70% trust score (0-100) + 30% proximity (inverse distance, capped)
      const proximityScore = distanceKm !== undefined
        ? Math.max(0, 100 - distanceKm) // Closer = higher score, caps at 100km
        : 50; // Default for vendors without location
      const blendedScore = trustScore * 0.7 + proximityScore * 0.3;

      const serialized = serializeVendorProfile(vendor);
      return {
        ...serialized,
        trust_score: trustScore,
        trust_level: trustStats?.level ?? 0,
        trust_title: trustStats?.title ?? 'Unknown',
        avg_rating: Math.round(avgRating * 10) / 10,
        rating_count: ratingCount,
        distance_km: distanceKm !== undefined ? Math.round(distanceKm * 10) / 10 : null,
        _rank_score: blendedScore,
      };
    });

    // Sort by blended rank score (highest first)
    enrichedVendors.sort((a: any, b: any) => b._rank_score - a._rank_score);

    // Strip internal ranking score from response
    const results = enrichedVendors.map(({ _rank_score, ...rest }: any) => rest);

    return NextResponse.json({ vendors: results, total: results.length });
  } catch (error: any) {
    console.error('Vendor search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

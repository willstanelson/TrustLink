// lib/vendor-serializer.ts
// ─── Shared safe-field serializer for vendor/search and vendor/lookup ────────
// Both endpoints import this to ensure they can never drift and accidentally
// leak banking data (bank_code, account_number, account_name).

/**
 * The ONLY fields that are safe to return from a vendor profile query.
 * This is an allowlist — anything not listed here is stripped.
 */
export const VENDOR_PUBLIC_FIELDS = [
  'wallet_address',
  'business_name',
  'vendor_category',
  'vendor_subcategory',
  'is_vendor',
  'business_kyc_status',
  'nin_verified',
  'location_lat',
  'location_lng',
  'location_type',
  'current_trust_level',
  'lifetime_completed_tx',
  'lifetime_disputed_tx',
  'lifetime_volume_usd',
  'unique_buyers',
  'staked_amount_usd',
  'clean_streak_days',
  'kyc_completed',
  'created_at',
] as const;

/**
 * The Supabase .select() string — use this in all vendor queries
 * to ensure the database never even returns sensitive fields.
 */
export const VENDOR_SELECT_CLAUSE = VENDOR_PUBLIC_FIELDS.join(', ');

export type VendorPublicProfile = {
  wallet_address: string;
  business_name: string | null;
  vendor_category: 'digital' | 'physical' | 'services' | null;
  vendor_subcategory: string | null;
  is_vendor: boolean;
  business_kyc_status: 'unverified' | 'pending' | 'verified';
  nin_verified: boolean;
  location_lat: number | null;
  location_lng: number | null;
  location_type: 'fixed' | 'mobile';
  current_trust_level: number;
  lifetime_completed_tx: number;
  lifetime_disputed_tx: number;
  lifetime_volume_usd: number;
  unique_buyers: number;
  staked_amount_usd: number;
  clean_streak_days: number;
  kyc_completed: boolean;
  created_at: string;
  // Computed fields added at query time (not from DB)
  avg_rating?: number;
  rating_count?: number;
  distance_km?: number;
};

/**
 * Allowlist-only serializer. Even if the DB query accidentally returns
 * extra fields, this function strips them before the API response.
 */
export function serializeVendorProfile(profile: Record<string, any>): VendorPublicProfile {
  const result: Record<string, any> = {};
  for (const field of VENDOR_PUBLIC_FIELDS) {
    result[field] = profile[field] ?? null;
  }
  // Carry over computed fields if present
  if (profile.avg_rating !== undefined) result.avg_rating = profile.avg_rating;
  if (profile.rating_count !== undefined) result.rating_count = profile.rating_count;
  if (profile.distance_km !== undefined) result.distance_km = profile.distance_km;
  return result as VendorPublicProfile;
}

/**
 * Haversine formula — distance between two lat/lng points in kilometers.
 * Used at query time for geo-ranking, not stored in the score itself.
 */
export function haversineDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

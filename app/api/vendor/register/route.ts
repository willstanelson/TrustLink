// app/api/vendor/register/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getVerifiedWallet } from '@/lib/auth-helpers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RegisterSchema = z.object({
  vendor_category: z.enum(['digital', 'physical', 'services']),
  vendor_subcategory: z.string().min(1).max(100),
  business_name: z.string().max(200).optional().nullable(),
  location_lat: z.number().min(-90).max(90),
  location_lng: z.number().min(-180).max(180),
  location_type: z.enum(['fixed', 'mobile']).default('fixed'),
});

export async function POST(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);

    // 1. Check NIN verification — required before vendor registration
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('nin_verified, is_vendor')
      .ilike('wallet_address', callerWallet)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found. Complete KYC first.' },
        { status: 404 }
      );
    }

    if (!profile.nin_verified) {
      return NextResponse.json(
        { error: 'NIN verification required before vendor registration. Please verify your vNIN first.' },
        { status: 403 }
      );
    }

    if (profile.is_vendor) {
      return NextResponse.json(
        { error: 'You are already registered as a vendor.' },
        { status: 409 }
      );
    }

    // 2. Validate input
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { vendor_category, vendor_subcategory, business_name, location_lat, location_lng, location_type } = parsed.data;

    // 3. Update profile with vendor fields
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        is_vendor: true,
        vendor_category,
        vendor_subcategory,
        business_name: business_name || null,
        location_lat,
        location_lng,
        location_type,
        updated_at: new Date().toISOString(),
      })
      .ilike('wallet_address', callerWallet);

    if (updateError) {
      console.error('Vendor registration error:', updateError);
      return NextResponse.json({ error: 'Failed to register as vendor' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Vendor registration complete',
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No wallet found') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('Vendor registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

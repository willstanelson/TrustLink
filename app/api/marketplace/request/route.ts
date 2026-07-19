// app/api/marketplace/request/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getVerifiedWallet } from '@/lib/auth-helpers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CreateRequestSchema = z.object({
  seller_wallet_address: z.string().min(1),
  category: z.enum(['digital', 'physical', 'services']),
  subcategory: z.string().max(100).optional(),
  description: z.string().min(1).max(1000),
  proposed_amount: z.number().positive(),
});

// ── POST: Create a new marketplace request
export async function POST(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);
    const body = await req.json();
    const parsed = CreateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { seller_wallet_address, category, subcategory, description, proposed_amount } = parsed.data;

    // Prevent self-requests
    if (seller_wallet_address.toLowerCase() === callerWallet.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot create a request with yourself.' }, { status: 400 });
    }

    // Verify seller is a registered vendor
    const { data: sellerProfile } = await supabaseAdmin
      .from('profiles')
      .select('is_vendor')
      .ilike('wallet_address', seller_wallet_address)
      .single();

    if (!sellerProfile?.is_vendor) {
      return NextResponse.json({ error: 'The specified seller is not a registered vendor.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('marketplace_requests')
      .insert({
        buyer_wallet_address: callerWallet,
        seller_wallet_address: seller_wallet_address.toLowerCase(),
        category,
        subcategory: subcategory || null,
        description,
        proposed_amount,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Create request error:', error);
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }

    return NextResponse.json({ success: true, request_id: data.id });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No wallet found') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('Create request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET: List requests for the authenticated user
export async function GET(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);

    const { data, error } = await supabaseAdmin
      .from('marketplace_requests')
      .select('*')
      .or(`buyer_wallet_address.ilike.${callerWallet},seller_wallet_address.ilike.${callerWallet}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('List requests error:', error);
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    return NextResponse.json({ requests: data || [] });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No wallet found') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('List requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// app/api/marketplace/rate/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getVerifiedWallet } from '@/lib/auth-helpers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RatingSchema = z.object({
  order_id: z.number().int().positive(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);
    const body = await req.json();
    const parsed = RatingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { order_id, stars, comment } = parsed.data;

    // 1. Verify the order exists and is completed
    const { data: order, error: orderError } = await supabaseAdmin
      .from('escrow_orders')
      .select('id, status, buyer_wallet_address, seller_address, trade_type')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'completed') {
      return NextResponse.json({ error: 'Can only rate completed orders.' }, { status: 400 });
    }

    // 2. Verify the caller is the buyer on this order
    if (order.buyer_wallet_address?.toLowerCase() !== callerWallet.toLowerCase()) {
      return NextResponse.json({ error: 'Only the buyer can rate this order.' }, { status: 403 });
    }

    // 3. Determine who is being rated (the seller)
    const ratedWallet = order.seller_address?.toLowerCase();
    if (!ratedWallet) {
      return NextResponse.json({ error: 'Seller not found on this order.' }, { status: 400 });
    }

    // 4. Insert rating
    // The UNIQUE(order_id, rater_wallet_address) constraint prevents double-rating
    const { error: insertError } = await supabaseAdmin
      .from('ratings')
      .insert({
        order_id,
        rater_wallet_address: callerWallet,
        rated_wallet_address: ratedWallet,
        stars,
        comment: comment || null,
      });

    if (insertError) {
      // Postgres 23505 = unique_violation (duplicate rating)
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'You have already rated this order.' }, { status: 409 });
      }
      console.error('Rating insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 });
    }

    // NOTE: We do NOT touch lifetime_completed_tx or any trust counters here.
    // The existing release_escrow_and_update_reputation RPC already increments
    // those atomically when the escrow is released. Adding another increment
    // here would double-count every rated marketplace order.
    //
    // Ratings are stored independently and can be consumed by calculateTrustStats
    // in a future iteration (e.g., average rating as a scoring factor), but for
    // now they are a new data source that does not feed the existing formula.

    return NextResponse.json({ success: true, message: 'Rating saved' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No wallet found') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('Rating error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

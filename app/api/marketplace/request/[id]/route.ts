// app/api/marketplace/request/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getVerifiedWallet } from '@/lib/auth-helpers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ActionSchema = z.object({
  action: z.enum(['accept', 'reject', 'counter']),
  counter_amount: z.number().positive().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const callerWallet = await getVerifiedWallet(req);
    const { id } = await params;
    const requestId = parseInt(id, 10);

    if (isNaN(requestId)) {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = ActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { action, counter_amount } = parsed.data;

    // Fetch the request to verify ownership
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('marketplace_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Only the seller can accept/reject/counter
    if (request.seller_wallet_address.toLowerCase() !== callerWallet.toLowerCase()) {
      return NextResponse.json({ error: 'Only the seller can respond to this request.' }, { status: 403 });
    }

    // Validate current status allows this action
    if (!['pending', 'countered'].includes(request.status)) {
      return NextResponse.json(
        { error: `Request is in '${request.status}' state and cannot be modified.` },
        { status: 400 }
      );
    }

    // ── REJECT
    if (action === 'reject') {
      const { error } = await supabaseAdmin
        .from('marketplace_requests')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    // ── COUNTER
    if (action === 'counter') {
      if (!counter_amount) {
        return NextResponse.json({ error: 'counter_amount required for counter action' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('marketplace_requests')
        .update({
          status: 'countered',
          counter_amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
      return NextResponse.json({ success: true, status: 'countered', counter_amount });
    }

    // ── ACCEPT — atomic via Postgres function
    if (action === 'accept') {
      const finalAmount = request.counter_amount ?? request.proposed_amount;

      const { data: orderId, error: rpcError } = await supabaseAdmin.rpc(
        'accept_request_and_create_order',
        {
          p_request_id: requestId,
          p_seller_wallet: callerWallet,
          p_buyer_wallet: request.buyer_wallet_address,
          p_amount: finalAmount,
          p_category: request.category,
          p_subcategory: request.subcategory,
        }
      );

      if (rpcError) {
        console.error('Accept request RPC error:', rpcError);
        return NextResponse.json(
          { error: rpcError.message || 'Failed to accept request and create order' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        status: 'accepted',
        escrow_order_id: orderId,
        amount: finalAmount,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No wallet found') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('Request action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/auth-helpers';
import { getVerifiedWallet } from '@/lib/auth-helpers';
import { getNormalizedUSD } from '@/lib/rates';

export async function POST(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);
    const { orderId } = await req.json();

    const { data: order } = await supabaseAdmin
      .from('escrow_orders')
      .select('status, seller_address, currency, fiat_amount, crypto_amount, code_revealed_at')
      .eq('id', orderId)
      .single();
    
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.seller_address.toLowerCase() !== callerWallet) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    if (order.status !== 'code_revealed') return NextResponse.json({ error: 'Order is not pending buyer redemption' }, { status: 400 });

    // Ensure the timestamp exists to prevent Epoch zero-day bypass
    if (!order.code_revealed_at) {
      return NextResponse.json({ error: 'Code reveal timestamp is missing' }, { status: 400 });
    }

    const revealedTime = new Date(order.code_revealed_at).getTime();
    if (Date.now() - revealedTime < 2 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Timer has not expired yet' }, { status: 403 });
    }

    const normalizedUSD = await getNormalizedUSD(order);

    const { error: rpcError } = await supabaseAdmin.rpc('release_escrow_and_update_reputation', {
      p_order_id: orderId,
      p_normalized_usd: normalizedUSD
    });

    if (rpcError) throw rpcError;

    return NextResponse.json({ success: true, message: 'Force release successful', volumeAddedUSD: normalizedUSD });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
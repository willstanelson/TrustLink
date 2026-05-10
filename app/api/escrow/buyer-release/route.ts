import { NextResponse } from 'next/server';
import { supabaseAdmin, getVerifiedWallet } from '@/lib/auth-helpers';
import { getNormalizedUSD } from '@/lib/rates';

export async function POST(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);
    const { orderId } = await req.json();

    const { data: order } = await supabaseAdmin.from('escrow_orders').select('status, buyer_wallet_address, currency, fiat_amount, crypto_amount').eq('id', orderId).single();
    
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.buyer_wallet_address.toLowerCase() !== callerWallet) return NextResponse.json({ error: 'Unauthorized: Only buyer can release' }, { status: 403 });
    if (order.status !== 'code_revealed') return NextResponse.json({ error: 'Order is not in a releasable state' }, { status: 400 });

    const normalizedUSD = await getNormalizedUSD(order);
    const { error: rpcError } = await supabaseAdmin.rpc('release_escrow_and_update_reputation', { p_order_id: orderId, p_normalized_usd: normalizedUSD });

    if (rpcError) throw rpcError;
    return NextResponse.json({ success: true, message: 'Released successfully', volumeAddedUSD: normalizedUSD });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
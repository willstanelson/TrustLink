import { NextResponse } from 'next/server';
import { supabaseAdmin, getVerifiedWallet } from '@/lib/auth-helpers';

export async function POST(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);
    const { orderId } = await req.json();

    const { data: order } = await supabaseAdmin.from('escrow_orders').select('*').eq('id', orderId).single();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (order.buyer_wallet_address.toLowerCase() !== callerWallet && order.seller_address.toLowerCase() !== callerWallet) {
      return NextResponse.json({ error: 'Unauthorized: You are not a participant' }, { status: 403 });
    }
    return NextResponse.json(order);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
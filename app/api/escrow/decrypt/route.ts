import { NextResponse } from 'next/server';
import { supabaseAdmin, getVerifiedWallet } from '@/lib/auth-helpers';
import { decryptGiftCard } from '@/lib/encryption';

export async function POST(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);
    const { orderId } = await req.json();

    const { data: order } = await supabaseAdmin.from('escrow_orders').select('buyer_wallet_address, status, gift_card_code').eq('id', orderId).single();

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.buyer_wallet_address.toLowerCase() !== callerWallet) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    if (order.status !== 'code_revealed') return NextResponse.json({ error: 'Code is not revealed yet' }, { status: 400 });
    if (!order.gift_card_code) return NextResponse.json({ error: 'Gift card data missing' }, { status: 404 });

    const plainTextCode = decryptGiftCard(order.gift_card_code);
    return NextResponse.json({ success: true, code: plainTextCode });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
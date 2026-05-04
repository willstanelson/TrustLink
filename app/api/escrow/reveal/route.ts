import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getVerifiedWallet } from '@/lib/auth-helpers'; // Assuming you kept this helper
import { encryptGiftCard } from '@/lib/encryption';

export async function POST(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);
    const { orderId, plainTextCode } = await req.json();

    if (!plainTextCode) return NextResponse.json({ error: 'Code is required' }, { status: 400 });

    const { data: order } = await supabaseAdmin
      .from('escrow_orders')
      .select('seller_address, status')
      .eq('id', orderId)
      .single();

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.seller_address.toLowerCase() !== callerWallet) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    if (order.status !== 'locked') return NextResponse.json({ error: 'Order must be locked to reveal code' }, { status: 400 });

    const encryptedCode = encryptGiftCard(plainTextCode);

    const { error } = await supabaseAdmin
      .from('escrow_orders')
      .update({ 
        gift_card_code: encryptedCode,
        status: 'code_revealed',
        code_revealed_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) throw error;
    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
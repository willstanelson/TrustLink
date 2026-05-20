import { NextResponse } from 'next/server';
import { supabaseAdmin, getVerifiedIdentity } from '@/lib/auth-helpers';

export async function POST(req: Request) {
  try {
    const { wallet: callerWallet, email: callerEmail } = await getVerifiedIdentity(req);
    
    const body = await req.json();
    const orderId = parseInt(body.order_id, 10);
    
    if (isNaN(orderId) || orderId <= 0) {
      return NextResponse.json({ status: false, message: 'Invalid order ID format' }, { status: 400 });
    }

    const { data: order, error: fetchError } = await supabaseAdmin
      .from('escrow_orders')
      .select('status, buyer_wallet_address, buyer_email')
      .eq('id', orderId)
      .eq('trade_type', 'GIFT_CARD')
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ status: false, message: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'accepted' && order.status !== 'shipped') {
      return NextResponse.json({ status: false, message: `Cannot release. Current status is: ${order.status}` }, { status: 400 });
    }

    // 🚀 THE FIX: Flexible Identity Matching
    const orderWallet = order.buyer_wallet_address?.toLowerCase();
    const orderEmail  = order.buyer_email?.toLowerCase();
    const activeWallet = callerWallet?.toLowerCase();
    const activeEmail  = callerEmail?.toLowerCase();

    let isAuthorized = false;
    if (orderWallet && activeWallet && orderWallet === activeWallet) isAuthorized = true;
    if (orderEmail && activeEmail && orderEmail === activeEmail) isAuthorized = true;

    if (!isAuthorized) {
      return NextResponse.json({ status: false, message: 'Unauthorized: Identity does not match the buyer' }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('escrow_orders')
      .update({ status: 'completed' })
      .eq('id', orderId)
      .eq('status', order.status); 

    if (updateError) throw updateError;
    
    return NextResponse.json({ status: true });
    
  } catch (err: any) {
    console.error('Release GC Error:', err.message);
    // 🚀 THE FIX: Catch Privy token expirations and return a 401 instead of a 500
    if (err.message.includes('jwt expired') || err.message === 'Unauthorized' || err.message.includes('token')) {
      return NextResponse.json({ status: false, message: 'Session expired. Please log in again.' }, { status: 401 });
    }
    return NextResponse.json({ status: false, message: 'An internal error occurred while releasing the order' }, { status: 500 });
  }
}
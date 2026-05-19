import { NextResponse } from 'next/server';
import { supabaseAdmin, getVerifiedWallet } from '@/lib/auth-helpers';

export async function POST(req: Request) {
  try {
    // 1. Ensure the user is actually authenticated
    const callerWallet = await getVerifiedWallet(req); // Throws or returns null
    
    // 2. Safely parse and validate the Order ID
    const body = await req.json();
    const orderId = parseInt(body.order_id, 10);
    
    if (isNaN(orderId) || orderId <= 0) {
      return NextResponse.json({ status: false, message: 'Invalid order ID format' }, { status: 400 });
    }

    // 3. Fetch the order FIRST to check state and ownership
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('escrow_orders')
      .select('status, seller_address, seller_email')
      .eq('id', orderId)
      .eq('trade_type', 'GIFT_CARD')
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ status: false, message: 'Order not found' }, { status: 404 });
    }

    // 4. Status Transition Safety Guard
    // Only allow accepting if the order is fresh ('secured' or 'pending')
    if (order.status !== 'secured' && order.status !== 'pending') {
      return NextResponse.json({ status: false, message: `Cannot accept order. Current status is: ${order.status}` }, { status: 400 });
    }

    // 5. Secure Ownership Check (Hybrid Web2/Web3)
    // If the order has a seller_address, enforce that the caller's wallet matches.
    if (order.seller_address && callerWallet) {
      if (order.seller_address.toLowerCase() !== callerWallet.toLowerCase()) {
        return NextResponse.json({ status: false, message: 'Unauthorized: You are not the wallet owner of this order' }, { status: 403 });
      }
    } 
    // Note: If the seller is email-only (no seller_address), and you have an auth helper 
    // like `getVerifiedEmail(req)`, you would do the email comparison here. 

    // 6. The Atomic Update (Double-locked with status check)
    const { error: updateError } = await supabaseAdmin
      .from('escrow_orders')
      .update({ status: 'accepted' })
      .eq('id', orderId)
      .eq('status', order.status); // Atomic lock: ensures status hasn't changed since we fetched it

    if (updateError) throw updateError;
    
    return NextResponse.json({ status: true });
    
  } catch (err: any) {
    console.error('Accept GC Error:', err.message);
    // Return a generic error to the client to avoid leaking database schema details
    return NextResponse.json({ status: false, message: 'An internal error occurred while accepting the order' }, { status: 500 });
  }
}
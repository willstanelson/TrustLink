// app/api/user/action/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { createClient } from '@supabase/supabase-js';

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  // 1. Verify the user's Privy token
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  let userId;
  try {
    const verified = await privy.verifyAuthToken(token);
    userId = verified.userId;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 2. Get the user's email and wallet address from Privy
  const user = await privy.getUser(userId);
  const userEmail = (user.email?.address || (user as any).google?.email || '').toLowerCase();
  const userWallet = (user.wallet?.address || '').toLowerCase();

  const linkedWallets: string[] = (user.linkedAccounts || [])
    .filter((a: any) => a.type === 'wallet' && a.address)
    .map((a: any) => a.address.toLowerCase());
  if (userWallet && !linkedWallets.includes(userWallet)) {
    linkedWallets.push(userWallet);
  }

  const linkedEmails: string[] = (user.linkedAccounts || [])
    .filter((a: any) => (a.type === 'email' || a.type === 'google') && (a.address || a.email))
    .map((a: any) => (a.address || a.email).toLowerCase());
  if (userEmail && !linkedEmails.includes(userEmail)) {
    linkedEmails.push(userEmail);
  }

  if (linkedEmails.length === 0 && linkedWallets.length === 0) {
    return NextResponse.json({ error: 'User identity not found' }, { status: 400 });
  }

  // 3. Process the action
  try {
    const body = await req.json();
    const { actionType, orderId, payload } = body;

    // VERY IMPORTANT: Verify the user is actually involved in this order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('escrow_orders')
      .select('buyer_email, buyer_wallet_address, seller_email, seller_address, status, amount, released_amount')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      throw new Error('Order not found');
    }

    const buyerEmail = order.buyer_email?.toLowerCase();
    const buyerWallet = order.buyer_wallet_address?.toLowerCase();
    const sellerEmail = order.seller_email?.toLowerCase();
    const sellerWallet = order.seller_address?.toLowerCase();

    const isBuyer = (buyerWallet && linkedWallets.includes(buyerWallet)) || 
                    (buyerEmail && linkedEmails.includes(buyerEmail));
    const isSeller = (sellerWallet && linkedWallets.includes(sellerWallet)) || 
                     (sellerEmail && linkedEmails.includes(sellerEmail));

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'You are not authorized to modify this order' }, { status: 403 });
    }

    // Process specific actions
    if (actionType === 'ACCEPT' || actionType === 'SHIP') {
      if (!isSeller) throw new Error('Only the seller can perform this action');
      
      const newStatus = actionType === 'ACCEPT' ? 'accepted' : 'shipped';
      const { error } = await supabaseAdmin
        .from('escrow_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'FIAT_RELEASE') {
      if (!isBuyer) throw new Error('Only the buyer can release funds');
      
      const releaseAmount = Number(payload?.releaseAmount || 0);
      const isPartial = !!payload?.isPartial;
      const prevReleased = Number(order.released_amount || 0);
      const totalAmount = Number(order.amount || 0);

      const newReleasedAmount = isPartial ? prevReleased + releaseAmount : (releaseAmount || totalAmount);
      const isFull = totalAmount > 0 && newReleasedAmount >= totalAmount;
      const newStatus = isFull ? 'processing_payout' : 'partially_released';

      const { error } = await supabaseAdmin
        .from('escrow_orders')
        .update({ 
          status: newStatus,
          released_amount: newReleasedAmount
        })
        .eq('id', orderId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'RELEASE' || actionType === 'CRYPTO_RELEASE') {
      if (!isBuyer) throw new Error('Only the buyer can release escrow funds');

      const releaseAmount = payload?.releaseAmount ? Number(payload.releaseAmount) : Number(order.amount || 0);
      const isPartial = !!payload?.isPartial;
      const prevReleased = Number(order.released_amount || 0);
      const totalAmount = Number(order.amount || 0);

      const newReleasedAmount = isPartial ? prevReleased + releaseAmount : (releaseAmount || totalAmount);
      const isFull = !isPartial || (totalAmount > 0 && newReleasedAmount >= totalAmount);
      const newStatus = isFull ? 'completed' : 'partially_released';

      const { error } = await supabaseAdmin
        .from('escrow_orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          released_amount: newReleasedAmount,
        })
        .eq('id', orderId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, status: newStatus, released_amount: newReleasedAmount });
    }

    if (actionType === 'DISPUTE') {
      const { error } = await supabaseAdmin
        .from('escrow_orders')
        .update({ status: 'disputed' })
        .eq('id', orderId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'CANCEL') {
      if (!isBuyer) throw new Error('Only the buyer can cancel an unaccepted order');
      const currentStatus = String(order.status || '').toLowerCase();
      if (['accepted', 'shipped', 'completed', 'success', 'disputed'].includes(currentStatus)) {
        throw new Error('Cannot cancel order after work or delivery has begun');
      }
      const { error } = await supabaseAdmin
        .from('escrow_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
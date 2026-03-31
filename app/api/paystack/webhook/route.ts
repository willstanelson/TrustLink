import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ✅ Service role key — bypasses RLS, safe ONLY in backend routes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Whitelist of events we handle — everything else is silently ignored
const HANDLED_EVENTS = new Set([
  'charge.success',
  'transfer.success',
  'transfer.failed',
  'transfer.reversed',
]);

export async function POST(req: Request) {
  try {
    // 1. Read raw body BEFORE parsing — required for accurate signature verification
    const rawBody = await req.text();

    // 2. Verify Paystack signature
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) {
      console.error("[Webhook] Missing x-paystack-signature header");
      return NextResponse.json({ status: false, message: 'Missing signature' }, { status: 400 });
    }

    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.error("[Webhook] Signature mismatch — possible spoofed request");
      return NextResponse.json({ status: false, message: 'Invalid signature' }, { status: 401 });
    }

    // 3. Parse verified payload
    const event = JSON.parse(rawBody);
    const eventType: string = event.event;
    const data = event.data;

    // 4. Ignore unhandled events — return 200 so Paystack stops retrying them
    if (!HANDLED_EVENTS.has(eventType)) {
      console.log(`[Webhook] Ignored unhandled event: ${eventType}`);
      return NextResponse.json({ status: true, message: 'Event ignored' });
    }

    console.log(`[Webhook] Processing event: ${eventType}`);

    // -------------------------------------------------------------------------
    // EVENT: charge.success — Buyer paid, move order from awaiting_payment → accepted
    // -------------------------------------------------------------------------
    if (eventType === 'charge.success') {
      const reference = data.reference;

      if (!reference) {
        console.error("[Webhook] charge.success missing reference");
        return NextResponse.json({ status: true, message: 'Missing reference, ignored' });
      }

      // Fetch order for idempotency check
      const { data: order, error: fetchError } = await supabase
        .from('escrow_orders')
        .select('id, status')
        .eq('paystack_ref', reference)
        .single();

      if (fetchError || !order) {
        console.error(`[Webhook] Order not found for reference: ${reference}`);
        // Return 200 — no point Paystack retrying for an order that doesn't exist
        return NextResponse.json({ status: true, message: 'Order not found, ignored' });
      }

      // ✅ Case-insensitive check — handles 'AWAITING_PAYMENT' and 'awaiting_payment'
      if (order.status.toUpperCase() !== 'AWAITING_PAYMENT') {
        console.log(`[Webhook] Order ${order.id} already processed (status: ${order.status}). Skipping.`);
        return NextResponse.json({ status: true, message: 'Already processed' });
      }

      const { error: updateError } = await supabase
        .from('escrow_orders')
        .update({ status: 'accepted' })
        .eq('paystack_ref', reference);

      if (updateError) {
        console.error(`[Webhook] DB update failed for charge.success (ref: ${reference}):`, updateError);
        // Return 500 so Paystack retries
        return NextResponse.json({ status: false, message: 'DB update failed' }, { status: 500 });
      }

      console.log(`[Webhook] ✅ Order ${order.id} marked as accepted.`);
    }

    // -------------------------------------------------------------------------
    // EVENT: transfer.success — Paystack confirmed money reached seller's bank
    // -------------------------------------------------------------------------
    if (eventType === 'transfer.success') {
      const transferCode = data.transfer_code;
      const reason: string = data.reason || '';

      // We embed the orderId in the transfer reason: "TrustLink Escrow Release (Order NGN-123)"
      const orderIdMatch = reason.match(/Order NGN-(\d+)/);

      if (!orderIdMatch) {
        console.warn(`[Webhook] transfer.success has no recognizable order ID in reason: "${reason}"`);
        return NextResponse.json({ status: true, message: 'No order ID in reason, ignored' });
      }

      const orderId = Number(orderIdMatch[1]);

      // Idempotency check
      const { data: order, error: fetchError } = await supabase
        .from('escrow_orders')
        .select('id, status')
        .eq('id', orderId)
        .single();

      if (fetchError || !order) {
        console.error(`[Webhook] Order ${orderId} not found for transfer.success`);
        return NextResponse.json({ status: true, message: 'Order not found, ignored' });
      }

      if (order.status.toUpperCase() === 'TRANSFER_CONFIRMED') {
        console.log(`[Webhook] Order ${orderId} transfer already confirmed. Skipping.`);
        return NextResponse.json({ status: true, message: 'Already confirmed' });
      }

      const { error: updateError } = await supabase
        .from('escrow_orders')
        .update({
          transfer_status: 'confirmed',
          transfer_code: transferCode,
          transfer_confirmed_at: new Date().toISOString(),
          pending_release_amount: 0, // ✅ Clean up pending amount on success
        })
        .eq('id', orderId);

      if (updateError) {
        console.error(`[Webhook] DB update failed for transfer.success (order: ${orderId}):`, updateError);
        return NextResponse.json({ status: false, message: 'DB update failed' }, { status: 500 });
      }

      console.log(`[Webhook] ✅ Transfer confirmed for order ${orderId}.`);
    }

    // -------------------------------------------------------------------------
    // EVENT: transfer.failed — Transfer rejected, seller did NOT get paid
    // -------------------------------------------------------------------------
    if (eventType === 'transfer.failed') {
      const reason: string = data.reason || '';
      const orderIdMatch = reason.match(/Order NGN-(\d+)/);

      if (!orderIdMatch) {
        console.warn(`[Webhook] transfer.failed has no recognizable order ID in reason: "${reason}"`);
        return NextResponse.json({ status: true, message: 'No order ID in reason, ignored' });
      }

      const orderId = Number(orderIdMatch[1]);

      const { data: order, error: fetchError } = await supabase
        .from('escrow_orders')
        .select('id, status, released_amount, pending_release_amount')
        .eq('id', orderId)
        .single();

      if (fetchError || !order) {
        console.error(`[Webhook] Order ${orderId} not found for transfer.failed`);
        return NextResponse.json({ status: true, message: 'Order not found, ignored' });
      }

      // ✅ Rollback engine — subtract the exact amount that failed, never go below 0
      const pendingAmount = Number(order.pending_release_amount || 0);
      const rolledBackAmount = Math.max(0, Number(order.released_amount) - pendingAmount);

      const { error: updateError } = await supabase
        .from('escrow_orders')
        .update({
          status: 'transfer_failed',
          transfer_status: 'failed',
          released_amount: rolledBackAmount, // ✅ Accurate rollback
          release_in_progress: false,         // Unlock so retry is possible
          pending_release_amount: 0,          // Clear pending
        })
        .eq('id', orderId);

      if (updateError) {
        console.error(`[Webhook] DB update failed for transfer.failed (order: ${orderId}):`, updateError);
        return NextResponse.json({ status: false, message: 'DB update failed' }, { status: 500 });
      }

      // 🚨 Seller was not paid — needs attention
      console.error(`[Webhook] 🚨 TRANSFER FAILED for order ${orderId}. Rolled back ₦${pendingAmount.toLocaleString()}. Manual review required!`);
    }

    // -------------------------------------------------------------------------
    // EVENT: transfer.reversed — Bank reversed after transfer appeared successful
    // This is the most critical failure — money left your account then came back
    // -------------------------------------------------------------------------
    if (eventType === 'transfer.reversed') {
      const reason: string = data.reason || '';
      const orderIdMatch = reason.match(/Order NGN-(\d+)/);

      if (!orderIdMatch) {
        console.warn(`[Webhook] transfer.reversed has no recognizable order ID in reason: "${reason}"`);
        return NextResponse.json({ status: true, message: 'No order ID in reason, ignored' });
      }

      const orderId = Number(orderIdMatch[1]);

      // ✅ Must fetch order first to get released_amount and pending_release_amount for rollback
      const { data: order, error: fetchError } = await supabase
        .from('escrow_orders')
        .select('id, status, released_amount, pending_release_amount')
        .eq('id', orderId)
        .single();

      if (fetchError || !order) {
        console.error(`[Webhook] Order ${orderId} not found for transfer.reversed`);
        return NextResponse.json({ status: true, message: 'Order not found, ignored' });
      }

      // ✅ Same rollback logic as transfer.failed — reversal means seller didn't get paid
      const pendingAmount = Number(order.pending_release_amount || 0);
      const rolledBackAmount = Math.max(0, Number(order.released_amount) - pendingAmount);

      const { error: updateError } = await supabase
        .from('escrow_orders')
        .update({
          status: 'transfer_reversed',
          transfer_status: 'reversed',
          released_amount: rolledBackAmount, // ✅ Fixed — was missing in your version
          release_in_progress: false,
          pending_release_amount: 0,
        })
        .eq('id', orderId);

      if (updateError) {
        console.error(`[Webhook] DB update failed for transfer.reversed (order: ${orderId}):`, updateError);
        return NextResponse.json({ status: false, message: 'DB update failed' }, { status: 500 });
      }

      // 🚨 Highest severity — seller appeared paid but money returned
      console.error(`[Webhook] 🚨 TRANSFER REVERSED for order ${orderId}. Rolled back ₦${pendingAmount.toLocaleString()}. URGENT review required!`);
    }

    // 5. Always return 200 so Paystack doesn't retry
    return NextResponse.json({ status: true, message: 'Webhook processed successfully' });

  } catch (error: any) {
    console.error("[Webhook] Unhandled error:", error);
    // 500 tells Paystack to retry — only reached for truly unexpected errors
    return NextResponse.json({ status: false, message: error.message }, { status: 500 });
  }
}

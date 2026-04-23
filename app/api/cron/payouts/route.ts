import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')?.trim();
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { data: pendingOrders, error: fetchError } = await supabaseAdmin
      .from('escrow_orders')
      .select('*')
      .eq('status', 'processing_payout')
      .limit(50);

    if (fetchError) throw fetchError;
    if (!pendingOrders?.length) {
      return NextResponse.json({ message: 'No pending payouts.' });
    }

    const results: any[] = [];

    for (const order of pendingOrders) {
      try {
        let recipientCode = order.paystack_recipient_code;

        // A. Create recipient if not exists
        if (!recipientCode) {
          const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'nuban',
              name: order.seller_name?.trim(),
              account_number: order.seller_number,
              bank_code: order.seller_bank,
              currency: 'NGN',
            }),
          });

          const recipientData = await recipientRes.json();

          if (!recipientData.status) {
            throw new Error(`Recipient failed: ${recipientData.message}`);
          }

          recipientCode = recipientData.data.recipient_code;

          await supabaseAdmin
            .from('escrow_orders')
            .update({ paystack_recipient_code: recipientCode })
            .eq('id', order.id);
        }

        // B. Calculate amount FIRST
        const amountInKobo = Math.round(Number(order.released_amount) * 100);
        if (isNaN(amountInKobo) || amountInKobo <= 0) {
          throw new Error('Invalid payout amount');
        }

        // C. Generate or reuse reference (safe format)
        let reference = order.paystack_transfer_reference;

        if (!reference) {
          reference = `payout_${String(order.id).toLowerCase()}_${Date.now()}`;
          // Ensure it meets Paystack rules (min 16 chars, allowed chars)
          if (reference.length < 16) {
            reference += `_${Math.random().toString(36).slice(2)}`;
          }

          // Save reference BEFORE calling Paystack (idempotency)
          await supabaseAdmin
            .from('escrow_orders')
            .update({ paystack_transfer_reference: reference })
            .eq('id', order.id);
        }

        // D. Execute Transfer
        const transferRes = await fetch('https://api.paystack.co/transfer', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: 'balance',
            amount: amountInKobo,
            recipient: recipientCode,
            reason: `TrustLink Escrow Payout (Order #${order.id})`,
            reference,
          }),
        });

        const transferData = await transferRes.json();

        if (!transferData.status) {
          throw new Error(transferData.message || 'Transfer initiation failed');
        }

        // E. Mark as completed (or 'payout_initiated' if using webhooks)
        await supabaseAdmin
          .from('escrow_orders')
          .update({ 
            status: 'completed',
            paystack_transfer_reference: reference 
          })
          .eq('id', order.id);

        results.push({ id: order.id, status: 'success', reference });

      } catch (err: any) {
        console.error(`Payout failed for order ${order.id}:`, err.message);

        await supabaseAdmin
          .from('escrow_orders')
          .update({ 
            last_payout_error: err.message?.slice(0, 500), // prevent too long text
            // Optionally: increment attempt count here
          })
          .eq('id', order.id);

        results.push({ id: order.id, status: 'failed', reason: err.message });
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: results.length, 
      details: results 
    });

  } catch (error: any) {
    console.error("Cron Execution Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
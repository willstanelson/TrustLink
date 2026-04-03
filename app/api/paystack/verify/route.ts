import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// God-Mode Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables for Supabase.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

function isValidReference(ref: unknown): ref is string {
  return typeof ref === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(ref);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reference } = body as Record<string, unknown>;

    if (!isValidReference(reference)) {
      return NextResponse.json(
        { status: false, message: 'Invalid payment reference.' },
        { status: 400 }
      );
    }

    const { data: existingOrder, error: fetchError } = await supabaseAdmin
      .from('escrow_orders')
      .select('id, status, amount') 
      .eq('paystack_ref', reference)
      .maybeSingle();

    if (fetchError || !existingOrder) {
      return NextResponse.json(
        { status: false, message: 'Order not found.' },
        { status: 404 }
      );
    }

    // Idempotency check
    if (existingOrder.status !== 'awaiting_payment') {
      return NextResponse.json({
        status: true,
        message: 'Order already verified.',
        data: { orderStatus: existingOrder.status },
      });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      }
    );

    const paystackData = await paystackRes.json();

    if (!paystackData?.data) {
      console.error('[Verify] Malformed Paystack response:', paystackData);
      return NextResponse.json(
        { status: false, message: 'Invalid response from payment provider.' },
        { status: 502 }
      );
    }

    const paystackStatus: string = paystackData.data.status ?? 'unknown';

    // Partial Payment Guard
    const amountPaidInKobo: number = paystackData.data.amount ?? 0;
    const expectedAmountInKobo = Math.round(existingOrder.amount * 100);

    if (paystackStatus === 'success' && amountPaidInKobo < expectedAmountInKobo) {
      console.error(
        `[Verify] Amount mismatch for ref ${reference}. Expected: ${expectedAmountInKobo}, Got: ${amountPaidInKobo}`
      );
      return NextResponse.json(
        { status: false, message: 'Payment amount mismatch. Possible partial payment detected.' },
        { status: 402 }
      );
    }

    // Maps Paystack 'success' to TrustLink 'accepted'
    const statusMap: Record<string, string> = {
      success: 'accepted',
      failed: 'failed',
      abandoned: 'abandoned',
    };

    const newStatus = statusMap[paystackStatus];

    if (!newStatus) {
      console.warn(`[Verify] Unhandled Paystack status: ${paystackStatus} for ref ${reference}`);
      return NextResponse.json({
        status: false,
        message: `Unhandled payment status: ${paystackStatus}`,
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from('escrow_orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('paystack_ref', reference)
      .eq('status', existingOrder.status);

    if (updateError) {
      console.error('[Verify] DB update error:', updateError);
      return NextResponse.json(
        { status: false, message: 'DB update failed.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: paystackStatus === 'success',
      message: `Payment verified. Order is now ${newStatus}.`,
      data: { reference },
    });
  } catch (error: any) {
    console.error('[Verify] Error:', error);
    return NextResponse.json({ status: false, message: error.message }, { status: 500 });
  }
}
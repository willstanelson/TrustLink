import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Admin client — uses service role key to bypass RLS.
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY'
  );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isValidReference(ref: unknown): ref is string {
  return typeof ref === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(ref);
}

// ---------------------------------------------------------------------------
// POST /api/paystack/verify
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { status: false, message: 'Invalid JSON body.' },
        { status: 400 }
      );
    }

    const { reference } = body as Record<string, unknown>;

    if (!isValidReference(reference)) {
      return NextResponse.json(
        { status: false, message: 'Missing or invalid payment reference.' },
        { status: 400 }
      );
    }

    const { data: existingOrder, error: fetchError } = await supabaseAdmin
      .from('escrow_orders')
      .select('id, status')
      .eq('paystack_ref', reference)
      .maybeSingle();

    if (fetchError) {
      console.error('[Verify] DB fetch error:', fetchError);
      return NextResponse.json(
        { status: false, message: 'Could not retrieve order.' },
        { status: 500 }
      );
    }

    if (!existingOrder) {
      return NextResponse.json(
        { status: false, message: 'Order not found.' },
        { status: 404 }
      );
    }

    const terminalStatuses = ['success', 'failed', 'abandoned'];
    if (terminalStatuses.includes(existingOrder.status)) {
      return NextResponse.json({
        status: existingOrder.status === 'success',
        message: 'Order already finalised.',
        data: { orderStatus: existingOrder.status },
      });
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      throw new Error('Missing PAYSTACK_SECRET_KEY environment variable.');
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (!paystackRes.ok) {
      console.error('[Verify] Paystack HTTP error:', paystackRes.status);
      return NextResponse.json(
        { status: false, message: 'Payment gateway error. Please try again.' },
        { status: 502 }
      );
    }

    const paystackData = await paystackRes.json();
    const paystackStatus: string = paystackData.data?.status ?? 'unknown';

    const statusMap: Record<string, string> = {
      success: 'success',
      failed: 'failed',
      abandoned: 'abandoned',
    };

    const newStatus = statusMap[paystackStatus];

    if (!newStatus) {
      return NextResponse.json({
        status: false,
        message: `Unhandled Paystack status: ${paystackStatus}`,
        data: paystackData.data,
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
        { status: false, message: 'Failed to update order status.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: newStatus === 'success',
      message: `Payment ${newStatus}.`,
      data: {
        reference,
        orderStatus: newStatus,
        amount: paystackData.data?.amount,
        currency: paystackData.data?.currency,
        paidAt: paystackData.data?.paid_at,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    console.error('[Verify] Unhandled error:', error);
    return NextResponse.json({ status: false, message }, { status: 500 });
  }
}
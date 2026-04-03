import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing environment variables for Supabase.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(process.env.RESEND_API_KEY);

function isValidReference(ref: unknown): ref is string {
  return typeof ref === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(ref);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reference } = body as Record<string, unknown>;

    if (!isValidReference(reference)) {
      return NextResponse.json({ status: false, message: 'Invalid reference.' }, { status: 400 });
    }

    // 🚀 We now fetch the seller_email so we can send the notification!
    const { data: existingOrder, error: fetchError } = await supabaseAdmin
      .from('escrow_orders')
      .select('id, status, amount, seller_email')
      .eq('paystack_ref', reference)
      .maybeSingle();

    if (fetchError || !existingOrder) {
      return NextResponse.json({ status: false, message: 'Order not found.' }, { status: 404 });
    }

    if (existingOrder.status !== 'awaiting_payment') {
      return NextResponse.json({
        status: true,
        message: 'Order already verified.',
        data: { orderStatus: existingOrder.status },
      });
    }

    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });

    const paystackData = await paystackRes.json();
    if (!paystackData?.data) {
      return NextResponse.json({ status: false, message: 'Invalid response from Paystack.' }, { status: 502 });
    }

    const paystackStatus: string = paystackData.data.status ?? 'unknown';
    const amountPaidInKobo = paystackData.data.amount ?? 0;
    const expectedAmountInKobo = Math.round(existingOrder.amount * 100);

    if (paystackStatus === 'success' && amountPaidInKobo < expectedAmountInKobo) {
      return NextResponse.json({ status: false, message: 'Partial payment detected.' }, { status: 402 });
    }

    // 🚀 THE HARMONY FIX: Paystack success means the funds are "secured"
    const statusMap: Record<string, string> = {
      success: 'secured', 
      failed: 'failed',
      abandoned: 'abandoned',
    };

    const newStatus = statusMap[paystackStatus];

    if (!newStatus) return NextResponse.json({ status: false, message: `Unhandled status: ${paystackStatus}` });

    const { error: updateError } = await supabaseAdmin
      .from('escrow_orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('paystack_ref', reference)
      .eq('status', existingOrder.status);

    if (updateError) return NextResponse.json({ status: false, message: 'DB update failed.' }, { status: 500 });

    // 🚀 BACKEND EMAIL TRIGGER
    if (newStatus === 'secured' && existingOrder.seller_email) {
        try {
            await resend.emails.send({
                from: 'TrustLink Updates <onboarding@resend.dev>', // Keep until domain is verified
                to: [existingOrder.seller_email], 
                subject: 'New Escrow Order Secured! 💰',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-w: 500px;">
                        <h2 style="color: #10b981;">TrustLink Alert</h2>
                        <p style="color: #334155; font-size: 16px;">Great news! A buyer has securely locked <strong>₦${existingOrder.amount.toLocaleString()}</strong> in TrustLink.</p>
                        <p style="color: #334155;">Please log in to your dashboard to <strong>Accept</strong> the order and begin the transaction.</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Failed to send email:', emailErr);
            // We don't throw here; the order is still secured even if Resend Sandbox blocks the email.
        }
    }

    return NextResponse.json({
      status: paystackStatus === 'success',
      message: `Payment verified. Order is now ${newStatus}.`,
      data: { reference },
    });
  } catch (error: any) {
    return NextResponse.json({ status: false, message: error.message }, { status: 500 });
  }
}
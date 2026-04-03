import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);
const resend = new Resend(process.env.RESEND_API_KEY);

const HANDLED_EVENTS = new Set(['charge.success']);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) return NextResponse.json({ status: false }, { status: 400 });

    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(rawBody).digest('hex');
    if (hash !== signature) return NextResponse.json({ status: false }, { status: 401 });

    const event = JSON.parse(rawBody);
    const eventType: string = event.event;
    const data = event.data;

    if (!HANDLED_EVENTS.has(eventType)) return NextResponse.json({ status: true });

    if (eventType === 'charge.success') {
      const reference = data.reference;

      const { data: order, error: fetchError } = await supabaseAdmin
        .from('escrow_orders')
        .select('id, status, amount, seller_email')
        .eq('paystack_ref', reference)
        .maybeSingle();

      if (fetchError || !order || order.status !== 'awaiting_payment') {
        return NextResponse.json({ status: true });
      }

      // 🚀 THE HARMONY FIX: Update to 'secured'
      const { error: updateError } = await supabaseAdmin
        .from('escrow_orders')
        .update({ status: 'secured', updated_at: new Date().toISOString() })
        .eq('paystack_ref', reference)
        .eq('status', 'awaiting_payment');

      if (updateError) return NextResponse.json({ status: false }, { status: 500 });

      // 🚀 BACKEND EMAIL TRIGGER
      if (order.seller_email) {
        try {
            await resend.emails.send({
                from: 'TrustLink Updates <onboarding@resend.dev>',
                to: [order.seller_email], 
                subject: 'New Escrow Order Secured! 💰',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-w: 500px;">
                        <h2 style="color: #10b981;">TrustLink Alert</h2>
                        <p style="color: #334155; font-size: 16px;">Great news! A buyer has securely locked <strong>₦${order.amount.toLocaleString()}</strong> in TrustLink.</p>
                        <p style="color: #334155;">Please log in to your dashboard to <strong>Accept</strong> the order and begin the transaction.</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Webhook Email Error:', emailErr);
        }
      }
    }

    return NextResponse.json({ status: true });
  } catch (error: any) {
    return NextResponse.json({ status: false }, { status: 500 });
  }
}
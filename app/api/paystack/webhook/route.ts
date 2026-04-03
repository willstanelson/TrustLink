import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

const HANDLED_EVENTS = new Set(['charge.success']);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) return NextResponse.json({ status: false }, { status: 400 });

    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) return NextResponse.json({ status: false }, { status: 401 });

    const event = JSON.parse(rawBody);
    const eventType: string = event.event;
    const data = event.data;

    if (!HANDLED_EVENTS.has(eventType)) {
      return NextResponse.json({ status: true, message: 'Event ignored' });
    }

    if (eventType === 'charge.success') {
      const reference = data.reference;

      const { data: order, error: fetchError } = await supabaseAdmin
        .from('escrow_orders')
        .select('id, status')
        .eq('paystack_ref', reference)
        .maybeSingle();

      if (fetchError || !order) {
        return NextResponse.json({ status: true, message: 'Order not found or error fetching.' });
      }

      if (order.status !== 'awaiting_payment') {
        return NextResponse.json({ status: true, message: 'Already processed.' });
      }

      const { error: updateError } = await supabaseAdmin
        .from('escrow_orders')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('paystack_ref', reference)
        .eq('status', 'awaiting_payment');

      if (updateError) {
        console.error('[Webhook] DB update error:', updateError);
        return NextResponse.json({ status: false }, { status: 500 });
      }
    }

    return NextResponse.json({ status: true });
  } catch (error: any) {
    console.error('[Webhook] Unhandled error:', error);
    return NextResponse.json({ status: false }, { status: 500 });
  }
}
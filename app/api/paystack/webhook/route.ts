import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. Get the raw body text (required for Paystack signature verification)
    const rawBody = await req.text();
    
    // 2. Get the signature Paystack sent in the headers
    const signature = req.headers.get('x-paystack-signature');

    // 3. Verify the signature to ensure this request ACTUALLY came from Paystack
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.error("Webhook signature mismatch!");
      return NextResponse.json({ status: false, message: 'Invalid signature' }, { status: 400 });
    }

    // 4. Parse the verified data
    const event = JSON.parse(rawBody);

    // 5. If the payment was successful, update the TrustLink database
    if (event.event === 'charge.success') {
      const reference = event.data.reference;

      console.log(`Payment successful for reference: ${reference}. Updating database...`);

      const { error } = await supabase
        .from('escrow_orders')
        .update({ status: 'accepted' }) // Changes it from AWAITING_PAYMENT to accepted
        .eq('paystack_ref', reference);

      if (error) {
        console.error("Database update failed inside webhook:", error);
        throw error;
      }
    }

    // 6. ALWAYS return a 200 OK so Paystack knows you received it, otherwise they keep retrying
    return NextResponse.json({ status: true, message: 'Webhook received successfully' });

  } catch (error: any) {
    console.error("[Webhook Error]", error);
    return NextResponse.json({ status: false, message: error.message }, { status: 500 });
  }
}
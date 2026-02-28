import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { reference } = await request.json();
    if (!reference) return NextResponse.json({ status: false, message: 'No reference provided' });

    // 1. Verify directly with Paystack
    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const data = await res.json();

    // 2. If truly successful, update DB so the Seller can finally see it
    if (data.data && data.data.status === 'success') {
      await supabase.from('escrow_orders').update({ status: 'PENDING' }).eq('paystack_ref', reference);
      return NextResponse.json({ status: true, message: 'Payment verified successfully' });
    } else {
      // 3. If they cancelled or failed, mark it dead
      await supabase.from('escrow_orders').update({ status: 'FAILED' }).eq('paystack_ref', reference);
      return NextResponse.json({ status: false, message: 'Payment was cancelled or failed' });
    }
  } catch (error: any) {
    return NextResponse.json({ status: false, message: error.message });
  }
}
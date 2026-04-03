import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🚀 God-Mode Client: Bypasses all RLS restrictions to guarantee insertion
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      amount,
      email,
      seller_email,
      seller_bank,
      seller_number,
      seller_name,
      description,
      buyer_wallet,
    } = body;

    if (!amount || !email || !seller_email) {
      return NextResponse.json({ status: false, message: 'Missing required fields' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ status: false, message: 'Invalid amount.' }, { status: 400 });
    }

    const amountInKobo = Math.round(parsedAmount * 100);

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        currency: 'NGN',
        channels: ['card', 'bank', 'ussd', 'bank_transfer'],
        callback_url: 'https://trustlink.com.ng/dashboard',
        metadata: {
            custom_fields: [
                { display_name: "Seller Email", variable_name: "seller_email", value: seller_email },
                { display_name: "Seller Bank", variable_name: "seller_bank", value: seller_bank },
                { display_name: "Seller Account", variable_name: "seller_account", value: seller_number },
                { display_name: "Seller Name", variable_name: "seller_name", value: seller_name },
                { display_name: "Description", variable_name: "description", value: description }
            ]
        }
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Paystack initialization failed');

    const { error: dbError } = await supabaseAdmin
      .from('escrow_orders')
      .insert([
        {
          id: Date.now(),
          seller_address: '0xFIAT0000000000000000000000000000000000',
          buyer_email: email,
          buyer_wallet_address: buyer_wallet || null,
          seller_email: seller_email,
          seller_name: seller_name || null,
          seller_bank: seller_bank || null,
          seller_number: seller_number || null,
          amount: parsedAmount,
          currency: 'NGN',
          status: 'awaiting_payment',
          description: description || null,
          paystack_ref: data.data.reference,
        },
      ]);

    // 🚀 EXPLICIT ERROR REPORTING: If this fails, it will tell you EXACTLY why.
    if (dbError) {
      console.error('[Initiate] DB Error:', dbError);
      return NextResponse.json(
        { status: false, message: `Database Error: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Initiate] Error:', error);
    return NextResponse.json({ status: false, message: error.message }, { status: 500 });
  }
}
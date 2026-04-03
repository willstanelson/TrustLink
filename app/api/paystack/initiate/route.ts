import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, email, seller_email, seller_bank, seller_number, seller_name, description, buyer_wallet } = body;

    if (!amount || !email || !seller_email) {
      return NextResponse.json({ status: false, message: 'Missing amount, buyer email, or seller email' }, { status: 400 });
    }

    const amountInKobo = parseFloat(amount) * 100;

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
        metadata: {
            custom_fields: [
                { display_name: "Seller Email", variable_name: "seller_email", value: seller_email },
                { display_name: "Seller Bank", variable_name: "seller_bank", value: seller_bank },
                { display_name: "Seller Account", variable_name: "seller_account", value: seller_number },
                { display_name: "Seller Name", variable_name: "seller_name", value: seller_name },
                { display_name: "Description", variable_name: "description", value: description }
            ]
        },
        callback_url: "https://trustlink.com.ng/dashboard"
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Paystack initialization failed");

    const { error: dbError } = await supabase
        .from('escrow_orders')
        .insert([
            {
                id: Date.now(),
                seller_address: "0xFIAT0000000000000000000000000000000000",
                buyer_email: email,
                buyer_wallet_address: buyer_wallet,
                seller_email: seller_email, 
                seller_name: seller_name,
                seller_bank: seller_bank,       
                seller_number: seller_number,   
                amount: parseFloat(amount),
                currency: 'NGN',
                status: 'AWAITING_PAYMENT',
                description: description,
                paystack_ref: data.data.reference
            }
        ]);

    if (dbError) console.error("Database Save Failed Details:", JSON.stringify(dbError, null, 2));

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("[Payment Init Error]", error);
    return NextResponse.json({ status: false, message: error.message }, { status: 500 });
  }
}
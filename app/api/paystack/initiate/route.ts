import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, email, seller_bank, seller_number, seller_name, description } = body;

    if (!amount || !email) {
      return NextResponse.json({ status: false, message: 'Missing amount or email' }, { status: 400 });
    }

    // PAYSTACK REQUIRES AMOUNT IN KOBO (x100)
    // 5000 Naira = 500000 Kobo
    const amountInKobo = parseFloat(amount) * 100;

    const payload = {
      email,
      amount: amountInKobo,
      currency: 'NGN',
      channels: ['card', 'bank', 'ussd', 'bank_transfer'],
      metadata: {
        custom_fields: [
          { display_name: "Seller Bank", variable_name: "seller_bank", value: seller_bank },
          { display_name: "Seller Account", variable_name: "seller_account", value: seller_number },
          { display_name: "Seller Name", variable_name: "seller_name", value: seller_name },
          { display_name: "Description", variable_name: "description", value: description },
        ]
      },
      callback_url: "https://trust-link-sooty.vercel.app/" // Where they go after paying
    };

    // Call Paystack
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.message || "Paystack failed to initialize");
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("[Payment Init Error]", error);
    return NextResponse.json({ status: false, message: error.message }, { status: 500 });
  }
}
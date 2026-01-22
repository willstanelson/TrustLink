import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // 1. Get the Query Params (Account & Bank Code)
  const { searchParams } = new URL(request.url);
  const account_number = searchParams.get('account_number');
  const bank_code = searchParams.get('bank_code');

  if (!account_number || !bank_code) {
    return NextResponse.json({ status: false, message: 'Missing details' }, { status: 400 });
  }

  // 2. Securely call Paystack from the Server
  try {
    const res = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, // Secure Server-Side Key
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();

    // 3. Return the result to your Frontend
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ status: false, message: 'Server Error' }, { status: 500 });
  }
}
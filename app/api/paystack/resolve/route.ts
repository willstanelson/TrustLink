import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const account_number = searchParams.get('account_number');
  const bank_code = searchParams.get('bank_code');

  // 1. Log what we received (for debugging)
  console.log(`[API] Resolving Account: ${account_number} | Bank: ${bank_code}`);

  if (!account_number || !bank_code) {
    return NextResponse.json({ status: false, message: 'Missing details' }, { status: 400 });
  }

  // 2. Check if Key exists
  if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error("[API Error] PAYSTACK_SECRET_KEY is missing in Vercel!");
      return NextResponse.json({ status: false, message: 'Server Config Error' }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();

    // 3. Log the Paystack response (Success or Failure)
    if (!res.ok) {
        console.error("[Paystack Error]", JSON.stringify(data));
    } else {
        console.log("[Paystack Success]", data.data.account_name);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[Server Exception]", error.message);
    return NextResponse.json({ status: false, message: 'Server Error' }, { status: 500 });
  }
}
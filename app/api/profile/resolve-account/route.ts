import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountNumber = searchParams.get('account_number');
  const bankCode = searchParams.get('bank_code');

  // Strict backend validation
  if (!accountNumber || accountNumber.length !== 10 || !/^\d{10}$/.test(accountNumber)) {
    return NextResponse.json({ error: 'Account number must be exactly 10 digits' }, { status: 400 });
  }

  if (!bankCode) {
    return NextResponse.json({ error: 'Bank code is required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    const data = await response.json();

    if (data.status) {
      return NextResponse.json({ account_name: data.data.account_name });
    } else {
      return NextResponse.json({ error: data.message }, { status: 400 });
    }
  } catch (error) {
    console.error('Account resolution error:', error);
    return NextResponse.json({ error: 'Failed to resolve account' }, { status: 500 });
  }
}
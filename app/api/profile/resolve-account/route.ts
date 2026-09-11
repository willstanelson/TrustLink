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

  // Normalize digital banks (OPay, PalmPay, Moniepoint, Kuda) to Paystack resolution codes
  let effectiveBankCode = bankCode.trim().toUpperCase();
  if (effectiveBankCode === '50572' || effectiveBankCode === '100004' || effectiveBankCode === 'OPAY') effectiveBankCode = '999992';
  else if (effectiveBankCode === '090275' || effectiveBankCode === '100033' || effectiveBankCode === 'PALMPAY') effectiveBankCode = '999991';
  else if (effectiveBankCode === '090405' || effectiveBankCode === 'MONIEPOINT') effectiveBankCode = '50515';
  else if (effectiveBankCode === '090267' || effectiveBankCode === 'KUDA') effectiveBankCode = '50211';
  else effectiveBankCode = bankCode.trim();

  try {
    const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(effectiveBankCode)}`, {
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
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Normalizes digital bank/fintech NIBSS codes to Paystack expected resolution codes.
 * - OPay: NIBSS 50572 / 100004 / OPAY -> Paystack 999992
 * - PalmPay: NIBSS 090275 / 100033 / PALMPAY -> Paystack 999991
 * - Moniepoint: NIBSS 090405 / MONIEPOINT -> Paystack 50515
 * - Kuda Bank: NIBSS 090267 / KUDA -> Paystack 50211
 */
function normalizeFintechBankCode(code: string): string {
  if (!code) return '';
  const trimmed = String(code).trim().toUpperCase();
  switch (trimmed) {
    case '50572':
    case '100004':
    case 'OPAY':
      return '999992';
    case '090275':
    case '100033':
    case 'PALMPAY':
      return '999991';
    case '090405':
    case 'MONIEPOINT':
      return '50515';
    case '090267':
    case 'KUDA':
      return '50211';
    default:
      return String(code).trim();
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountNumber = searchParams.get('account_number')?.trim();
    const bankCode = searchParams.get('bank_code')?.trim();

    // 1. Parameter Guard: Validate that BOTH account_number and bank_code exist
    if (!accountNumber || !bankCode) {
      const missing: string[] = [];
      if (!accountNumber) missing.push('account_number');
      if (!bankCode) missing.push('bank_code');

      return NextResponse.json(
        {
          status: false,
          error: `Missing required parameter(s): ${missing.join(' and ')}. Both account_number and bank_code are required.`,
        },
        { status: 400 }
      );
    }

    // Validate 10-digit NUBAN
    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json(
        {
          status: false,
          error: 'Account number must be exactly 10 numeric digits.',
        },
        { status: 400 }
      );
    }

    // 2. Fintech Code Normalization
    const effectiveBankCode = normalizeFintechBankCode(bankCode);

    // Optional test mode bypass if using test account
    if (accountNumber === '9999999999') {
      return NextResponse.json({
        status: true,
        message: 'Account number resolved (Test Mode)',
        data: {
          account_number: accountNumber,
          account_name: 'Test Mode User (Bypassed)',
          bank_id: 0,
        },
        account_name: 'Test Mode User (Bypassed)',
      });
    }

    // 1. Environment Variable Audit & Runtime Server Console Check
    const rawSecretKey = process.env.PAYSTACK_SECRET_KEY;
    const isKeyDefined = typeof rawSecretKey === 'string' && rawSecretKey.trim().length > 0;

    console.log('[API Audit] PAYSTACK_SECRET_KEY runtime check:', {
      isDefined: isKeyDefined,
      keyPrefix: isKeyDefined ? `${rawSecretKey!.trim().slice(0, 7)}...` : 'undefined',
      length: isKeyDefined ? rawSecretKey!.trim().length : 0,
    });

    if (!isKeyDefined || rawSecretKey?.trim() === 'placeholder_paystack_secret_key') {
      console.error('[API Error] PAYSTACK_SECRET_KEY is missing or undefined in server environment.');
      return NextResponse.json(
        {
          status: false,
          error: 'Server configuration error: PAYSTACK_SECRET_KEY is not configured in the environment (.env.local). Please configure a valid Paystack secret key and restart the server.',
        },
        { status: 500 }
      );
    }

    const secretKey = rawSecretKey!.trim().replace(/^["']|["']$/g, '');

    // 3. Paystack Forwarding: GET request with server secret key and caching disabled
    const paystackUrl = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(
      accountNumber
    )}&bank_code=${encodeURIComponent(effectiveBankCode)}`;

    const response = await fetch(paystackUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      console.error('[Paystack API Error]', response.status, data);
    }

    // Return the response payload with account_name top-level for client convenience
    const payload = {
      ...data,
      account_name: data?.data?.account_name || null,
    };

    return NextResponse.json(payload, { status: response.status });
  } catch (error: any) {
    console.error('[API Error] Account resolution error:', error);
    return NextResponse.json(
      {
        status: false,
        error: 'Failed to resolve account',
        message: error?.message || 'Server error',
      },
      { status: 500 }
    );
  }
}

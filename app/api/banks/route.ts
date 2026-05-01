import { NextResponse } from 'next/server';

// Expanded list of ~30 active Nigerian commercial, neo, and microfinance banks
const FALLBACK_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'Guaranty Trust Bank (GTB)', code: '058' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'United Bank for Africa (UBA)', code: '033' },
  { name: 'Opay', code: '999992' },
  { name: 'Moniepoint', code: '090405' },
  { name: 'Kuda Bank', code: '090267' },
  { name: 'Palmpay', code: '090275' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Ecobank Nigeria', code: '050' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'FCMB', code: '214' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Providus Bank', code: '101' },
  { name: 'Jaiz Bank', code: '301' },
  { name: 'Taj Bank', code: '302' },
  { name: 'VFD Microfinance Bank', code: '090110' },
  { name: 'Globus Bank', code: '103' },
  { name: 'Titan Trust Bank', code: '102' },
  { name: 'SunTrust Bank', code: '100' },
  { name: 'PremiumTrust Bank', code: '105' },
  { name: 'Standard Chartered Bank', code: '068' },
  { name: 'CitiBank', code: '023' },
  { name: 'Unity Bank', code: '215' }
];

export async function GET() {
  try {
    const response = await fetch('https://api.paystack.co/bank?country=nigeria', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000) 
    });

    if (!response.ok) {
      throw new Error(`Paystack returned status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    // Structured logging for Vercel/Datadog to catch
    console.error(JSON.stringify({
      event: "PAYSTACK_BANK_FETCH_FAILED",
      message: "API unreachable, falling back to hardcoded list",
      error: String(error)
    }));
    
    return NextResponse.json({ 
      status: true, 
      message: 'Fallback banks loaded', 
      data: FALLBACK_BANKS,
      source: 'fallback' // Explicitly flag this to the frontend
    });
  }
}
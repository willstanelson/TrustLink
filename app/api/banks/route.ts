import { NextResponse } from 'next/server';

// Expanded list of ~30 active Nigerian commercial, neo, and microfinance banks
const FALLBACK_BANKS = [
  { id: 1, name: 'Access Bank', code: '044', slug: 'access-bank' },
  { id: 2, name: 'Guaranty Trust Bank (GTB)', code: '058', slug: 'guaranty-trust-bank' },
  { id: 3, name: 'Zenith Bank', code: '057', slug: 'zenith-bank' },
  { id: 4, name: 'First Bank of Nigeria', code: '011', slug: 'first-bank-of-nigeria' },
  { id: 5, name: 'United Bank for Africa (UBA)', code: '033', slug: 'united-bank-for-africa' },
  { id: 6, name: 'Opay', code: '999992', slug: 'opay' },
  { id: 7, name: 'Moniepoint', code: '50515', slug: 'moniepoint' },
  { id: 8, name: 'Kuda Bank', code: '50211', slug: 'kuda-bank' },
  { id: 9, name: 'Palmpay', code: '999991', slug: 'palmpay' },
  { id: 10, name: 'Fidelity Bank', code: '070', slug: 'fidelity-bank' },
  { id: 11, name: 'Union Bank of Nigeria', code: '032', slug: 'union-bank-of-nigeria' },
  { id: 12, name: 'Sterling Bank', code: '232', slug: 'sterling-bank' },
  { id: 13, name: 'Stanbic IBTC Bank', code: '221', slug: 'stanbic-ibtc-bank' },
  { id: 14, name: 'Wema Bank', code: '035', slug: 'wema-bank' },
  { id: 15, name: 'Ecobank Nigeria', code: '050', slug: 'ecobank-nigeria' },
  { id: 16, name: 'Polaris Bank', code: '076', slug: 'polaris-bank' },
  { id: 17, name: 'FCMB', code: '214', slug: 'fcmb' },
  { id: 18, name: 'Keystone Bank', code: '082', slug: 'keystone-bank' },
  { id: 19, name: 'Providus Bank', code: '101', slug: 'providus-bank' },
  { id: 20, name: 'Jaiz Bank', code: '301', slug: 'jaiz-bank' },
  { id: 21, name: 'Taj Bank', code: '302', slug: 'taj-bank' },
  { id: 22, name: 'VFD Microfinance Bank', code: '090110', slug: 'vfd-microfinance-bank' },
  { id: 23, name: 'Globus Bank', code: '103', slug: 'globus-bank' },
  { id: 24, name: 'Titan Trust Bank', code: '102', slug: 'titan-trust-bank' },
  { id: 25, name: 'SunTrust Bank', code: '100', slug: 'suntrust-bank' },
  { id: 26, name: 'PremiumTrust Bank', code: '105', slug: 'premiumtrust-bank' },
  { id: 27, name: 'Standard Chartered Bank', code: '068', slug: 'standard-chartered-bank' },
  { id: 28, name: 'CitiBank', code: '023', slug: 'citibank' },
  { id: 29, name: 'Unity Bank', code: '215', slug: 'unity-bank' }
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
    if (data?.data && Array.isArray(data.data)) {
      data.data = data.data.map((bank: { code?: string; name?: string; [key: string]: any }) => {
        const c = String(bank.code || '').trim();
        const n = String(bank.name || '').toLowerCase();
        // Normalize digital fintech banks to Paystack resolution codes
        if (c === '50572' || c === '100004' || c === 'OPAY' || n.includes('opay')) {
          return { ...bank, code: '999992' };
        }
        if (c === '090275' || c === '100033' || c === 'PALMPAY' || n.includes('palmpay')) {
          return { ...bank, code: '999991' };
        }
        if (c === '090405' || c === 'MONIEPOINT' || n.includes('moniepoint')) {
          return { ...bank, code: '50515' };
        }
        if (c === '090267' || c === 'KUDA' || n.includes('kuda')) {
          return { ...bank, code: '50211' };
        }
        return bank;
      });
    }
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
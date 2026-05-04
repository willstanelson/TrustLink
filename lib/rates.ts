import { supabaseAdmin } from '@/lib/auth-helpers';

export async function getNormalizedUSD(order: { 
  currency: string; 
  crypto_amount: number | string; 
  fiat_amount: number | string; 
}): Promise<number> {
  if (order.currency === 'USDT' || order.currency === 'USD') {
    return Number(Number(order.crypto_amount).toFixed(2));
  }

  let currentNairaRate = 1600; 
  
  const { data: rateData, error: rateError } = await supabaseAdmin
    .from('exchange_rates')
    .select('rate, updated_at')
    .eq('pair', 'USDT_NGN')
    .single();

  const isFresh = !rateError && rateData?.rate && rateData?.updated_at &&
    (Date.now() - new Date(rateData.updated_at).getTime()) < 30 * 60 * 1000;

  if (isFresh) {
    currentNairaRate = Number(rateData.rate);
  } else {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.tether?.ngn) currentNairaRate = data.tether.ngn;
      } else if (rateData?.rate) {
        currentNairaRate = Number(rateData.rate);
      }
    } catch (e) {
      if (rateData?.rate) currentNairaRate = Number(rateData.rate);
    }
  }

  const tradeAmountNGN = Number(order.fiat_amount || 0);
  return Number((tradeAmountNGN / currentNairaRate).toFixed(2));
}
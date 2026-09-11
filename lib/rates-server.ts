export async function getNormalizedUSD(order: { 
  currency: string; 
  crypto_amount: number | string; 
  fiat_amount: number | string; 
}): Promise<number> {
  if (order.currency === 'USDT' || order.currency === 'USD') {
    return Number(Number(order.crypto_amount).toFixed(2));
  }

  let currentNairaRate = 0; 
  
  try {
    const { supabaseAdmin } = await import('@/lib/auth-helpers');
    const { data: rateData, error: rateError } = await supabaseAdmin
      .from('exchange_rates')
      .select('rate, updated_at')
      .eq('pair', 'USDT_NGN')
      .maybeSingle();

    const isFresh = !rateError && rateData?.rate && rateData?.updated_at &&
      (Date.now() - new Date(rateData.updated_at).getTime()) < 30 * 60 * 1000;

    if (isFresh) {
      currentNairaRate = Number(rateData.rate);
    } else {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.rates?.NGN && typeof data.rates.NGN === 'number') {
            currentNairaRate = Number(data.rates.NGN);
          }
        }
      } catch {
        if (rateData?.rate) currentNairaRate = Number(rateData.rate);
      }
    }
  } catch {
    // Fallback if dynamic import fails
  }

  if (currentNairaRate <= 0) return 0;

  const tradeAmountNGN = Number(order.fiat_amount || 0);
  return Number((tradeAmountNGN / currentNairaRate).toFixed(2));
}

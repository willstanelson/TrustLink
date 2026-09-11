import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client for database caching (Last Known Good Cache)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export interface RatesPayload {
  success: boolean;
  rates: {
    ETH: number;
    BNB: number;
    POL: number;
    OP: number;
    XPL: number;
    USDC: 1;
    NGN: number;
  };
  source: 'coingecko' | 'binance' | 'database_cache';
  stale: boolean;
  lastUpdated: string;
}

// ── Step 3 Helper: Query Supabase Last Known Good Cache ────────────────────
async function getDatabaseCache(): Promise<{ rates: any; lastUpdated: string } | null> {
  if (!supabase) return null;
  try {
    // 1. Try market_rates_cache table
    const { data: cacheData, error: cacheError } = await supabase
      .from('market_rates_cache')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cacheError && cacheData) {
      const raw = cacheData.rates || cacheData;
      const rates = {
        ETH: Number(raw.ETH ?? raw.eth ?? 0),
        BNB: Number(raw.BNB ?? raw.bnb ?? 0),
        POL: Number(raw.POL ?? raw.pol ?? 0),
        OP: Number(raw.OP ?? raw.op ?? 0),
        XPL: Number(raw.XPL ?? raw.xpl ?? 0),
        USDC: 1 as const,
        NGN: Number(raw.NGN ?? raw.ngn ?? 0),
      };
      if (rates.ETH > 0 && rates.BNB > 0) {
        return { rates, lastUpdated: cacheData.updated_at || new Date().toISOString() };
      }
    }

    // 2. Fallback check on exchange_rates table if present
    const { data: rateRow, error: rateError } = await supabase
      .from('exchange_rates')
      .select('rate, updated_at')
      .eq('pair', 'USDT_NGN')
      .maybeSingle();

    if (!rateError && rateRow?.rate) {
      return {
        rates: {
          ETH: 0,
          BNB: 0,
          POL: 0,
          OP: 0,
          XPL: 0,
          USDC: 1 as const,
          NGN: Number(rateRow.rate),
        },
        lastUpdated: rateRow.updated_at || new Date().toISOString(),
      };
    }
  } catch (err: any) {
    console.warn('Database rate cache read error:', err.message);
  }
  return null;
}

// ── Helper: Asynchronously persist successful live rates to DB cache ──────
async function persistToDatabaseCache(rates: any, source: string) {
  if (!supabase) return;
  try {
    const now = new Date().toISOString();
    await supabase.from('market_rates_cache').insert({
      rates,
      source,
      updated_at: now,
    });
  } catch (err: any) {
    // Non-blocking catch to ensure response is never interrupted
    console.warn('Could not persist to market_rates_cache:', err.message);
  }
}

// ── Step 1: CoinGecko (Primary Provider) ──────────────────────────────────
async function fetchCoinGecko(): Promise<{ rates: RatesPayload['rates']; source: 'coingecko'; lastUpdated: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin,polygon-ecosystem-token,ethereum,optimism,plasma&vs_currencies=usd,ngn',
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      console.warn(`CoinGecko primary returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data || typeof data !== 'object') return null;

    const ethUsd = Number(data?.ethereum?.usd || 0);
    const ethNgn = Number(data?.ethereum?.ngn || 0);
    const bnbUsd = Number(data?.binancecoin?.usd || 0);
    const polUsd = Number(data?.['polygon-ecosystem-token']?.usd || 0);
    const opUsd = Number(data?.optimism?.usd || 0);
    const xplUsd = Number(data?.plasma?.usd || 0);

    // Derive USD/NGN rate from ethereum.ngn / ethereum.usd or binancecoin.ngn / binancecoin.usd
    let usdNgn = 0;
    if (ethNgn > 0 && ethUsd > 0) {
      usdNgn = Number((ethNgn / ethUsd).toFixed(2));
    } else if (data?.binancecoin?.ngn && bnbUsd > 0) {
      usdNgn = Number((data.binancecoin.ngn / bnbUsd).toFixed(2));
    }

    // Require core rates to consider Step 1 successful
    if (ethUsd <= 0 || bnbUsd <= 0 || polUsd <= 0 || usdNgn <= 0) {
      console.warn('CoinGecko payload missing essential rates');
      return null;
    }

    return {
      rates: {
        ETH: ethUsd,
        BNB: bnbUsd,
        POL: polUsd,
        OP: opUsd,
        XPL: xplUsd,
        USDC: 1,
        NGN: usdNgn,
      },
      source: 'coingecko',
      lastUpdated: new Date().toISOString(),
    };
  } catch (err: any) {
    console.warn('CoinGecko fetch failed:', err.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Step 2: Binance & Open Exchange Rates (Secondary Provider) ─────────────
async function fetchBinanceAndFx(): Promise<{ rates: RatesPayload['rates']; source: 'binance'; lastUpdated: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    // 1. Binance Public Ticker for crypto USD prices
    const binancePromise = fetch(
      'https://api.binance.com/api/v3/ticker/price?symbols=%5B%22ETHUSDT%22,%22BNBUSDT%22,%22POLUSDT%22,%22OPUSDT%22%5D',
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
        signal: controller.signal,
      }
    );

    // 2. Open Exchange Rates for real-time USD/NGN FX rate
    const fxPromise = fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
      signal: controller.signal,
    });

    const [binanceRes, fxRes] = await Promise.allSettled([binancePromise, fxPromise]);

    if (binanceRes.status !== 'fulfilled' || !binanceRes.value.ok) {
      console.warn('Binance ticker request failed');
      return null;
    }

    const binanceData = await binanceRes.value.json();
    if (!Array.isArray(binanceData)) return null;

    const priceMap: Record<string, number> = {};
    binanceData.forEach((item: { symbol?: string; price?: string }) => {
      if (item?.symbol && item?.price) {
        priceMap[item.symbol] = parseFloat(item.price);
      }
    });

    const eth = priceMap['ETHUSDT'] || 0;
    const bnb = priceMap['BNBUSDT'] || 0;
    const pol = priceMap['POLUSDT'] || 0;
    const op = priceMap['OPUSDT'] || 0;

    if (eth <= 0 || bnb <= 0 || pol <= 0) {
      console.warn('Binance response missing core tokens');
      return null;
    }

    // Resolve NGN rate from FX API
    let ngn = 0;
    if (fxRes.status === 'fulfilled' && fxRes.value.ok) {
      const fxData = await fxRes.value.json();
      if (fxData?.rates?.NGN && typeof fxData.rates.NGN === 'number') {
        ngn = Number(Number(fxData.rates.NGN).toFixed(2));
      }
    }

    // If FX API failed to provide NGN, try to retain from DB cache
    if (ngn <= 0) {
      const dbCache = await getDatabaseCache();
      if (dbCache?.rates?.NGN) ngn = dbCache.rates.NGN;
    }

    if (ngn <= 0) {
      console.warn('Could not resolve NGN rate from secondary provider');
      return null;
    }

    // Plasma (XPL) price fallback from DB cache if not on Binance
    let xpl = 0;
    const dbCache = await getDatabaseCache();
    if (dbCache?.rates?.XPL) xpl = dbCache.rates.XPL;

    return {
      rates: {
        ETH: eth,
        BNB: bnb,
        POL: pol,
        OP: op,
        XPL: xpl,
        USDC: 1,
        NGN: ngn,
      },
      source: 'binance',
      lastUpdated: new Date().toISOString(),
    };
  } catch (err: any) {
    console.warn('Binance / FX fetch failed:', err.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Multi-Provider Cascade Waterfall ──────────────────────────────────────
export async function GET() {
  try {
    // Step 1 (Primary - CoinGecko)
    const step1 = await fetchCoinGecko();
    if (step1) {
      // Asynchronously update DB cache with fresh snapshot
      persistToDatabaseCache(step1.rates, 'coingecko').catch(() => {});
      return NextResponse.json({
        success: true,
        rates: step1.rates,
        source: 'coingecko',
        stale: false,
        lastUpdated: step1.lastUpdated,
      });
    }

    // Step 2 (Secondary - Binance & Open Exchange Rates)
    console.info('Cascading to Step 2: Binance & Open Exchange Rates');
    const step2 = await fetchBinanceAndFx();
    if (step2) {
      // Asynchronously update DB cache with fresh snapshot
      persistToDatabaseCache(step2.rates, 'binance').catch(() => {});
      return NextResponse.json({
        success: true,
        rates: step2.rates,
        source: 'binance',
        stale: false,
        lastUpdated: step2.lastUpdated,
      });
    }

    // Step 3 (Tertiary - Supabase Last Known Good Cache)
    console.info('Cascading to Step 3: Supabase market_rates_cache');
    const step3 = await getDatabaseCache();
    if (step3 && step3.rates) {
      return NextResponse.json({
        success: true,
        rates: step3.rates,
        source: 'database_cache',
        stale: true,
        lastUpdated: step3.lastUpdated,
      });
    }

    // If all providers and database cache fail, return clean error with zero hardcoded values
    return NextResponse.json(
      {
        success: false,
        error: 'Market exchange rates temporarily unavailable from all providers',
        rates: null,
        stale: true,
        lastUpdated: new Date().toISOString(),
      },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Internal rate engine error',
        rates: null,
        stale: true,
        lastUpdated: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

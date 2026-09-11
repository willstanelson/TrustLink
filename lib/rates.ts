'use client';

import { useState, useEffect } from 'react';

export interface LiveRatesState {
  rates: Record<string, number>;
  loading: boolean;
  stale: boolean;
  source: 'coingecko' | 'binance' | 'database_cache' | null;
  lastUpdated: string | null;
}

export function useLiveRates(): LiveRatesState {
  const [rates, setRates] = useState<Record<string, number>>({ USDC: 1 });
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [source, setSource] = useState<'coingecko' | 'binance' | 'database_cache' | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchRates() {
      try {
        const res = await fetch('/api/rates');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data?.success && data?.rates) {
            setRates(data.rates);
            setStale(Boolean(data.stale));
            setSource(data.source || null);
            setLastUpdated(data.lastUpdated || null);
          }
        }
      } catch (err) {
        console.warn('useLiveRates fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRates();
    const interval = setInterval(fetchRates, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { rates, loading, stale, source, lastUpdated };
}
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    // 1. Strict Security: Reject unauthorized pings
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch live rate
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn', {
      cache: 'no-store' // Critical: Bypass Next.js static caching
    });

    if (!response.ok) throw new Error(`CoinGecko status: ${response.status}`);

    const data = await response.json();
    const liveRate = data?.tether?.ngn;

    if (!liveRate) throw new Error('Invalid data format from CoinGecko');

    // 3. Upsert into cache
    const { error } = await supabaseAdmin
      .from('exchange_rates')
      .upsert({ 
        pair: 'USDT_NGN', 
        rate: liveRate, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'pair' });

    if (error) throw error;

    return NextResponse.json({ success: true, updatedRate: liveRate });

  } catch (error: any) {
    console.error("Cron Job Error:", error.message);
    return NextResponse.json({ error: "Failed to update rates" }, { status: 500 });
  }
}
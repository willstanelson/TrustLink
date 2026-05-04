import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient, WalletWithMetadata } from '@privy-io/server-auth';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getVerifiedWallet(req: Request): Promise<string> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');
  
  const privyToken = authHeader.split(' ')[1];
  const claims = await privy.verifyAuthToken(privyToken);
  const privyUser = await privy.getUser(claims.userId);
  const wallet = privyUser.linkedAccounts.find(
    (a): a is WalletWithMetadata => a.type === 'wallet'
  );
  
  if (!wallet?.address) throw new Error('No wallet found');
  return wallet.address.toLowerCase();
}

export async function POST(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Missing order ID' }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('escrow_orders')
      .select('status, seller_address, currency, fiat_amount, crypto_amount')
      .eq('id', orderId)
      .single();

    if (orderError || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.seller_address.toLowerCase() !== callerWallet) return NextResponse.json({ error: 'Only seller can release' }, { status: 403 });
    if (order.status !== 'locked') return NextResponse.json({ error: 'Order is not in releasable state' }, { status: 400 });

    let normalizedUSD = 0;

    if (order.currency === 'USDT' || order.currency === 'USD') {
      normalizedUSD = Number(Number(order.crypto_amount).toFixed(2));
    } else {
      let currentNairaRate = 1600; // Ultimate fallback
      
      const { data: rateData, error: rateError } = await supabaseAdmin
        .from('exchange_rates')
        .select('rate, updated_at')
        .eq('pair', 'USDT_NGN')
        .single();

      // 🚀 Explicit intentional freshness check
      const isFresh = !rateError && 
        rateData?.rate && 
        rateData?.updated_at &&
        (Date.now() - new Date(rateData.updated_at).getTime()) < 30 * 60 * 1000; // 30 mins

      if (isFresh) {
        currentNairaRate = Number(rateData.rate);
      } else {
        console.warn("Exchange rate cache is stale or missing, attempting live fallback fetch...");
        try {
          const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn', {
            cache: 'no-store'
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.tether?.ngn) currentNairaRate = data.tether.ngn;
          } else if (rateData?.rate) {
            currentNairaRate = Number(rateData.rate); // Fallback to stale DB rate
          }
        } catch (e) {
          console.warn("Live fallback fetch failed.", e);
          if (rateData?.rate) currentNairaRate = Number(rateData.rate);
        }
      }

      const tradeAmountNGN = Number(order.fiat_amount || 0);
      normalizedUSD = Number((tradeAmountNGN / currentNairaRate).toFixed(2));
    }

    // Execute Atomic Postgres Transaction
    const { error: rpcError } = await supabaseAdmin.rpc('release_escrow_and_update_reputation', {
      p_order_id: orderId,
      p_normalized_usd: normalizedUSD
    });

    if (rpcError) throw rpcError;

    return NextResponse.json({ 
      success: true, 
      message: 'Escrow released successfully',
      volumeAddedUSD: normalizedUSD 
    });

  } catch (error: any) {
    console.error('Escrow Release Error:', error);
    if (error.message === 'Unauthorized' || error.message === 'No wallet found') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to release escrow' }, { status: 500 });
  }
}
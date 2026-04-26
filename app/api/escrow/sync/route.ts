import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { PrivyClient, WalletWithMetadata } from '@privy-io/server-auth';
import { CHAIN_CONFIG, CONTRACT_ADDRESS, CONTRACT_ABI } from '@/app/constants';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. Verify Caller Identity
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const privyToken = authHeader.split(' ')[1];
    let callerWallet: string;

    try {
      const claims = await privy.verifyAuthToken(privyToken);
      const privyUser = await privy.getUser(claims.userId);
      const wallet = privyUser.linkedAccounts.find(
        (a): a is WalletWithMetadata => a.type === 'wallet'
      );
      callerWallet = wallet?.address?.toLowerCase() ?? '';
      if (!callerWallet) throw new Error('No wallet');
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { orderId, scId, chainId } = await req.json();

    if (!orderId || scId === undefined || !chainId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 2. Fetch the order and verify ownership before touching it
    const { data: order } = await supabaseAdmin
      .from('escrow_orders')
      .select('seller_address, buyer_wallet_address')
      .eq('id', orderId)
      .single();

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const isSeller = order.seller_address?.toLowerCase() === callerWallet;
    const isBuyer  = order.buyer_wallet_address?.toLowerCase() === callerWallet;

    if (!isSeller && !isBuyer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const chainConfig = CHAIN_CONFIG[chainId];
    if (!chainConfig) {
      return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });
    }

    // 3. Initialize Production RPC Client
    // Fallback to the public URL defined in your config if no private env var exists yet
    const rpcUrl = process.env[`RPC_URL_${chainId}`] || chainConfig.viemChain?.rpcUrls?.default?.http[0];
    
    if (!rpcUrl) {
      return NextResponse.json({ error: 'No RPC configured for this chain' }, { status: 500 });
    }

    const publicClient = createPublicClient({
      chain: chainConfig.viemChain,
      transport: http(rpcUrl)
    });

    // 4. Read the absolute truth from the Smart Contract
    const escrowData: any = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'escrows',
      args: [BigInt(scId)]
    });

    const isDisputed = escrowData[8];
    const isCompleted = escrowData[9];

    let newStatus = null;
    if (isCompleted) newStatus = 'completed';
    else if (isDisputed) newStatus = 'disputed';

    if (!newStatus) {
      return NextResponse.json({ message: 'No terminal state reached on-chain yet.' }, { status: 200 });
    }

    // 5. Sync the verified truth to Supabase
    const { error } = await supabaseAdmin
      .from('escrow_orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) throw error;

    return NextResponse.json({ success: true, newStatus });
  } catch (error: any) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: 'Failed to sync with blockchain' }, { status: 500 });
  }
}
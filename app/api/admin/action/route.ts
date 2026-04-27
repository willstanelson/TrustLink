import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'; // 🚀 ADD THIS TO BUST THE SERVER CACHE

import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { createClient } from '@supabase/supabase-js';

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  try {
    const { userId } = await privy.verifyAuthToken(token);
    const user = await privy.getUser(userId);

    const email = (user.email?.address ?? (user as any).google?.email ?? '').toLowerCase().trim();
    const wallet = (user.wallet?.address ?? '').toLowerCase().trim();

    return ADMIN_EMAILS.includes(email) || ADMIN_WALLETS.includes(wallet);
  } catch {
    return false;
  }
}

async function nukeProfile(sellerId: string) {
  const normalizedId = sellerId.toLowerCase().trim();
  if (!normalizedId) throw new Error('Invalid seller identifier');

  const isEmail = normalizedId.includes('@');

  const { data, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('id, severe_strikes')
    .ilike(isEmail ? 'email_address' : 'wallet_address', normalizedId)
    .single();

  if (fetchError || !data) {
    const insertPayload = isEmail
      ? { email_address: normalizedId, severe_strikes: 1 }
      : { wallet_address: normalizedId, severe_strikes: 1 };

    // NOTE: Requires UNIQUE constraint on email_address and wallet_address in the profiles table.
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .upsert(insertPayload, {
        onConflict: isEmail ? 'email_address' : 'wallet_address',
      });

    if (insertError) throw new Error(`Failed to create profile: ${insertError.message}`);
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ severe_strikes: (data.severe_strikes ?? 0) + 1 })
    .eq('id', data.id);

  if (updateError) throw new Error(`Profile nuke failed: ${updateError.message}`);
}

export async function GET(req: NextRequest) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data: orders, error } = await supabaseAdmin
      .from('escrow_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, orders });
  } catch (err: any) {
    console.error('[admin/action GET] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    switch (body.actionType) {
      case 'RESOLVE_DISPUTE': {
        const { orderId, resolution, nukeSellerId } = body;

        if (!Number.isInteger(Number(orderId)) || Number(orderId) <= 0) {
          return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
        }

        if (!['completed', 'refunded'].includes(resolution)) {
          return NextResponse.json({ error: 'Invalid resolution' }, { status: 400 });
        }

        const { data: order, error: fetchError } = await supabaseAdmin
          .from('escrow_orders')
          .select('status')
          .eq('id', orderId)
          .single();

        if (fetchError || !order) throw new Error(fetchError?.message ?? 'Order not found');

        if (order.status !== 'disputed') {
          return NextResponse.json({ error: 'Order is not in disputed state' }, { status: 409 });
        }

        if (nukeSellerId) await nukeProfile(nukeSellerId);

        const { error } = await supabaseAdmin
          .from('escrow_orders')
          .update({
            status: resolution,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true });
      }

      case 'COMPLETE_PAYOUT': {
        const { orderId } = body;

        if (!Number.isInteger(Number(orderId)) || Number(orderId) <= 0) {
          return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
        }

        const { data: order, error: fetchError } = await supabaseAdmin
          .from('escrow_orders')
          .select('amount, status')
          .eq('id', orderId)
          .single();

        if (fetchError || !order) throw new Error(fetchError?.message ?? 'Order not found');

        if (['completed', 'refunded'].includes(order.status)) {
          return NextResponse.json({ error: 'Order already finalised' }, { status: 409 });
        }

        const total = Number(order.amount ?? 0);

        const { error } = await supabaseAdmin
          .from('escrow_orders')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
            released_amount: total,
          })
          .eq('id', orderId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, newStatus: 'completed' });
      }

      case 'NUKE_CRYPTO_SELLER': {
        const { sellerAddress } = body;
        if (!sellerAddress || typeof sellerAddress !== 'string') {
          return NextResponse.json({ error: 'Invalid sellerAddress' }, { status: 400 });
        }
        await nukeProfile(sellerAddress);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown actionType' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[admin/action POST] error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}
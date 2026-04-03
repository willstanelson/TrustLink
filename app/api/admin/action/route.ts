// app/api/admin/action/route.ts
//
// ⚠️  REQUIRED ENV VARS (server-side only — never NEXT_PUBLIC_):
//   PRIVY_APP_ID          – from your Privy dashboard
//   PRIVY_APP_SECRET      – from your Privy dashboard
//   ADMIN_WALLETS         – comma-separated lowercase wallet addresses
//   ADMIN_EMAILS          – comma-separated lowercase email addresses
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  – the service-role key, NOT the anon key

import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { createClient } from '@supabase/supabase-js';

// ── Privy server client ────────────────────────────────────────────────────
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

// ── Supabase with service-role key (bypasses RLS — admin only) ─────────────
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Admin lists live ONLY on the server ────────────────────────────────────
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// ── Auth guard ─────────────────────────────────────────────────────────────
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  try {
    const { userId } = await privy.verifyAuthToken(token);
    const user = await privy.getUser(userId);

    const email  = (user.email?.address ?? (user as any).google?.email ?? '').toLowerCase();
    const wallet = (user.wallet?.address ?? '').toLowerCase();

    return ADMIN_EMAILS.includes(email) || ADMIN_WALLETS.includes(wallet);
  } catch {
    return false;
  }
}

// ── Action types ───────────────────────────────────────────────────────────
type ActionBody =
  | { actionType: 'VERIFY' }
  | { actionType: 'RESOLVE_DISPUTE';  orderId: number; resolution: 'completed' | 'refunded'; nukeSellerId?: string }
  | { actionType: 'COMPLETE_PAYOUT';  orderId: number }
  | { actionType: 'NUKE_CRYPTO_SELLER'; sellerAddress: string };

// ── GET – lightweight auth check for the admin page bootstrap ──────────────
export async function GET(req: NextRequest) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ ok: true });
}

// ── POST – all mutating admin actions ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: ActionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── Helper: increment severe_strikes on a seller profile ──────────────
  const nukeProfile = async (sellerId: string) => {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('severe_strikes')
      .eq('id', sellerId.toLowerCase())
      .single();

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ severe_strikes: (data?.severe_strikes ?? 0) + 1 })
      .eq('id', sellerId.toLowerCase());

    if (error) throw new Error(`Profile nuke failed: ${error.message}`);
  };

  try {
    switch (body.actionType) {

      // ── Resolve a fiat dispute ─────────────────────────────────────────
      case 'RESOLVE_DISPUTE': {
        const { orderId, resolution, nukeSellerId } = body;

        if (nukeSellerId) await nukeProfile(nukeSellerId);

        const { error } = await supabaseAdmin
          .from('escrow_orders')
          .update({ status: resolution })
          .eq('id', orderId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true });
      }

      // ── Complete a pending manual payout ──────────────────────────────
      case 'COMPLETE_PAYOUT': {
        const { orderId } = body;

        const { data: order, error: fetchError } = await supabaseAdmin
          .from('escrow_orders')
          .select('amount, released_amount')
          .eq('id', orderId)
          .single();

        if (fetchError) throw new Error(fetchError.message);

        const released = Number(order.released_amount ?? order.amount);
        const total    = Number(order.amount);
        const newStatus = released < total ? 'partially_released' : 'completed';

        const { error } = await supabaseAdmin
          .from('escrow_orders')
          .update({ status: newStatus })
          .eq('id', orderId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, newStatus });
      }

      // ── Nuke a crypto seller's trust score ────────────────────────────
      case 'NUKE_CRYPTO_SELLER': {
        await nukeProfile(body.sellerAddress);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown actionType' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[admin/action] error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
  }
}

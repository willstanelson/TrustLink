import { NextResponse } from 'next/server';
import { supabaseAdmin, getVerifiedWallet } from '@/lib/auth-helpers';
import { encryptGiftCard } from '@/lib/encryption';

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

export async function POST(req: Request) {
  try {
    // 1. Always verify JWT — unconditional, before reading the body
    const callerWallet = await getVerifiedWallet(req); // throws if invalid/missing

    const body = await req.json();
    const { gc_code: plainTextCode, ...orderData } = body;

    // 2. Input validation
    if (typeof plainTextCode !== 'string' || !plainTextCode.trim()) {
      return NextResponse.json({ status: false, message: 'Gift Card code is required' }, { status: 400 });
    }
    const parsedAmount = parseFloat(String(orderData.gc_amount ?? ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ status: false, message: 'Invalid gift card amount' }, { status: 400 });
    }
    if (orderData.seller_email && !isValidEmail(orderData.seller_email)) {
      return NextResponse.json({ status: false, message: 'Invalid seller email' }, { status: 400 });
    }

    // 3. Wallet identity check — only when a wallet is present on both sides
    if (orderData.buyer_wallet && callerWallet) {
      if (callerWallet.toLowerCase() !== orderData.buyer_wallet.toLowerCase()) {
        return NextResponse.json({ status: false, message: 'Unauthorized' }, { status: 403 });
      }
    }

    // 4. Encrypt the code — it never hits the DB in plaintext
    const encryptedCode = encryptGiftCard(plainTextCode.trim());

    // 5. Insert
    const { data, error } = await supabaseAdmin
      .from('escrow_orders')
      .insert({
        buyer_wallet_address: orderData.buyer_wallet   ?? null,
        buyer_email:          orderData.buyer_email    ?? null,
        seller_email:         orderData.seller_email   ?? null,
        seller_identifier:    String(orderData.seller_identifier ?? '').slice(0, 254),
        amount:               parsedAmount,
        token_symbol:         'USD',
        gc_brand:             String(orderData.gc_brand ?? '').slice(0, 50),
        gift_card_code:       encryptedCode,
        gc_image_url:         orderData.gc_image_url   ?? null,
        trade_type:           'GIFT_CARD',
        status:               'secured',
        paystack_ref:         null,   // explicit — keeps fiat filter logic clean
        network:              null,   // off-chain — no network needed
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ status: true, order: data });

  } catch (err: any) {
    console.error('Gift Card Escrow Error:', err.message);
    return NextResponse.json({ status: false, message: err.message }, { status: 500 });
  }
}
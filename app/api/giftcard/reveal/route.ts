import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin, getVerifiedIdentity } from '@/lib/auth-helpers';
import { decryptGiftCard } from '@/lib/encryption';

// ─── Constants ───────────────────────────────────────────────────────────────
const MAX_REVEAL_ATTEMPTS = 10;

// ─── Validation Schema ───────────────────────────────────────────────────────
const RevealRequestSchema = z.object({
  order_id: z
    .union([z.number().int().positive(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'Order ID must be a positive integer',
    }),
});

// ─── Custom Error ────────────────────────────────────────────────────────────
class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ─── Method Not Allowed ──────────────────────────────────────────────────────
const methodNotAllowed = () =>
  NextResponse.json(
    { status: false, message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    { status: 405, headers: { Allow: 'POST' } }
  );

// ─── POST Handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // 1. Content-Type Check
    if (!req.headers.get('content-type')?.includes('application/json')) {
      throw new AppError(415, 'Content-Type must be application/json', 'UNSUPPORTED_MEDIA_TYPE');
    }

    // 2. Authentication
    const identity = await getVerifiedIdentity(req).catch(() => {
      throw new AppError(401, 'Session expired. Please log in again.', 'SESSION_EXPIRED');
    });

    const callerEmail = identity.email?.toLowerCase() ?? null;
    const callerWallet = identity.wallet?.toLowerCase() ?? null;

    // 3. Parse & Validate Body (Fixed with safeParse)
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new AppError(400, 'Invalid JSON body', 'VALIDATION_ERROR');
    }

    const parseResult = RevealRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        parseResult.error.issues[0]?.message || 'Valid Order ID is required',
        'VALIDATION_ERROR'
      );
    }

    const { order_id } = parseResult.data;

    // 4. Fetch Order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('escrow_orders')
      .select('id, status, seller_email, seller_identifier, gift_card_code, reveal_attempts')
      .eq('id', order_id)
      .single();

    if (fetchError || !order) {
      throw new AppError(404, 'Order not found', 'NOT_FOUND');
    }

    // 5. Business Rules
    if (order.status.toUpperCase() !== 'COMPLETED') {
      throw new AppError(403, 'Funds have not been released yet. The code is still secured.', 'NOT_COMPLETED');
    }

    const sellerEmail = order.seller_email?.toLowerCase() ?? null;
    const sellerWallet = order.seller_identifier?.toLowerCase() ?? null;

    const isAuthorizedSeller =
      (callerEmail && callerEmail === sellerEmail) ||
      (callerWallet && callerWallet === sellerWallet);

    if (!isAuthorizedSeller) {
      throw new AppError(403, 'Unauthorized: Only the seller can reveal this code.', 'FORBIDDEN');
    }

    // 6. Rate Limiting
    if (order.reveal_attempts >= MAX_REVEAL_ATTEMPTS) {
      throw new AppError(429, 'Maximum reveal attempts exceeded. Contact support.', 'RATE_LIMITED');
    }

    // 7. Decrypt
    let plainTextCode: string;
    try {
      plainTextCode = decryptGiftCard(order.gift_card_code);
    } catch (err) {
      console.error(`[GiftCard Reveal] Decryption failed for order ${order.id}:`, err);
      throw new AppError(500, 'Failed to decrypt gift card', 'DECRYPTION_ERROR');
    }

    // 8. Increment attempts (Awaited for consistency)
    const { error: updateError } = await supabaseAdmin
      .from('escrow_orders')
      .update({
        reveal_attempts: order.reveal_attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      console.warn(`[GiftCard Reveal] Failed to increment reveal count for order ${order.id}:`, updateError);
      // We still return the code — this is non-blocking failure
    }

    // 9. Success
    return NextResponse.json(
      {
        status: true,
        code: plainTextCode,
        message: 'Gift card code revealed successfully',
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { status: false, message: err.message, code: err.code },
        { status: err.statusCode }
      );
    }

    console.error('[GiftCard Reveal] Unexpected error:', err);
    return NextResponse.json(
      { status: false, message: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// Other methods
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
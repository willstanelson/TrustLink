import { NextResponse } from 'next/server';
import { supabaseAdmin, getVerifiedIdentity } from '@/lib/auth-helpers';
import { encryptGiftCard } from '@/lib/encryption';
import crypto from 'crypto';

// ─── Boot-time config guard ───────────────────────────────────────────────────

const GIFT_CARD_HASH_SECRET = process.env.GIFT_CARD_HASH_SECRET;
if (!GIFT_CARD_HASH_SECRET) {
  throw new Error(
    '[GiftCard] GIFT_CARD_HASH_SECRET environment variable is not set. ' +
    'Add it to your .env.local and deployment secrets.',
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_AMOUNT_USD = 2_000;
const REUSABLE_STATUSES = ['cancelled', 'refunded'] as const; 

// ─── Typed error classes ───────────────────────────────────────────────────────

class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string, 
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class AuthError extends AppError {
  constructor(message = 'Session expired. Please log in again.') {
    super(401, message, 'SESSION_EXPIRED');
    this.name = 'AuthError';
  }
}

class ForbiddenError extends AppError {
  constructor(message: string) {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalise(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateEmail(value: unknown): string | null {
  const n = normalise(value);
  if (!n) return null;
  if (!EMAIL_RE.test(n)) throw new ValidationError('Invalid email address format');
  return n;
}

function sanitiseText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function validateUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString().slice(0, 2_048);
  } catch {
    return null;
  }
}

function parseCurrencyAmount(value: unknown): number {
  const n = parseFloat(String(value ?? ''));
  if (isNaN(n)) return NaN;
  return Math.round(n * 100) / 100;
}

function hmacGiftCardCode(code: string): string {
  return crypto
    .createHmac('sha256', GIFT_CARD_HASH_SECRET!)
    .update(code)
    .digest('hex');
}

function assertIdentityMatch(
  callerWallet: string | null | undefined,
  callerEmail: string | null | undefined,
  bodyWallet: string | null | undefined,
  bodyEmail: string | null | undefined,
): void {
  const normCallerWallet = normalise(callerWallet);
  const normCallerEmail  = normalise(callerEmail);
  const normBodyWallet   = normalise(bodyWallet);
  const normBodyEmail    = normalise(bodyEmail);

  if (!normBodyWallet && !normBodyEmail) {
    throw new ForbiddenError('Unauthorized: No buyer identity provided');
  }

  if (normBodyWallet !== null) {
    if (!normCallerWallet || normBodyWallet !== normCallerWallet) {
      throw new ForbiddenError('Unauthorized: Wallet address mismatch');
    }
  }

  if (normBodyEmail !== null) {
    if (!normCallerEmail || normBodyEmail !== normCallerEmail) {
      throw new ForbiddenError('Unauthorized: Email address mismatch');
    }
  }
}

function methodNotAllowed(_req: Request) {
  return NextResponse.json(
    { status: false, message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { status: false, message: 'Content-Type must be application/json', code: 'UNSUPPORTED_MEDIA_TYPE' },
      { status: 415 },
    );
  }

  try {
    let callerWallet: string | null | undefined;
    let callerEmail: string | null | undefined;
    try {
      const identity = await getVerifiedIdentity(req);
      callerWallet   = identity.wallet;
      callerEmail    = identity.email;
    } catch {
      throw new AuthError();
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError('Invalid JSON body');
    }

    const { gc_code: plainTextCode, ...orderData } = body;

    // 🚀 NEW: Explicit Max-Length CPU Spam Guard
    if (typeof plainTextCode !== 'string' || !plainTextCode.trim()) {
      throw new ValidationError('Gift card code is required');
    }
    const trimmedCode = plainTextCode.trim();
    if (trimmedCode.length > 64) {
      throw new ValidationError('Gift card code exceeds maximum allowed length');
    }

    const parsedAmount = parseCurrencyAmount(orderData.gc_amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new ValidationError('Invalid gift card amount');
    }
    if (parsedAmount > MAX_AMOUNT_USD) {
      throw new ValidationError(`Gift card amount cannot exceed $${MAX_AMOUNT_USD.toLocaleString()}`);
    }

    const sellerIdentifier = sanitiseText(orderData.seller_identifier, 254);
    if (!sellerIdentifier) throw new ValidationError('Seller identifier is required');

    const gcBrand = sanitiseText(orderData.gc_brand, 50);
    if (!gcBrand) throw new ValidationError('Gift card brand is required');

    const buyerWallet = normalise(orderData.buyer_wallet);
    const buyerEmail  = validateEmail(orderData.buyer_email);
    const sellerEmail = validateEmail(orderData.seller_email);
    const gcImageUrl  = validateUrl(orderData.gc_image_url);

    assertIdentityMatch(
      callerWallet,
      callerEmail,
      buyerWallet,
      buyerEmail,
    );

    let encryptedCode: string;
    let codeHash: string;
    try {
      codeHash      = hmacGiftCardCode(trimmedCode);
      encryptedCode = encryptGiftCard(trimmedCode);
    } catch (err) {
      if (err instanceof AppError) throw err; 
      console.error('[GiftCard] Code securing failed');
      throw new AppError(500, 'Failed to secure gift card code', 'ENCRYPTION_ERROR');
    }

    const { data: existing, error: dupError } = await supabaseAdmin
      .from('escrow_orders')
      .select('id')
      .eq('gc_code_hash', codeHash)
      .not('status', 'in', `(${REUSABLE_STATUSES.map(s => `"${s}"`).join(',')})`)
      .maybeSingle();

    if (dupError) {
      const hint = dupError.code === 'PGRST116'
        ? 'Duplicate active orders detected — contact support'
        : 'Could not verify gift card uniqueness';
      console.error('[GiftCard] Duplicate check error:', dupError.code, dupError.message);
      throw new AppError(500, hint, 'DB_ERROR');
    }
    if (existing) {
      throw new ValidationError('This gift card code is already in an active or completed escrow');
    }

    const { data, error } = await supabaseAdmin
      .from('escrow_orders')
      .insert({
        buyer_wallet_address: buyerWallet, 
        buyer_email:          buyerEmail,
        seller_email:         sellerEmail,
        seller_identifier:    sellerIdentifier,
        amount:               parsedAmount,
        token_symbol:         'USD',
        gc_brand:             gcBrand,
        gift_card_code:       encryptedCode,
        gc_code_hash:         codeHash,
        gc_image_url:         gcImageUrl,
        trade_type:           'GIFT_CARD',
        status:               'secured',
        paystack_ref:         null,
        network:              null,
        reveal_attempts:      0,
      })
      .select(`
        id, status, amount, gc_brand, trade_type,
        created_at, gc_image_url,
        buyer_email, buyer_wallet_address,
        seller_identifier, reveal_attempts
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ValidationError('This gift card code is already in an active or completed escrow');
      }
      console.error('[GiftCard] DB insert error:', error.code, error.message);
      throw new AppError(500, 'Failed to create escrow order', 'DB_INSERT_ERROR');
    }

    return NextResponse.json({ status: true, order: data }, { status: 201 });

  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { status: false, message: err.message, code: err.code },
        { status: err.statusCode },
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error('[GiftCard] Unexpected error:', message);
    return NextResponse.json(
      { status: false, message: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

export const GET    = methodNotAllowed;
export const PUT    = methodNotAllowed;
export const PATCH  = methodNotAllowed;
export const DELETE = methodNotAllowed;
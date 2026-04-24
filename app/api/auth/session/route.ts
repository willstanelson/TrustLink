import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { PrivyClient, User, WalletWithMetadata, AuthError } from '@privy-io/server-auth';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

// ==========================================
// IN-MEMORY RATE LIMITER (with Auto-Pruning)
// ==========================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute window
  const maxRequests = 10;  // max 10 session calls per minute per IP

  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }

  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (entry.count >= maxRequests) return true;

  entry.count++;
  return false;
}

// ==========================================
// TYPE-SAFE EMAIL EXTRACTION
// ==========================================
const getEmailFromPrivyUser = (privyUser: User): string | null => {
  for (const account of privyUser.linkedAccounts) {
    if (account.type === 'email' && account.address) {
      return account.address.toLowerCase();
    }
    if (account.type === 'google_oauth' && account.email) {
      return account.email.toLowerCase();
    }
    if (account.type === 'apple_oauth' && account.email) {
      return account.email.toLowerCase();
    }
    if (account.type === 'discord_oauth' && account.email) {
      return account.email.toLowerCase();
    }
  }
  return null;
};

export async function POST(req: Request) {
  // 1. CRITICAL SERVER CHECK (Fail fast, waste zero external calls)
  if (!process.env.SUPABASE_JWT_SECRET) {
    console.error('CRITICAL: SUPABASE_JWT_SECRET is missing during a session request.');
    return NextResponse.json({ error: 'Internal server misconfiguration' }, { status: 500 });
  }

  // 2. Rate Limit Check with properly parsed Proxy IPs
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const privyToken = authHeader.split(' ')[1];

    // 3. Verify the Privy token (returns lightweight claims)
    const claims = await privy.verifyAuthToken(privyToken);

    // 4. Fetch the FULL user profile from Privy using the verified ID
    const privyUser: User = await privy.getUser(claims.userId);

    // 5. Safely extract identifiers from the full typed user object
    const walletAccount = privyUser.linkedAccounts.find(
      (a): a is WalletWithMetadata => a.type === 'wallet'
    );
    const walletAddress = walletAccount?.address?.toLowerCase() ?? null;
    
    const emailAddress = getEmailFromPrivyUser(privyUser);

    if (!walletAddress && !emailAddress) {
      return NextResponse.json({ error: 'No valid identity found' }, { status: 400 });
    }

    // 6. Mint the custom Supabase JWT using the verified ID
    const supabaseJwt = jwt.sign(
      {
        sub: claims.userId,
        role: 'authenticated',
        wallet_address: walletAddress, 
        email_address: emailAddress, 
        iss: process.env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1',
        aud: 'authenticated',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      },
      process.env.SUPABASE_JWT_SECRET // TypeScript knows this is safe because of the guard at the top
    );

    return NextResponse.json({ token: supabaseJwt, walletAddress, emailAddress });
  } catch (err: unknown) {
    console.error('Session error:', err);

    // Explicit type checking for SDK-defined auth errors
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Unhandled server errors or network timeouts
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
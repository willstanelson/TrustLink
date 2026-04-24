import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { PrivyClient } from '@privy-io/server-auth';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const getEmailFromPrivyUser = (privyUser: any): string | null => {
  for (const account of privyUser.linkedAccounts ?? []) {
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
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const privyToken = authHeader.split(' ')[1];

    // 1. Verify the Privy token
    const privyUser = await privy.verifyAuthToken(privyToken);

    // 2. Safely extract identifiers
    const walletAccount = privyUser.linkedAccounts?.find(a => a.type === 'wallet');
    const walletAddress = walletAccount?.address?.toLowerCase() || null;
    const emailAddress = getEmailFromPrivyUser(privyUser);

    if (!walletAddress && !emailAddress) {
      return NextResponse.json({ error: 'No valid identity found' }, { status: 400 });
    }

    if (!process.env.SUPABASE_JWT_SECRET) {
        throw new Error("Missing SUPABASE_JWT_SECRET environment variable");
    }

    // 3. Mint the custom Supabase JWT
    const supabaseJwt = jwt.sign(
      {
        sub: privyUser.userId,
        role: 'authenticated',
        wallet_address: walletAddress, 
        email_address: emailAddress, 
        iss: process.env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1',
        aud: 'authenticated',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      },
      process.env.SUPABASE_JWT_SECRET
    );

    return NextResponse.json({ token: supabaseJwt, walletAddress, emailAddress });
  } catch (err: any) {
    console.error('Session error:', err);
    return NextResponse.json({ error: 'Invalid or expired Privy token' }, { status: 401 });
  }
}
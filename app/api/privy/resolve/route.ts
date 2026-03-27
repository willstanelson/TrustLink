import { NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';

// Initialize the Privy server client
const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID as string,
  process.env.PRIVY_APP_SECRET as string
);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ status: false, message: "Email is required" }, { status: 400 });
    }

    // 1. Search Privy for a user with this email
    const user = await privy.getUserByEmail(email);
    
    if (!user) {
      return NextResponse.json({ status: false, message: "User not found. They must log into TrustLink first." }, { status: 404 });
    }

    // 2. Find their linked wallet address (✅ THE FIX: Force TypeScript to accept it)
    const walletAccount: any = user.linkedAccounts.find((acc) => acc.type === 'wallet');

    if (!walletAccount || !walletAccount.address) {
      return NextResponse.json({ status: false, message: "User found, but they don't have a wallet yet." }, { status: 400 });
    }

    // 3. Return the 0x address!
    return NextResponse.json({ 
        status: true, 
        address: walletAccount.address 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Privy Resolve Error:", error);
    return NextResponse.json({ status: false, message: "Failed to resolve email to wallet." }, { status: 500 });
  }
}
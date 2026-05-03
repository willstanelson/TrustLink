// app/api/trust/claim-level/route.ts
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 1. Grab the Privy token from the headers
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized: Missing Token" }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    // 2. Verify the token securely using Privy's Server SDK
    const privy = new PrivyClient(
      process.env.NEXT_PUBLIC_PRIVY_APP_ID!, 
      process.env.PRIVY_APP_SECRET!
    );
    const verifiedClaims = await privy.verifyAuthToken(token);
    
    // 3. Extract the guaranteed, cryptographically verified wallet address
    const user = await privy.getUser(verifiedClaims.userId);
    const walletAddress = user.wallet?.address;

    if (!walletAddress) {
      return NextResponse.json({ error: "No Web3 wallet linked to this account" }, { status: 400 });
    }

    // 4. Initialize Supabase Admin Client (Bypasses RLS)
    // We use the SERVICE_ROLE_KEY because our server has already verified the user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    // 5. Fetch profile using wallet_address (Matching your frontend architecture)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        current_trust_level, kyc_completed, profile_completed,
        tx_this_level, volume_this_level, staked_amount_usd,
        clean_streak_days, created_at, lifetime_completed_tx
      `)
      .ilike('wallet_address', walletAddress)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "Profile not found in database" }, { status: 404 });
    }

    const currentLevel = profile.current_trust_level || 0;
    const targetLevel = currentLevel + 1;
    const daysActive = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000);

    let isEligible = false;
    let missingRequirement = "";

    switch (targetLevel) {
      case 1:
        isEligible = profile.kyc_completed && profile.profile_completed && (profile.lifetime_completed_tx || 0) >= 15;
        missingRequirement = "KYC, completed profile, and 15 lifetime transactions required.";
        break;
      case 2:
        isEligible = (profile.tx_this_level || 0) >= 20 && (profile.volume_this_level || 0) >= 1000 && (profile.staked_amount_usd || 0) >= 100;
        missingRequirement = "20 tx, $1,000 volume this phase, and $100 staked required.";
        break;
      case 3:
        isEligible = (profile.tx_this_level || 0) >= 25 && (profile.volume_this_level || 0) >= 5000 && (profile.staked_amount_usd || 0) >= 1000 && daysActive >= 180;
        missingRequirement = "25 tx, $5k volume, $1k staked, and 6 months active required.";
        break;
      case 4:
        isEligible = (profile.tx_this_level || 0) >= 50 && (profile.volume_this_level || 0) >= 15000 && (profile.staked_amount_usd || 0) >= 5000 && daysActive >= 365;
        missingRequirement = "50 tx, $15k volume, $5k staked, and 12 months active required.";
        break;
      case 5:
        isEligible = (profile.tx_this_level || 0) >= 100 && (profile.volume_this_level || 0) >= 50000 && (profile.staked_amount_usd || 0) >= 15000 && daysActive >= 540 && (profile.clean_streak_days || 0) >= 60;
        missingRequirement = "100 tx, $50k volume, $15k staked, 18 months, and 60-day clean streak required.";
        break;
      default:
        return NextResponse.json({ error: "Maximum level reached" }, { status: 400 });
    }

    if (!isEligible) {
      return NextResponse.json({ error: "Requirements not met", details: missingRequirement }, { status: 403 });
    }

    // 6. The Secure Promotion (Using wallet_address)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        current_trust_level: targetLevel,
        tx_this_level: 0,
        volume_this_level: 0
      })
      .ilike('wallet_address', walletAddress)
      .eq('current_trust_level', currentLevel); 

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: "Level already claimed or changed" }, { status: 409 });
      }
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully promoted to Level ${targetLevel}! Current phase stats have been reset.`,
      newLevel: targetLevel
    });

  } catch (err: any) {
    console.error("Claim Level Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
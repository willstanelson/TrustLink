// lib/trust.ts

export function calculateTrustStats(profile: any) {
  if (!profile) return null;

  const daysActive = profile.created_at 
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
    : 0;

  // Raw Score Calculation
  let rawScore = 15; // Base score after KYC/Profile

  const totalTx = (profile.lifetime_completed_tx || 0) + (profile.lifetime_disputed_tx || 0);
  const bayesian = totalTx > 0 
    ? (profile.lifetime_completed_tx + 12) / (totalTx + 12) 
    : 0.5;

  rawScore += bayesian * 32;                                      // Success Rate
  rawScore += Math.min(40, Math.log10((profile.lifetime_volume_usd || 0) + 1) * 8.2); // Volume
  rawScore += Math.min(15, Math.sqrt(profile.unique_buyers || 1) * 2.8);             // Diversity
  rawScore += Math.min(22, daysActive / 3);                                           // Time
  rawScore += Math.min(28, Math.log10((profile.staked_amount_usd || 0) + 1) * 7.8);  // Staking
  rawScore += Math.min(16, Math.max(0, (profile.clean_streak_days || 0) - 14) * 0.6); // Streak

  // Dispute Penalty
  rawScore -= Math.min(45, (profile.lifetime_disputed_tx || 0) * 9);

  const mathScore = Math.max(8, Math.min(100, Math.round(rawScore)));

  // === HARD CAP BASED ON CURRENT LEVEL ===
  const currentLevel = Math.max(0, profile.current_trust_level || 0);
  
  let maxAllowedScore = 25; // Default Level 1 cap
  if (currentLevel === 5) maxAllowedScore = 100;
  else if (currentLevel === 4) maxAllowedScore = 89;
  else if (currentLevel === 3) maxAllowedScore = 72;
  else if (currentLevel === 2) maxAllowedScore = 50;

  const finalScore = Math.min(mathScore, maxAllowedScore);

  // Check if user can claim next level
  const isEligibleForNext = checkEligibilityForLevel(profile, currentLevel + 1, daysActive);

  return {
    score: finalScore,
    level: currentLevel || 1,
    title: getLevelTitle(currentLevel || 1),
    isEligibleForNext,
    rawScore: mathScore,        // Used for XP Cap warning
  };
}

function checkEligibilityForLevel(profile: any, targetLevel: number, daysActive: number): boolean {
  switch (targetLevel) {
    case 1:
      return !!(profile.kyc_completed && profile.profile_completed && (profile.lifetime_completed_tx || 0) >= 15);
    case 2:
      return (profile.tx_this_level || 0) >= 20 && 
             (profile.volume_this_level || 0) >= 1000 && 
             (profile.staked_amount_usd || 0) >= 100;
    case 3:
      return (profile.tx_this_level || 0) >= 25 && 
             (profile.volume_this_level || 0) >= 5000 && 
             (profile.staked_amount_usd || 0) >= 1000 && 
             daysActive >= 180;
    case 4:
      return (profile.tx_this_level || 0) >= 50 && 
             (profile.volume_this_level || 0) >= 15000 && 
             (profile.staked_amount_usd || 0) >= 5000 && 
             daysActive >= 365;
    case 5:
      return (profile.tx_this_level || 0) >= 100 && 
             (profile.volume_this_level || 0) >= 50000 && 
             (profile.staked_amount_usd || 0) >= 15000 && 
             daysActive >= 540 && 
             (profile.clean_streak_days || 0) >= 60;
    default:
      return false;
  }
}

function getLevelTitle(level: number): string {
  const titles = ["New User", "Verified", "Trusted Trader", "Established", "Veteran", "Legendary"];
  return titles[level] || "Unknown";
}
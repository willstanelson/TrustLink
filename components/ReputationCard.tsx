import { calculateTrustStats } from '@/lib/trust';
import ClaimLevelButton from '@/components/ClaimLevelButton';

export default function ReputationCard({ profile }: { profile: any }) {
  const trustStats = calculateTrustStats(profile);
  if (!trustStats) return null;

  const levelColors: Record<number, string> = {
    1: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    2: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    3: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    4: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    5: 'text-violet-400 bg-violet-500/10 border-violet-500/20 ring-1 ring-violet-400/30',
  };

  const theme = levelColors[trustStats.level] || levelColors[1];

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-white">Trust Reputation</h2>
          <p className="text-sm text-slate-400 mt-1">
            Level {trustStats.level} • {trustStats.title}
          </p>
        </div>

        {/* Badge */}
        <div className={`px-4 py-1.5 rounded-xl text-base font-black border flex items-center gap-2 ${theme}`}>
          <span>{trustStats.score}%</span>
          {trustStats.level === 5 && <span className="text-amber-400 text-lg">👑</span>}
        </div>
      </div>

      {/* XP Cap Warning */}
      {trustStats.rawScore > trustStats.score && (
        <div className="mb-5 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm">
          <p className="text-amber-400 font-medium">⚠️ Your potential is higher</p>
          <p className="text-amber-200/75 text-xs mt-1">
            You have a raw score of <strong>{trustStats.rawScore}%</strong>, but you're capped at Level {trustStats.level}. 
            Complete the requirements to unlock Level {trustStats.level + 1}.
          </p>
        </div>
      )}

      {/* Progress Info (Optional but helpful) */}
      <div className="text-xs text-slate-400 space-y-1 mb-6">
        <div>Staked: <span className="text-white">${(profile.staked_amount_usd || 0).toLocaleString()}</span></div>
        <div>Clean Streak: <span className="text-white">{profile.clean_streak_days || 0} days</span></div>
      </div>

      {/* Claim Button */}
      {trustStats.level < 5 && (
        <ClaimLevelButton 
          currentLevel={trustStats.level} 
          isEligible={trustStats.isEligibleForNext} 
          onSuccess={() => window.location.reload()} // or use React Query / SWR invalidate
        />
      )}
    </div>
  );
}
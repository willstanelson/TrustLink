import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full bg-[#0b0f19]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#ffdd40]" />
        <p className="text-[#aaaaaa] text-sm font-mono tracking-widest uppercase">Initializing Secure Env</p>
      </div>
    </div>
  );
}
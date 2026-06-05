'use client';
import { LayoutDashboard, FileSignature, UserCircle, Wallet, Settings, LogOut } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userName: string;
}

export default function Sidebar({ activeTab, setActiveTab, userName }: SidebarProps) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'escrow', label: 'Escrow Contracts', icon: FileSignature },
    { id: 'profile', label: 'Profile', icon: UserCircle },
    { id: 'earnings', label: 'Earnings & Staking', icon: Wallet },
    { id: 'settings', label: 'Account & Security', icon: Settings },
  ];

  const displayName = userName ? userName.split(' ')[0] : 'Seller';
  
  // Dynamically generate initials (e.g., "William Tudor" -> "WT")
  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'T';

  return (
    <aside className="w-64 bg-[#0b0f19] border-r border-[#333333] h-screen flex flex-col fixed left-0 top-0">
      {/* Brand & Personalization */}
      <div className="p-6 border-b border-[#333333]">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center">
            <span className="text-[#0b0f19] font-black text-xl leading-none tracking-tighter">TL</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">TrustLink</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1e1f26] border border-[#333333] flex items-center justify-center text-emerald-400 font-bold text-sm">
            {initials}
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">{displayName}'s Dashboard</h2>
            <p className="text-[#aaaaaa] text-xs mt-0.5">Welcome back, {displayName}!</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'text-[#aaaaaa] hover:bg-[#1e1f26] hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* System Status & Logout */}
      <div className="p-6 border-t border-[#333333]">
        <div className="flex items-center gap-2 mb-6 px-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[#aaaaaa] text-xs font-mono">System Online</span>
        </div>
        <button className="w-full flex items-center gap-3 px-4 py-3 text-[#f44336] hover:bg-[#f44336]/10 rounded-lg text-sm font-medium transition-colors">
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
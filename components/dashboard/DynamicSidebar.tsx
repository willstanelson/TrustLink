'use client';
import { 
  LayoutDashboard, FileSignature, Search, UserCircle, 
  Wallet, Settings, Star, ShieldCheck, Briefcase 
} from 'lucide-react';

interface SidebarProps {
  appMode: 'xpress' | 'market';
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isVerifiedSeller: boolean;
}

export default function DynamicSidebar({ appMode, activeTab, setActiveTab, isVerifiedSeller }: SidebarProps) {
  const xpressNav = [
    { id: 'xpress-home', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'xpress-escrows', label: 'My Escrows', icon: FileSignature },
    { id: 'xpress-settings', label: 'Settings', icon: Settings },
  ];

  const marketBuyerNav = [
    { id: 'market-discover', label: 'Market Home', icon: Search },
    { id: 'market-escrows', label: 'My Hires', icon: FileSignature },
    { id: 'market-profile', label: 'Buyer Profile', icon: UserCircle },
  ];

  const marketSellerNav = [
    { id: 'seller-orders', label: 'Incoming Orders', icon: Briefcase },
    { id: 'seller-earnings', label: 'Earnings & Bucket', icon: Wallet },
    { id: 'seller-reputation', label: 'My Reputation', icon: Star },
  ];

  const currentNav = appMode === 'xpress' ? xpressNav : marketBuyerNav;

  return (
    <aside className="hidden md:flex flex-col w-64 bg-[#0b0f19] border-r border-[#333333] h-[calc(100vh-4rem)] fixed left-0 top-16">
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <div className="text-xs font-bold text-[#555555] uppercase tracking-wider mb-4 px-2">
          {appMode === 'xpress' ? 'P2P Escrow' : 'Local Services'}
        </div>

        {currentNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-[#aaaaaa] hover:bg-[#1e1f26] hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}

        {appMode === 'market' && (
          <div className="pt-6 mt-6 border-t border-[#333333]">
            {isVerifiedSeller ? (
              <>
                <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-4 px-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Seller Hub
                </div>
                {marketSellerNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-[#aaaaaa] hover:bg-[#1e1f26] hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  );
                })}
              </>
            ) : (
              <div className="bg-[#1e1f26] border border-[#333333] rounded-xl p-4 text-center">
                <ShieldCheck className="w-8 h-8 text-[#aaaaaa] mx-auto mb-2" />
                <h4 className="text-white text-sm font-bold mb-1">Offer Services</h4>
                <p className="text-[#aaaaaa] text-xs mb-3">Complete Tier 2 KYC to start earning.</p>
                <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#0b0f19] font-bold text-xs py-2 rounded-lg transition-colors">
                  Upgrade to Seller
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
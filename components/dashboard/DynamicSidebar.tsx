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
  isOpen: boolean;
}

export default function DynamicSidebar({ appMode, activeTab, setActiveTab, isVerifiedSeller, isOpen }: SidebarProps) {
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
    <aside className={`hidden md:flex flex-col bg-[#0b0f19] border-r border-[#333333] h-[calc(100vh-76px)] fixed left-0 top-[76px] z-[90] transition-all duration-300 ease-in-out ${
      isOpen ? 'w-64' : 'w-16'
    }`}>
      <nav className="flex-1 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
        
        <div className={`text-xs font-bold text-[#555555] uppercase tracking-wider mb-4 px-4 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
          {appMode === 'xpress' ? 'P2P Escrow' : 'Local Services'}
        </div>

        {currentNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-all ${
                isOpen ? 'px-4 mx-2 w-[calc(100%-16px)]' : 'justify-center mx-1 w-[calc(100%-8px)]'
              } ${
                isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-[#aaaaaa] hover:bg-[#1e1f26] hover:text-white'
              }`}
              title={!isOpen ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className={`whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {appMode === 'market' && (
          <div className="pt-6 mt-6 border-t border-[#333333]">
            {isVerifiedSeller ? (
              <>
                <div className={`text-xs font-bold text-emerald-500 uppercase tracking-wider mb-4 px-4 flex items-center gap-2 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" /> 
                  {isOpen && <span>Seller Hub</span>}
                </div>
                {marketSellerNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-all ${
                        isOpen ? 'px-4 mx-2 w-[calc(100%-16px)]' : 'justify-center mx-1 w-[calc(100%-8px)]'
                      } ${
                        isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-[#aaaaaa] hover:bg-[#1e1f26] hover:text-white'
                      }`}
                      title={!isOpen ? item.label : undefined}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className={`whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </>
            ) : (
              <div className={`transition-opacity duration-200 ${isOpen ? 'opacity-100 px-4' : 'opacity-0 hidden'}`}>
                <div className="bg-[#1e1f26] border border-[#333333] rounded-xl p-4 text-center">
                  <ShieldCheck className="w-8 h-8 text-[#aaaaaa] mx-auto mb-2" />
                  <h4 className="text-white text-sm font-bold mb-1">Offer Services</h4>
                  <p className="text-[#aaaaaa] text-xs mb-3">Complete Tier 2 KYC to start earning.</p>
                  <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#0b0f19] font-bold text-xs py-2 rounded-lg transition-colors">
                    Upgrade
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
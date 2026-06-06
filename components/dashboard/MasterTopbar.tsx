'use client';
import { Bell, Menu, Search, Globe, Wallet, LogOut, ChevronDown, X, ShieldCheck, Bitcoin, Banknote, Gift, Info } from 'lucide-react';
import { useChainId, useSwitchChain } from 'wagmi';
import { useRef, useEffect } from 'react';
import { CHAIN_CONFIG } from '@/app/constants';
import type { AppNotification } from '@/app/dashboard/page';

interface XpressControls {
  networkAlerts: Record<number, number>;
  totalActionableOrders: number;
  isUnsupportedNetwork: boolean;
  activeChain: { name: string };
  formattedBalance: string;
  activeEmail?: string;
  userAddress?: string;
  isNetworkListOpen: boolean;
  setIsNetworkListOpen: (v: boolean) => void;
  onOpenWallet: () => void;
  onLogout: () => void;
}

interface TopbarProps {
  appMode: 'xpress' | 'market';
  setAppMode: (mode: 'xpress' | 'market') => void;
  // Sidebar Toggle
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  // Notifications
  notifications: AppNotification[];
  notifPanelOpen: boolean;
  setNotifPanelOpen: (v: boolean) => void;
  onMarkAllRead: () => void;
  hasGlobalAlert: boolean;
  // Search
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  // Wallet/network
  xpress: XpressControls | null;
}

function NotifIcon({ notif }: { notif: AppNotification }) {
  if (notif.type === 'system') {
    return (
      <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
        <Info className="w-4 h-4 text-blue-400" />
      </div>
    );
  }
  const trade = notif.trade_type;
  if (trade === 'FIAT') {
    return (
      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
        <Banknote className="w-4 h-4 text-emerald-400" />
      </div>
    );
  }
  if (trade === 'GIFT_CARD') {
    return (
      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
        <Gift className="w-4 h-4 text-indigo-400" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
      <Bitcoin className="w-4 h-4 text-purple-400" />
    </div>
  );
}

export default function MasterTopbar({
  appMode,
  setAppMode,
  sidebarOpen,
  toggleSidebar,
  notifications,
  notifPanelOpen,
  setNotifPanelOpen,
  onMarkAllRead,
  hasGlobalAlert,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  xpress,
}: TopbarProps) {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const networkDropdownRef = useRef<HTMLDivElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Close network dropdown on outside click
  useEffect(() => {
    if (!xpress?.isNetworkListOpen) return;
    function handler(e: MouseEvent) {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(e.target as Node)) {
        xpress?.setIsNetworkListOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [xpress?.isNetworkListOpen]);

  // Close notif panel on outside click
  useEffect(() => {
    if (!notifPanelOpen) return;
    function handler(e: MouseEvent) {
      if (
        notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setNotifPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifPanelOpen, setNotifPanelOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <header className="fixed w-full h-[76px] bg-[#0b0f19] border-b border-[#333333] flex items-center justify-between px-4 sm:px-6 top-0 z-[150] gap-4">
        
        <div className="flex items-center gap-4 min-w-max">
          {/* Hamburger Menu - Always visible now to toggle the sidebar */}
          <button onClick={toggleSidebar} className="text-[#aaaaaa] hover:text-white relative z-[110] transition-colors" aria-label="Toggle Menu">
            <Menu className="w-6 h-6" />
          </button>

          <div className="hidden md:flex items-center gap-2 mr-4">
            <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center">
              <span className="text-[#0b0f19] font-black text-xl leading-none tracking-tighter">TL</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight hidden lg:block">TrustLink</span>
          </div>

          <div className="flex bg-[#1e1f26] border border-[#333333] rounded-lg p-1 relative z-[110]">
            <button
              onClick={() => setAppMode('xpress')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                appMode === 'xpress' ? 'bg-emerald-500 text-[#0b0f19] shadow-sm' : 'text-[#aaaaaa] hover:text-white'
              }`}
            >
              Xpress
            </button>
            <button
              onClick={() => setAppMode('market')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                appMode === 'market' ? 'bg-emerald-500 text-[#0b0f19] shadow-sm' : 'text-[#aaaaaa] hover:text-white'
              }`}
            >
              Market
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 min-w-max">
          {/* Search */}
          <form onSubmit={onSearchSubmit} className="relative group hidden lg:block" role="search">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors" aria-hidden />
            </div>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoComplete="off"
              aria-label="Search seller by email or wallet"
              className="block w-48 pl-10 pr-3 py-2 border border-[#333333] rounded-xl bg-[#1e1f26] text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition-all"
              placeholder="Search seller…"
            />
          </form>

          {/* Global notification bell */}
          <button
            ref={bellRef}
            onClick={() => setNotifPanelOpen(!notifPanelOpen)}
            className="relative p-2.5 text-[#aaaaaa] hover:text-white transition-colors bg-[#1e1f26] rounded-xl border border-[#333333] hover:border-emerald-500/50"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {hasGlobalAlert && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-[#0b0f19] rounded-full animate-pulse" />
            )}
          </button>

          {/* Network selector */}
          {xpress && (
            <div className="relative hidden sm:block" ref={networkDropdownRef}>
              <button
                type="button"
                aria-label="Select network"
                aria-expanded={xpress.isNetworkListOpen}
                onClick={() => xpress.setIsNetworkListOpen(!xpress.isNetworkListOpen)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-xs font-bold ${
                  xpress.isUnsupportedNetwork
                    ? 'bg-red-500/10 border-red-500 text-red-400'
                    : 'bg-[#1e1f26] border-[#333333] text-white hover:border-emerald-500/50'
                }`}
              >
                <Globe className="w-4 h-4" aria-hidden />
                <span className="hidden sm:block">
                  {xpress.isUnsupportedNetwork ? 'Unsupported' : xpress.activeChain.name}
                </span>
                {xpress.totalActionableOrders > 0 && (
                  <span className="flex items-center justify-center bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full animate-pulse">
                    {xpress.totalActionableOrders}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 opacity-50" aria-hidden />
              </button>

              {xpress.isNetworkListOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1e1f26] border border-[#333333] rounded-xl z-[150] overflow-hidden shadow-xl">                  {Object.entries(CHAIN_CONFIG).map(([id, config]) => {
                    const chainIdNum = Number(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { switchChain?.({ chainId: chainIdNum }); xpress.setIsNetworkListOpen(false); }}
                        className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-[#2a2b36] transition-colors flex items-center justify-between ${
                          chainIdNum === chainId ? 'text-emerald-400 bg-[#2a2b36]/50' : 'text-slate-300'
                        }`}
                      >
                        <span>{config.name}</span>
                        {xpress.networkAlerts[chainIdNum] > 0 && (
                          <span className="flex items-center justify-center bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full">
                            {xpress.networkAlerts[chainIdNum]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Wallet button */}
          {xpress && (
            <button
              type="button"
              aria-label="Open wallet"
              onClick={xpress.onOpenWallet}
              className="flex items-center gap-3 bg-[#1e1f26] hover:bg-[#2a2b36] border border-[#333333] hover:border-emerald-500/50 px-4 py-2.5 rounded-xl transition-all shadow-lg"
            >
              <div className="flex flex-col items-start hidden sm:flex">
                <span className="font-mono text-sm font-bold truncate max-w-[100px] sm:max-w-[140px] text-white">
                  {xpress.activeEmail
                    ? xpress.activeEmail.split('@')[0]
                    : xpress.userAddress
                    ? `${xpress.userAddress.slice(0, 6)}…${xpress.userAddress.slice(-4)}`
                    : 'Wallet'}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold leading-none mt-0.5">
                  {xpress.formattedBalance}
                </span>
              </div>
              <Wallet className="w-5 h-5 text-emerald-400" aria-hidden />
            </button>
          )}

          {/* Logout */}
          {xpress && (
            <button
              type="button"
              aria-label="Log out"
              onClick={xpress.onLogout}
              className="hidden sm:block bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2.5 rounded-xl border border-red-500/20 transition-all"
            >
              <LogOut className="w-5 h-5" aria-hidden />
            </button>
          )}
        </div>
      </header>

      {/* Notification panel */}
      {notifPanelOpen && (
        <div
          ref={notifPanelRef}
          className="fixed top-[84px] right-4 w-[360px] max-h-[520px] bg-[#0d1320] border border-[#1e2a3a] rounded-2xl shadow-2xl z-[200] flex flex-col overflow-hidden"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2a3a]">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setNotifPanelOpen(false)}
                className="text-[#aaaaaa] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 divide-y divide-[#1e2a3a]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <Bell className="w-8 h-8 text-[#333] mb-3" />
                <p className="text-[#555] text-sm font-medium">All caught up</p>
                <p className="text-[#444] text-xs mt-1">New orders and system updates will appear here</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex gap-3 px-5 py-4 transition-colors cursor-pointer ${
                    notif.read ? 'opacity-60 hover:opacity-80' : 'hover:bg-[#131a2a]'
                  }`}
                >
                  <NotifIcon notif={notif} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold leading-snug ${notif.read ? 'text-[#aaaaaa]' : 'text-white'}`}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-[#666] mt-0.5 truncate">{notif.body}</p>
                    <p className="text-[10px] text-[#444] mt-1">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-[#1e2a3a] text-center">
            <p className="text-[10px] text-[#444] font-medium uppercase tracking-wider">
              Covers Crypto · Bank Transfer · Gift Card · System
            </p>
          </div>
        </div>
      )}
    </>
  );
}
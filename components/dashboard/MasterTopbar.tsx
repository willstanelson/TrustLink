'use client';
import { Bell, Menu, Search, Globe, Wallet, LogOut, ChevronDown } from 'lucide-react';
import { useChainId, useSwitchChain } from 'wagmi';
import { useRef, useEffect } from 'react';
import { CHAIN_CONFIG } from '@/app/constants';

interface TopbarProps {
  appMode: 'xpress' | 'market';
  setAppMode: (mode: 'xpress' | 'market') => void;
  hasGlobalAlert: boolean;
  // Xpress controls — always visible in topbar regardless of mode
  xpress: {
    searchQuery: string;
    onSearchChange: (val: string) => void;
    onSearchSubmit: (e: React.FormEvent) => void;
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
  } | null;
}

export default function MasterTopbar({
  appMode,
  setAppMode,
  hasGlobalAlert,
  xpress,
}: TopbarProps) {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const networkDropdownRef = useRef<HTMLDivElement>(null);

  // Close network dropdown on outside click
  useEffect(() => {
    if (!xpress?.isNetworkListOpen) return;
    function handler(e: MouseEvent) {
      if (
        networkDropdownRef.current &&
        !networkDropdownRef.current.contains(e.target as Node)
      ) {
        xpress?.setIsNetworkListOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [xpress?.isNetworkListOpen]);

  return (
    <header className="h-16 bg-[#0b0f19] border-b border-[#333333] flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50">

      {/* ── Left: Brand + Master Toggle ──────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button className="md:hidden text-[#aaaaaa] hover:text-white" aria-label="Toggle Menu">
          <Menu className="w-6 h-6" />
        </button>

        <div className="hidden md:flex items-center gap-2 mr-8">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center">
            <span className="text-[#0b0f19] font-black text-xl leading-none tracking-tighter">TL</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight hidden lg:block">TrustLink</span>
        </div>

        <div className="flex bg-[#1e1f26] border border-[#333333] rounded-lg p-1">
          <button
            onClick={() => setAppMode('xpress')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
              appMode === 'xpress'
                ? 'bg-emerald-500 text-[#0b0f19] shadow-sm'
                : 'text-[#aaaaaa] hover:text-white'
            }`}
          >
            Xpress
          </button>
          <button
            onClick={() => setAppMode('market')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
              appMode === 'market'
                ? 'bg-emerald-500 text-[#0b0f19] shadow-sm'
                : 'text-[#aaaaaa] hover:text-white'
            }`}
          >
            Market
          </button>
        </div>
      </div>

      {/* ── Right: Always-visible controls ───────────────────────────────── */}
      <div className="flex items-center gap-3">

        {/* Seller search — hidden on small screens */}
        {xpress && (
          <form
            onSubmit={xpress.onSearchSubmit}
            className="relative group hidden lg:block"
            role="search"
          >
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search
                className="h-4 w-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors"
                aria-hidden
              />
            </div>
            <input
              type="search"
              value={xpress.searchQuery}
              onChange={(e) => xpress.onSearchChange(e.target.value)}
              autoComplete="off"
              aria-label="Search seller by email or wallet"
              className="block w-48 pl-10 pr-3 py-2 border border-[#333333] rounded-xl bg-[#1e1f26] text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition-all"
              placeholder="Search seller…"
            />
          </form>
        )}

        {/* Global notification bell — always visible, both modes */}
        <button
          className="relative p-2 text-[#aaaaaa] hover:text-white transition-colors bg-[#1e1f26] rounded-full border border-[#333333]"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {hasGlobalAlert && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-[#0b0f19] rounded-full animate-pulse" />
          )}
        </button>

        {/* Network selector — always visible */}
        {xpress && (
          <div className="relative" ref={networkDropdownRef}>
            <button
              type="button"
              aria-label="Select network"
              aria-expanded={xpress.isNetworkListOpen}
              onClick={() => xpress.setIsNetworkListOpen(!xpress.isNetworkListOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-xs font-bold ${
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
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#1e1f26] border border-[#333333] rounded-xl z-[100] overflow-hidden shadow-xl">
                {Object.entries(CHAIN_CONFIG).map(([id, config]) => {
                  const chainIdNum = Number(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        switchChain({ chainId: chainIdNum });
                        xpress.setIsNetworkListOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-[#0b0f19] transition-colors flex items-center justify-between ${
                        chainIdNum === chainId
                          ? 'text-emerald-400 bg-[#0b0f19]/50'
                          : 'text-slate-300'
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

        {/* Wallet button — always visible */}
        {xpress && (
          <button
            type="button"
            aria-label="Open wallet"
            onClick={xpress.onOpenWallet}
            className="flex items-center gap-2 bg-[#1e1f26] hover:bg-[#2a2d3a] border border-[#333333] hover:border-emerald-500/50 px-4 py-2 rounded-2xl transition-all"
          >
            <div className="flex flex-col items-start">
              <span className="font-mono text-sm font-bold truncate max-w-[120px] text-white">
                {xpress.activeEmail
                  ? xpress.activeEmail.split('@')[0]
                  : xpress.userAddress
                  ? `${xpress.userAddress.slice(0, 6)}…${xpress.userAddress.slice(-4)}`
                  : 'Wallet'}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold leading-none">
                {xpress.formattedBalance}
              </span>
            </div>
            <Wallet className="w-4 h-4 text-emerald-400" aria-hidden />
          </button>
        )}

        {/* Logout — always visible */}
        {xpress && (
          <button
            type="button"
            aria-label="Log out"
            onClick={xpress.onLogout}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-xl border border-red-500/20 transition-all"
          >
            <LogOut className="w-4 h-4" aria-hidden />
          </button>
        )}

      </div>
    </header>
  );
}
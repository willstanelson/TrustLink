'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useChainId } from 'wagmi';
import { CHAIN_CONFIG, DEFAULT_CHAIN_ID } from '@/app/constants';
import {
  LayoutDashboard,
  WalletCards,
  ShieldCheck,
  Store,
  Briefcase,
  MessageSquare,
  HelpCircle,
  LogOut,
  Globe,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    name: 'Dashboard',
    href: '/escrow',
    icon: LayoutDashboard,
    checkActive: (pathname: string, tab: string | null) => pathname === '/escrow' && tab !== 'deals',
  },
  {
    name: 'Profile & Wallet',
    href: '/profile',
    icon: WalletCards,
    checkActive: (pathname: string) => pathname === '/profile' || pathname.startsWith('/profile'),
  },
  {
    name: 'P2P Escrows',
    href: '/escrow?tab=deals',
    icon: ShieldCheck,
    checkActive: (pathname: string, tab: string | null) => pathname === '/escrow' && tab === 'deals',
  },
  {
    name: 'Marketplace',
    badge: 'Bendansalet',
    href: '/marketplace',
    icon: Store,
    checkActive: (pathname: string) =>
      pathname === '/marketplace' || (pathname.startsWith('/marketplace') && !pathname.startsWith('/marketplace/requests')),
  },
  {
    name: 'Job Requests',
    href: '/marketplace/requests',
    icon: Briefcase,
    checkActive: (pathname: string) => pathname.startsWith('/marketplace/requests'),
  },
  {
    name: 'Trade Rooms',
    href: '/trade',
    icon: MessageSquare,
    checkActive: (pathname: string) => pathname.startsWith('/trade'),
  },
  {
    name: 'Support & Disputes',
    href: '/support',
    icon: HelpCircle,
    checkActive: (pathname: string) => pathname.startsWith('/support'),
  },
];

function SidebarNavigation({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const { authenticated, user, logout } = usePrivy();
  const chainId = useChainId();
  const activeChain = CHAIN_CONFIG[chainId] ?? CHAIN_CONFIG[DEFAULT_CHAIN_ID] ?? { name: 'Plasma Testnet' };

  const userIdentifier =
    user?.email?.address ||
    user?.google?.email ||
    (user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}…${user.wallet.address.slice(-4)}` : 'User');

  return (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* ── Sidebar Header: Brand Logo ── */}
        <div className="flex items-center justify-between border-b border-[#232a45] pr-3">
          <Link
            className="flex items-center px-4 py-5 hover:opacity-90 transition-opacity"
            href="/escrow"
            onClick={onCloseMobile}
          >
            <Image
              alt="TrustLink Software Firm"
              className="h-10 sm:h-11 w-auto object-contain drop-shadow-sm"
              height={55}
              priority
              src="/logo.png"
              width={180}
            />
          </Link>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* ── Navigation Items ── */}
        <nav className="p-4 space-y-1" aria-label="Portal Navigation">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Menu
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.checkActive(pathname, tab);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#161b30]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && !isActive && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#161b30] border border-[#232a45] text-slate-400 font-medium">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Sidebar Footer: Network Indicator & Logout ── */}
      <div className="p-4 border-t border-[#232a45] space-y-3 bg-[#0b0e1b]">
        {/* Active Network Indicator */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#161b30] border border-[#232a45]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-slate-300 truncate">
              {activeChain.name}
            </span>
          </div>
          <Globe className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 ml-2" />
        </div>

        {/* User / Logout */}
        {authenticated ? (
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold flex-shrink-0">
                {userIdentifier[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-medium text-slate-300 truncate max-w-[120px]">
                {userIdentifier}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-violet-600/20"
          >
            Sign In
          </button>
        )}
      </div>
    </div>
  );
}

export default function MacqetPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { ready, authenticated } = usePrivy();
  const pathname = usePathname();
  const router = useRouter();

  const isEscrowRoute = pathname === '/escrow' || pathname?.startsWith('/escrow');

  // Flicker-Free Auth Guard: If accessing /escrow while unauthenticated, redirect to /login
  useEffect(() => {
    if (ready && !authenticated && isEscrowRoute) {
      router.replace('/login');
    }
  }, [ready, authenticated, isEscrowRoute, router]);

  // While mounting or redirecting unauthenticated visitors, render a clean neutral screen
  if (isEscrowRoute && (!ready || !authenticated)) {
    return (
      <div className="min-h-screen w-full bg-[#060812] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Securing escrow session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#060812] text-white">
      {/* ── Fixed Desktop Left Sidebar (w-64) ── */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 bg-[#0b0e1b] border-r border-[#232a45] z-40">
        <Suspense fallback={<div className="p-6 text-slate-500 text-xs">Loading navigation…</div>}>
          <SidebarNavigation />
        </Suspense>
      </aside>

      {/* ── Mobile Top Header ── */}
      <div className="md:hidden fixed top-0 inset-x-0 h-16 bg-[#0b0e1b] border-b border-[#232a45] z-40 px-4 flex items-center justify-between">
        <Link href="/escrow" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center p-1">
            <Image
              src="/logo-icon.png"
              alt="TrustLink Logo"
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
              unoptimized
            />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">TrustLink</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── Mobile Drawer Sidebar ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80%] bg-[#0b0e1b] border-r border-[#232a45] z-50 flex flex-col h-full shadow-2xl">
            <Suspense fallback={<div className="p-6 text-slate-500 text-xs">Loading navigation…</div>}>
              <SidebarNavigation onCloseMobile={() => setMobileMenuOpen(false)} />
            </Suspense>
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <main className="flex-1 ml-0 md:ml-64 min-h-screen bg-[#060812] overflow-y-auto max-md:pt-16">
        {children}
      </main>
    </div>
  );
}

'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import {
  Lock,
  LogOut,
  User,
  Wallet,
  ShieldCheck,
  Store,
  ArrowLeftRight,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const SECTIONS = [
  {
    key: 'escrow',
    label: 'P2P Escrow',
    href: '/escrow',
    icon: ArrowLeftRight,
    description: 'Lock & release funds securely',
  },
  {
    key: 'marketplace',
    label: 'Bendansalet',
    href: '/marketplace',
    icon: Store,
    description: 'Trust-based marketplace',
  },
] as const;

export default function PortalNav() {
  const pathname = usePathname();
  const { authenticated, login, logout, user } = usePrivy();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeEmail =
    user?.email?.address ||
    user?.google?.email ||
    user?.apple?.email ||
    user?.discord?.email;
  const activeWallet = user?.wallet?.address;

  const activeSection = SECTIONS.find(
    (s) => pathname === s.href || pathname.startsWith(s.href + '/')
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* ── Logo + Portal Name */}
          <div className="flex items-center gap-3 min-w-max">
            <Link href="/escrow" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center rotate-3 group-hover:rotate-6 transition-transform">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:flex flex-col leading-none">
                <span className="text-sm font-black text-white tracking-tight">
                  Macqet
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                  TrustLink Portal
                </span>
              </div>
            </Link>
          </div>

          {/* ── Section Switcher (Desktop) */}
          <div className="hidden md:flex items-center bg-slate-900/80 border border-slate-800 rounded-xl p-1 gap-1">
            {SECTIONS.map(({ key, label, href, icon: Icon }) => {
              const isActive =
                pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={key}
                  href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-700/80 text-white shadow-md shadow-slate-900/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* ── Right Section (Auth + Profile) */}
          <div className="flex items-center gap-2">
            {authenticated ? (
              <>
                <Link
                  href="/profile"
                  className="hidden sm:flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 px-3 py-2 rounded-xl transition-all text-sm"
                >
                  <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-slate-300 font-medium truncate max-w-[120px]">
                    {activeEmail
                      ? activeEmail.split('@')[0]
                      : activeWallet
                        ? `${activeWallet.slice(0, 6)}…${activeWallet.slice(-4)}`
                        : 'Profile'}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={logout}
                  className="hidden sm:flex items-center justify-center p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all"
                  aria-label="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>

                {/* ── Mobile Menu Toggle */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={login}
                className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                Log In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile Menu */}
      {mobileMenuOpen && authenticated && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-2">
            {/* Section Switcher */}
            {SECTIONS.map(({ key, label, href, icon: Icon, description }) => {
              const isActive =
                pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={key}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-slate-800 text-white border border-slate-700'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <div>
                    <div className="font-bold text-sm">{label}</div>
                    <div className="text-xs text-slate-500">{description}</div>
                  </div>
                </Link>
              );
            })}

            <div className="border-t border-slate-800 pt-3 mt-3 space-y-2">
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-all"
              >
                <User className="w-5 h-5" />
                <span className="font-bold text-sm">Profile & Settings</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-bold text-sm">Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

'use client';
import React, { useState, useEffect, useRef } from 'react';
import MasterTopbar from '@/components/dashboard/MasterTopbar';
import DynamicSidebar from '@/components/dashboard/DynamicSidebar';
import XpressDashboard from '@/components/xpress/XpressDashboard';
import { useAuth } from '@/context/AuthContext';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-400 border border-red-500/20 bg-red-500/10 rounded-xl">
          Failed to load module. Please refresh the page.
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppShell() {
  const [appMode, setAppMode] = useState<'xpress' | 'market'>('xpress');
  const [activeTab, setActiveTab] = useState('xpress-home');
  const previousMode = useRef(appMode);

  const { profileData } = useAuth();
  const isVerifiedSeller = profileData?.tier_2_verified || false;
  const hasGlobalAlert = (profileData?.unread_notifications ?? 0) > 0;

  // ── Xpress topbar state (lifted here so MasterTopbar can render them) ──────
  const [xpressSearchQuery, setXpressSearchQuery] = useState('');
  const [xpressNetworkAlerts, setXpressNetworkAlerts] = useState<Record<number, number>>({});
  const [xpressTotalActionable, setXpressTotalActionable] = useState(0);
  const [xpressIsUnsupportedNetwork, setXpressIsUnsupportedNetwork] = useState(false);
  const [xpressActiveChain, setXpressActiveChain] = useState<{ name: string }>({ name: '' });
  const [xpressFormattedBalance, setXpressFormattedBalance] = useState('0.00 USDC');
  const [xpressActiveEmail, setXpressActiveEmail] = useState<string | undefined>(undefined);
  const [xpressUserAddress, setXpressUserAddress] = useState<string | undefined>(undefined);
  const [xpressIsNetworkListOpen, setXpressIsNetworkListOpen] = useState(false);
  const [xpressWalletModalOpen, setXpressWalletModalOpen] = useState(false);
  const xpressSearchSubmitRef = useRef<(e: React.FormEvent) => void>(() => {});
  const xpressLogoutRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (previousMode.current !== appMode) {
      if (appMode === 'xpress' && !activeTab.startsWith('xpress')) {
        setActiveTab('xpress-home');
      } else if (
        appMode === 'market' &&
        !activeTab.startsWith('market') &&
        !activeTab.startsWith('seller')
      ) {
        setActiveTab('market-discover');
      }
      previousMode.current = appMode;
    }
  }, [appMode]);

  const renderContent = () => {
    switch (activeTab) {
      case 'xpress-home':
        return (
          <XpressDashboard
            // Topbar sync callbacks — XpressDashboard calls these
            // to keep the topbar controls in sync with its internal state
            onTopbarSync={{
              setNetworkAlerts: setXpressNetworkAlerts,
              setTotalActionable: setXpressTotalActionable,
              setIsUnsupportedNetwork: setXpressIsUnsupportedNetwork,
              setActiveChain: setXpressActiveChain,
              setFormattedBalance: setXpressFormattedBalance,
              setActiveEmail: setXpressActiveEmail,
              setUserAddress: setXpressUserAddress,
              setIsNetworkListOpen: setXpressIsNetworkListOpen,
              isNetworkListOpen: xpressIsNetworkListOpen,
              walletModalOpen: xpressWalletModalOpen,
              setWalletModalOpen: setXpressWalletModalOpen,
              bindSearchSubmit: (fn) => { xpressSearchSubmitRef.current = fn; },
              bindLogout: (fn) => { xpressLogoutRef.current = fn; },
            }}
          />
        );
      case 'xpress-escrows':
        return <div className="text-white p-8">Escrow List Table goes here…</div>;
      case 'market-discover':
        return <div className="text-white p-8">Market Discovery logic goes here…</div>;
      default:
        return <div className="text-white p-8">Module not found.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] font-sans overflow-hidden flex flex-col">
      <MasterTopbar
        appMode={appMode}
        setAppMode={setAppMode}
        hasGlobalAlert={hasGlobalAlert}
        xpress={
          appMode === 'xpress'
            ? {
                searchQuery: xpressSearchQuery,
                onSearchChange: setXpressSearchQuery,
                onSearchSubmit: (e) => xpressSearchSubmitRef.current(e),
                networkAlerts: xpressNetworkAlerts,
                totalActionableOrders: xpressTotalActionable,
                isUnsupportedNetwork: xpressIsUnsupportedNetwork,
                activeChain: xpressActiveChain,
                formattedBalance: xpressFormattedBalance,
                activeEmail: xpressActiveEmail,
                userAddress: xpressUserAddress,
                isNetworkListOpen: xpressIsNetworkListOpen,
                setIsNetworkListOpen: setXpressIsNetworkListOpen,
                onOpenWallet: () => setXpressWalletModalOpen(true),
                onLogout: () => xpressLogoutRef.current(),
              }
            : undefined
        }
      />

      <div className="flex flex-1 overflow-hidden relative">
        <DynamicSidebar
          appMode={appMode}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isVerifiedSeller={isVerifiedSeller}
        />

        <main className="flex-1 md:ml-64 overflow-y-auto bg-[#0b0f19]">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <ErrorBoundary>{renderContent()}</ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MasterTopbar from '@/components/dashboard/MasterTopbar';
import DynamicSidebar from '@/components/dashboard/DynamicSidebar';
import XpressDashboard from '@/components/xpress/XpressDashboard';
import { useAuth } from '@/context/AuthContext';

// ─── Notification type ────────────────────────────────────────────────────────
export interface AppNotification {
  id: string | number;
  type: 'order' | 'system';
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  // order-specific
  trade_type?: 'CRYPTO' | 'FIAT' | 'GIFT_CARD';
  order_status?: string;
  mode?: 'xpress' | 'market';
}

// ─── Error boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
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

// ─── AppShell ─────────────────────────────────────────────────────────────────
export default function AppShell() {
  const router = useRouter();
  const [appMode, setAppMode] = useState<'xpress' | 'market'>('xpress');
  const [activeTab, setActiveTab] = useState('xpress-home');
  const previousMode = useRef(appMode);

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { sessionReady, supabase, walletAddress, emailAddress } = useAuth();
  const [isVerifiedSeller, setIsVerifiedSeller] = useState(false);

  useEffect(() => {
    if (!sessionReady || !walletAddress) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('tier_2_verified')
      .ilike('wallet_address', walletAddress)
      .single()
      .then(({ data }) => {
        if (!cancelled) setIsVerifiedSeller(data?.tier_2_verified ?? false);
      });
    return () => { cancelled = true; };
  }, [sessionReady, walletAddress, supabase]);

  // ── Global notifications ────────────────────────────────────────────────────
  // Fetches from two sources:
  //   1. escrow_orders  — new orders, status changes (crypto + fiat + gift card)
  //   2. notifications  — system messages pushed by devs
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const manuallyReadIds = useRef<Set<string | number>>(new Set());
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  const hasGlobalAlert = notifications.some((n) => !n.read);

  const fetchNotifications = useCallback(async () => {
    if (!sessionReady) return;

    // 1. Order notifications — escrows where user is buyer or seller and
    //    status has changed recently (last 48h), across all trade types.
    const identifier = walletAddress?.toLowerCase();
    const email = emailAddress?.toLowerCase();
    if (!identifier && !email) return;

    const { data: orders } = await supabase
      .from('escrow_orders')
      .select('id, status, trade_type, created_at, buyer_email, seller_email, buyer_wallet_address, seller_address, amount, gc_brand')
      .or(
        [
          identifier ? `buyer_wallet_address.ilike.${identifier}` : null,
          identifier ? `seller_address.ilike.${identifier}` : null,
          email ? `buyer_email.ilike.${email}` : null,
          email ? `seller_email.ilike.${email}` : null,
        ]
          .filter(Boolean)
          .join(',')
      )
      .order('created_at', { ascending: false })
      .limit(30);

    // 2. System notifications — a simple `notifications` table where devs
    //    insert rows. Falls back gracefully if the table doesn't exist yet.
    const { data: sysNotifs } = await supabase
      .from('notifications')
      .select('id, title, body, read, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

  const orderNotifs: AppNotification[] = (orders ?? []).map((o: any) => {
    const id = `order-${o.id}`;
    const isStatusRead = ['completed', 'success'].includes(o.status?.toLowerCase() ?? '');
    
    // Check our local memory cache to see if the user already dismissed this
    const wasManuallyRead = manuallyReadIds.current.has(id);

    let title = 'Order Update';
    let body = `Your order #${o.id} status is ${o.status}.`;
    
    // ... (keep your existing title/body logic here) ...

    return {
      id,
      type: 'order',
      title,
      body,
      // The key fix: It is read if it's completed OR if the user manually dismissed it
      read: wasManuallyRead || isStatusRead, 
      created_at: o.updated_at || o.created_at,
      trade_type: o.trade_type,
      order_status: o.status,
      mode: 'xpress'
    };
  });

    const systemNotifs: AppNotification[] = (sysNotifs ?? []).map((n: any) => ({
      id: `sys-${n.id}`,
      type: 'system',
      title: n.title ?? 'TrustLink Update',
      body: n.body ?? '',
      read: n.read ?? false,
      created_at: n.created_at,
    }));

    // Merge and sort newest first
    const merged = [...orderNotifs, ...systemNotifs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setNotifications(merged);
  }, [sessionReady, walletAddress, emailAddress, supabase]);

  // Fetch on mount and poll every 30s
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      prev.forEach((n) => manuallyReadIds.current.add(n.id));
      return prev.map((n) => ({ ...n, read: true }));
    });
    if (sessionReady) {
      supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false)
        .then(() => {});
    }
  }, [sessionReady, supabase]);

  // ── Search (owned here — router lives here, not inside XpressDashboard) ─────
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 100).trim();
    if (q) router.push(`/user/${encodeURIComponent(q)}`);
  }, [searchQuery, router]);

  // ── Xpress topbar state (wallet/network — still owned by XpressDashboard) ───
  const [xpressNetworkAlerts, setXpressNetworkAlerts] = useState<Record<number, number>>({});
  const [xpressTotalActionable, setXpressTotalActionable] = useState(0);
  const [xpressIsUnsupportedNetwork, setXpressIsUnsupportedNetwork] = useState(false);
  const [xpressActiveChain, setXpressActiveChain] = useState<{ name: string }>({ name: '' });
  const [xpressFormattedBalance, setXpressFormattedBalance] = useState('0.00 USDC');
  const [xpressActiveEmail, setXpressActiveEmail] = useState<string | undefined>(undefined);
  const [xpressUserAddress, setXpressUserAddress] = useState<string | undefined>(undefined);
  const [xpressIsNetworkListOpen, setXpressIsNetworkListOpen] = useState(false);
  const [xpressWalletModalOpen, setXpressWalletModalOpen] = useState(false);
  const xpressLogoutRef = useRef<() => void>(() => {});

  // ── Mode tab sync ───────────────────────────────────────────────────────────
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

  // ── Content router ──────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'xpress-home':
        return (
          <XpressDashboard
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
              // Search is now handled in AppShell — no bind needed
              bindSearchSubmit: () => {},
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0b0f19] font-sans overflow-hidden flex flex-col">
      <MasterTopbar
        appMode={appMode}
        setAppMode={setAppMode}
        // Notifications
        notifications={notifications}
        notifPanelOpen={notifPanelOpen}
        setNotifPanelOpen={setNotifPanelOpen}
        onMarkAllRead={markAllRead}
        hasGlobalAlert={hasGlobalAlert}
        // Search (owned here)
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        // Xpress wallet/network controls
        xpress={{
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
        }}
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
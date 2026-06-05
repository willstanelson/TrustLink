'use client';

// ─── Imports ──────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import OrderCard from '@/components/OrderCard';
import WalletModal from '@/components/WalletModal';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import {
  useReadContract,
  useReadContracts,
  useAccount,
  useSwitchChain,
  useBalance,
  useChainId,
} from 'wagmi';
import {
  createWalletClient,
  createPublicClient,
  custom,
  parseUnits,
  formatEther,
  formatUnits,
  isAddress,
} from 'viem';
import { CONTRACT_ABI, CONTRACT_ADDRESS, CHAIN_CONFIG } from '@/app/constants';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Lock,
  LogOut,
  Loader2,
  RefreshCcw,
  AlertTriangle,
  Wallet,
  ChevronDown,
  X,
  CheckCircle2,
  Banknote,
  Bitcoin,
  ArrowRight,
  UserCheck,
  Search,
  Mail,
  Globe,
  User,
  Gift,
  ShieldCheck,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const POLL_INTERVAL_DB = 8_000;
const POLL_INTERVAL_CHAIN = 60_000;

const ERC20_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ─── Utility helpers ──────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function sanitize(value: string, maxLen = 200): string {
  return value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, maxLen).trim();
}

function isSafePaystackUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'checkout.paystack.com' ||
        parsed.hostname.endsWith('.paystack.com'))
    );
  } catch {
    return false;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
// This is the complete Xpress escrow engine, refactored from page(23).tsx
// to work as a self-contained panel inside the AppShell layout.
// The standalone <nav> and full-page wrappers have been removed — the shell
// already provides the topbar, sidebar, and layout chrome.

export default function XpressDashboard() {
  // ── Auth & session ──────────────────────────────────────────────────────────
  const { supabase, sessionReady, sessionLoading, sessionError, refreshSession } = useAuth();
  const { login, authenticated, user, logout, linkEmail, getAccessToken } = usePrivy();

  // ── Bank list ───────────────────────────────────────────────────────────────
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchBanks() {
      try {
        const res = await fetch('/api/banks');
        const json = await res.json();
        if (!cancelled && Array.isArray(json?.data)) setBanks(json.data);
      } catch (err) {
        console.error('Error loading banks:', err);
      } finally {
        if (!cancelled) setIsLoadingBanks(false);
      }
    }
    fetchBanks();
    return () => { cancelled = true; };
  }, []);

  // ── Wallet / chain ──────────────────────────────────────────────────────────
  const { switchChain, error: switchError } = useSwitchChain();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const chainId = useChainId();
  const { address: wagmiAddress } = useAccount();

  const activeEmail =
    user?.email?.address ||
    user?.google?.email ||
    user?.apple?.email ||
    user?.discord?.email;

  const userAddress = wagmiAddress || user?.wallet?.address;

  const isUnsupportedNetwork = authenticated && !CHAIN_CONFIG[chainId];
  const activeChainId = CHAIN_CONFIG[chainId] ? chainId : 9746;
  const activeChain = CHAIN_CONFIG[activeChainId] ?? CHAIN_CONFIG[9746];

  // ── Form state ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'crypto' | 'fiat' | 'giftcard'>('crypto');
  const [trustLevel, setTrustLevel] = useState<number | null>(null);

  // Crypto
  const [sellerAddress, setSellerAddress] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const [isTokenListOpen, setIsTokenListOpen] = useState(false);
  const [isNetworkListOpen, setIsNetworkListOpen] = useState(false);
  const [isWriting, setIsWriting] = useState(false);

  // Fiat
  const [fiatAmount, setFiatAmount] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [fiatDescription, setFiatDescription] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);

  // Gift card
  const [gcSellerAddress, setGcSellerAddress] = useState('');
  const [gcAmount, setGcAmount] = useState('');
  const [gcBrand, setGcBrand] = useState('');
  const [gcCode, setGcCode] = useState('');
  const [gcImage, setGcImage] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  // UI state
  const [dbOrders, setDbOrders] = useState<Record<number, any>>({});
  const [dashboardTab, setDashboardTab] = useState<'buying' | 'selling'>('buying');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const networkDropdownRef = useRef<HTMLDivElement>(null);

  // ── Assets ──────────────────────────────────────────────────────────────────
  const ASSETS = useMemo(
    () => [
      {
        symbol: activeChain.nativeSymbol,
        name: activeChain.name,
        type: 'native' as const,
        icon: 'bg-purple-600',
        address: ZERO_ADDRESS,
        decimals: 18,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        type: 'erc20' as const,
        icon: 'bg-blue-600',
        address: activeChain.usdcAddress,
        decimals: 6,
      },
    ],
    [activeChain]
  );

  const selectedAsset = ASSETS[selectedAssetIndex];

  // ── Toast & email helpers ────────────────────────────────────────────────────
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
      setNotification({ message: sanitize(message, 300), type });
    },
    []
  );

  const sendEmailNotification = useCallback(
    async (to: string, subject: string, message: string) => {
      if (!isValidEmail(to)) return;
      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: sanitize(to, 254),
            subject: sanitize(subject, 200),
            message: sanitize(message, 2000),
          }),
        });
      } catch (err) {
        console.error('Failed to send email notification', err);
      }
    },
    []
  );

  // Stable refs so async handlers always call the latest version
  const showToastRef = useRef(showToast);
  const sendEmailRef = useRef(sendEmailNotification);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);
  useEffect(() => { sendEmailRef.current = sendEmailNotification; }, [sendEmailNotification]);

  // ── Side-effects ─────────────────────────────────────────────────────────────

  // Auto-set active wallet when wallets change
  const prevFirstWalletRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const firstWallet = wallets[0];
    if (!firstWallet) return;
    if (firstWallet.address === prevFirstWalletRef.current) return;
    prevFirstWalletRef.current = firstWallet.address;
    setActiveWallet(firstWallet);
  }, [wallets, setActiveWallet]);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  // Surface chain switch errors
  useEffect(() => {
    if (switchError) showToastRef.current(switchError.message, 'error');
  }, [switchError]);

  // Close network dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        networkDropdownRef.current &&
        !networkDropdownRef.current.contains(e.target as Node)
      ) {
        setIsNetworkListOpen(false);
      }
    }
    if (isNetworkListOpen) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isNetworkListOpen]);

  // Fetch trust level once session is ready
  useEffect(() => {
    if (!sessionReady || !userAddress) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('current_trust_level')
      .ilike('wallet_address', userAddress)
      .single()
      .then(({ data }) => {
        if (!cancelled) setTrustLevel(data?.current_trust_level ?? 0);
      });
    return () => { cancelled = true; };
  }, [sessionReady, userAddress, supabase]);

  // Sync buyer email from authenticated user
  useEffect(() => {
    if (activeEmail) setBuyerEmail(activeEmail);
  }, [activeEmail]);

  // ── On-chain reads ────────────────────────────────────────────────────────────
  const { data: usdcBalance, refetch: refetchUsdc } = useBalance({
    address: userAddress as `0x${string}`,
    token: activeChain.usdcAddress,
    query: { enabled: !!userAddress },
  });

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: ASSETS[1].address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress
      ? [userAddress as `0x${string}`, CONTRACT_ADDRESS]
      : undefined,
    query: { enabled: !!userAddress && selectedAsset.type === 'erc20' },
  });

  const { data: totalEscrows, refetch: refetchTotalEscrows } = useReadContract({
    abi: CONTRACT_ABI,
    address: CONTRACT_ADDRESS,
    functionName: 'escrowCount',
  });
  const count = totalEscrows ? Number(totalEscrows) : 0;

  const indexesToFetch = useMemo(() => {
    if (count === 0) return [];
    const idxs: number[] = [];
    for (let i = count; i > 0 && idxs.length < 20; i--) idxs.push(i);
    return idxs;
  }, [count]);

  const { data: escrowsData, refetch: refetchOrders } = useReadContracts({
    contracts: indexesToFetch.map((id) => ({
      abi: CONTRACT_ABI,
      address: CONTRACT_ADDRESS,
      functionName: 'escrows',
      args: [BigInt(id)],
    })),
    query: { refetchInterval: 30_000 },
  });

  // ── DB polling ────────────────────────────────────────────────────────────────
  const fetchDbOrders = useCallback(async () => {
    if (!sessionReady) return;
    const { data, error } = await supabase.from('escrow_orders').select('*');
    if (error) { console.error('fetchDbOrders error:', error); return; }
    if (data) {
      const map: Record<number, any> = {};
      data.forEach((row: any) => { map[row.id] = row; });
      setDbOrders(map);
    }
  }, [supabase, sessionReady]);

  const handleRefresh = useCallback(() => {
    refetchTotalEscrows();
    refetchOrders();
    refetchUsdc();
    if (selectedAsset.type === 'erc20') refetchAllowance?.();
    fetchDbOrders();
  }, [refetchTotalEscrows, refetchOrders, refetchUsdc, refetchAllowance, selectedAsset.type, fetchDbOrders]);

  useEffect(() => {
    if (sessionReady) fetchDbOrders();
  }, [sessionReady, fetchDbOrders]);

  useEffect(() => {
    if (!sessionReady) return;
    const id = setInterval(fetchDbOrders, POLL_INTERVAL_DB);
    return () => clearInterval(id);
  }, [sessionReady, fetchDbOrders]);

  useEffect(() => {
    const id = setInterval(() => {
      refetchTotalEscrows();
      refetchOrders();
    }, POLL_INTERVAL_CHAIN);
    return () => clearInterval(id);
  }, [refetchTotalEscrows, refetchOrders]);

  // ── Bank account resolver ─────────────────────────────────────────────────────
  const resolveBankAccount = useCallback(async (account: string, bank: string) => {
    setIsResolving(true);
    setResolveError('');
    setAccountName('');

    if (account === '9999999999') {
      const t = setTimeout(() => {
        setAccountName('Test Mode User (Bypassed)');
        setIsResolving(false);
      }, 800);
      return () => clearTimeout(t);
    }

    try {
      const response = await fetch(
        `/api/paystack/resolve?account_number=${encodeURIComponent(account)}&bank_code=${encodeURIComponent(bank)}`
      );
      const data = await response.json();
      if (!data.status) throw new Error(data.message || 'Unknown bank error');
      if (data.data?.account_name) setAccountName(data.data.account_name);
      else throw new Error('Account name not found');
    } catch (err: any) {
      setResolveError(err.message || 'Verification failed');
    } finally {
      setIsResolving(false);
    }
  }, []);

  useEffect(() => {
    if (autoFilled) { setAutoFilled(false); return; }
    if (accountNumber.length === 10 && bankCode) {
      resolveBankAccount(accountNumber, bankCode);
    } else {
      setAccountName('');
      setResolveError('');
    }
  }, [accountNumber, bankCode, resolveBankAccount, autoFilled]);

  // Seller email auto-fill
  useEffect(() => {
    if (mode !== 'fiat') return;
    if (!isValidEmail(sellerEmail)) return;

    const controller = new AbortController();
    const timerId = setTimeout(async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch(
          `/api/profile/lookup?email=${encodeURIComponent(sellerEmail.trim())}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
        );
        const data = await res.json();
        if (data.success && data.profile) {
          setBankCode(data.profile.bank_code);
          setAccountNumber(data.profile.account_number);
          setAccountName(data.profile.account_name);
          setAutoFilled(true);
          showToastRef.current("Seller's bank details auto-filled!", 'success');
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error('Auto-fill lookup failed', err);
      }
    }, 800);

    return () => { clearTimeout(timerId); controller.abort(); };
  }, [sellerEmail, mode, getAccessToken]);

  // Paystack return verification
  useEffect(() => {
    const trxref = searchParams.get('trxref') || searchParams.get('reference');
    if (!trxref || !sessionReady) return;

    setMode('fiat');
    let cancelled = false;

    fetch('/api/paystack/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: sanitize(trxref, 100) }),
    })
      .then((r) => r.json())
      .then(async (data) => {
        if (cancelled) return;
        if (data.status) {
          setShowSuccessModal(true);
          const { data: orderData } = await supabase
            .from('escrow_orders')
            .select('seller_email, amount')
            .eq('paystack_ref', trxref)
            .single();
          if (orderData?.seller_email && isValidEmail(orderData.seller_email)) {
            sendEmailRef.current(
              orderData.seller_email,
              'New Escrow Order Secured! 💰',
              `Great news! A buyer has securely locked ₦${Number(orderData.amount).toLocaleString()} in TrustLink for a Bank Transfer order. Please log in to your dashboard to view and accept the order.`
            );
          }
        } else {
          showToastRef.current('Payment was cancelled or failed.', 'error');
        }
        fetchDbOrders();
        router.replace('/dashboard');
      })
      .catch((err) => {
        if (!cancelled) showToastRef.current(err.message || 'Verification error', 'error');
      });

    return () => { cancelled = true; };
  }, [searchParams, supabase, sessionReady, fetchDbOrders, router]);

  // ── Derived order data ────────────────────────────────────────────────────────
  const networkAlerts = useMemo(() => {
    const alerts: Record<number, number> = {};
    if (!userAddress) return alerts;

    Object.values(dbOrders).forEach((db: any) => {
      if (db.paystack_ref || !db.network) return;
      const isSeller = db.seller_address?.toLowerCase() === userAddress.toLowerCase();
      const isBuyer = db.buyer_wallet_address?.toLowerCase() === userAddress.toLowerCase();
      const status = db.status?.toLowerCase();
      const actionNeeded =
        (isSeller && (status === 'secured' || status === 'accepted')) ||
        (isBuyer && status === 'shipped');
      if (!actionNeeded) return;
      const chainEntry = Object.entries(CHAIN_CONFIG).find(
        ([, cfg]) => cfg.name === db.network || cfg.nativeSymbol === db.network
      );
      if (!chainEntry) return;
      const chainIdNum = Number(chainEntry[0]);
      alerts[chainIdNum] = (alerts[chainIdNum] || 0) + 1;
    });

    return alerts;
  }, [dbOrders, userAddress]);

  const totalActionableOrders = useMemo(
    () => Object.values(networkAlerts).reduce((s, n) => s + n, 0),
    [networkAlerts]
  );

  const { myBuyingOrders, mySellingOrders } = useMemo(() => {
    const buying: any[] = [];
    const selling: any[] = [];

    const dbByKey = new Map<string, any[]>();
    Object.values(dbOrders).forEach((db: any) => {
      if (db.paystack_ref) return;
      if (db.trade_type === 'GIFT_CARD') return;
      const key = `${db.buyer_wallet_address?.toLowerCase()}|${db.seller_address?.toLowerCase()}|${Number(db.amount)}`;
      const bucket = dbByKey.get(key) ?? [];
      bucket.push(db);
      dbByKey.set(key, bucket);
    });

    const usedDbIds = new Set<number>();

    if (escrowsData && userAddress) {
      escrowsData.forEach((result, index) => {
        if (result.status !== 'success' || !result.result) return;

        const escrow = result.result as any;
        const scId = indexesToFetch[index];
        const buyer = String(escrow[1]);
        const seller = String(escrow[2]);
        const tokenAddr = String(escrow[3]);
        const totalAmount = BigInt(escrow[4]);
        const lockedBalance = BigInt(escrow[5]);
        const chainDisputed = escrow[8];
        const chainCompleted = escrow[9];

        const isNative = tokenAddr === ZERO_ADDRESS;
        const formattedAmt = isNative
          ? formatEther(totalAmount)
          : formatUnits(totalAmount, 6);

        const key = `${buyer.toLowerCase()}|${seller.toLowerCase()}|${Number(formattedAmt)}`;
        const candidates = (dbByKey.get(key) ?? [])
          .filter((db) => !usedDbIds.has(db.id))
          .sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() -
              new Date(a.created_at || 0).getTime()
          );

        const dbOrder = candidates[0];
        if (dbOrder) usedDbIds.add(dbOrder.id);

        const dbId = dbOrder ? dbOrder.id : scId;
        const isAccepted =
          dbOrder?.status === 'accepted' ||
          dbOrder?.status === 'shipped' ||
          !!escrow[6];
        const isShipped = dbOrder?.status === 'shipped' || !!escrow[7];

        const paidAmount = totalAmount - lockedBalance;
        const percentPaid =
          totalAmount > BigInt(0)
            ? Number((paidAmount * BigInt(100)) / totalAmount)
            : 0;

        let status = 'ACTIVE';
        let statusColor = 'bg-emerald-500/20 text-emerald-400';
        if (chainCompleted) { status = 'COMPLETED'; statusColor = 'bg-slate-700 text-slate-300'; }
        else if (chainDisputed) { status = 'DISPUTED'; statusColor = 'bg-red-500/20 text-red-400'; }
        else if (!isAccepted) { status = 'WAITING ACCEPTANCE'; statusColor = 'bg-yellow-500/20 text-yellow-400'; }
        else if (isShipped) { status = 'SHIPPED'; statusColor = 'bg-blue-500/20 text-blue-400'; }

        const orderType = dbOrder?.trade_type === 'GIFT_CARD' ? 'GIFTCARD' : 'CRYPTO';

        const order = {
          id: dbId, scId, buyer, seller,
          sellerEmail: dbOrder?.seller_email ?? undefined,
          buyerEmail: dbOrder?.buyer_email ?? undefined,
          token: tokenAddr, amount: totalAmount, lockedBalance, isAccepted, isShipped,
          isDisputed: chainDisputed, isCompleted: chainCompleted, status, statusColor,
          token_symbol: isNative ? activeChain.nativeSymbol : 'USDC',
          formattedTotal: formattedAmt,
          formattedLocked: isNative
            ? formatEther(lockedBalance)
            : formatUnits(lockedBalance, 6),
          percentPaid, type: orderType,
          timestamp: dbOrder?.created_at
            ? new Date(dbOrder.created_at).getTime()
            : Number(scId),
        };

        const buyerLower = buyer.toLowerCase();
        const sellerLower = seller.toLowerCase();
        const addrLower = userAddress.toLowerCase();
        if (buyerLower === addrLower) buying.push(order);
        if (sellerLower === addrLower) selling.push(order);
      });
    }

    const myEmail = activeEmail?.toLowerCase();
    const myWallet = userAddress?.toLowerCase();

    // Fiat orders
    Object.values(dbOrders).forEach((dbOrder: any) => {
      if (!dbOrder.paystack_ref) return;
      const currentStatus = (dbOrder.status?.toLowerCase() || 'pending') as string;
      if (currentStatus === 'awaiting_payment' || currentStatus === 'failed') return;

      const isMyEmailAsBuyer = myEmail && dbOrder.buyer_email?.toLowerCase() === myEmail;
      const isMyWalletAsBuyer = myWallet && dbOrder.buyer_wallet_address?.toLowerCase() === myWallet;
      const isMyEmailAsSeller = myEmail && dbOrder.seller_email?.toLowerCase() === myEmail;

      if (!isMyEmailAsBuyer && !isMyWalletAsBuyer && !isMyEmailAsSeller) return;

      let fiatStatusColor = 'bg-yellow-500/20 text-yellow-400';
      if (['success', 'completed'].includes(currentStatus)) fiatStatusColor = 'bg-slate-700 text-slate-300';
      else if (currentStatus === 'disputed') fiatStatusColor = 'bg-red-500/20 text-red-400';
      else if (currentStatus === 'shipped') fiatStatusColor = 'bg-blue-500/20 text-blue-400';
      else if (['accepted', 'partially_released', 'processing_payout', 'secured'].includes(currentStatus))
        fiatStatusColor = 'bg-emerald-500/20 text-emerald-400';

      const totalAmt = Number(dbOrder.amount || 0);
      const releasedAmt = Number(dbOrder.released_amount || 0);
      const lockedAmt = totalAmt - releasedAmt;
      const isFullyPaid = ['success', 'completed'].includes(currentStatus);
      const percentPaid = isFullyPaid
        ? 100
        : totalAmt > 0
        ? Math.round((releasedAmt / totalAmt) * 100)
        : 0;

      const fiatOrderObj = {
        id: `NGN-${dbOrder.id}`, buyer: dbOrder.buyer_email,
        seller: dbOrder.seller_name || dbOrder.seller_email || '',
        sellerEmail: dbOrder.seller_email ?? undefined,
        amount: BigInt(0), lockedBalance: BigInt(0),
        formattedTotal: totalAmt.toLocaleString(),
        formattedLocked: lockedAmt.toLocaleString(),
        token_symbol: 'NGN', token: '',
        status: isFullyPaid ? 'PAID' : currentStatus.toUpperCase().replace(/_/g, ' '),
        statusColor: fiatStatusColor, percentPaid, type: 'FIAT',
        timestamp: dbOrder.created_at
          ? new Date(dbOrder.created_at).getTime()
          : dbOrder.id,
        isAccepted: ['accepted', 'partially_released', 'shipped', 'success', 'completed', 'processing_payout'].includes(currentStatus),
        isShipped: ['shipped', 'success', 'completed', 'processing_payout'].includes(currentStatus),
        isCompleted: isFullyPaid,
        isDisputed: currentStatus === 'disputed',
      };

      if (isMyEmailAsBuyer || isMyWalletAsBuyer) buying.push(fiatOrderObj);
      if (isMyEmailAsSeller) selling.push(fiatOrderObj);
    });

    // Gift card orders
    Object.values(dbOrders).forEach((dbOrder: any) => {
      if (dbOrder.trade_type !== 'GIFT_CARD') return;
      if (usedDbIds.has(dbOrder.id)) return;

      const currentStatus = (dbOrder.status?.toLowerCase() || 'secured') as string;
      const isMyEmailAsBuyer = myEmail && dbOrder.buyer_email?.toLowerCase() === myEmail;
      const isMyWalletAsBuyer = myWallet && dbOrder.buyer_wallet_address?.toLowerCase() === myWallet;
      const isMyEmailAsSeller = myEmail && dbOrder.seller_email?.toLowerCase() === myEmail;

      if (!isMyEmailAsBuyer && !isMyWalletAsBuyer && !isMyEmailAsSeller) return;

      let gcStatusColor = 'bg-yellow-500/20 text-yellow-400';
      if (['success', 'completed'].includes(currentStatus)) gcStatusColor = 'bg-slate-700 text-slate-300';
      else if (currentStatus === 'disputed') gcStatusColor = 'bg-red-500/20 text-red-400';
      else if (currentStatus === 'shipped') gcStatusColor = 'bg-blue-500/20 text-blue-400';
      else if (['accepted', 'secured'].includes(currentStatus)) gcStatusColor = 'bg-emerald-500/20 text-emerald-400';

      const isCompleted = ['success', 'completed'].includes(currentStatus);

      const gcOrderObj = {
        id: `GC-${dbOrder.id}`,
        buyer: dbOrder.buyer_email || dbOrder.buyer_wallet_address || '',
        seller: dbOrder.seller_email || dbOrder.seller_identifier || '',
        sellerEmail: dbOrder.seller_email ?? undefined,
        buyerEmail: dbOrder.buyer_email ?? undefined,
        amount: BigInt(0), lockedBalance: BigInt(0),
        formattedTotal: String(dbOrder.amount ?? 0),
        formattedLocked: isCompleted ? '0' : String(dbOrder.amount ?? 0),
        token_symbol: `${dbOrder.gc_brand ?? ''} GC`.trim(),
        token: '',
        status: isCompleted ? 'COMPLETED' : currentStatus.toUpperCase().replace(/_/g, ' '),
        statusColor: gcStatusColor,
        percentPaid: isCompleted ? 100 : 0,
        type: 'GIFTCARD',
        timestamp: dbOrder.created_at
          ? new Date(dbOrder.created_at).getTime()
          : dbOrder.id,
        isAccepted: ['accepted', 'shipped', 'success', 'completed'].includes(currentStatus),
        isShipped: ['shipped', 'success', 'completed'].includes(currentStatus),
        isCompleted,
        isDisputed: currentStatus === 'disputed',
        gcBrand: dbOrder.gc_brand ?? '',
        gc_image_url: dbOrder.gc_image_url ?? '',
      };

      if (isMyEmailAsBuyer || isMyWalletAsBuyer) buying.push(gcOrderObj);
      if (isMyEmailAsSeller) selling.push(gcOrderObj);
    });

    buying.sort((a, b) => b.timestamp - a.timestamp);
    selling.sort((a, b) => b.timestamp - a.timestamp);

    return { myBuyingOrders: buying, mySellingOrders: selling };
  }, [escrowsData, userAddress, indexesToFetch, dbOrders, activeEmail, activeChain.nativeSymbol]);

  // ── Search ────────────────────────────────────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = sanitize(searchQuery, 100);
    if (q) router.push(`/user/${encodeURIComponent(q)}`);
  };

  // ── Transaction handlers ──────────────────────────────────────────────────────
  async function resolveSellerAddress(raw: string): Promise<string | null> {
    const trimmed = raw.trim();
    if (isAddress(trimmed)) return trimmed;
    if (isValidEmail(trimmed)) {
      showToastRef.current('Resolving email to secure wallet...', 'info');
      try {
        const res = await fetch('/api/privy/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        });
        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Resolution failed');
        if (!isAddress(data.address)) throw new Error('Resolved address is invalid');
        showToastRef.current(`Found wallet: ${data.address.slice(0, 6)}...${data.address.slice(-4)}`, 'success');
        return data.address as string;
      } catch (err: any) {
        showToastRef.current(err.message, 'error');
        return null;
      }
    }
    showToastRef.current('Invalid Wallet Address or Email', 'error');
    return null;
  }

  const handleCryptoTransaction = async () => {
    if (isUnsupportedNetwork) {
      showToastRef.current('Please switch to a supported network first.', 'error');
      return;
    }
    if (!sellerAddress.trim() || !amountInput) return;

    const finalSellerAddress = await resolveSellerAddress(sellerAddress);
    if (!finalSellerAddress) return;

    if (finalSellerAddress.toLowerCase() === userAddress?.toLowerCase()) {
      showToastRef.current('You cannot create an order with yourself.', 'error');
      return;
    }

    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToastRef.current('Please enter a valid amount.', 'error');
      return;
    }

    setIsWriting(true);
    try {
      const wallet = wallets[0];
      if (!wallet) throw new Error('Wallet not connected');

      await wallet.switchChain(activeChainId);
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: activeChain.viemChain,
        transport: custom(provider),
      });
      const publicClient = createPublicClient({
        chain: activeChain.viemChain,
        transport: custom(provider),
      });

      const isNative = selectedAsset.type === 'native';
      const amountWei = parseUnits(amountInput, selectedAsset.decimals);
      const symbolLabel = isNative ? activeChain.nativeSymbol : 'USDC';

      if (!isNative) {
        const currentAllowance = usdcAllowance ? BigInt(String(usdcAllowance)) : BigInt(0);
        if (currentAllowance < amountWei) {
          showToastRef.current('Approving USDC… Please wait.', 'info');
          const approveHash = await walletClient.writeContract({
            address: selectedAsset.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [CONTRACT_ADDRESS, amountWei],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
          refetchAllowance?.();
          showToastRef.current('USDC Approved. Securing escrow…', 'info');
        }
      }

      showToastRef.current('Awaiting wallet confirmation…', 'info');
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'createEscrow',
        args: [
          finalSellerAddress as `0x${string}`,
          selectedAsset.address as `0x${string}`,
          amountWei,
        ],
        value: isNative ? amountWei : BigInt(0),
      });

      showToastRef.current('Transaction submitted. Waiting for confirmation…', 'info');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        const sellerEmailIfProvided = isValidEmail(sellerAddress.trim())
          ? sellerAddress.trim()
          : null;

        const res = await fetch('/api/escrow/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyer_wallet_address: userAddress,
            seller_address: finalSellerAddress,
            buyer_email: buyerEmail || null,
            seller_email: sellerEmailIfProvided,
            amount: amountInput,
            token_symbol: symbolLabel,
            network: activeChain.name,
            status: 'secured',
          }),
        });
        const data = await res.json();

        if (data.status === 'error') {
          showToastRef.current('Escrow secured on-chain, but dashboard sync is delayed.', 'warning');
        } else {
          showToastRef.current('Escrow Created Successfully!', 'success');
          if (sellerEmailIfProvided) {
            sendEmailRef.current(
              sellerEmailIfProvided,
              `New Escrow Order on ${activeChain.name}! 💰`,
              `Great news! A buyer has securely locked ${amountInput} ${symbolLabel} in TrustLink.\n\nIMPORTANT: This order was created on the ${activeChain.name} network. Please ensure your wallet is connected to ${activeChain.name} in your TrustLink dashboard to view and accept the order.`
            );
          }
        }
        setSellerAddress('');
        setAmountInput('');
        handleRefresh();
      } else {
        throw new Error('Transaction reverted on chain.');
      }
    } catch (err: any) {
      showToastRef.current(err.shortMessage || err.message || 'Transaction Error', 'error');
    } finally {
      setIsWriting(false);
    }
  };

  const handleFiatTransaction = async () => {
    if (!fiatAmount || !accountNumber || !bankCode || !buyerEmail || !sellerEmail) {
      showToastRef.current('Please fill all fields', 'error');
      return;
    }
    if (!isValidEmail(buyerEmail) || !isValidEmail(sellerEmail)) {
      showToastRef.current('Invalid email address', 'error');
      return;
    }
    if (buyerEmail.trim().toLowerCase() === sellerEmail.trim().toLowerCase()) {
      showToastRef.current('You cannot create an order with yourself.', 'error');
      return;
    }
    if (!accountName) {
      showToastRef.current('Please wait for bank verification to complete', 'error');
      return;
    }
    const parsedFiat = parseFloat(fiatAmount);
    if (isNaN(parsedFiat) || parsedFiat <= 0) {
      showToastRef.current('Please enter a valid amount', 'error');
      return;
    }

    try {
      showToastRef.current('Initializing Secure Checkout…', 'info');
      const response = await fetch('/api/paystack/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: fiatAmount,
          email: buyerEmail,
          seller_email: sellerEmail,
          seller_bank: banks.find((b) => b.code === bankCode)?.name || bankCode,
          seller_number: accountNumber,
          seller_name: accountName,
          description: sanitize(fiatDescription || 'Escrow Payment', 500),
          buyer_wallet: userAddress,
        }),
      });

      const data = await response.json();
      if (!data.status) throw new Error(data.message || 'Payment initialization failed');

      const authUrl = data?.data?.authorization_url;
      if (!isSafePaystackUrl(authUrl)) throw new Error('Invalid payment redirect URL');

      showToastRef.current('Redirecting to Paystack…', 'success');
      setTimeout(() => { window.location.href = authUrl; }, 1000);
    } catch (err: any) {
      showToastRef.current(err.message || 'Payment Error', 'error');
    }
  };

  const handleGiftCardTransaction = async () => {
    if (trustLevel === null || trustLevel < 3) {
      showToastRef.current('Level 3 required to use Gift Card escrow.', 'error');
      return;
    }
    if (!gcSellerAddress.trim() || !gcAmount || !gcBrand || !gcCode) {
      showToastRef.current('Please fill all Gift Card details.', 'error');
      return;
    }
    if (!gcImage) {
      showToastRef.current('Please upload an image of the physical gift card.', 'error');
      return;
    }
    const parsedGc = parseFloat(gcAmount);
    if (isNaN(parsedGc) || parsedGc <= 0) {
      showToastRef.current('Please enter a valid amount.', 'error');
      return;
    }

    const sellerIdentifier = gcSellerAddress.trim();
    const gcSellerEmail = isValidEmail(sellerIdentifier) ? sellerIdentifier : null;

    if (gcSellerEmail && activeEmail && gcSellerEmail.toLowerCase() === activeEmail.toLowerCase()) {
      showToastRef.current('You cannot create an order with yourself.', 'error');
      return;
    }

    setIsWriting(true);
    let uploadedFileName: string | undefined;

    try {
      showToastRef.current('Uploading card image…', 'info');
      const fileExt = gcImage.name.split('.').pop() ?? 'jpg';
      const fileName = `gc-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      uploadedFileName = fileName;

      const { error: uploadError } = await supabase.storage
        .from('gift-card-images')
        .upload(fileName, gcImage, { upsert: false });
      if (uploadError) throw new Error('Image upload failed: ' + uploadError.message);

      const { data: publicUrlData } = supabase.storage
        .from('gift-card-images')
        .getPublicUrl(fileName);

      const fullImageUrl = publicUrlData.publicUrl;

      showToastRef.current('Encrypting gift card code…', 'info');
      const token = await getAccessToken();
      const response = await fetch('/api/giftcard/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          buyer_email: buyerEmail || null,
          buyer_wallet: userAddress || null,
          seller_email: gcSellerEmail,
          seller_identifier: sellerIdentifier,
          gc_brand: sanitize(gcBrand, 50),
          gc_amount: gcAmount,
          gc_code: sanitize(gcCode, 200),
          gc_image_url: fullImageUrl,
          trade_type: 'GIFT_CARD',
          status: 'secured',
        }),
      });

      const responseData = await response.json();
      if (!responseData.status) throw new Error(responseData.message || 'Failed to create gift card escrow');

      if (gcSellerEmail) {
        sendEmailRef.current(
          gcSellerEmail,
          'New Gift Card Escrow Order! 🎁',
          `Great news! A buyer has secured a $${gcAmount} ${gcBrand} Gift Card in TrustLink for your service.\n\nThe card code has been encrypted and locked. Please log in to your TrustLink dashboard to view and accept the order.\n\nThe code will only be revealed to you once you deliver the service and the buyer releases the escrow.`
        );
      }

      setShowSuccessModal(true);
      setGcSellerAddress('');
      setGcAmount('');
      setGcBrand('');
      setGcCode('');
      setGcImage(null);
      setFileInputKey((prev) => prev + 1);
      handleRefresh();
    } catch (err: any) {
      if (uploadedFileName) {
        supabase.storage.from('gift-card-images').remove([uploadedFileName]).catch(() => {});
      }
      showToastRef.current(err.message || 'Transaction Error', 'error');
    } finally {
      setIsWriting(false);
    }
  };

  // ── Derived display values ─────────────────────────────────────────────────────
  const activeOrdersList =
    dashboardTab === 'buying' ? myBuyingOrders : mySellingOrders;
  const displayedOrders = activeOrdersList.filter(
    (order: any) => order.type.toLowerCase() === mode
  );
  const hasEmailLinked = !!(
    user?.email?.address ||
    user?.google?.email ||
    user?.apple?.email ||
    user?.discord?.email
  );
  const formattedBalance = usdcBalance
    ? `${parseFloat(formatUnits(usdcBalance.value, 6)).toFixed(2)} USDC`
    : '0.00 USDC';
  const isGiftCardLocked = trustLevel === null || trustLevel < 3;

  // ── Loading & error states ─────────────────────────────────────────────────────
  // These are now inline panels within the shell, not full-page takeovers.
  if (sessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400 font-mono text-sm animate-pulse">Securing session…</p>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-slate-300 font-mono text-sm mb-6 max-w-sm text-center">
          {sanitize(sessionError, 200)}
        </p>
        <button
          type="button"
          onClick={refreshSession}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" /> Retry Connection
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    // NOTE: No min-h-screen, no standalone nav, no full-page bg gradient.
    // The AppShell provides all of that. This component owns only its content area.
    <div className="text-white font-sans pb-20 relative">

      {/* ── WalletModal ─────────────────────────────────────────────────────── */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />

      {/* ── Success modal ───────────────────────────────────────────────────── */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 border border-emerald-500/30 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center flex flex-col items-center">
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-3">
              {mode === 'giftcard' ? 'Gift Card Secured! 🎁' : 'Payment Successful!'}
            </h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              {mode === 'giftcard'
                ? 'Your gift card code has been encrypted and locked in escrow. The seller has been notified and will deliver the service before the code is revealed.'
                : 'Your fiat payment has been securely locked in escrow. The seller has been notified via email.'}
            </p>
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-extrabold text-lg py-4 rounded-xl transition-all shadow-lg"
            >
              View My Order
            </button>
          </div>
        </div>
      )}

      {/* ── Toast notification ──────────────────────────────────────────────── */}
      {notification && (
        <div
          role="alert"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md max-w-sm ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
              : notification.type === 'info'
              ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
              : notification.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
              : 'bg-red-500/10 border-red-500/50 text-red-400'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : notification.type === 'info' ? (
            <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          <p className="text-sm font-bold truncate">{notification.message}</p>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Xpress Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Direct P2P escrow — you know who you&apos;re dealing with</p>
        </div>

        {/* Context-bar: search + wallet + network + actions */}
        {authenticated && (
          <div className="flex items-center gap-3">
            {/* Seller search */}
            <form onSubmit={handleSearch} className="relative group hidden lg:block" role="search">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors" aria-hidden />
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
                aria-label="Search seller by email or wallet"
                className="block w-56 pl-10 pr-3 py-2 border border-slate-700 rounded-xl bg-slate-900/50 text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition-all"
                placeholder="Search seller…"
              />
            </form>

            {/* Network selector */}
            <div className="relative" ref={networkDropdownRef}>
              <button
                type="button"
                aria-label="Select network"
                aria-expanded={isNetworkListOpen}
                onClick={() => setIsNetworkListOpen((v) => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-xs font-bold ${
                  isUnsupportedNetwork
                    ? 'bg-red-500/10 border-red-500 text-red-400'
                    : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                }`}
              >
                <Globe className="w-4 h-4" aria-hidden />
                <span>{isUnsupportedNetwork ? 'Unsupported' : activeChain.name}</span>
                {totalActionableOrders > 0 && (
                  <span
                    aria-label={`${totalActionableOrders} actions required`}
                    className="flex items-center justify-center bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full animate-pulse"
                  >
                    {totalActionableOrders}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 opacity-50" aria-hidden />
              </button>

              {isNetworkListOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl z-[100] overflow-hidden shadow-xl">
                  {Object.entries(CHAIN_CONFIG).map(([id, config]) => {
                    const chainIdNum = Number(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          switchChain({ chainId: chainIdNum });
                          setIsNetworkListOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-slate-700 transition-colors flex items-center justify-between ${
                          chainIdNum === chainId
                            ? 'text-emerald-400 bg-slate-700/50'
                            : 'text-slate-300'
                        }`}
                      >
                        <span>{config.name}</span>
                        {networkAlerts[chainIdNum] > 0 && (
                          <span className="flex items-center justify-center bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full">
                            {networkAlerts[chainIdNum]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Wallet button */}
            <button
              type="button"
              aria-label="Open wallet"
              onClick={() => setIsWalletModalOpen(true)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-xl transition-all"
            >
              <div className="flex flex-col items-start">
                <span className="font-mono text-sm font-bold truncate max-w-[120px]">
                  {activeEmail
                    ? activeEmail.split('@')[0]
                    : userAddress
                    ? `${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`
                    : 'Wallet'}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold leading-none">
                  {formattedBalance}
                </span>
              </div>
              <Wallet className="w-4 h-4 text-emerald-400" aria-hidden />
            </button>

            {/* Logout */}
            <button
              type="button"
              aria-label="Log out"
              onClick={logout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-xl border border-red-500/20 transition-all"
            >
              <LogOut className="w-4 h-4" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {/* ── Profile & KYC summary cards ──────────────────────────────────────── */}
      {authenticated && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Profile card */}
          <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 font-bold text-xl flex-shrink-0">
                {activeEmail ? activeEmail[0].toUpperCase() : <User className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">
                  {activeEmail ? activeEmail.split('@')[0] : 'Wallet User'}
                </h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-emerald-400 text-sm font-medium">
                    Trust Score: {trustLevel ?? '—'}
                  </span>
                  <span className="text-slate-600 text-sm">•</span>
                  <span className="text-slate-500 text-xs font-mono">
                    {userAddress
                      ? `${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`
                      : 'Not connected'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-sm space-y-1 text-slate-400 min-w-max">
              <p>
                Email:{' '}
                {hasEmailLinked ? (
                  <span className="text-emerald-400 font-medium">Linked</span>
                ) : (
                  <span className="text-red-400 font-medium">Not linked</span>
                )}
              </p>
              <p>
                Balance:{' '}
                <span className="text-white font-mono">{formattedBalance}</span>
              </p>
            </div>
          </div>

          {/* KYC tier card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex flex-col justify-center items-center text-center">
            <ShieldCheck className="w-9 h-9 text-emerald-500 mb-2" />
            <h3 className="text-white font-bold">Tier 1 KYC Verified</h3>
            <p className="text-slate-400 text-xs mt-1 mb-3">
              You are cleared for P2P Escrow.
            </p>
            <button className="text-emerald-400 hover:text-emerald-300 text-sm font-bold flex items-center gap-1 transition-colors">
              Upgrade to Tier 2 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Escrow creation panel ─────────────────────────────────────────────── */}
      <div className="w-full max-w-lg mx-auto bg-slate-800/50 border border-slate-700 p-8 rounded-2xl shadow-2xl relative z-10 mb-10">
        {!authenticated ? (
          <div className="text-center">
            <Lock className="w-10 h-10 text-emerald-500 mx-auto mb-4" aria-hidden />
            <h2 className="text-xl font-bold text-white mb-2">
              Trust is no longer a leap of faith.
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Connect your wallet to create and manage secure escrows.
            </p>
            <button
              type="button"
              onClick={login}
              className="w-full bg-emerald-500 hover:bg-emerald-400 py-3 rounded-xl font-bold text-slate-900 transition-all"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Mode tabs */}
            <div
              className="bg-slate-900/80 p-1 rounded-xl flex mb-2 border border-slate-700 overflow-x-auto no-scrollbar"
              role="tablist"
            >
              {(
                [
                  { key: 'crypto', label: 'Crypto', Icon: Bitcoin },
                  { key: 'fiat', label: 'Bank Transfer', Icon: Banknote },
                  { key: 'giftcard', label: 'Gift Card', Icon: Gift },
                ] as const
              ).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => setMode(key)}
                  className={`flex-1 min-w-max px-3 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                    mode === key
                      ? 'bg-slate-700 text-white shadow'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden /> {label}
                </button>
              ))}
            </div>

            {/* ── CRYPTO form ──────────────────────────────────────────────── */}
            {mode === 'crypto' && (
              <>
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Select token"
                    aria-expanded={isTokenListOpen}
                    onClick={() => setIsTokenListOpen((v) => !v)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 flex justify-between items-center hover:border-slate-600 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-5 h-5 rounded-full ${selectedAsset.icon} flex items-center justify-center text-[8px]`}
                        aria-hidden
                      >
                        {selectedAsset.symbol[0]}
                      </div>
                      <span>{selectedAsset.symbol}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-500" aria-hidden />
                  </button>
                  {isTokenListOpen && (
                    <div className="absolute top-full w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl z-20 overflow-hidden shadow-xl">
                      {ASSETS.map((a, index) => (
                        <div
                          key={a.symbol}
                          role="option"
                          aria-selected={selectedAssetIndex === index}
                          tabIndex={0}
                          onClick={() => {
                            setSelectedAssetIndex(index);
                            setIsTokenListOpen(false);
                          }}
                          className="p-3 hover:bg-slate-700 cursor-pointer flex gap-3"
                        >
                          <div
                            className={`w-6 h-6 rounded-full ${a.icon} flex items-center justify-center text-[10px]`}
                            aria-hidden
                          >
                            {a.symbol[0]}
                          </div>
                          {a.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="crypto-seller" className="text-xs text-slate-400 ml-1 font-bold">
                    SELLER ADDRESS OR EMAIL
                  </label>
                  <input
                    id="crypto-seller"
                    value={sellerAddress}
                    onChange={(e) => setSellerAddress(e.target.value)}
                    placeholder="0x… or seller@email.com"
                    autoComplete="off"
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="crypto-amount" className="text-xs text-slate-400 ml-1 font-bold">
                    AMOUNT
                  </label>
                  <input
                    id="crypto-amount"
                    type="number"
                    min="0"
                    step="any"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCryptoTransaction}
                  disabled={
                    isWriting ||
                    (!isUnsupportedNetwork && (!sellerAddress.trim() || !amountInput))
                  }
                  className={`w-full py-4 rounded-xl font-bold mt-2 flex items-center justify-center gap-2 transition-all ${
                    isUnsupportedNetwork
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white'
                  }`}
                >
                  {isWriting ? (
                    <Loader2 className="animate-spin w-5 h-5" />
                  ) : isUnsupportedNetwork ? (
                    'Network Unsupported'
                  ) : (
                    'Secure Cryptocurrency'
                  )}
                </button>
              </>
            )}

            {/* ── FIAT form ────────────────────────────────────────────────── */}
            {mode === 'fiat' && (
              <>
                {!hasEmailLinked ? (
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-900/50 border border-slate-700 rounded-2xl text-center gap-4 mt-2">
                    <div className="w-14 h-14 bg-blue-500/20 border border-blue-500/30 rounded-full flex items-center justify-center mb-2">
                      <Mail className="w-6 h-6 text-blue-400" aria-hidden />
                    </div>
                    <h3 className="text-lg font-bold text-white">Email Verification Required</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      To use Bank Transfer escrows, you must link an email address to your account.
                    </p>
                    <button
                      type="button"
                      onClick={linkEmail}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl mt-2 transition-all w-full flex items-center justify-center gap-2"
                    >
                      Link Email Address <ArrowRight className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 flex items-center justify-center gap-2 cursor-not-allowed opacity-80">
                        <span className="text-sm font-bold">NGN</span>
                        <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center text-[8px] text-white">
                          ₦
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label htmlFor="fiat-amount" className="sr-only">Amount in NGN</label>
                        <input
                          id="fiat-amount"
                          type="number"
                          min="0"
                          step="any"
                          value={fiatAmount}
                          onChange={(e) => setFiatAmount(e.target.value)}
                          placeholder="Amount (e.g. 5000)"
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="opacity-70 cursor-not-allowed">
                      <label htmlFor="fiat-buyer-email" className="text-xs text-slate-400 ml-1 font-bold flex items-center gap-1.5">
                        YOUR EMAIL <Lock className="w-3 h-3 text-slate-500" aria-hidden />
                      </label>
                      <input
                        id="fiat-buyer-email"
                        readOnly
                        value={buyerEmail}
                        autoComplete="email"
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none text-slate-400 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="fiat-seller-email" className="text-xs text-emerald-400 ml-1 font-bold">
                        SELLER&apos;S TRUSTLINK EMAIL
                      </label>
                      <input
                        id="fiat-seller-email"
                        type="email"
                        autoComplete="email"
                        value={sellerEmail}
                        onChange={(e) => setSellerEmail(e.target.value)}
                        placeholder="seller@email.com"
                        className="w-full bg-slate-900/50 border border-emerald-500/30 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 ml-1 font-bold">
                        SELLER BANK DETAILS
                      </label>
                      <div className="flex flex-col gap-2 mt-1">
                        <label htmlFor="fiat-bank" className="sr-only">Select Bank</label>
                        <select
                          id="fiat-bank"
                          value={bankCode}
                          onChange={(e) => setBankCode(e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm appearance-none"
                        >
                          <option value="">
                            {isLoadingBanks ? 'Loading banks…' : 'Select Bank'}
                          </option>
                          {banks.map((b) => (
                            <option key={b.code} value={b.code}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                        <div className="relative">
                          <label htmlFor="fiat-acct-no" className="sr-only">Account Number</label>
                          <input
                            id="fiat-acct-no"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={10}
                            autoComplete="off"
                            value={accountNumber}
                            onChange={(e) =>
                              setAccountNumber(e.target.value.replace(/\D/g, ''))
                            }
                            placeholder="Account Number (10 digits)"
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-all"
                          />
                          {isResolving && (
                            <div className="absolute right-4 top-3.5">
                              <Loader2
                                className="animate-spin w-4 h-4 text-blue-500"
                                aria-label="Verifying account…"
                              />
                            </div>
                          )}
                        </div>
                        <div
                          aria-live="polite"
                          className={`w-full bg-slate-800/50 border ${
                            accountName
                              ? 'border-emerald-500/30 bg-emerald-500/10'
                              : resolveError
                              ? 'border-red-500/30 bg-red-500/10'
                              : 'border-slate-800'
                          } rounded-lg px-4 py-3 transition-all flex items-center gap-2 min-h-[46px]`}
                        >
                          {accountName ? (
                            <>
                              <div className="bg-emerald-500 rounded-full p-0.5">
                                <CheckCircle2 className="w-3 h-3 text-white" aria-hidden />
                              </div>
                              <span className="text-xs font-bold text-emerald-400 tracking-wide">
                                {accountName}
                              </span>
                            </>
                          ) : resolveError ? (
                            <>
                              <div className="bg-red-500 rounded-full p-0.5">
                                <X className="w-3 h-3 text-white" aria-hidden />
                              </div>
                              <span className="text-xs font-bold text-red-400 tracking-wide">
                                {resolveError}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-600 italic flex items-center gap-2">
                              <UserCheck className="w-3 h-3" aria-hidden /> Account Name will appear here
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="fiat-description" className="text-xs text-slate-400 ml-1 font-bold">
                        DESCRIPTION
                      </label>
                      <textarea
                        id="fiat-description"
                        value={fiatDescription}
                        onChange={(e) => setFiatDescription(e.target.value)}
                        placeholder="What are you paying for?"
                        maxLength={500}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-blue-500 transition-all h-24 resize-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleFiatTransaction}
                      disabled={!fiatAmount || !accountName || !buyerEmail || !sellerEmail}
                      className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      Secure Bank Transfer <ArrowRight className="w-4 h-4" aria-hidden />
                    </button>
                  </>
                )}
              </>
            )}

            {/* ── GIFT CARD form ───────────────────────────────────────────── */}
            {mode === 'giftcard' && (
              <div className="relative mt-2">
                <div
                  className={`flex flex-col gap-4 transition-all duration-300 ${
                    isGiftCardLocked
                      ? 'blur-md pointer-events-none opacity-40 select-none'
                      : ''
                  }`}
                  aria-hidden={isGiftCardLocked}
                >
                  <div>
                    <label htmlFor="gc-seller" className="text-xs text-slate-400 ml-1 font-bold">
                      SELLER ADDRESS OR EMAIL
                    </label>
                    <input
                      id="gc-seller"
                      value={gcSellerAddress}
                      onChange={(e) => setGcSellerAddress(e.target.value)}
                      placeholder="0x… or seller@email.com"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="gc-brand" className="text-xs text-slate-400 ml-1 font-bold">
                        BRAND
                      </label>
                      <select
                        id="gc-brand"
                        value={gcBrand}
                        onChange={(e) => setGcBrand(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-indigo-500 transition-all text-sm appearance-none"
                      >
                        <option value="">Select Brand</option>
                        <option value="Apple">Apple / iTunes</option>
                        <option value="Steam">Steam</option>
                        <option value="Amazon">Amazon</option>
                        <option value="Razer">Razer Gold</option>
                        <option value="Vanilla">Vanilla Visa</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="gc-amount" className="text-xs text-slate-400 ml-1 font-bold">
                        CARD VALUE (USD)
                      </label>
                      <input
                        id="gc-amount"
                        type="number"
                        min="0"
                        value={gcAmount}
                        onChange={(e) => setGcAmount(e.target.value)}
                        placeholder="e.g. 100"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="gc-code" className="text-xs text-slate-400 ml-1 font-bold">
                      GIFT CARD CODE (Encrypted upon save)
                    </label>
                    <input
                      id="gc-code"
                      type="text"
                      value={gcCode}
                      onChange={(e) => setGcCode(e.target.value)}
                      placeholder="Enter the alphanumeric code"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-indigo-500 transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="gc-image" className="text-xs text-slate-400 ml-1 font-bold">
                      UPLOAD PHYSICAL CARD IMAGE
                    </label>
                    <input
                      key={fileInputKey}
                      id="gc-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setGcImage(e.target.files?.[0] || null)}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 mt-1 outline-none text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-500/20 file:text-indigo-400 hover:file:bg-indigo-500/30 transition-all cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGiftCardTransaction}
                    disabled={
                      isWriting ||
                      !gcSellerAddress.trim() ||
                      !gcAmount ||
                      !gcBrand ||
                      !gcCode ||
                      !gcImage
                    }
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold mt-2 flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                  >
                    {isWriting ? (
                      <Loader2 className="animate-spin w-5 h-5" />
                    ) : (
                      'Encrypt & Secure Gift Card'
                    )}
                  </button>
                </div>

                {isGiftCardLocked && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-6 bg-slate-900/40 rounded-xl">
                    {trustLevel === null ? (
                      <Loader2
                        className="w-8 h-8 text-slate-400 animate-spin mb-4"
                        aria-label="Loading trust level"
                      />
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700 shadow-xl">
                          <Lock className="w-8 h-8 text-slate-400" aria-hidden />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Level 3 Required</h3>
                        <p className="text-sm text-slate-300">
                          Gift Card trading is locked to prevent fraud. Complete more standard trades
                          to reach Trust Level 3 and unlock this feature.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Order list ────────────────────────────────────────────────────────── */}
      {authenticated && (
        <div className="w-full border-t border-white/10 pt-8">
          <div className="flex justify-between items-end mb-6 border-b border-white/10 pb-1">
            <div className="flex gap-6" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={dashboardTab === 'buying'}
                onClick={() => setDashboardTab('buying')}
                className={`text-lg font-bold pb-4 border-b-2 transition-all ${
                  dashboardTab === 'buying'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-500'
                }`}
              >
                I&apos;m Buying
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dashboardTab === 'selling'}
                onClick={() => setDashboardTab('selling')}
                className={`text-lg font-bold pb-4 border-b-2 transition-all ${
                  dashboardTab === 'selling'
                    ? 'border-blue-400 text-blue-400'
                    : 'border-transparent text-slate-500'
                }`}
              >
                I&apos;m Selling
              </button>
            </div>

            <div className="flex items-center gap-3 pb-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
                Showing{' '}
                {mode === 'crypto'
                  ? 'Cryptocurrency'
                  : mode === 'fiat'
                  ? 'Bank Transfer'
                  : 'Gift Card'}{' '}
                Orders
              </span>
              <button
                type="button"
                aria-label="Refresh orders"
                onClick={handleRefresh}
                className="text-slate-500 hover:text-white"
              >
                <RefreshCcw className="w-4 h-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {displayedOrders.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                isSellerView={dashboardTab === 'selling'}
                userAddress={userAddress || ''}
                onUpdate={handleRefresh}
              />
            ))}
            {displayedOrders.length === 0 && (
              <div className="text-slate-500 text-center py-10 italic border border-dashed border-slate-700 rounded-xl">
                No active{' '}
                <span className="capitalize">
                  {mode === 'crypto'
                    ? 'Cryptocurrency'
                    : mode === 'fiat'
                    ? 'Bank Transfer'
                    : 'Gift Card'}
                </span>{' '}
                orders found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
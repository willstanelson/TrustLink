'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePrivy, useFundWallet } from '@privy-io/react-auth';
import {
  useAccount,
  useBalance,
  useSendTransaction,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from 'wagmi';
import { formatEther, formatUnits, parseEther, parseUnits, isAddress } from 'viem';
import { CHAIN_CONFIG, DEFAULT_CHAIN_ID, SUPPORTED_CHAIN_IDS } from '@/app/constants';
import { useLiveRates } from '@/lib/rates';
import { useAuth } from '@/context/AuthContext';
import KYCVerification from '@/components/KYCVerification';
import {
  WalletCards,
  ShieldCheck,
  CreditCard,
  Coins,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  ArrowDown,
  Send,
  Repeat,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Landmark,
  Lock,
  ArrowUpRight,
  Award,
  LogOut,
  X,
  ExternalLink,
  ChevronDown,
  TrendingUp,
  Globe,
  Sparkles,
  Layers,
  ArrowDownLeft,
} from 'lucide-react';

const ERC20_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

type HubTab = 'payouts' | 'kyc' | 'crypto' | 'security';
type SendTokenType = 'NATIVE' | 'USDC';

interface BankItem {
  id?: number | string;
  name: string;
  code: string;
  slug?: string;
}

/**
 * Normalizes digital bank/fintech NIBSS codes to Paystack expected resolution codes.
 * - OPay: NIBSS 50572 / 100004 / OPAY -> Paystack 999992
 * - PalmPay: NIBSS 090275 / 100033 / PALMPAY -> Paystack 999991
 * - Moniepoint: NIBSS 090405 / MONIEPOINT -> Paystack 50515
 * - Kuda Bank: NIBSS 090267 / KUDA -> Paystack 50211
 */
function normalizeFintechBankCode(code: string): string {
  if (!code) return '';
  const trimmed = String(code).trim().toUpperCase();
  switch (trimmed) {
    case '50572':
    case '100004':
    case 'OPAY':
      return '999992';
    case '090275':
    case '100033':
    case 'PALMPAY':
      return '999991';
    case '090405':
    case 'MONIEPOINT':
      return '50515';
    case '090267':
    case 'KUDA':
      return '50211';
    default:
      return String(code).trim();
  }
}

export default function ProfileAndWalletPage() {
  const {
    user,
    logout,
    linkGoogle,
    linkTwitter,
    linkEmail,
    unlinkGoogle,
    unlinkTwitter,
    unlinkEmail,
    exportWallet,
    getAccessToken,
  } = usePrivy();

  const { fundWallet } = useFundWallet();
  const { address: wagmiAddress } = useAccount();
  const { supabase, sessionReady } = useAuth();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { rates, stale: ratesStale } = useLiveRates();

  // Active wallet address (Wagmi address or Privy embedded wallet address)
  const activeWallet = (wagmiAddress || user?.wallet?.address) as `0x${string}` | undefined;

  // Active chain derivation
  const isUnsupportedNetwork = !CHAIN_CONFIG[chainId];
  const activeChainId = isUnsupportedNetwork ? DEFAULT_CHAIN_ID : chainId;
  const activeChain = CHAIN_CONFIG[activeChainId] ?? CHAIN_CONFIG[DEFAULT_CHAIN_ID];
  const nativeSymbol = activeChain.nativeCurrency?.symbol || activeChain.nativeSymbol || 'XPL';

  // ── Privacy & Visibility Toggle (persisted independently) ──
  const [showBalance, setShowBalance] = useState<boolean>(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('trustlink_show_profile_balance');
      if (stored !== null) setShowBalance(stored === 'true');
    } catch {
      // ignore
    }
  }, []);

  const toggleBalanceVisibility = () => {
    setShowBalance((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('trustlink_show_profile_balance', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // ── Active Lower Tab ──
  const [activeTab, setActiveTab] = useState<HubTab>('payouts');

  // ── Copy to Clipboard State ──
  const [hasCopied, setHasCopied] = useState(false);
  const copyAddress = () => {
    if (!activeWallet) return;
    navigator.clipboard.writeText(activeWallet);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  // ── Balances & Live Valuation ──
  const { data: nativeBalance, refetch: refetchNative } = useBalance({
    address: activeWallet,
    chainId: activeChainId,
    query: { enabled: !!activeWallet },
  });

  const { data: usdcBalance, refetch: refetchUsdc } = useBalance({
    address: activeWallet,
    token: activeChain.usdcAddress,
    chainId: activeChainId,
    query: { enabled: !!activeWallet && !!activeChain.usdcAddress },
  });

  const formattedNative = nativeBalance
    ? parseFloat(formatEther(nativeBalance.value)).toFixed(4)
    : '0.0000';
  const formattedUsdc = usdcBalance
    ? parseFloat(formatUnits(usdcBalance.value, usdcBalance.decimals ?? 6)).toFixed(2)
    : '0.00';

  // Total USD Calculation using live rates or reasonable fallback
  const totalValueUSD = useMemo(() => {
    const nativePrice = rates[nativeSymbol] || rates['ETH'] || (nativeSymbol === 'XPL' ? 1.5 : 2500);
    const usdcPrice = rates['USDC'] || 1.0;
    const nativeVal = (nativeBalance ? parseFloat(formatEther(nativeBalance.value)) : 0) * nativePrice;
    const usdcVal = (usdcBalance ? parseFloat(formatUnits(usdcBalance.value, usdcBalance.decimals ?? 6)) : 0) * usdcPrice;
    const total = nativeVal + usdcVal;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total);
  }, [nativeBalance, usdcBalance, rates, nativeSymbol]);

  // ── Profile, Escrow Stats & Bank Payout Details ──
  const [profileData, setProfileData] = useState<any>(null);
  const [stats, setStats] = useState({ completed: 0, disputed: 0 });
  const [selectedBank, setSelectedBank] = useState<BankItem | null>(null);
  const [selectedBankKey, setSelectedBankKey] = useState<string>('');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [banks, setBanks] = useState<BankItem[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── Modals State ──
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isSwapOpen, setIsSwapOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [customDisplayName, setCustomDisplayName] = useState('');

  // ── Load Banks ──
  useEffect(() => {
    let cancelled = false;
    async function fetchBanks() {
      try {
        const res = await fetch('/api/banks');
        const json = await res.json();
        if (!cancelled && json?.data && Array.isArray(json.data)) {
          const mappedBanks: BankItem[] = json.data.map((b: any, idx: number) => {
            const code = normalizeFintechBankCode(b.code);
            const slug = b.slug || b.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `bank-${idx}`;
            const id = b.id != null ? String(b.id) : slug;
            return {
              ...b,
              id,
              slug,
              code,
              name: b.name,
            };
          });
          setBanks(mappedBanks);
        }
      } catch (err) {
        console.error('Failed to load banks:', err);
      } finally {
        if (!cancelled) setIsLoadingBanks(false);
      }
    }
    fetchBanks();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Secure Profile Data + Escrow Stats Fetch ──
  const fetchProfileAndStats = useCallback(async () => {
    if (!activeWallet || !sessionReady) return;

    try {
      // 1. Fetch Escrow Statistics
      const { data: orders } = await supabase
        .from('escrow_orders')
        .select('status')
        .or(`seller_address.ilike.${activeWallet},buyer_wallet_address.ilike.${activeWallet}`);

      if (orders) {
        const completed = orders.filter((o) => o.status === 'completed').length;
        const disputed = orders.filter((o) => o.status === 'disputed').length;
        setStats({ completed, disputed });
      }

      // 2. Fetch Profile details with Bearer token
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.profile) {
        setProfileData(data.profile);
        const savedName = data.profile.bank_name || '';
        const savedCode = normalizeFintechBankCode(data.profile.bank_code || '');
        setBankName(savedName);
        setBankCode(savedCode);
        setAccountNumber(data.profile.account_number || '');
        setAccountName(data.profile.account_name || '');
        if (data.profile.display_name) setCustomDisplayName(data.profile.display_name);

        if (banks.length > 0) {
          const match = banks.find(
            (b) =>
              (savedName && b.name.toLowerCase() === savedName.toLowerCase()) ||
              (savedCode && b.code === savedCode)
          );
          if (match) {
            setSelectedBank(match);
            setSelectedBankKey(String(match.id || match.slug));
          }
        }
      }
    } catch (err) {
      console.error('Error fetching profile and stats:', err);
    }
  }, [activeWallet, sessionReady, supabase, getAccessToken, banks]);

  useEffect(() => {
    fetchProfileAndStats();
  }, [fetchProfileAndStats]);

  // Synchronize selectedBank with loaded banks if profile already has bank details
  useEffect(() => {
    if (banks.length > 0 && (bankName || bankCode) && !selectedBankKey) {
      const match = banks.find(
        (b) =>
          (bankName && b.name.toLowerCase() === bankName.toLowerCase()) ||
          (bankCode && b.code === bankCode)
      );
      if (match) {
        setSelectedBank(match);
        setSelectedBankKey(String(match.id || match.slug));
      }
    }
  }, [banks, bankName, bankCode, selectedBankKey]);

  // ── Auto-resolve Account Name via Paystack ──
  useEffect(() => {
    const trimmedAccount = accountNumber.trim();

    // Extract the bank code from the selected bank object (guarantees OPay never aliases to BANKIT MFB)
    const codeFromSelectedBank = selectedBank?.code || bankCode;
    const effectiveBankCode = normalizeFintechBankCode(codeFromSelectedBank);

    // Request Trigger: Only fires when account number reaches exactly 10 numeric digits AND a valid bank code exists
    const hasValidAccount = /^\d{10}$/.test(trimmedAccount);
    const hasValidBank = Boolean(
      effectiveBankCode &&
      effectiveBankCode.length > 0 &&
      effectiveBankCode !== 'undefined' &&
      effectiveBankCode !== 'null'
    );

    if (!hasValidAccount || !hasValidBank) {
      if (trimmedAccount.length === 0) {
        setAccountName('');
        setResolveError(null);
      }
      return;
    }

    let cancelled = false;
    async function resolveAccount() {
      setIsResolvingAccount(true);
      setResolveError(null);

      try {
        // URL Parameters: Ensure outgoing fetch call appends both query parameters
        const queryParams = new URLSearchParams({
          account_number: trimmedAccount,
          bank_code: effectiveBankCode,
        });

        const res = await fetch(`/api/resolve-account?${queryParams.toString()}`);
        const data = await res.json();

        if (cancelled) return;

        if (res.ok && data.status) {
          const resolvedName = data?.data?.account_name || data?.account_name;
          if (resolvedName) {
            // Auto-Fill: Set directly into verified account name field and clear prior errors
            setAccountName(resolvedName);
            setResolveError(null);
            setSaveMessage(null);
          } else {
            setAccountName('');
            setResolveError('Could not verify account name with selected bank.');
          }
        } else {
          setAccountName('');
          setResolveError(data?.error || data?.message || 'Verification failed. Please check bank and account number.');
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Failed to resolve bank account:', err);
          setAccountName('');
          setResolveError(err?.message || 'Network error verifying account.');
        }
      } finally {
        if (!cancelled) setIsResolvingAccount(false);
      }
    }

    resolveAccount();
    return () => {
      cancelled = true;
    };
  }, [accountNumber, selectedBank, bankCode]);

  // ── Authenticated Bank Details Save Handshake ──
  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBank(true);
    setSaveMessage(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setSaveMessage({ text: 'Authentication token missing. Please sign in again.', type: 'error' });
        return;
      }

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bankName, bankCode, accountNumber, accountName }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveMessage({ text: 'Bank payout details securely saved!', type: 'success' });
        fetchProfileAndStats();
      } else {
        setSaveMessage({ text: data.error || 'Failed to save bank details.', type: 'error' });
      }
    } catch (err: any) {
      setSaveMessage({ text: err.message || 'Network error saving bank details.', type: 'error' });
    } finally {
      setIsSavingBank(false);
    }
  };

  // ── Deposit Flow Handler (Privy fundWallet + Graceful Fallback) ──
  const handleDepositTrigger = async () => {
    if (!activeWallet) return;
    try {
      await fundWallet({ address: activeWallet });
    } catch (err) {
      console.warn('Privy fundWallet exited or unsupported, opening direct deposit modal:', err);
      setIsDepositOpen(true);
    }
  };

  // ── Send Transaction Flow ──
  const [sendToken, setSendToken] = useState<SendTokenType>('NATIVE');
  const [recipient, setRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);

  const {
    sendTransaction,
    data: nativeTxHash,
    isPending: isSendingNative,
    error: nativeTxError,
    reset: resetNativeTx,
  } = useSendTransaction();

  const {
    writeContract,
    data: tokenTxHash,
    isPending: isSendingToken,
    error: tokenTxError,
    reset: resetTokenTx,
  } = useWriteContract();

  const activeTxHash = sendToken === 'NATIVE' ? nativeTxHash : tokenTxHash;
  const activeTxError = sendToken === 'NATIVE' ? nativeTxError : tokenTxError;
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: activeTxHash,
  });

  useEffect(() => {
    if (isTxSuccess) {
      setSendAmount('');
      setRecipient('');
      resetNativeTx();
      resetTokenTx();
      refetchNative();
      refetchUsdc();
    }
  }, [isTxSuccess, resetNativeTx, resetTokenTx, refetchNative, refetchUsdc]);

  const handleMaxAmount = () => {
    if (sendToken === 'NATIVE' && nativeBalance) {
      const val = parseFloat(nativeBalance.formatted) - 0.0001;
      setSendAmount(val > 0 ? val.toFixed(6) : '0');
    } else if (sendToken === 'USDC' && usdcBalance) {
      const safeDecimals = Math.min(usdcBalance.decimals ?? 6, 6);
      setSendAmount(parseFloat(usdcBalance.formatted).toFixed(safeDecimals));
    }
  };

  const handleExecuteSend = () => {
    setSendError(null);
    if (!isAddress(recipient)) {
      setSendError('Please enter a valid Ethereum address.');
      return;
    }
    const num = parseFloat(sendAmount);
    if (!sendAmount || isNaN(num) || num <= 0) {
      setSendError('Please enter a valid amount.');
      return;
    }

    try {
      if (sendToken === 'NATIVE') {
        sendTransaction({
          to: recipient as `0x${string}`,
          value: parseEther(sendAmount),
          chainId: activeChainId,
        });
      } else {
        writeContract({
          address: activeChain.usdcAddress,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipient as `0x${string}`, parseUnits(sendAmount, usdcBalance?.decimals ?? 6)],
          chainId: activeChainId,
        });
      }
    } catch (err: any) {
      setSendError(err.message || 'Transaction submission failed');
    }
  };

  const isSending = isSendingNative || isSendingToken || isTxConfirming;

  // ── User Identity Details ──
  const emailIdentifier =
    user?.email?.address ||
    user?.google?.email ||
    user?.apple?.email ||
    '';
  const displayName =
    customDisplayName ||
    user?.google?.name ||
    (emailIdentifier ? emailIdentifier.split('@')[0] : 'Willstan');
  const userInitials = (displayName[0] || 'W').toUpperCase();

  // Tier Status
  const currentTierLevel = profileData?.current_trust_level || 1;
  const tierTitle =
    currentTierLevel >= 3
      ? 'Tier 3: Enterprise'
      : currentTierLevel === 2
        ? 'Tier 2: Verified'
        : 'Tier 1: Starter';

  return (
    <div className="w-full min-h-screen bg-[#060812] text-white font-sans pb-20">
      {/* ── Ambient Header Banner ── */}
      <div className="relative w-full overflow-hidden border-b border-[#1b2238] bg-gradient-to-b from-[#0b1022] to-[#060812]">
        {/* Glow Spheres */}
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -top-24 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Decorative Abstract Doodle Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
                <span>Profile &amp; Wallet Hub</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                  Live
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Manage your Web3 credentials, fiat withdrawal rails, and multi-chain escrow liquidity.
              </p>
            </div>

            {/* Quick Network Selector Switcher */}
            <div className="hidden sm:flex items-center gap-2 bg-[#12182b] border border-[#232c4a] rounded-xl px-3 py-1.5 text-xs text-slate-300">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{activeChain.name}</span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
              DUAL-CARD HEADER (STACKS CLEANLY ON MOBILE: flex-col lg:flex-row)
             ══════════════════════════════════════════════════════════ */}
          <div className="flex flex-col lg:flex-row items-stretch gap-6 w-full">
            {/* ── CARD 1: Identity & Trust Status (Left: ~58-60% width) ── */}
            <div className="w-full lg:w-[58%] bg-[#12182b]/95 backdrop-blur-xl border border-[#232c4a] rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shadow-2xl transition-all hover:border-slate-700">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1f2742]">
                  <div className="flex items-center gap-4 sm:gap-5">
                    {/* Glowing Ambient Avatar Ring */}
                    <div className="relative group">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-600 to-emerald-800 p-0.5 shadow-[0_0_30px_rgba(16,185,129,0.35)] ring-2 ring-emerald-400/40 flex items-center justify-center">
                        <div className="w-full h-full bg-[#0e1424] rounded-[14px] flex items-center justify-center">
                          <span className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                            {userInitials}
                          </span>
                        </div>
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#12182b] flex items-center justify-center">
                        <Check className="w-3 h-3 text-black stroke-[3]" />
                      </span>
                    </div>

                    <div>
                      {/* Trust Tier Badge Pill */}
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold tracking-wide mb-1.5">
                        <Award className="w-3 h-3" />
                        <span>{tierTitle}</span>
                      </div>

                      <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                        {displayName}
                      </h2>

                      {/* Truncated Active Wallet Address + 1-Click Copy */}
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={copyAddress}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-300 hover:text-white bg-[#19223a] border border-[#2b375b] px-2.5 py-1 rounded-lg transition-colors group"
                          title="Copy full wallet address"
                        >
                          <span>
                            {activeWallet
                              ? `${activeWallet.slice(0, 6)}…${activeWallet.slice(-4)}`
                              : 'No Wallet Connected'}
                          </span>
                          {hasCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" />
                          )}
                        </button>
                        {hasCopied && (
                          <span className="text-[11px] text-emerald-400 font-semibold animate-in fade-in">
                            Copied!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Edit Profile Button */}
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(true)}
                    className="self-start sm:self-center border border-[#2b375b] hover:border-slate-500 bg-[#19223a] hover:bg-[#202b49] text-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                  >
                    Edit Profile
                  </button>
                </div>

                {/* Identity Metadata & Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6">
                  <div className="bg-[#0e1424] border border-[#1e2742] rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Trust Status
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-200">
                        {profileData?.kyc_completed ? 'KYC Verified' : 'Level 1 Active'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#0e1424] border border-[#1e2742] rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Escrow Track Record
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-slate-200">
                        {stats.completed} Deals (0% Disputes)
                      </span>
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1 bg-[#0e1424] border border-[#1e2742] rounded-xl p-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Linked Account
                    </span>
                    <span className="text-xs font-bold text-slate-200 truncate block mt-1" title={emailIdentifier}>
                      {emailIdentifier || 'Web3 Native'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verified Trust Statement */}
              <div className="mt-6 pt-4 border-t border-[#1f2742]/60 flex items-center justify-between text-xs text-slate-400">
                <span>Account protected by TrustLink Non-Custodial Multi-Sig Shield</span>
                <span className="text-emerald-400 font-semibold">100% On-Chain Protected</span>
              </div>
            </div>

            {/* ── CARD 2: Funds & Privy Wallet Hub (Right: ~40-42% width) ── */}
            <div className="w-full lg:w-[42%] bg-[#12182b]/95 backdrop-blur-xl border border-[#232c4a] rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden shadow-2xl transition-all hover:border-slate-700">
              <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

              <div>
                {/* Header: Label + Independent Eye Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Total Estimated Balance
                    </span>
                    <button
                      id="balance-privacy-toggle"
                      type="button"
                      onClick={toggleBalanceVisibility}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                      title={showBalance ? 'Hide balance' : 'Show balance'}
                      aria-label={showBalance ? 'Hide balance' : 'Show balance'}
                    >
                      {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      refetchNative();
                      refetchUsdc();
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                    title="Refresh balances"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Primary Figure */}
                <div className="mt-2">
                  <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                    {showBalance ? totalValueUSD : '$••••••'}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{activeChain.name} Network</span>
                  </div>
                </div>

                {/* Quick Action Row (Direct Privy Actions) */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3 my-5">
                  {/* Deposit Button (Emerald) */}
                  <button
                    id="quick-action-deposit"
                    type="button"
                    onClick={handleDepositTrigger}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-2.5 px-3 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 group"
                  >
                    <ArrowDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
                    <span>Deposit</span>
                  </button>

                  {/* Send Button (Blue) */}
                  <button
                    id="quick-action-send"
                    type="button"
                    onClick={() => setIsSendOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 px-3 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20 transition-all active:scale-95 group"
                  >
                    <Send className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    <span>Send</span>
                  </button>

                  {/* Swap Button (Purple) */}
                  <button
                    id="quick-action-swap"
                    type="button"
                    onClick={() => setIsSwapOpen(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 px-3 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/20 transition-all active:scale-95 group"
                  >
                    <Repeat className="w-4 h-4 transition-transform group-hover:rotate-45" />
                    <span>Swap</span>
                  </button>
                </div>

                {/* My Assets Mini-Ledger Preview */}
                <div className="space-y-2 pt-2 border-t border-[#1f2742]">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    My Assets Preview
                  </span>

                  {/* Native Token Row */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0e1424] border border-[#1e2742]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-black text-xs">
                        {nativeSymbol.slice(0, 3)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{nativeSymbol}</div>
                        <div className="text-[10px] text-slate-400">{activeChain.name} Native</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-white">
                        {showBalance ? `${formattedNative} ${nativeSymbol}` : '••••••'}
                      </div>
                    </div>
                  </div>

                  {/* USDC Token Row */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0e1424] border border-[#1e2742]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-black text-xs">
                        USD
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">USDC</div>
                        <div className="text-[10px] text-slate-400">USD Coin Stablecoin</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-white">
                        {showBalance ? `$${formattedUsdc}` : '••••••'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          LOWER CONTENT SECTION: 4 MODULAR TABS
         ══════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-2 p-1.5 bg-[#12182b] border border-[#232c4a] rounded-2xl overflow-x-auto scrollbar-none w-full sm:w-max mb-8">
          <button
            id="tab-btn-payouts"
            type="button"
            onClick={() => setActiveTab('payouts')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'payouts'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
          >
            <Landmark className="w-4 h-4" />
            <span>Bank &amp; Payouts</span>
          </button>

          <button
            id="tab-btn-kyc"
            type="button"
            onClick={() => setActiveTab('kyc')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'kyc'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Trust &amp; KYC Tier</span>
          </button>

          <button
            id="tab-btn-crypto"
            type="button"
            onClick={() => setActiveTab('crypto')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'crypto'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
          >
            <Coins className="w-4 h-4" />
            <span>Crypto Assets</span>
          </button>

          <button
            id="tab-btn-security"
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'security'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Security &amp; Linked Accounts</span>
          </button>
        </div>

        {/* ── TAB 1: Bank & Payouts ── */}
        {activeTab === 'payouts' && (
          <div className="bg-[#12182b] border border-[#232c4a] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in fade-in duration-200">
            <div className="max-w-2xl">
              <div className="mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Bank Account Details</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Your verified NGN bank details for fiat escrow withdrawals. All transactions are securely mediated.
                </p>
              </div>

              <form onSubmit={handleSaveBankDetails} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bank Name Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Bank Name
                    </label>
                    <select
                      id="bank-select"
                      required
                      value={selectedBankKey}
                      onChange={(e) => {
                        const chosenKey = e.target.value;
                        setSelectedBankKey(chosenKey);
                        const bankObj = banks.find(
                          (b) => String(b.id || b.slug) === chosenKey
                        );
                        setSelectedBank(bankObj || null);
                        if (bankObj) {
                          setBankCode(bankObj.code);
                          setBankName(bankObj.name);
                        } else {
                          setBankCode('');
                          setBankName('');
                        }
                        setResolveError(null);
                      }}
                      className="w-full bg-[#0e1424] border border-[#232c4a] focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white transition-all outline-none"
                    >
                      <option value="" disabled className="text-slate-500">
                        {isLoadingBanks ? 'Loading banks...' : 'Select your bank...'}
                      </option>
                      {banks.map((b) => {
                        const optionValue = String(b.id || b.slug);
                        return (
                          <option key={optionValue} value={optionValue}>
                            {b.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Account Number */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Account Number (10 Digits)
                    </label>
                    <input
                      id="account-number"
                      type="text"
                      required
                      maxLength={10}
                      pattern="[0-9]{10}"
                      placeholder="e.g. 0123456789"
                      value={accountNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setAccountNumber(val);
                        if (val.length !== 10) {
                          setAccountName('');
                          setResolveError(null);
                        }
                      }}
                      className="w-full bg-[#0e1424] border border-[#232c4a] focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Account Name (Auto-Resolved read-only) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Verified Account Name
                    </label>
                    {isResolvingAccount && (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Resolving NUBAN…
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    readOnly
                    placeholder="Auto-resolved upon entering valid bank and account number"
                    value={accountName}
                    className="w-full bg-[#0e1424]/80 border border-[#232c4a] focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 transition-all outline-none cursor-default font-medium"
                  />
                  {resolveError && (
                    <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5 animate-in fade-in">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{resolveError}</span>
                    </p>
                  )}
                </div>

                {saveMessage && (
                  <div
                    className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2.5 ${saveMessage.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                  >
                    {saveMessage.type === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span>{saveMessage.text}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingBank}
                    className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 px-8 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_25px_rgba(16,185,129,0.25)] active:scale-95"
                  >
                    {isSavingBank ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving Payout Details…
                      </span>
                    ) : (
                      'Save Payout Details'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── TAB 2: Trust & KYC Tier ── */}
        {activeTab === 'kyc' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Tiers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Tier 1 */}
              <div
                className={`bg-[#12182b] border rounded-3xl p-6 relative overflow-hidden ${currentTierLevel === 1
                  ? 'border-amber-500/40 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/20'
                  : 'border-[#232c4a]'
                  }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Tier 1: Starter
                  </span>
                  {currentTierLevel === 1 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 text-[10px] font-bold border border-amber-500/20">
                      Current
                    </span>
                  )}
                </div>
                <div className="text-2xl font-black text-white">₦100,000</div>
                <div className="text-xs text-slate-400 mt-0.5">$200 per deal limit</div>
                <ul className="mt-5 space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Basic P2P crypto &amp; fiat trades</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Standard escrow mediation</span>
                  </li>
                </ul>
              </div>

              {/* Tier 2 */}
              <div
                className={`bg-[#12182b] border rounded-3xl p-6 relative overflow-hidden ${currentTierLevel === 2
                  ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20'
                  : 'border-[#232c4a]'
                  }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Tier 2: Verified Identity
                  </span>
                  {currentTierLevel === 2 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-bold border border-emerald-500/20">
                      Current
                    </span>
                  )}
                </div>
                <div className="text-2xl font-black text-white">₦2,000,000</div>
                <div className="text-xs text-slate-400 mt-0.5">$2,500 per deal limit</div>
                <ul className="mt-5 space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Government ID / BVN Verification</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Higher volume trade rooms</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Priority dispute turnaround</span>
                  </li>
                </ul>
              </div>

              {/* Tier 3 */}
              <div
                className={`bg-[#12182b] border rounded-3xl p-6 relative overflow-hidden ${currentTierLevel >= 3
                  ? 'border-purple-500/40 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/20'
                  : 'border-[#232c4a]'
                  }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                    Tier 3: Enterprise
                  </span>
                  {currentTierLevel >= 3 && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 text-[10px] font-bold border border-purple-500/20">
                      Current
                    </span>
                  )}
                </div>
                <div className="text-2xl font-black text-white">Unlimited</div>
                <div className="text-xs text-slate-400 mt-0.5">High-volume merchant status</div>
                <ul className="mt-5 space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-purple-400" />
                    <span>Zero cap on locked deals</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-purple-400" />
                    <span>Dedicated account mediator</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-purple-400" />
                    <span>Custom escrow smart contract deployments</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Verification CTA Card */}
            <div className="bg-[#12182b] border border-[#232c4a] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Identity Verification Status</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
                  {profileData?.kyc_completed
                    ? 'Your identity has been fully verified. You currently enjoy Tier 2 limits and enhanced escrow counterparty trust.'
                    : 'Verify your BVN or government-issued ID to immediately upgrade to Tier 2 and unlock up to ₦2,000,000 deal limits.'}
                </p>
              </div>

              <div>
                {profileData?.kyc_completed ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verified</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsKycModalOpen(true)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] active:scale-95 whitespace-nowrap"
                  >
                    Verify Identity Now
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: Crypto Assets ── */}
        {activeTab === 'crypto' && (
          <div className="bg-[#12182b] border border-[#232c4a] rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-violet-400" />
                  <span>Multi-Chain Testnet Assets</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Active escrow liquidity supported across Plasma Testnet and EVM partner chains.
                </p>
              </div>
              <div className="text-xs text-slate-400">
                NGN FX Rate: <span className="text-emerald-400 font-bold">₦1,550 / USD</span>
              </div>
            </div>

            {/* Asset Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1f2742] text-slate-500 uppercase tracking-wider font-bold">
                    <th className="py-3 px-4">Asset / Network</th>
                    <th className="py-3 px-4">Chain ID</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Est. USD Valuation</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2742]">
                  {SUPPORTED_CHAIN_IDS.map((cId) => {
                    const cfg = CHAIN_CONFIG[cId];
                    if (!cfg) return null;
                    const isCurrent = cId === chainId;
                    const tokenPrice =
                      rates[cfg.nativeSymbol] || (cfg.nativeSymbol === 'XPL' ? 1.5 : 2500);

                    return (
                      <tr key={cId} className="hover:bg-[#161d33] transition-colors">
                        <td className="py-4 px-4 flex items-center gap-3 font-semibold text-white">
                          <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xs">
                            {cfg.nativeSymbol.slice(0, 3)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span>{cfg.name}</span>
                              {isCurrent && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400" title="Connected Network" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500">{cfg.nativeSymbol} Native</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono text-slate-400">{cId}</td>
                        <td className="py-4 px-4 text-slate-300 font-medium">EVM Testnet</td>
                        <td className="py-4 px-4 font-semibold text-white">
                          ${tokenPrice.toLocaleString()}
                          <span className="text-[10px] text-slate-400 block">
                            ₦{(tokenPrice * 1550).toLocaleString()} NGN
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {isCurrent ? (
                            <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[11px]">
                              Connected
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => switchChain({ chainId: cId })}
                              className="px-3 py-1.5 rounded-lg bg-[#1a223a] hover:bg-[#222c4a] border border-[#2b375b] text-slate-200 font-bold text-[11px] transition-colors"
                            >
                              Switch Chain
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 4: Security & Linked Accounts ── */}
        {activeTab === 'security' && (
          <div className="bg-[#12182b] border border-[#232c4a] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-400" />
                <span>Security &amp; Connected Accounts</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Manage your Web3 identity connections, recovery credentials, and active sessions.
              </p>
            </div>

            {/* Linked Accounts List */}
            <div className="space-y-3 max-w-2xl">
              {/* Google */}
              <div className="flex items-center justify-between bg-[#0e1424] border border-[#1e2742] p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white text-black font-black flex items-center justify-center text-sm shadow">
                    G
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Google Account</p>
                    <p className="text-xs text-slate-400">
                      {user?.google ? user.google.email : 'Not Linked'}
                    </p>
                  </div>
                </div>
                {user?.google ? (
                  <button
                    type="button"
                    onClick={() => unlinkGoogle(user.google!.subject)}
                    className="text-xs text-red-400 hover:text-red-300 font-bold px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors"
                  >
                    Unlink
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={linkGoogle}
                    className="text-xs text-slate-900 bg-white hover:bg-slate-200 font-bold px-3.5 py-1.5 rounded-lg transition-colors"
                  >
                    Connect
                  </button>
                )}
              </div>

              {/* Twitter / X */}
              <div className="flex items-center justify-between bg-[#0e1424] border border-[#1e2742] p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-black text-white border border-slate-700 font-black flex items-center justify-center text-sm shadow">
                    𝕏
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Twitter / X</p>
                    <p className="text-xs text-slate-400">
                      {user?.twitter ? `@${user.twitter.username}` : 'Not Linked'}
                    </p>
                  </div>
                </div>
                {user?.twitter ? (
                  <button
                    type="button"
                    onClick={() => unlinkTwitter(user.twitter!.subject)}
                    className="text-xs text-red-400 hover:text-red-300 font-bold px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors"
                  >
                    Unlink
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={linkTwitter}
                    className="text-xs text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 font-bold px-3.5 py-1.5 rounded-lg transition-colors"
                  >
                    Connect
                  </button>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center justify-between bg-[#0e1424] border border-[#1e2742] p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center text-sm shadow">
                    @
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Email Address</p>
                    <p className="text-xs text-slate-400">
                      {user?.email ? user.email.address : 'Not Linked'}
                    </p>
                  </div>
                </div>
                {user?.email ? (
                  <button
                    type="button"
                    onClick={() => unlinkEmail(user.email!.address)}
                    className="text-xs text-red-400 hover:text-red-300 font-bold px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors"
                  >
                    Unlink
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={linkEmail}
                    className="text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 font-bold px-3.5 py-1.5 rounded-lg transition-colors"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>

            {/* Wallet Key Export & Danger Zone */}
            <div className="pt-6 border-t border-[#1f2742] max-w-2xl space-y-4">
              <div className="bg-[#0e1424] border border-[#1e2742] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>Non-Custodial Private Key Export</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Export your embedded wallet recovery key to use in external Web3 wallets (MetaMask, Rabby).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={exportWallet}
                  className="bg-[#19223a] hover:bg-[#202b49] text-white border border-[#2b375b] font-bold px-4 py-2.5 rounded-xl text-xs transition-colors whitespace-nowrap active:scale-95"
                >
                  Export Key
                </button>
              </div>

              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-3.5 rounded-2xl font-bold text-xs transition-all active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out of TrustLink</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          MODALS
         ══════════════════════════════════════════════════════════ */}

      {/* ── 1. Send Modal ── */}
      {isSendOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#12182b] border border-[#232c4a] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#1f2742]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Send className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-white">Send Crypto</h3>
              </div>
              <button
                id="close-send-modal"
                type="button"
                onClick={() => setIsSendOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Token Switcher */}
            <div className="grid grid-cols-2 gap-2 bg-[#0e1424] p-1 rounded-xl border border-[#1e2742]">
              <button
                type="button"
                onClick={() => setSendToken('NATIVE')}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${sendToken === 'NATIVE' ? 'bg-[#1e2742] text-white shadow' : 'text-slate-400'
                  }`}
              >
                {nativeSymbol} (Native)
              </button>
              <button
                type="button"
                onClick={() => setSendToken('USDC')}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${sendToken === 'USDC' ? 'bg-[#1e2742] text-white shadow' : 'text-slate-400'
                  }`}
              >
                USDC (Stablecoin)
              </button>
            </div>

            {/* Recipient Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Recipient Address
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                className="w-full bg-[#0e1424] border border-[#232c4a] focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder-slate-600 transition-all outline-none"
              />
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Amount
                </label>
                <button
                  type="button"
                  onClick={handleMaxAmount}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-bold"
                >
                  MAX
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full bg-[#0e1424] border border-[#232c4a] focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 transition-all outline-none"
                />
                <span className="absolute right-4 top-3 text-xs font-bold text-slate-500">
                  {sendToken === 'NATIVE' ? nativeSymbol : 'USDC'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Available:{' '}
                {sendToken === 'NATIVE'
                  ? `${formattedNative} ${nativeSymbol}`
                  : `${formattedUsdc} USDC`}
              </div>
            </div>

            {sendError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            {activeTxError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{activeTxError.message.slice(0, 120)}</span>
              </div>
            )}

            {isTxSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Transfer confirmed successfully on-chain!</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleExecuteSend}
              disabled={isSending || !recipient || !sendAmount}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Confirming on-chain…</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Transaction</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── 2. Deposit / Receive Modal ── */}
      {isDepositOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#12182b] border border-[#232c4a] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative text-center">
            <button
              type="button"
              onClick={() => setIsDepositOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/10">
              <ArrowDown className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">Deposit &amp; Receive Assets</h3>
              <p className="text-xs text-slate-400 mt-1">
                Transfer {nativeSymbol} or USDC directly to your personal address on {activeChain.name}.
              </p>
            </div>

            {/* Address Monospace Block */}
            <div className="bg-[#0e1424] border border-[#1e2742] rounded-2xl p-4 break-all text-xs font-mono text-slate-300 select-all">
              {activeWallet ?? 'No address connected'}
            </div>

            <button
              type="button"
              onClick={copyAddress}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2"
            >
              {hasCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Address Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Wallet Address</span>
                </>
              )}
            </button>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-left flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Only deposit assets on the <strong>{activeChain.name}</strong> (Chain ID {activeChainId}).
                Sending assets over an unsupported network may result in loss of funds.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Swap / Bridge Modal ── */}
      {isSwapOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#12182b] border border-[#232c4a] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative text-center">
            <button
              type="button"
              onClick={() => setIsSwapOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mx-auto shadow-lg shadow-purple-500/10">
              <Repeat className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">In-App Swap &amp; Bridge</h3>
              <p className="text-xs text-slate-400 mt-1">
                Cross-chain asset conversion for escrow settlements.
              </p>
            </div>

            <div className="bg-[#0e1424] border border-[#1e2742] rounded-2xl p-4 text-left space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-400 font-medium">
                <span>From</span>
                <span>Balance: {formattedNative} {nativeSymbol}</span>
              </div>
              <div className="flex items-center justify-between text-base font-bold text-white">
                <span>1.0 {nativeSymbol}</span>
                <span className="text-xs text-purple-400 px-2 py-1 rounded bg-purple-500/10">Active</span>
              </div>
              <div className="flex justify-center my-1">
                <div className="w-7 h-7 rounded-full bg-[#19223a] border border-[#2b375b] flex items-center justify-center text-slate-400">
                  <ArrowDown className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-center justify-between text-slate-400 font-medium">
                <span>To (Estimated)</span>
                <span>Rate: 1 {nativeSymbol} ≈ ${(rates[nativeSymbol] || 1.5).toFixed(2)} USDC</span>
              </div>
              <div className="flex items-center justify-between text-base font-bold text-emerald-400">
                <span>{(rates[nativeSymbol] || 1.5).toFixed(2)} USDC</span>
                <span className="text-xs text-emerald-400 px-2 py-1 rounded bg-emerald-500/10">Zero Fee</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                alert('Swap liquidity pool is operational on testnet. Full DEX routing will unlock at Mainnet launch.');
                setIsSwapOpen(false);
              }}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-purple-600/20 active:scale-95"
            >
              Simulate Testnet Swap
            </button>
          </div>
        </div>
      )}

      {/* ── 4. Edit Profile Modal ── */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#12182b] border border-[#232c4a] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#1f2742]">
              <h3 className="text-lg font-bold text-white">Edit Profile Details</h3>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Display Name
              </label>
              <input
                type="text"
                placeholder="Enter your trader display name..."
                value={customDisplayName}
                onChange={(e) => setCustomDisplayName(e.target.value)}
                className="w-full bg-[#0e1424] border border-[#232c4a] focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 transition-all outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setIsEditProfileOpen(false);
              }}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] active:scale-95"
            >
              Save Profile
            </button>
          </div>
        </div>
      )}

      {/* ── 5. KYC BVN Verification Modal ── */}
      {isKycModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative max-w-md w-full">
            <button
              type="button"
              onClick={() => setIsKycModalOpen(false)}
              className="absolute top-4 right-4 z-10 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <KYCVerification
              onSuccess={() => {
                setIsKycModalOpen(false);
                fetchProfileAndStats();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
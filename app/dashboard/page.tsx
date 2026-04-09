'use client';

// ==========================================
// 1. IMPORTS
// ==========================================
import OrderCard from '@/components/OrderCard';
import WalletModal from '@/components/WalletModal';
import { usePrivy } from '@privy-io/react-auth';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts, useAccount, useSwitchChain, useBalance, useChainId } from 'wagmi';
import { parseUnits, formatEther, formatUnits, isAddress } from 'viem';
import { CONTRACT_ABI, CONTRACT_ADDRESS, CHAIN_CONFIG } from '@/app/constants';
import React, { useEffect, useState, useMemo, Suspense, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Lock, LogOut, Loader2, RefreshCcw, AlertTriangle, Wallet,
  ChevronDown, X, CheckCircle2, Banknote, Bitcoin, ArrowRight, UserCheck, Search, Mail, Globe
} from 'lucide-react';

// --- CONSTANTS ---
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const ERC20_ABI = [
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' }
];

const BANKS = [
    { code: '120001', name: '9mobile 9Payment Service Bank' },
    { code: '801',    name: 'Abbey Mortgage Bank' },
    { code: '044',    name: 'Access Bank' },
    { code: '063',    name: 'Access Bank (Diamond)' },
    { code: '035A',   name: 'ALAT by WEMA' },
    { code: '050',    name: 'Ecobank Nigeria' },
    { code: '070',    name: 'Fidelity Bank' },
    { code: '011',    name: 'First Bank of Nigeria' },
    { code: '214',    name: 'First City Monument Bank' },
    { code: '058',    name: 'Guaranty Trust Bank' },
    { code: '082',    name: 'Keystone Bank' },
    { code: '50211',  name: 'Kuda Bank' },
    { code: '120003', name: 'MTN Momo PSB' },
    { code: '999992', name: 'Opay (Paycom)' },
    { code: '999991', name: 'PalmPay' },
    { code: '076',    name: 'Polaris Bank' },
    { code: '221',    name: 'Stanbic IBTC Bank' },
    { code: '232',    name: 'Sterling Bank' },
    { code: '032',    name: 'Union Bank of Nigeria' },
    { code: '033',    name: 'United Bank For Africa' },
    { code: '035',    name: 'Wema Bank' },
    { code: '057',    name: 'Zenith Bank' },
].sort((a, b) => a.name.localeCompare(b.name));

// ==========================================
// 2. MAIN DASHBOARD COMPONENT
// ==========================================
function MainDashboard() {
  const { login, authenticated, user, logout, linkEmail } = usePrivy();
  const { switchChain, error: switchError } = useSwitchChain();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mode, setMode] = useState<'crypto' | 'fiat'>('crypto');

  const [sellerAddress, setSellerAddress] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const [isTokenListOpen, setIsTokenListOpen] = useState(false);
  const [isNetworkListOpen, setIsNetworkListOpen] = useState(false);

  const [fiatAmount, setFiatAmount] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [fiatDescription, setFiatDescription] = useState('');

  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const [dbOrders, setDbOrders] = useState<Record<number, any>>({});
  const [dashboardTab, setDashboardTab] = useState<'buying' | 'selling'>('buying');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [txType, setTxType] = useState<'approve' | 'deposit' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [pendingCryptoOrder, setPendingCryptoOrder] = useState<any>(null);

  // FIX 7: Ref for click-outside on network dropdown
  const networkDropdownRef = useRef<HTMLDivElement>(null);

  const { writeContract, data: txHash, isPending: isWriting, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Multi-Chain Network Logic
  const chainId = useChainId();
  const isUnsupportedNetwork = authenticated && !CHAIN_CONFIG[chainId];
  const activeChainId = CHAIN_CONFIG[chainId] ? chainId : 9746;
  const activeChain = CHAIN_CONFIG[activeChainId];

  // Dynamic Assets based on current network
  const ASSETS = useMemo(() => [
    { symbol: activeChain.nativeSymbol, name: activeChain.name, type: 'native', icon: 'bg-purple-600', address: ZERO_ADDRESS, decimals: 18 },
    { symbol: 'USDC', name: 'USD Coin', type: 'erc20', icon: 'bg-blue-600', address: activeChain.usdcAddress, decimals: 6 },
  ], [activeChain]);

  const selectedAsset = ASSETS[selectedAssetIndex];

  // FIX 2: showToast in useCallback so effects always have a stable reference
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
  }, []);

  const sendEmailNotification = useCallback(async (to: string, subject: string, message: string) => {
    if (!to || !to.includes('@')) return;
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message }),
      });
    } catch (err) {
      console.error("Failed to send email notification", err);
    }
  }, []);

  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  useEffect(() => {
    if (writeError) {
      const errorMsg = (writeError as any).shortMessage || writeError.message;
      showToast(errorMsg, 'error');
      setTxType(null);
      setPendingCryptoOrder(null);
    }
  }, [writeError, showToast]);

  useEffect(() => {
    if (switchError) showToast(switchError.message, 'error');
  }, [switchError, showToast]);

  // FIX 7: Close network dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(e.target as Node)) {
        setIsNetworkListOpen(false);
      }
    };
    if (isNetworkListOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNetworkListOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery) router.push(`/user/${encodeURIComponent(searchQuery)}`);
  };

  const { address: wagmiAddress } = useAccount();
  const userAddress = wagmiAddress || user?.wallet?.address;

  // FIX 5: useBalance with enabled guard to prevent undefined address errors
  // 🚀 UPDATED: Fetch USDC balance instead of Native Token
  const { data: usdcBalance, refetch: refetchUsdc } = useBalance({
    address: userAddress as `0x${string}`,
    token: activeChain.usdcAddress, // Explicitly points to the active chain's USDC contract
    query: { enabled: !!userAddress },
  });

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: ASSETS[1].address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress as `0x${string}`, CONTRACT_ADDRESS] : undefined,
    query: { enabled: !!userAddress && selectedAsset.symbol === 'USDC' },
  });

  const { data: totalEscrows, refetch: refetchTotalEscrows } = useReadContract({
    abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrowCount',
  });
  const count = totalEscrows ? Number(totalEscrows) : 0;

  const indexesToFetch = useMemo(() => {
    const idxs = [];
    for (let i = count; i > 0 && i > count - 10; i--) idxs.push(i);
    return idxs;
  }, [count]);

  const { data: escrowsData, refetch: refetchOrders } = useReadContracts({
    contracts: indexesToFetch.map((id) => ({
      abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrows', args: [BigInt(id)],
    })),
    query: { refetchInterval: 30000 },
  });

  // FIX 3: fetchDbOrders in useCallback so handleRefresh can depend on it safely
  const fetchDbOrders = useCallback(async () => {
    const { data } = await supabase.from('escrow_orders').select('*');
    if (data) {
      const map: Record<number, any> = {};
      data.forEach((row: any) => { map[row.id] = row; });
      setDbOrders(map);
    }
  }, []);

  // FIX 1: handleRefresh in useCallback so the setInterval always calls the latest version
  const handleRefresh = useCallback(() => {
    refetchTotalEscrows();
    refetchOrders();
    refetchUsdc(); // 🚀 Refetches USDC instead of ETH
    if (selectedAsset.symbol === 'USDC') refetchAllowance?.();
    fetchDbOrders();
  }, [refetchTotalEscrows, refetchOrders, refetchUsdc, refetchAllowance, selectedAsset.symbol, fetchDbOrders]);

  useEffect(() => { fetchDbOrders(); }, [fetchDbOrders]);

  // FIX 1 (cont): setInterval now uses stable handleRefresh and has it in the dep array
  useEffect(() => {
    const intervalId = setInterval(handleRefresh, 5000);
    return () => clearInterval(intervalId);
  }, [handleRefresh]);

  useEffect(() => {
    const trxref = searchParams.get('trxref') || searchParams.get('reference');
    if (trxref) {
      setMode('fiat');
      fetch('/api/paystack/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: trxref }),
      })
        .then(res => res.json())
        .then(async data => {
          if (data.status) {
            setShowSuccessModal(true);
            const { data: orderData } = await supabase
              .from('escrow_orders').select('seller_email, amount').eq('paystack_ref', trxref).single();
            if (orderData?.seller_email) {
              sendEmailNotification(
                orderData.seller_email,
                'New Escrow Order Secured! 💰',
                `Great news! A buyer has securely locked ₦${Number(orderData.amount).toLocaleString()} in TrustLink for a Bank Transfer order. Please log in to your dashboard to view and accept the order.`
              );
            }
          } else {
            showToast("Payment was cancelled or failed.", "error");
          }
          fetchDbOrders();
          router.replace('/dashboard');
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const prefillSeller = searchParams.get('seller');
    const prefillMode = searchParams.get('autoMode');
    if (prefillSeller && prefillMode) {
      if (prefillMode === 'fiat') {
        setMode('fiat');
        setSellerEmail(decodeURIComponent(prefillSeller));
      } else if (prefillMode === 'crypto') {
        setMode('crypto');
        setSellerAddress(prefillSeller);
      }
      router.replace('/dashboard');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const activeEmail = user?.email?.address || user?.google?.email || user?.apple?.email || user?.discord?.email;
    if (activeEmail) setBuyerEmail(activeEmail);
  }, [user]);

  // FIX 4: resolveBankAccount in useCallback for stable identity across renders
  const resolveBankAccount = useCallback(async (account: string, bank: string) => {
    setIsResolving(true);
    setResolveError('');
    setAccountName('');
    if (account === '9999999999') {
      setTimeout(() => { setAccountName("Test Mode User (Bypassed)"); setIsResolving(false); }, 800);
      return;
    }
    try {
      const response = await fetch(`/api/paystack/resolve?account_number=${account}&bank_code=${bank}`);
      const data = await response.json();
      if (!data.status) throw new Error(data.message || "Unknown bank error");
      if (data.data?.account_name) setAccountName(data.data.account_name);
      else throw new Error("Account name not found");
    } catch (err: any) {
      setResolveError(err.message || "Verification failed");
    } finally {
      if (account !== '9999999999') setIsResolving(false);
    }
  }, []);

  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) resolveBankAccount(accountNumber, bankCode);
    else { setAccountName(''); setResolveError(''); }
  }, [accountNumber, bankCode, resolveBankAccount]);

  // FIX 6: isSuccess effect now declares all values it reads as deps
  useEffect(() => {
    if (isSuccess && pendingCryptoOrder) {
      if (txType === 'approve') {
        showToast("Approved! Automatically securing your escrow...", 'success');
        setTxType('deposit');
        const amountWei = parseUnits(pendingCryptoOrder.amount, selectedAsset.decimals);
        writeContract({
          chainId: activeChainId,
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'createEscrow',
          args: [pendingCryptoOrder.sellerWallet as `0x${string}`, pendingCryptoOrder.tokenAddress as `0x${string}`, amountWei],
          value: BigInt(0),
        });
      } else if (txType === 'deposit') {
        supabase.from('escrow_orders').insert([{
          buyer_wallet_address: pendingCryptoOrder.buyerWallet,
          seller_address: pendingCryptoOrder.sellerWallet,
          buyer_email: pendingCryptoOrder.buyerEmail,
          seller_email: pendingCryptoOrder.sellerEmail,
          amount: pendingCryptoOrder.amount,
          status: 'secured',
        }]).then(({ error }) => {
          if (error) console.error("Supabase Sync Error:", error);
          showToast("Escrow Created Successfully!", 'success');
          if (pendingCryptoOrder.sellerEmail) {
            sendEmailNotification(
              pendingCryptoOrder.sellerEmail,
              'New Escrow Order Secured! 💰',
              `Great news! A buyer has securely locked ${pendingCryptoOrder.amount} ${selectedAsset.symbol} in TrustLink for an order. Please log in to your dashboard to view and accept the order.`
            );
          }
          setSellerAddress('');
          setAmountInput('');
          setTxType(null);
          setPendingCryptoOrder(null);
          handleRefresh();
        });
      }
    } else if (isSuccess && !pendingCryptoOrder && txType === 'deposit') {
      showToast("Escrow Created Successfully!", 'success');
      setSellerAddress('');
      setAmountInput('');
      setTxType(null);
      handleRefresh();
    }
  }, [isSuccess, txType, pendingCryptoOrder, selectedAsset, activeChainId, writeContract, showToast, sendEmailNotification, handleRefresh]);

  const { myBuyingOrders, mySellingOrders } = useMemo(() => {
    const buying: any[] = [];
    const selling: any[] = [];

    if (escrowsData && userAddress) {
      escrowsData.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const escrow = result.result as any;
          const id = indexesToFetch[index];
          const buyer = String(escrow[1]);
          const seller = String(escrow[2]);
          const tokenAddr = String(escrow[3]);
          const totalAmount = BigInt(escrow[4]);
          const lockedBalance = BigInt(escrow[5]);
          const chainDisputed = escrow[8];
          const chainCompleted = escrow[9];

          const dbOrder = dbOrders[id];
          const isAccepted = dbOrder?.status === 'accepted' || dbOrder?.status === 'shipped' || escrow[6];
          const isShipped = dbOrder?.status === 'shipped' || escrow[7];

          const isNative = tokenAddr === ZERO_ADDRESS;
          const paidAmount = totalAmount - lockedBalance;
          const percentPaid = totalAmount > BigInt(0) ? Number((paidAmount * BigInt(100)) / totalAmount) : 0;

          let status = "ACTIVE";
          let statusColor = "bg-emerald-500/20 text-emerald-400";
          if (chainCompleted)      { status = "COMPLETED";          statusColor = "bg-slate-700 text-slate-300"; }
          else if (chainDisputed)  { status = "DISPUTED";           statusColor = "bg-red-500/20 text-red-400"; }
          else if (!isAccepted)    { status = "WAITING ACCEPTANCE"; statusColor = "bg-yellow-500/20 text-yellow-400"; }
          else if (isShipped)      { status = "SHIPPED";            statusColor = "bg-blue-500/20 text-blue-400"; }

          const order = {
            id, buyer, seller, token: tokenAddr, amount: totalAmount, lockedBalance,
            isAccepted, isShipped, isDisputed: chainDisputed, isCompleted: chainCompleted,
            status, statusColor,
            token_symbol: isNative ? activeChain.nativeSymbol : 'USDC',
            formattedTotal:  isNative ? formatEther(totalAmount)    : formatUnits(totalAmount, 6),
            formattedLocked: isNative ? formatEther(lockedBalance)  : formatUnits(lockedBalance, 6),
            percentPaid, type: 'CRYPTO', timestamp: Number(id),
          };

          if (buyer.toLowerCase()  === userAddress.toLowerCase()) buying.push(order);
          if (seller.toLowerCase() === userAddress.toLowerCase()) selling.push(order);
        }
      });
    }

    Object.values(dbOrders).forEach((dbOrder: any) => {
      if (!dbOrder.paystack_ref) return;
      const currentStatus = dbOrder.status?.toLowerCase() || 'pending';
      if (currentStatus === 'awaiting_payment' || currentStatus === 'failed') return;
      const activeEmail = user?.email?.address || user?.google?.email || user?.apple?.email || user?.discord?.email;
      const myEmail  = activeEmail?.toLowerCase();
      const myWallet = userAddress?.toLowerCase();

      const isMyEmailAsBuyer  = myEmail  && dbOrder.buyer_email?.toLowerCase()  === myEmail;
      const isMyWalletAsBuyer = myWallet && dbOrder.buyer_wallet_address?.toLowerCase() === myWallet;
      const isMyEmailAsSeller = myEmail  && dbOrder.seller_email?.toLowerCase() === myEmail;

      let fiatStatusColor = "bg-yellow-500/20 text-yellow-400";
      if (['success', 'completed'].includes(currentStatus))   fiatStatusColor = "bg-slate-700 text-slate-300";
      else if (currentStatus === 'disputed')                   fiatStatusColor = "bg-red-500/20 text-red-400";
      else if (currentStatus === 'shipped')                    fiatStatusColor = "bg-blue-500/20 text-blue-400";
      else if (['accepted', 'partially_released', 'processing_payout', 'secured'].includes(currentStatus))
                                                               fiatStatusColor = "bg-emerald-500/20 text-emerald-400";

      const totalAmt    = Number(dbOrder.amount || 0);
      const releasedAmt = Number(dbOrder.released_amount || 0);
      const lockedAmt   = totalAmt - releasedAmt;
      const isFullyPaid = ['success', 'completed'].includes(currentStatus);
      const percentPaid = isFullyPaid ? 100 : (totalAmt > 0 ? Math.round((releasedAmt / totalAmt) * 100) : 0);

      const fiatOrderObj = {
        id: `NGN-${dbOrder.id}`, buyer: dbOrder.buyer_email,
        seller: dbOrder.seller_email || dbOrder.seller_name, amount: BigInt(0),
        formattedTotal: totalAmt.toLocaleString(), formattedLocked: lockedAmt.toLocaleString(),
        token_symbol: 'NGN',
        status: isFullyPaid ? 'PAID' : currentStatus.toUpperCase().replace('_', ' '),
        statusColor: fiatStatusColor, percentPaid, type: 'FIAT',
        timestamp: dbOrder.created_at ? new Date(dbOrder.created_at).getTime() : dbOrder.id,
        isAccepted:  ['accepted', 'partially_released', 'shipped', 'success', 'completed', 'processing_payout', 'secured'].includes(currentStatus),
        isShipped:   ['shipped', 'success', 'completed', 'processing_payout'].includes(currentStatus),
        isCompleted: isFullyPaid,
        isDisputed:  currentStatus === 'disputed',
      };

      if (isMyEmailAsBuyer || isMyWalletAsBuyer) buying.push(fiatOrderObj);
      if (isMyEmailAsSeller) selling.push(fiatOrderObj);
    });

    buying.sort((a, b)  => b.timestamp - a.timestamp);
    selling.sort((a, b) => b.timestamp - a.timestamp);

    return { myBuyingOrders: buying, mySellingOrders: selling };
  }, [escrowsData, userAddress, indexesToFetch, dbOrders, user, activeChain.nativeSymbol]);

  const handleCryptoTransaction = async () => {
    if (isUnsupportedNetwork) { showToast("Please switch to a supported network first.", 'error'); return; }
    if (!sellerAddress || !amountInput) return;

    let finalSellerAddress = sellerAddress.trim();

    if (finalSellerAddress.includes('@')) {
      showToast("Resolving email to secure wallet...", 'info');
      try {
        const res = await fetch('/api/privy/resolve', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: finalSellerAddress }),
        });
        const data = await res.json();
        if (!data.status) throw new Error(data.message);
        finalSellerAddress = data.address;
        showToast(`Found wallet: ${finalSellerAddress.slice(0, 6)}...${finalSellerAddress.slice(-4)}`, 'success');
      } catch (err: any) { showToast(err.message, 'error'); return; }
    }

    if (!isAddress(finalSellerAddress))                                       { showToast("Invalid Wallet Address or Email", 'error'); return; }
    if (finalSellerAddress.toLowerCase() === userAddress?.toLowerCase())      { showToast("You cannot create an order with yourself.", 'error'); return; }

    setPendingCryptoOrder({
      buyerWallet: userAddress, sellerWallet: finalSellerAddress,
      buyerEmail: buyerEmail || null,
      sellerEmail: sellerAddress.includes('@') ? sellerAddress.trim() : null,
      amount: amountInput, tokenAddress: selectedAsset.address,
    });

    try {
      const isNative  = selectedAsset.type === 'native';
      const amountWei = parseUnits(amountInput, selectedAsset.decimals);

      if (!isNative) {
        const currentAllowance = usdcAllowance ? BigInt(String(usdcAllowance)) : BigInt(0);
        if (currentAllowance < amountWei) {
          setTxType('approve');
          writeContract({ chainId: activeChainId, address: selectedAsset.address as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACT_ADDRESS, amountWei] });
          showToast("Approving USDC... Please wait.", 'info');
          return;
        }
      }
      setTxType('deposit');
      writeContract({
        chainId: activeChainId, address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
        functionName: 'createEscrow',
        args: [finalSellerAddress as `0x${string}`, selectedAsset.address as `0x${string}`, amountWei],
        value: isNative ? amountWei : BigInt(0),
      });
      showToast("Awaiting wallet confirmation...", 'info');
    } catch (err: any) { showToast("Error: " + err.message, 'error'); }
  };

  const handleFiatTransaction = async () => {
    if (!fiatAmount || !accountNumber || !bankCode || !buyerEmail || !sellerEmail) { showToast("Please fill all fields", 'error'); return; }
    if (!accountName) { showToast("Please wait for verification", 'error'); return; }

    try {
      showToast("Initializing Secure Checkout...", 'info');
      const response = await fetch('/api/paystack/initiate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: fiatAmount, email: buyerEmail, seller_email: sellerEmail,
          seller_bank: BANKS.find(b => b.code === bankCode)?.name || bankCode,
          seller_number: accountNumber, seller_name: accountName,
          description: fiatDescription || "Escrow Payment", buyer_wallet: userAddress,
        }),
      });

      const data = await response.json();
      if (!data.status) throw new Error(data.message || "Payment initialization failed");

      showToast("Redirecting to Paystack...", 'success');
      setTimeout(() => { window.location.href = data.data.authorization_url; }, 1000);
    } catch (err: any) { showToast(err.message || "Payment Error", 'error'); }
  };

  const activeOrdersList  = dashboardTab === 'buying' ? myBuyingOrders : mySellingOrders;
  const displayedOrders   = activeOrdersList.filter((order: any) => order.type.toLowerCase() === mode);
  const hasEmailLinked    = !!(user?.email?.address || user?.google?.email || user?.apple?.email || user?.discord?.email);

  // FIX 8: Format balance for wallet button display
  // 🚀 UPDATED: Formats the USDC balance string (6 decimals)
  const formattedBalance = usdcBalance
    ? `${parseFloat(formatUnits(usdcBalance.value, 6)).toFixed(2)} USDC`
    : '0.00 USDC';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white font-sans pb-20 relative">
      <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />

      {showSuccessModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-all duration-300">
          <div className="bg-slate-800 border border-emerald-500/30 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative flex flex-col items-center transform scale-100 opacity-100">
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-3">Payment Successful!</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">Your fiat payment has been securely locked in escrow. The seller has been notified via email.</p>
            <button onClick={() => setShowSuccessModal(false)} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-extrabold text-lg py-4 rounded-xl transition-all shadow-lg">
              View My Order
            </button>
          </div>
        </div>
      )}

      {notification && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md max-w-sm ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : notification.type === 'info' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : notification.type === 'info' ? <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm font-bold truncate">{notification.message}</p>
        </div>
      )}

      <nav className="flex items-center justify-between px-6 py-6 max-w-6xl mx-auto w-full gap-4">
        <div className="flex items-center gap-2 min-w-max">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center rotate-3"><Lock className="w-4 h-4 text-white" /></div>
          <span className="text-xl font-bold hidden sm:block">TrustLink</span>
        </div>

        {authenticated && (
          <form onSubmit={handleSearch} className="flex-1 max-w-lg relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors" /></div>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-700 rounded-2xl leading-5 bg-slate-900/50 text-slate-300 placeholder-slate-500 focus:outline-none focus:bg-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:text-sm transition-all shadow-inner"
              placeholder="Search seller by email or wallet..." />
          </form>
        )}

        {authenticated ? (
          <div className="flex items-center gap-3 min-w-max">
            {/* FIX 7: Attach ref to the wrapper div for outside-click detection */}
            <div className="relative" ref={networkDropdownRef}>
              <button
                onClick={() => setIsNetworkListOpen(!isNetworkListOpen)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border transition-all text-xs font-bold ${isUnsupportedNetwork ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'}`}
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:block">{isUnsupportedNetwork ? 'Unsupported' : activeChain.name}</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
              {isNetworkListOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl z-[100] overflow-hidden shadow-xl">
                  {Object.entries(CHAIN_CONFIG).map(([id, config]) => (
                    <button key={id} onClick={() => { switchChain({ chainId: Number(id) }); setIsNetworkListOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-slate-700 transition-colors ${Number(id) === chainId ? 'text-emerald-400 bg-slate-700/50' : 'text-slate-300'}`}>
                      {config.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* FIX 8: Show wallet balance in the button */}
            <button onClick={() => setIsWalletModalOpen(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 rounded-2xl transition-all shadow-lg">
              <div className="flex flex-col items-start">
                <span className="font-mono text-sm font-bold truncate max-w-[100px] sm:max-w-[150px]">
                  {user?.email?.address || user?.google?.email
                    ? (user?.email?.address || user?.google?.email)?.split('@')[0]
                    : (userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : "Wallet")}
                </span>
                {formattedBalance && (
                  <span className="text-[10px] text-emerald-400 font-bold leading-none">{formattedBalance}</span>
                )}
              </div>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </button>

            <button onClick={logout} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2.5 rounded-2xl border border-red-500/20 transition-all"><LogOut className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={login} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20">Log In</button>
        )}
      </nav>

      <main className="flex flex-col items-center mt-10 px-4 max-w-4xl mx-auto">
        <h1 className="text-5xl font-extrabold mb-8 text-center leading-tight">Trust is no longer <br /><span className="text-emerald-400">a leap of faith.</span></h1>

        <div className="w-full max-w-md bg-slate-800/50 border border-slate-700 p-8 rounded-2xl backdrop-blur-sm shadow-2xl relative z-10">
          {!authenticated ? (
            <button onClick={login} className="w-full bg-emerald-500 hover:bg-emerald-400 py-3 rounded-xl font-bold">Connect Wallet</button>
          ) : (
            <div className="flex flex-col gap-4">

              <div className="bg-slate-900/80 p-1 rounded-xl flex mb-2 border border-slate-700">
                <button onClick={() => setMode('crypto')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'crypto' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}><Bitcoin className="w-4 h-4" /> Cryptocurrency</button>
                <button onClick={() => setMode('fiat')}   className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'fiat'   ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}><Banknote className="w-4 h-4" /> Bank Transfer</button>
              </div>

              {mode === 'crypto' && (
                <>
                  <div className="relative">
                    <button onClick={() => setIsTokenListOpen(!isTokenListOpen)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 flex justify-between items-center hover:border-slate-600 transition-all">
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full ${selectedAsset.icon} flex items-center justify-center text-[8px]`}>{selectedAsset.symbol[0]}</div>
                        <span>{selectedAsset.symbol}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    </button>
                    {isTokenListOpen && (
                      <div className="absolute top-full w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl z-20 overflow-hidden shadow-xl">
                        {ASSETS.map((a, index) => (
                          <div key={a.symbol} onClick={() => { setSelectedAssetIndex(index); setIsTokenListOpen(false); }} className="p-3 hover:bg-slate-700 cursor-pointer flex gap-3">
                            <div className={`w-6 h-6 rounded-full ${a.icon} flex items-center justify-center text-[10px]`}>{a.symbol[0]}</div>
                            {a.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 ml-1 font-bold">SELLER ADDRESS OR EMAIL</label>
                    <input value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} placeholder="0x... or seller@email.com" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 ml-1 font-bold">AMOUNT</label>
                    <input type="number" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} placeholder="0.00" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all" />
                  </div>
                  <button onClick={handleCryptoTransaction} disabled={isWriting || isConfirming || (!isUnsupportedNetwork && (!sellerAddress || !amountInput))}
                    className={`w-full py-4 rounded-xl font-bold mt-2 flex items-center justify-center gap-2 transition-all ${isUnsupportedNetwork ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white'}`}>
                    {(isWriting || isConfirming) ? <Loader2 className="animate-spin w-5 h-5" /> : (isUnsupportedNetwork ? "Network Unsupported" : "Secure Cryptocurrency")}
                  </button>
                </>
              )}

              {mode === 'fiat' && (
                <>
                  {!hasEmailLinked ? (
                    <div className="flex flex-col items-center justify-center p-6 bg-slate-900/50 border border-slate-700 rounded-2xl text-center gap-4 mt-2">
                      <div className="w-14 h-14 bg-blue-500/20 border border-blue-500/30 rounded-full flex items-center justify-center mb-2"><Mail className="w-6 h-6 text-blue-400" /></div>
                      <h3 className="text-lg font-bold text-white">Email Verification Required</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">To use Bank Transfer escrows, you must link an email address to your account. This ensures you receive payment receipts and secure dispute notifications.</p>
                      <button onClick={linkEmail} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl mt-2 transition-all w-full flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">Link Email Address <ArrowRight className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 flex items-center justify-center gap-2 cursor-not-allowed opacity-80">
                          <span className="text-sm font-bold">NGN</span>
                          <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center text-[8px] text-white">₦</div>
                        </div>
                        <div className="col-span-2">
                          <input type="number" value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value)} placeholder="Amount (e.g. 5000)" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-all" />
                        </div>
                      </div>
                      <div className="opacity-70 cursor-not-allowed">
                        <label className="text-xs text-slate-400 ml-1 font-bold flex items-center gap-1.5">YOUR EMAIL <Lock className="w-3 h-3 text-slate-500" /></label>
                        <input readOnly value={buyerEmail} className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none text-slate-400 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="text-xs text-emerald-400 ml-1 font-bold">SELLER'S TRUSTLINK EMAIL</label>
                        <input value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} placeholder="seller@email.com" className="w-full bg-slate-900/50 border border-emerald-500/30 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 ml-1 font-bold">SELLER BANK DETAILS</label>
                        <div className="flex flex-col gap-2 mt-1">
                          <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm appearance-none">
                            <option value="">Select Bank</option>
                            {BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                          </select>
                          <div className="relative">
                            <input value={accountNumber} onChange={(e) => { if (e.target.value.length <= 10) setAccountNumber(e.target.value); }} placeholder="Account Number (10 digits)" type="number" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-all" />
                            {isResolving && <div className="absolute right-4 top-3.5"><Loader2 className="animate-spin w-4 h-4 text-blue-500" /></div>}
                          </div>
                          <div className={`w-full bg-slate-800/50 border ${accountName ? 'border-emerald-500/30 bg-emerald-500/10' : resolveError ? 'border-red-500/30 bg-red-500/10' : 'border-slate-800'} rounded-lg px-4 py-3 transition-all flex items-center gap-2 min-h-[46px]`}>
                            {accountName
                              ? <><div className="bg-emerald-500 rounded-full p-0.5"><CheckCircle2 className="w-3 h-3 text-white" /></div><span className="text-xs font-bold text-emerald-400 tracking-wide">{accountName}</span></>
                              : resolveError
                              ? <><div className="bg-red-500 rounded-full p-0.5"><X className="w-3 h-3 text-white" /></div><span className="text-xs font-bold text-red-400 tracking-wide">{resolveError}</span></>
                              : <span className="text-xs text-slate-600 italic flex items-center gap-2"><UserCheck className="w-3 h-3" /> Account Name will appear here</span>}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 ml-1 font-bold">DESCRIPTION</label>
                        <textarea value={fiatDescription} onChange={(e) => setFiatDescription(e.target.value)} placeholder="What are you paying for?" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-blue-500 transition-all h-24 resize-none" />
                      </div>
                      <button onClick={handleFiatTransaction} disabled={!fiatAmount || !accountName || !buyerEmail || !sellerEmail} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                        Secure Bank Transfer <ArrowRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="w-full mt-20 border-t border-white/10 pt-10">
          <div className="flex justify-between items-end mb-6 border-b border-white/10 pb-1">
            <div className="flex gap-6">
              <button onClick={() => setDashboardTab('buying')}  className={`text-lg font-bold pb-4 border-b-2 transition-all ${dashboardTab === 'buying'  ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-500'}`}>I'm Buying</button>
              <button onClick={() => setDashboardTab('selling')} className={`text-lg font-bold pb-4 border-b-2 transition-all ${dashboardTab === 'selling' ? 'border-blue-400 text-blue-400'     : 'border-transparent text-slate-500'}`}>I'm Selling</button>
            </div>
            <div className="flex items-center gap-3 pb-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">Showing {mode === 'crypto' ? 'Cryptocurrency' : 'Bank Transfer'} Orders</span>
              <button onClick={handleRefresh} className="text-slate-500 hover:text-white"><RefreshCcw className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="space-y-4">
            {displayedOrders.map((order: any) => (
              <OrderCard key={order.id} order={order} isSellerView={dashboardTab === 'selling'} userAddress={userAddress || ''} onUpdate={handleRefresh} />
            ))}
            {displayedOrders.length === 0 && (
              <div className="text-slate-500 text-center py-10 italic border border-dashed border-slate-700 rounded-xl">
                No active <span className="capitalize">{mode === 'crypto' ? 'Cryptocurrency' : 'Bank Transfer'}</span> orders found.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>}>
      <MainDashboard />
    </Suspense>
  );
}
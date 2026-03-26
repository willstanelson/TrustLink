'use client';

// ==========================================
// 1. IMPORTS
// ==========================================
import OrderCard from '@/components/OrderCard';
import WalletModal from '@/components/WalletModal';
import { usePrivy } from '@privy-io/react-auth';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts, useAccount, useSwitchChain, useBalance } from 'wagmi';
import { parseUnits, formatEther, formatUnits, isAddress } from 'viem'; 
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/app/constants';
import React, { useEffect, useState, useMemo, Suspense } from 'react'; 
import { supabase } from '@/lib/supabaseClient'; 
import { useSearchParams, useRouter } from 'next/navigation'; 
import { 
  Lock, LogOut, Loader2, RefreshCcw, AlertTriangle, Wallet, 
  ChevronDown, X, CheckCircle2, Banknote, Bitcoin, ArrowRight, UserCheck, Search, Mail
} from 'lucide-react';

// --- CONSTANTS ---
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const PLASMA_CHAIN_ID = 9746; // ✅ NEW: Plasma Testnet ID

const ERC20_ABI = [
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' }
];

const ASSETS = [
  // ✅ NEW: Swapped ETH for Plasma (XPL)
  { symbol: 'XPL', name: 'Plasma', type: 'native', icon: 'bg-purple-600', address: ZERO_ADDRESS, decimals: 18 },
  // NOTE: You will need to update this USDC address later when you deploy a test USDC token to Plasma
  { symbol: 'USDC', name: 'USD Coin', type: 'erc20', icon: 'bg-blue-600', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
];

const BANKS = [
    { code: '120001', name: '9mobile 9Payment Service Bank' },
    { code: '801', name: 'Abbey Mortgage Bank' },
    { code: '51204', name: 'Above Only MFB' },
    { code: '51312', name: 'Abulesoro MFB' },
    { code: '044', name: 'Access Bank' },
    { code: '063', name: 'Access Bank (Diamond)' },
    { code: '120004', name: 'Airtel Smartcash PSB' },
    { code: '035A', name: 'ALAT by WEMA' },
    { code: '50926', name: 'Amju Unique MFB' },
    { code: '50083', name: 'Aramoko MFB' },
    { code: '401', name: 'ASO Savings and Loans' },
    { code: 'MFB50094', name: 'Astrapolaris MFB LTD' },
    { code: '51229', name: 'Bainescredit MFB' },
    { code: '50931', name: 'Bowen Microfinance Bank' },
    { code: '565', name: 'Carbon' },
    { code: '50823', name: 'CEMCS Microfinance Bank' },
    { code: '50171', name: 'Chanelle Microfinance Bank Limited' },
    { code: '023', name: 'Citibank Nigeria' },
    { code: '50204', name: 'Corestep MFB' },
    { code: '559', name: 'Coronation Merchant Bank' },
    { code: '51297', name: 'Crescent MFB' },
    { code: '050', name: 'Ecobank Nigeria' },
    { code: '50263', name: 'Ekimogun MFB' },
    { code: '562', name: 'Ekondo Microfinance Bank' },
    { code: '50126', name: 'Eyowo' },
    { code: '070', name: 'Fidelity Bank' },
    { code: '51314', name: 'Firmus MFB' },
    { code: '011', name: 'First Bank of Nigeria' },
    { code: '214', name: 'First City Monument Bank' },
    { code: '501', name: 'FSDH Merchant Bank Limited' },
    { code: '812', name: 'Gateway Mortgage Bank LTD' },
    { code: '00103', name: 'Globus Bank' },
    { code: '100022', name: 'GoMoney' },
    { code: '058', name: 'Guaranty Trust Bank' },
    { code: '51251', name: 'Hackman Microfinance Bank' },
    { code: '50383', name: 'Hasal Microfinance Bank' },
    { code: '030', name: 'Heritage Bank' },
    { code: '120002', name: 'HopePSB' },
    { code: '51244', name: 'Ibile Microfinance Bank' },
    { code: '50439', name: 'Ikoyi Osun MFB' },
    { code: '50457', name: 'Infinity MFB' },
    { code: '301', name: 'Jaiz Bank' },
    { code: '50502', name: 'Kadpoly MFB' },
    { code: '082', name: 'Keystone Bank' },
    { code: '50200', name: 'Kredi Money MFB LTD' },
    { code: '50211', name: 'Kuda Bank' },
    { code: '90052', name: 'Lagos Building Investment Company Plc.' },
    { code: '50549', name: 'Links MFB' },
    { code: '031', name: 'Living Trust Mortgage Bank' },
    { code: '303', name: 'Lotus Bank' },
    { code: '50563', name: 'Mayfair MFB' },
    { code: '50304', name: 'Mint MFB' },
    { code: '120003', name: 'MTN Momo PSB' },
    { code: '100002', name: 'Paga' },
    { code: '999991', name: 'PalmPay' },
    { code: '104', name: 'Parallex Bank' },
    { code: '311', name: 'Parkway - ReadyCash' },
    { code: '999992', name: 'Opay (Paycom)' },
    { code: '50746', name: 'Petra Mircofinance Bank Plc' },
    { code: '076', name: 'Polaris Bank' },
    { code: '50864', name: 'Polyunwana MFB' },
    { code: '105', name: 'PremiumTrust Bank' },
    { code: '101', name: 'Providus Bank' },
    { code: '51293', name: 'QuickFund MFB' },
    { code: '502', name: 'Rand Merchant Bank' },
    { code: '90067', name: 'Refuge Mortgage Bank' },
    { code: '125', name: 'Rubies MFB' },
    { code: '51113', name: 'Safe Haven MFB' },
    { code: '50800', name: 'Solid Rock MFB' },
    { code: '51310', name: 'Sparkle Microfinance Bank' },
    { code: '221', name: 'Stanbic IBTC Bank' },
    { code: '068', name: 'Standard Chartered Bank' },
    { code: '51253', name: 'Stellas MFB' },
    { code: '232', name: 'Sterling Bank' },
    { code: '100', name: 'Suntrust Bank' },
    { code: '302', name: 'TAJ Bank' },
    { code: '51269', name: 'Tangerine Money' },
    { code: '51211', name: 'TCF MFB' },
    { code: '102', name: 'Titan Bank' },
    { code: '100039', name: 'Titan Paystack' },
    { code: '50871', name: 'Unical MFB' },
    { code: '032', name: 'Union Bank of Nigeria' },
    { code: '033', name: 'United Bank For Africa' },
    { code: '215', name: 'Unity Bank' },
    { code: '566', name: 'VFD Microfinance Bank Limited' },
    { code: '035', name: 'Wema Bank' },
    { code: '057', name: 'Zenith Bank' }
].sort((a, b) => a.name.localeCompare(b.name));

// ==========================================
// 2. MAIN DASHBOARD COMPONENT
// ==========================================
function MainDashboard() {
  const { login, authenticated, user, logout, linkEmail } = usePrivy();
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [mode, setMode] = useState<'crypto' | 'fiat'>('crypto');
  
  const [sellerAddress, setSellerAddress] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [isTokenListOpen, setIsTokenListOpen] = useState(false);
  
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
  
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const [txType, setTxType] = useState<'approve' | 'deposit' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { writeContract, data: txHash, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => { 
    if (notification) { 
      const t = setTimeout(() => setNotification(null), 4000); 
      return () => clearTimeout(t); 
    } 
  }, [notification]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => setNotification({ message, type });

  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery) {
          router.push(`/user/${encodeURIComponent(searchQuery)}`);
      }
  };

  // VERIFY PAYMENT ON RETURN INSTEAD OF BLIND TRUST
  useEffect(() => {
    const trxref = searchParams.get('trxref') || searchParams.get('reference');
    if (trxref) {
        setMode('fiat'); 
        
        fetch('/api/paystack/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: trxref })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status) {
                setShowSuccessModal(true); // Only show if Paystack says "success"
            } else {
                showToast("Payment was cancelled or failed.", "error");
            }
            fetchDbOrders(); 
            // Stay on the dashboard!
            router.replace('/dashboard'); 
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // MAGIC PRE-FILL: Catch the seller details from the profile page search
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
        
        // Wipe the URL clean so it looks like magic
        router.replace('/dashboard');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ✅ FIX: Grab email from either standard Email or Google Login
  useEffect(() => {
    const activeEmail = user?.email?.address || user?.google?.email || user?.apple?.email || user?.discord?.email;
    if (activeEmail) {
        setBuyerEmail(activeEmail);
    }
  }, [user]);

  const resolveBankAccount = async (account: string, bank: string) => {
    setIsResolving(true);
    setResolveError('');
    setAccountName('');

    if (account === '9999999999') {
        setTimeout(() => {
            setAccountName("Test Mode User (Bypassed)"); 
            setIsResolving(false);
        }, 800);
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
  };

  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) resolveBankAccount(accountNumber, bankCode);
    else { setAccountName(''); setResolveError(''); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountNumber, bankCode]);

  // Prioritize the active Wagmi transaction wallet over the initial login wallet
  const { address: wagmiAddress } = useAccount();
  const userAddress = wagmiAddress || user?.wallet?.address;
  
  // ✅ NEW: Enforce the Plasma Chain ID
  const isWrongNetwork = authenticated && chain && chain.id !== PLASMA_CHAIN_ID;

  const fetchDbOrders = async () => {
    const { data } = await supabase.from('escrow_orders').select('*');
    if (data) {
      const map: Record<number, any> = {};
      data.forEach((row: any) => { map[row.id] = row; });
      setDbOrders(map);
    }
  };
  
  useEffect(() => { fetchDbOrders(); }, []);

  const { data: ethBalance, refetch: refetchEth } = useBalance({ address: userAddress as `0x${string}` });
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: ASSETS[1].address as `0x${string}`, abi: ERC20_ABI, functionName: 'allowance',
    args: userAddress ? [userAddress as `0x${string}`, CONTRACT_ADDRESS] : undefined,
    query: { enabled: !!userAddress && selectedAsset.symbol === 'USDC' }
  });
  
  // Allow the app to refetch the total count after a new order
  const { data: totalEscrows, refetch: refetchTotalEscrows } = useReadContract({ abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrowCount' });
  const count = totalEscrows ? Number(totalEscrows) : 0;
  
  const indexesToFetch = useMemo(() => {
    const idxs = [];
    for (let i = count; i > 0 && i > count - 10; i--) idxs.push(i);
    return idxs;
  }, [count]);

  const { data: escrowsData, refetch: refetchOrders } = useReadContracts({
    contracts: indexesToFetch.map((id) => ({ 
        abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrows', args: [BigInt(id)] 
    })),
    query: { refetchInterval: 30000 }
  });

  // Force the app to recount the total escrows before refreshing the list
  const handleRefresh = () => { 
      refetchTotalEscrows(); 
      refetchOrders(); 
      refetchEth(); 
      if (selectedAsset.symbol === 'USDC') refetchAllowance?.(); 
      fetchDbOrders(); 
  };

  useEffect(() => {
    if (isSuccess) {
        if (txType === 'approve') {
            showToast("Approved! Automatically securing your escrow...", 'success');
            setTxType('deposit'); 
            
            // Auto-fire the deposit without making the user click anything!
            const amountWei = parseUnits(amountInput, selectedAsset.decimals);
            writeContract({ 
                address: CONTRACT_ADDRESS, 
                abi: CONTRACT_ABI, 
                functionName: 'createEscrow', 
                args: [sellerAddress as `0x${string}`, selectedAsset.address as `0x${string}`, amountWei], 
                value: BigInt(0) 
            });
        } else if (txType === 'deposit') {
            showToast("Escrow Created Successfully!", 'success');
            setSellerAddress(''); 
            setAmountInput('');
            setTxType(null); 
            handleRefresh();
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  const { myBuyingOrders, mySellingOrders } = useMemo(() => {
    const buying: any[] = [];
    const selling: any[] = [];
    
    // CRYPTO ORDERS
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
          if (chainCompleted) { status = "COMPLETED"; statusColor = "bg-slate-700 text-slate-300"; }
          else if (chainDisputed) { status = "DISPUTED"; statusColor = "bg-red-500/20 text-red-400"; }
          else if (!isAccepted) { status = "WAITING ACCEPTANCE"; statusColor = "bg-yellow-500/20 text-yellow-400"; }
          else if (isShipped) { status = "SHIPPED"; statusColor = "bg-blue-500/20 text-blue-400"; }

          const order = {
            id, buyer, seller, token: tokenAddr, amount: totalAmount, lockedBalance,
            isAccepted, isShipped, isDisputed: chainDisputed, isCompleted: chainCompleted,
            status, statusColor,
            token_symbol: isNative ? 'XPL' : 'USDC', // ✅ NEW: Swapped ETH to XPL
            formattedTotal: isNative ? formatEther(totalAmount) : formatUnits(totalAmount, 6),
            formattedLocked: isNative ? formatEther(lockedBalance) : formatUnits(lockedBalance, 6),
            percentPaid,
            type: 'CRYPTO',
            timestamp: Number(id) // Crypto orders now sort perfectly by their exact Blockchain ID 
          };

          if (buyer.toLowerCase() === userAddress.toLowerCase()) buying.push(order);
          if (seller.toLowerCase() === userAddress.toLowerCase()) selling.push(order);
        }
      });
    }

    // FIAT ORDERS
    Object.values(dbOrders).forEach((dbOrder: any) => {
        if (!dbOrder.paystack_ref) return;

        const currentStatus = dbOrder.status?.toLowerCase() || 'pending';
        
        if (currentStatus === 'awaiting_payment' || currentStatus === 'failed') return;

        // ✅ FIX: Check for Google or Social emails as well
        const activeEmail = user?.email?.address || user?.google?.email || user?.apple?.email || user?.discord?.email;
        const myEmail = activeEmail?.toLowerCase();

        const myWallet = userAddress?.toLowerCase();
        
        const isMyEmailAsBuyer = myEmail && dbOrder.buyer_email?.toLowerCase() === myEmail;
        const isMyWalletAsBuyer = myWallet && dbOrder.buyer_wallet_address?.toLowerCase() === myWallet;
        const isMyEmailAsSeller = myEmail && dbOrder.seller_email?.toLowerCase() === myEmail;

        let fiatStatusColor = "bg-yellow-500/20 text-yellow-400"; 
        
        if (['success', 'completed'].includes(currentStatus)) fiatStatusColor = "bg-slate-700 text-slate-300";
        else if (currentStatus === 'disputed') fiatStatusColor = "bg-red-500/20 text-red-400";
        else if (currentStatus === 'shipped') fiatStatusColor = "bg-blue-500/20 text-blue-400";
        else if (['accepted', 'partially_released'].includes(currentStatus)) fiatStatusColor = "bg-emerald-500/20 text-emerald-400";

        const totalAmt = Number(dbOrder.amount || 0);
        const releasedAmt = Number(dbOrder.released_amount || 0);
        const lockedAmt = totalAmt - releasedAmt;
        const isFullyPaid = ['success', 'completed'].includes(currentStatus);
        const percentPaid = isFullyPaid ? 100 : (totalAmt > 0 ? Math.round((releasedAmt / totalAmt) * 100) : 0);

        const fiatOrderObj = {
            id: `NGN-${dbOrder.id}`,
            buyer: dbOrder.buyer_email,
            seller: dbOrder.seller_email || dbOrder.seller_name,
            amount: BigInt(0),
            formattedTotal: totalAmt.toLocaleString(),
            formattedLocked: lockedAmt.toLocaleString(), 
            token_symbol: 'NGN',
            status: isFullyPaid ? 'PAID' : currentStatus.toUpperCase().replace('_', ' '),
            statusColor: fiatStatusColor,
            percentPaid: percentPaid,
            type: 'FIAT',
            timestamp: dbOrder.created_at ? new Date(dbOrder.created_at).getTime() : dbOrder.id,
            isAccepted: ['accepted', 'partially_released', 'shipped', 'success', 'completed'].includes(currentStatus),
            isShipped: ['shipped', 'success', 'completed'].includes(currentStatus),
            isCompleted: isFullyPaid,
            isDisputed: currentStatus === 'disputed'
        };

        if (isMyEmailAsBuyer || isMyWalletAsBuyer) buying.push(fiatOrderObj);
        if (isMyEmailAsSeller) selling.push(fiatOrderObj); 
    });

    buying.sort((a, b) => b.timestamp - a.timestamp);
    selling.sort((a, b) => b.timestamp - a.timestamp);

    return { myBuyingOrders: buying, mySellingOrders: selling };
  }, [escrowsData, userAddress, indexesToFetch, dbOrders, user]);

  const handleCryptoTransaction = async () => {
    // ✅ NEW: Switch to Plasma ID if they are on the wrong network
    if (isWrongNetwork) { switchChain({ chainId: PLASMA_CHAIN_ID }); return; }
    if (!sellerAddress || !amountInput) return;
    if (!isAddress(sellerAddress)) { showToast("Invalid Wallet Address", 'error'); return; }
    if (sellerAddress.toLowerCase() === userAddress?.toLowerCase()) { showToast("You cannot create an order with yourself.", 'error'); return; }

    try {
      // ✅ NEW: Check for XPL
      const isNative = selectedAsset.symbol === 'XPL';
      const amountWei = parseUnits(amountInput, isNative ? 18 : 6);

      if (!isNative) {
        const currentAllowance = usdcAllowance ? BigInt(String(usdcAllowance)) : BigInt(0);
        if (currentAllowance < amountWei) {
          setTxType('approve'); 
          writeContract({ address: selectedAsset.address as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACT_ADDRESS, amountWei] });
          showToast("Approving USDC... Please wait.", 'info'); 
          return;
        }
      }
      setTxType('deposit'); 
      writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'createEscrow', args: [sellerAddress as `0x${string}`, selectedAsset.address as `0x${string}`, amountWei], value: isNative ? amountWei : BigInt(0) });
      showToast("Deposit Request Sent...", 'info');
    } catch (err: any) { showToast("Error: " + err.message, 'error'); }
  };

  const handleFiatTransaction = async () => {
    if(!fiatAmount || !accountNumber || !bankCode || !buyerEmail || !sellerEmail) { showToast("Please fill all fields", 'error'); return; }
    if(!accountName) { showToast("Please wait for verification", 'error'); return; }

    try {
        showToast("Initializing Secure Checkout...", 'info');
        const response = await fetch('/api/paystack/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: fiatAmount,
                email: buyerEmail,
                seller_email: sellerEmail, 
                seller_bank: BANKS.find(b => b.code === bankCode)?.name || bankCode,
                seller_number: accountNumber,
                seller_name: accountName,
                description: fiatDescription || "Escrow Payment",
                buyer_wallet: userAddress
            })
        });

        const data = await response.json();
        if (!data.status) throw new Error(data.message || "Payment initialization failed");
        
        showToast("Redirecting to Paystack...", 'success');
        setTimeout(() => { window.location.href = data.data.authorization_url; }, 1000);

    } catch (err: any) {
        showToast(err.message || "Payment Error", 'error');
    }
  };

  const activeOrdersList = dashboardTab === 'buying' ? myBuyingOrders : mySellingOrders;
  const displayedOrders = activeOrdersList.filter((order: any) => order.type.toLowerCase() === mode);

  // ✅ CHECK IF USER HAS ANY EMAIL (Standard, Google, Apple, etc.)
  const hasEmailLinked = !!(user?.email?.address || user?.google?.email || user?.apple?.email || user?.discord?.email);

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
                <p className="text-slate-400 mb-8 leading-relaxed">Your fiat payment has been securely locked in escrow. The seller has been notified.</p>
                <button 
                    onClick={() => setShowSuccessModal(false)}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-extrabold text-lg py-4 rounded-xl transition-all shadow-lg"
                >
                    View My Order
                </button>
            </div>
        </div>
      )}

      {notification && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      <nav className="flex items-center justify-between px-6 py-6 max-w-6xl mx-auto w-full gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 min-w-max">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center rotate-3">
                <Lock className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold hidden sm:block">TrustLink</span>
        </div>

        {/* The Simple Search Engine */}
        {authenticated && (
            <form onSubmit={handleSearch} className="flex-1 max-w-lg relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-700 rounded-2xl leading-5 bg-slate-900/50 text-slate-300 placeholder-slate-500 focus:outline-none focus:bg-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:text-sm transition-all shadow-inner"
                    placeholder="Search seller by email or wallet..."
                />
            </form>
        )}

        {/* Simple Identity Dropdown */}
        {authenticated ? (
            <div className="flex items-center gap-3 min-w-max">
                {isWrongNetwork && <button onClick={() => switchChain({ chainId: PLASMA_CHAIN_ID })} className="text-red-400 text-xs font-bold border border-red-500 px-3 py-1 rounded-full bg-red-500/10">Wrong Network</button>}
                
                <button onClick={() => setIsWalletModalOpen(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 rounded-2xl transition-all shadow-lg">
                    <span className="font-mono text-sm font-bold truncate max-w-[100px] sm:max-w-[150px]">
                        {user?.email?.address || user?.google?.email 
                            ? (user?.email?.address || user?.google?.email)?.split('@')[0] 
                            : (userAddress ? `${userAddress.slice(0,6)}...${userAddress.slice(-4)}` : "Wallet")}
                    </span>
                    <Wallet className="w-4 h-4 text-emerald-400" />
                </button>
                <button onClick={logout} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2.5 rounded-2xl border border-red-500/20 transition-all">
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        ) : (
            <button onClick={login} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20">Log In</button>
        )}
      </nav>

      <main className="flex flex-col items-center mt-10 px-4 max-w-4xl mx-auto">
        <h1 className="text-5xl font-extrabold mb-8 text-center leading-tight">Trust is no longer <br /><span className="text-emerald-400">a leap of faith.</span></h1>
        
        <div className="w-full max-w-md bg-slate-800/50 border border-slate-700 p-8 rounded-2xl backdrop-blur-sm shadow-2xl relative z-10">
            {!authenticated ? <button onClick={login} className="w-full bg-emerald-500 hover:bg-emerald-400 py-3 rounded-xl font-bold">Connect Wallet</button> : (
            <div className="flex flex-col gap-4">
                
                <div className="bg-slate-900/80 p-1 rounded-xl flex mb-2 border border-slate-700">
                    <button onClick={() => setMode('crypto')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'crypto' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}><Bitcoin className="w-4 h-4" /> Crypto</button>
                    <button onClick={() => setMode('fiat')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'fiat' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}><Banknote className="w-4 h-4" /> Fiat</button>
                </div>

                {mode === 'crypto' && (
                    <>
                    <div className="relative">
                        <button onClick={() => setIsTokenListOpen(!isTokenListOpen)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 flex justify-between items-center hover:border-slate-600 transition-all">
                            <div className="flex items-center gap-2"><div className={`w-5 h-5 rounded-full ${selectedAsset.icon} flex items-center justify-center text-[8px]`}>{selectedAsset.symbol[0]}</div><span>{selectedAsset.symbol}</span></div><ChevronDown className="w-4 h-4 text-slate-500" />
                        </button>
                        {isTokenListOpen && <div className="absolute top-full w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl z-20 overflow-hidden shadow-xl">{ASSETS.map(a => <div key={a.symbol} onClick={() => { setSelectedAsset(a); setIsTokenListOpen(false); }} className="p-3 hover:bg-slate-700 cursor-pointer flex gap-3"><div className={`w-6 h-6 rounded-full ${a.icon} flex items-center justify-center text-[10px]`}>{a.symbol[0]}</div>{a.name}</div>)}</div>}
                    </div>
                    <div><label className="text-xs text-slate-400 ml-1 font-bold">SELLER ADDRESS</label><input value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} placeholder="0x..." className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all" /></div>
                    <div><label className="text-xs text-slate-400 ml-1 font-bold">AMOUNT</label><input type="number" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} placeholder="0.00" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all" /></div>
                    <button onClick={handleCryptoTransaction} disabled={isWriting || isConfirming || !sellerAddress || !amountInput} className="w-full bg-emerald-500 hover:bg-emerald-400 py-4 rounded-xl font-bold mt-2 disabled:opacity-50 flex items-center justify-center gap-2">{(isWriting || isConfirming) ? <Loader2 className="animate-spin" /> : "Deposit Crypto"}</button>
                    </>
                )}

                {/* ✅ GATED FIAT FORM */}
                {mode === 'fiat' && (
                    <>
                    {!hasEmailLinked ? (
                        <div className="flex flex-col items-center justify-center p-6 bg-slate-900/50 border border-slate-700 rounded-2xl text-center gap-4 mt-2">
                            <div className="w-14 h-14 bg-blue-500/20 border border-blue-500/30 rounded-full flex items-center justify-center mb-2">
                                <Mail className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white">Email Verification Required</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                To use Fiat (NGN) escrows, you must link an email address to your account. This ensures you receive payment receipts and secure dispute notifications.
                            </p>
                            <button 
                                onClick={linkEmail} 
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl mt-2 transition-all w-full flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                            >
                                Link Email Address <ArrowRight className="w-4 h-4"/>
                            </button>
                        </div>
                    ) : (
                        <>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 flex items-center justify-center gap-2 cursor-not-allowed opacity-80"><span className="text-sm font-bold">NGN</span><div className={`w-4 h-4 rounded-full bg-green-600 flex items-center justify-center text-[8px] text-white`}>₦</div></div>
                            <div className="col-span-2"><input type="number" value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value)} placeholder="Amount (e.g. 5000)" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-all" /></div>
                        </div>
                        
                        {/* ✅ LOCKED EMAIL FIELD */}
                        <div className="opacity-70 cursor-not-allowed">
                            <label className="text-xs text-slate-400 ml-1 font-bold flex items-center gap-1.5">YOUR EMAIL <Lock className="w-3 h-3 text-slate-500"/></label>
                            <input readOnly value={buyerEmail} className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none text-slate-400 cursor-not-allowed" />
                        </div>
                        
                        <div><label className="text-xs text-emerald-400 ml-1 font-bold">SELLER'S TRUSTLINK EMAIL</label><input value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} placeholder="seller@email.com" className="w-full bg-slate-900/50 border border-emerald-500/30 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all" /></div>

                        <div>
                            <label className="text-xs text-slate-400 ml-1 font-bold">SELLER BANK DETAILS</label>
                            <div className="flex flex-col gap-2 mt-1">
                                <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm appearance-none"><option value="">Select Bank</option>{BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}</select>
                                <div className="relative"><input value={accountNumber} onChange={(e) => { if(e.target.value.length <= 10) setAccountNumber(e.target.value); }} placeholder="Account Number (10 digits)" type="number" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-all" />{isResolving && <div className="absolute right-4 top-3.5"><Loader2 className="animate-spin w-4 h-4 text-blue-500"/></div>}</div>
                                <div className={`w-full bg-slate-800/50 border ${accountName ? 'border-emerald-500/30 bg-emerald-500/10' : resolveError ? 'border-red-500/30 bg-red-500/10' : 'border-slate-800'} rounded-lg px-4 py-3 transition-all flex items-center gap-2 min-h-[46px]`}>
                                    {accountName ? <><div className="bg-emerald-500 rounded-full p-0.5"><CheckCircle2 className="w-3 h-3 text-white"/></div><span className="text-xs font-bold text-emerald-400 tracking-wide">{accountName}</span></> : resolveError ? <><div className="bg-red-500 rounded-full p-0.5"><X className="w-3 h-3 text-white"/></div><span className="text-xs font-bold text-red-400 tracking-wide">{resolveError}</span></> : <span className="text-xs text-slate-600 italic flex items-center gap-2"><UserCheck className="w-3 h-3"/> Account Name will appear here</span>}
                                </div>
                            </div>
                        </div>
                        <div><label className="text-xs text-slate-400 ml-1 font-bold">DESCRIPTION</label><textarea value={fiatDescription} onChange={(e) => setFiatDescription(e.target.value)} placeholder="What are you paying for?" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-blue-500 transition-all h-24 resize-none" /></div>
                        <button onClick={handleFiatTransaction} disabled={!fiatAmount || !accountName || !buyerEmail || !sellerEmail} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold mt-2 disabled:opacity-50 flex items-center justify-center gap-2">Create Fiat Escrow <ArrowRight className="w-4 h-4" /></button>
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
                    <button onClick={() => setDashboardTab('buying')} className={`text-lg font-bold pb-4 border-b-2 transition-all ${dashboardTab === 'buying' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-500'}`}>I'm Buying</button>
                    <button onClick={() => setDashboardTab('selling')} className={`text-lg font-bold pb-4 border-b-2 transition-all ${dashboardTab === 'selling' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-500'}`}>I'm Selling</button>
                </div>
                
                <div className="flex items-center gap-3 pb-3">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
                         Showing {mode} Orders
                     </span>
                     <button onClick={handleRefresh} className="text-slate-500 hover:text-white"><RefreshCcw className="w-4 h-4" /></button>
                </div>
            </div>

            <div className="space-y-4">
                {displayedOrders.map((order: any) => (
                    <OrderCard key={order.id} order={order} isSellerView={dashboardTab === 'selling'} userAddress={userAddress || ''} onUpdate={handleRefresh} />
                ))}
                
                {displayedOrders.length === 0 && (
                    <div className="text-slate-500 text-center py-10 italic border border-dashed border-slate-700 rounded-xl">
                        No active <span className="capitalize">{mode}</span> orders found.
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
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    }>
      <MainDashboard />
    </Suspense>
  );
}
'use client';

// ==========================================
// 1. IMPORTS
// ==========================================
import OrderCard from '@/components/OrderCard';
import WalletModal from '@/components/WalletModal';
import { usePrivy } from '@privy-io/react-auth';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts, useAccount, useSwitchChain, useBalance } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { parseUnits, formatEther, formatUnits, isAddress } from 'viem'; 
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/app/constants';
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { 
  Lock, LogOut, Loader2, RefreshCcw, AlertTriangle, Network, Wallet, 
  ChevronDown, X, CheckCircle2, Banknote, Bitcoin, ArrowRight, UserCheck, Mail
} from 'lucide-react';

// --- CONSTANTS ---
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ERC20_ABI = [
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' }
];

const ASSETS = [
  { symbol: 'ETH', name: 'Ethereum', type: 'native', icon: 'bg-slate-700', address: ZERO_ADDRESS, decimals: 18 },
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

export default function Home() {
  // ==========================================
  // 2. STATE & HOOKS
  // ==========================================
  const { login, authenticated, user, logout } = usePrivy();
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  // UI State
  const [mode, setMode] = useState<'crypto' | 'fiat'>('crypto');
  
  // Crypto Form State
  const [sellerAddress, setSellerAddress] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [isTokenListOpen, setIsTokenListOpen] = useState(false);
  
  // Fiat Form State
  const [fiatAmount, setFiatAmount] = useState('');
  const [buyerEmail, setBuyerEmail] = useState(''); 
  const [fiatDescription, setFiatDescription] = useState('');
  
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  // Auto-fill Email if available from Privy
  useEffect(() => {
    if (user?.email?.address) {
        setBuyerEmail(user.email.address);
    }
  }, [user]);

  // --- REAL PAYSTACK LOGIC (WITH DEV BYPASS) ---
  const resolveBankAccount = async (account: string, bank: string) => {
    setIsResolving(true);
    setResolveError('');
    setAccountName('');

    // ⚡️ EMERGENCY BYPASS ⚡️
    // Since Paystack rate-limited your key for the day, we skip the server call
    // ONLY if you type the magic test number.
    if (account === '9999999999') {
        setTimeout(() => {
            setAccountName("Test Mode User (Bypassed)"); // ✅ Auto-verify!
            setIsResolving(false);
        }, 800);
        return; // <--- STOP HERE. Do not call the blocked API.
    }

    try {
        const response = await fetch(`/api/paystack/resolve?account_number=${account}&bank_code=${bank}`);
        const data = await response.json();

        if (!data.status) {
            throw new Error(data.message || "Unknown bank error");
        }

        if (data.data && data.data.account_name) {
             setAccountName(data.data.account_name);
        } else {
             throw new Error("Account name not found");
        }
    } catch (err: any) {
        console.error("Verification Error:", err);
        setResolveError(err.message || "Verification failed"); 
        showToast(`Error: ${err.message}`, 'error');
    } finally {
        if (account !== '9999999999') setIsResolving(false);
    }
  };

  // Trigger Resolution when inputs are ready
  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) {
        resolveBankAccount(accountNumber, bankCode);
    } else {
        setAccountName('');
        setResolveError('');
    }
  }, [accountNumber, bankCode]);

  // Data Fetching
  const [dbOrders, setDbOrders] = useState<Record<number, any>>({});
  const [dashboardTab, setDashboardTab] = useState<'buying' | 'selling'>('buying'); 
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [txType, setTxType] = useState<'approve' | 'deposit' | null>(null);

  // Blockchain Transaction State
  const { writeContract, data: txHash, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => { if (notification) { const t = setTimeout(() => setNotification(null), 4000); return () => clearTimeout(t); } }, [notification]);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => setNotification({ message, type });

  // Handle Transaction Success
  useEffect(() => {
    if (isSuccess) {
        showToast(txType === 'approve' ? "Approved! Now click Deposit." : "Escrow Created Successfully!", 'success');
        if (txType === 'deposit') {
            setSellerAddress('');
            setAmountInput('');
        }
        setTxType(null); 
        handleRefresh();
    }
  }, [isSuccess]);

  const userAddress = user?.wallet?.address;
  const isWrongNetwork = authenticated && chain && chain.id !== sepolia.id;

  // Database Fetch
  const fetchDbOrders = async () => {
    const { data } = await supabase.from('escrow_orders').select('*');
    if (data) {
      const map: Record<number, any> = {};
      data.forEach((row: any) => { map[row.id] = row; });
      setDbOrders(map);
    }
  };
  useEffect(() => { fetchDbOrders(); }, []);

  // Contract Reads
  const { data: ethBalance, refetch: refetchEth } = useBalance({ address: userAddress as `0x${string}` });
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: ASSETS[1].address as `0x${string}`, abi: ERC20_ABI, functionName: 'allowance',
    args: userAddress ? [userAddress as `0x${string}`, CONTRACT_ADDRESS] : undefined,
    query: { enabled: !!userAddress && selectedAsset.symbol === 'USDC' }
  });
  const { data: totalEscrows } = useReadContract({ abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrowCount' });
  const count = totalEscrows ? Number(totalEscrows) : 0;
  
  const indexesToFetch = useMemo(() => {
    const idxs = [];
    for (let i = count; i > 0 && i > count - 10; i--) idxs.push(i);
    return idxs;
  }, [count]);

  const { data: escrowsData, refetch: refetchOrders } = useReadContracts({
    contracts: indexesToFetch.map((id) => ({ 
        abi: CONTRACT_ABI, 
        address: CONTRACT_ADDRESS,
        functionName: 'escrows', 
        args: [BigInt(id)] 
    })),
    query: { refetchInterval: 5000 }
  });

  const handleRefresh = () => { 
      refetchEth(); 
      refetchOrders(); 
      if (selectedAsset.symbol === 'USDC') refetchAllowance?.(); 
      fetchDbOrders(); 
  };

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
          
          const paidAmount = totalAmount - lockedBalance;
          const isEth = tokenAddr === ZERO_ADDRESS;
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
            token_symbol: isEth ? 'ETH' : 'USDC',
            formattedTotal: isEth ? formatEther(totalAmount) : formatUnits(totalAmount, 6),
            formattedLocked: isEth ? formatEther(lockedBalance) : formatUnits(lockedBalance, 6),
            percentPaid
          };

          if (buyer.toLowerCase() === userAddress.toLowerCase()) buying.push(order);
          if (seller.toLowerCase() === userAddress.toLowerCase()) selling.push(order);
        }
      });
    }
    return { myBuyingOrders: buying, mySellingOrders: selling };
  }, [escrowsData, userAddress, indexesToFetch, dbOrders]);

  // Actions
  const handleCryptoTransaction = async () => {
    if (isWrongNetwork) { switchChain({ chainId: sepolia.id }); return; }
    if (!sellerAddress || !amountInput) return;
    if (!isAddress(sellerAddress)) { showToast("Invalid Ethereum Address", 'error'); return; }
    if (sellerAddress.toLowerCase() === userAddress?.toLowerCase()) { showToast("You cannot create an order with yourself.", 'error'); return; }

    try {
      const isEth = selectedAsset.symbol === 'ETH';
      const amountWei = parseUnits(amountInput, isEth ? 18 : 6);

      if (!isEth) {
        const currentAllowance = usdcAllowance ? BigInt(String(usdcAllowance)) : BigInt(0);
        if (currentAllowance < amountWei) {
          setTxType('approve'); 
          writeContract({ 
            address: selectedAsset.address as `0x${string}`, 
            abi: ERC20_ABI, 
            functionName: 'approve', 
            args: [CONTRACT_ADDRESS, amountWei] 
          });
          showToast("Approval Request Sent...", 'info');
          return;
        }
      }

      setTxType('deposit'); 
      writeContract({ 
        address: CONTRACT_ADDRESS, 
        abi: CONTRACT_ABI, 
        functionName: 'createEscrow', 
        args: [
            sellerAddress as `0x${string}`,
            selectedAsset.address as `0x${string}`,
            amountWei
        ], 
        value: isEth ? amountWei : BigInt(0) 
      });
      showToast("Deposit Request Sent...", 'info');
    } catch (err: any) { showToast("Error: " + err.message, 'error'); }
  };

  // --- HANDLE FIAT PAYMENT ---
  const handleFiatTransaction = async () => {
    // 1. Basic Validation
    if(!fiatAmount || !accountNumber || !bankCode || !buyerEmail) { 
        showToast("Please fill all fields", 'error'); 
        return; 
    }
    if(!accountName) { 
        showToast("Please wait for verification", 'error'); 
        return; 
    }

    try {
        showToast("Initializing Secure Checkout...", 'info');

        // 2. Call our Backend API
        const response = await fetch('/api/paystack/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: fiatAmount,
                email: buyerEmail,
                seller_bank: BANKS.find(b => b.code === bankCode)?.name || bankCode,
                seller_number: accountNumber,
                seller_name: accountName,
                description: fiatDescription || "Escrow Payment"
            })
        });

        const data = await response.json();

        if (!data.status) {
            throw new Error(data.message || "Payment initialization failed");
        }

        // 3. Redirect to Paystack
        showToast("Redirecting to Paystack...", 'success');
        
        // Slight delay so user sees the toast
        setTimeout(() => {
            window.location.href = data.data.authorization_url;
        }, 1000);

    } catch (err: any) {
        console.error(err);
        showToast(err.message || "Payment Error", 'error');
    }
  };

  // ==========================================
  // 5. RENDER
  // ==========================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white font-sans pb-20 relative">
      <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />

      {notification && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center rotate-3"><Lock className="w-4 h-4 text-white" /></div><span className="text-xl font-bold">TrustLink</span></div>
        {authenticated ? (
            <div className="flex items-center gap-4">
                {isWrongNetwork && <button onClick={() => switchChain({ chainId: sepolia.id })} className="text-red-400 text-xs font-bold border border-red-500 px-3 py-1 rounded-full bg-red-500/10">Wrong Network</button>}
                <button onClick={() => setIsWalletModalOpen(true)} className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded-lg border border-transparent hover:border-emerald-500/30">
                    <span className="font-mono text-sm font-bold">{ethBalance?.formatted ? Number(ethBalance.formatted).toFixed(4) : "0.00"} ETH</span>
                    <Wallet className="w-4 h-4 text-slate-400" />
                </button>
                <button onClick={logout} className="bg-white/5 p-2 rounded-full"><LogOut className="w-4 h-4" /></button>
            </div>
        ) : <button onClick={login} className="bg-white/10 hover:bg-white/20 px-5 py-2 rounded-full text-sm font-bold">Log In</button>}
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex flex-col items-center mt-10 px-4 max-w-4xl mx-auto">
        <h1 className="text-5xl font-extrabold mb-8 text-center leading-tight">Trust is no longer <br /><span className="text-emerald-400">a leap of faith.</span></h1>
        
        {/* DEPOSIT BOX */}
        <div className="w-full max-w-md bg-slate-800/50 border border-slate-700 p-8 rounded-2xl backdrop-blur-sm shadow-2xl relative z-10 transition-all duration-300">
            {!authenticated ? <button onClick={login} className="w-full bg-emerald-500 hover:bg-emerald-400 py-3 rounded-xl font-bold">Connect Wallet</button> : (
            <div className="flex flex-col gap-4">
                
                {/* MODE TOGGLE */}
                <div className="bg-slate-900/80 p-1 rounded-xl flex mb-2 border border-slate-700">
                    <button onClick={() => setMode('crypto')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'crypto' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Bitcoin className="w-4 h-4" /> Crypto
                    </button>
                    <button onClick={() => setMode('fiat')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'fiat' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Banknote className="w-4 h-4" /> Fiat
                    </button>
                </div>

                {/* === CRYPTO FORM === */}
                {mode === 'crypto' && (
                    <>
                    <div className="relative">
                        <button onClick={() => setIsTokenListOpen(!isTokenListOpen)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 flex justify-between items-center hover:border-slate-600 transition-all">
                            <div className="flex items-center gap-2"><div className={`w-5 h-5 rounded-full ${selectedAsset.icon} flex items-center justify-center text-[8px]`}>{selectedAsset.symbol[0]}</div><span>{selectedAsset.symbol}</span></div>
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                        </button>
                        {isTokenListOpen && <div className="absolute top-full w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl z-20 overflow-hidden shadow-xl">{ASSETS.map(a => <div key={a.symbol} onClick={() => { setSelectedAsset(a); setIsTokenListOpen(false); }} className="p-3 hover:bg-slate-700 cursor-pointer flex gap-3"><div className={`w-6 h-6 rounded-full ${a.icon} flex items-center justify-center text-[10px]`}>{a.symbol[0]}</div>{a.name}</div>)}</div>}
                    </div>
                    <div><label className="text-xs text-slate-400 ml-1 font-bold">SELLER ADDRESS</label><input value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} placeholder="0x..." className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all" /></div>
                    <div><label className="text-xs text-slate-400 ml-1 font-bold">AMOUNT</label><input type="number" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} placeholder="0.00" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500 transition-all" /></div>
                    
                    <button onClick={handleCryptoTransaction} disabled={isWriting || isConfirming || !sellerAddress || !amountInput} className="w-full bg-emerald-500 hover:bg-emerald-400 py-4 rounded-xl font-bold mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                        {(isWriting || isConfirming) ? <Loader2 className="animate-spin" /> : "Deposit Crypto"}
                    </button>
                    </>
                )}

                {/* === FIAT FORM (PAYSTACK READY) === */}
                {mode === 'fiat' && (
                    <>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-3 flex items-center justify-center gap-2 cursor-not-allowed opacity-80">
                            <span className="text-sm font-bold">NGN</span>
                            <div className={`w-4 h-4 rounded-full bg-green-600 flex items-center justify-center text-[8px] text-white`}>₦</div>
                        </div>
                        <div className="col-span-2">
                             <input type="number" value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value)} placeholder="Amount (e.g. 5000)" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-all" />
                        </div>
                    </div>
                    
                    <div><label className="text-xs text-slate-400 ml-1 font-bold">YOUR EMAIL</label><input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="receipt@email.com" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-blue-500 transition-all" /></div>

                    {/* BANK DETAILS SPLIT */}
                    <div>
                        <label className="text-xs text-slate-400 ml-1 font-bold">SELLER BANK DETAILS</label>
                        <div className="flex flex-col gap-2 mt-1">
                            <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm appearance-none">
                                <option value="">Select Bank</option>
                                {BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                            </select>
                            
                            <div className="relative">
                                <input value={accountNumber} onChange={(e) => {
                                    if(e.target.value.length <= 10) setAccountNumber(e.target.value);
                                }} placeholder="Account Number (10 digits)" type="number" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500 transition-all" />
                                {isResolving && <div className="absolute right-4 top-3.5"><Loader2 className="animate-spin w-4 h-4 text-blue-500"/></div>}
                            </div>

                            {/* ACCOUNT NAME RESOLVER */}
                            <div className={`w-full bg-slate-800/50 border ${accountName ? 'border-emerald-500/30 bg-emerald-500/10' : resolveError ? 'border-red-500/30 bg-red-500/10' : 'border-slate-800'} rounded-lg px-4 py-3 transition-all flex items-center gap-2 min-h-[46px]`}>
                                {accountName ? (
                                    <>
                                        <div className="bg-emerald-500 rounded-full p-0.5"><CheckCircle2 className="w-3 h-3 text-white"/></div>
                                        <span className="text-xs font-bold text-emerald-400 tracking-wide">{accountName}</span>
                                    </>
                                ) : resolveError ? (
                                    <>
                                        <div className="bg-red-500 rounded-full p-0.5"><X className="w-3 h-3 text-white"/></div>
                                        <span className="text-xs font-bold text-red-400 tracking-wide">{resolveError}</span>
                                    </>
                                ) : (
                                    <span className="text-xs text-slate-600 italic flex items-center gap-2"><UserCheck className="w-3 h-3"/> Account Name will appear here</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div><label className="text-xs text-slate-400 ml-1 font-bold">DESCRIPTION</label><textarea value={fiatDescription} onChange={(e) => setFiatDescription(e.target.value)} placeholder="What are you paying for?" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-blue-500 transition-all h-24 resize-none" /></div>

                    <button onClick={handleFiatTransaction} disabled={!fiatAmount || !accountName || !buyerEmail} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                        Create Fiat Escrow <ArrowRight className="w-4 h-4" />
                    </button>
                    </>
                )}

            </div>
            )}
        </div>

        {/* ORDER LIST */}
        <div className="w-full mt-20 border-t border-white/10 pt-10">
            <div className="flex gap-6 mb-6 border-b border-white/10 pb-1">
                <button onClick={() => setDashboardTab('buying')} className={`text-lg font-bold pb-4 border-b-2 transition-all ${dashboardTab === 'buying' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-500'}`}>I'm Buying</button>
                <button onClick={() => setDashboardTab('selling')} className={`text-lg font-bold pb-4 border-b-2 transition-all ${dashboardTab === 'selling' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-500'}`}>I'm Selling</button>
                <button onClick={handleRefresh} className="ml-auto text-slate-500 hover:text-white"><RefreshCcw className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
                {(dashboardTab === 'buying' ? myBuyingOrders : mySellingOrders).map((order: any) => (
                    <OrderCard 
                        key={order.id} 
                        order={order} 
                        isSellerView={dashboardTab === 'selling'} 
                        userAddress={userAddress || ''}
                        onUpdate={handleRefresh}
                    />
                ))}
                {(dashboardTab === 'buying' ? myBuyingOrders : mySellingOrders).length === 0 && <div className="text-slate-500 text-center py-10 italic border border-dashed border-slate-700 rounded-xl">No active orders found.</div>}
            </div>
        </div>
      </main>
    </div>
  );
}
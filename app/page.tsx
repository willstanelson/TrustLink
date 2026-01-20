'use client';

// ==========================================
// 1. IMPORTS & CONFIGURATION
// ==========================================
import { usePrivy } from '@privy-io/react-auth';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts, useAccount, useSwitchChain, useBalance, useSendTransaction } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { parseEther, formatEther, parseUnits, formatUnits } from 'viem';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from './constants';
import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic'; 
import { supabase } from '../lib/supabaseClient'; 
import { 
  Shield, Lock, LogOut, Loader2, RefreshCcw, CheckCircle, AlertTriangle, 
  Network, Wallet, Plus, X, ArrowDownLeft, ArrowUpRight, ArrowLeft, 
  ChevronDown, User, Settings, Chrome, Twitter, MessageSquare, 
  Link as LinkIcon, Key, Eye, Fingerprint, Check, RotateCw, CheckCircle2,
  Package, ThumbsUp, XCircle, Truck, CheckCheck, ArrowRight
} from 'lucide-react';

// --- DYNAMIC CHATBOX ---
const ChatBox = dynamic(() => import('../components/ChatBox'), { 
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-slate-500 text-xs">Loading Secure Chat...</div>
});

// --- CONSTANTS ---
const MOCK_ETH_PRICE = 2500; 
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const ERC20_ABI = [
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'transfer', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' }
];

const ASSETS = [
  { symbol: 'ETH', name: 'Ethereum', type: 'native', icon: 'bg-slate-700', address: ZERO_ADDRESS, decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', type: 'erc20', icon: 'bg-blue-600', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
];

const safeFormat = (value: string | undefined | null, decimals = 4) => {
  if (!value) return "0.0000";
  const num = Number(value);
  if (isNaN(num)) return "0.0000";
  return num.toFixed(decimals);
};

export default function Home() {
  // ==========================================
  // 2. AUTH & HOOKS
  // ==========================================
  const { login, authenticated, user, logout, exportWallet, linkGoogle, linkTwitter, linkDiscord, linkPasskey } = usePrivy();
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  // ==========================================
  // 3. STATE
  // ==========================================
  const [sellerAddress, setSellerAddress] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [txHash, setTxHash] = useState('');
  const [txType, setTxType] = useState<'approve' | 'deposit' | 'other' | null>(null);
  const [dbOrders, setDbOrders] = useState<Record<number, any>>({});
  const [dashboardTab, setDashboardTab] = useState<'buying' | 'selling'>('buying'); 
  const [isApproving, setIsApproving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'wallets' | 'profile' | 'settings'>('wallets');
  const [walletView, setWalletView] = useState<'dashboard' | 'send'>('dashboard');
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [isTokenListOpen, setIsTokenListOpen] = useState(false);
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  
  // NEW: State to track release inputs for each order { [orderId]: "0.5" }
  const [releaseInputs, setReleaseInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
  };

  const currentChainId = chain?.id;
  const isWrongNetwork = authenticated && chain && currentChainId !== sepolia.id;
  const userAddress = user?.wallet?.address;
  const isEmbeddedWallet = user?.wallet?.connectorType === 'embedded';

  const googleAccount = user?.linkedAccounts.find((a) => a.type === 'google_oauth');
  const twitterAccount = user?.linkedAccounts.find((a) => a.type === 'twitter_oauth');
  const discordAccount = user?.linkedAccounts.find((a) => a.type === 'discord_oauth');
  const passkeyAccount = user?.linkedAccounts.find((a) => a.type === 'passkey');

  // ==========================================
  // 4. DATA FETCHING
  // ==========================================
  const fetchDbOrders = async () => {
    const { data, error } = await supabase.from('escrow_orders').select('*');
    if (!error && data) {
      const map: Record<number, any> = {};
      data.forEach((row: any) => { map[row.id] = row; });
      setDbOrders(map);
    }
  };
  
  useEffect(() => {
    fetchDbOrders();
    const interval = setInterval(fetchDbOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const { data: ethBalance, refetch: refetchEth, isLoading: ethLoading } = useBalance({ address: userAddress as `0x${string}`, query: { enabled: !!userAddress, refetchInterval: 3000 } });
  const { data: usdcBalance, refetch: refetchUsdc } = useBalance({ address: userAddress as `0x${string}`, token: ASSETS[1].address as `0x${string}`, query: { enabled: !!userAddress, refetchInterval: 3000 } });
  
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: ASSETS[1].address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress as `0x${string}`, CONTRACT_ADDRESS as `0x${string}`] : undefined,
    query: { enabled: !!userAddress && selectedAsset.symbol === 'USDC', refetchInterval: 2000 }
  });

  const { totalPortfolioValue, ethValue, usdcValue } = useMemo(() => {
    const ethQty = ethBalance?.formatted ? parseFloat(ethBalance.formatted) : 0;
    const usdcQty = usdcBalance?.formatted ? parseFloat(usdcBalance.formatted) : 0;
    const eVal = (isNaN(ethQty) ? 0 : ethQty) * MOCK_ETH_PRICE;
    const uVal = (isNaN(usdcQty) ? 0 : usdcQty) * 1; 
    return {
      totalPortfolioValue: (eVal + uVal).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      ethValue: eVal.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      usdcValue: uVal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    };
  }, [ethBalance, usdcBalance]);

  const { data: totalEscrows } = useReadContract({ abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrowCount' });
  const count = totalEscrows ? Number(totalEscrows) : 0;

  const indexesToFetch = useMemo(() => {
    const idxs = [];
    for (let i = count; i > 0 && i > count - 10; i--) idxs.push(i);
    return idxs;
  }, [count]);

  const { data: escrowsData, refetch: refetchOrders } = useReadContracts({
    contracts: indexesToFetch.map((id) => ({ abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrows', args: [BigInt(id)] })),
    query: { refetchInterval: 3000 }
  });

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
            id, buyer, seller, token: tokenAddr, totalAmount, lockedBalance,
            isAccepted, isShipped, isDisputed: chainDisputed, isCompleted: chainCompleted,
            status, statusColor,
            symbol: isEth ? 'ETH' : 'USDC',
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

  // ==========================================
  // 5. ACTIONS
  // ==========================================
  const { writeContract, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash as `0x${string}` });
  const { sendTransaction, isPending: isSending, isSuccess: isSendSuccess } = useSendTransaction();

  useEffect(() => {
    if (isSuccess && txHash) {
      if (txType === 'approve') {
        showToast("Approval Confirmed! Now click Deposit.", 'success');
        refetchAllowance();
      } else if (txType === 'deposit') {
        showToast("Order Created Successfully!", 'success');
        setSellerAddress('');
        setAmountInput('');
        handleRefresh();
      } else {
        showToast("Transaction Confirmed!", 'success');
        handleRefresh();
      }
      setTxHash(''); setTxType(null);
    }
  }, [isSuccess, txHash, txType]);

  const handleRefresh = () => { refetchEth(); refetchUsdc(); refetchOrders(); refetchAllowance(); fetchDbOrders(); };
  const handleForceSwitch = async () => { try { switchChain({ chainId: sepolia.id }); } catch (e) { showToast("Switch to Sepolia.", 'error'); } };

  const handleCreateTransaction = async () => {
    if (isWrongNetwork) { handleForceSwitch(); return; }
    if (!sellerAddress || !amountInput) return;
    try {
      const isEth = selectedAsset.symbol === 'ETH';
      const amountWei = parseUnits(amountInput, isEth ? 18 : 6);
      if (!isEth) {
        const currentAllowance = usdcAllowance ? BigInt(String(usdcAllowance)) : BigInt(0);
        if (currentAllowance < amountWei) {
          setIsApproving(true); setTxType('approve');
          writeContract({ address: selectedAsset.address as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACT_ADDRESS as `0x${string}`, amountWei] }, { onSuccess: (hash) => { setTxHash(hash); showToast("Approval Sent...", 'info'); setIsApproving(false); }, onError: () => { setIsApproving(false); setTxType(null); showToast("Approval Failed", 'error'); } });
          return;
        }
      }
      setTxType('deposit');
      writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'createEscrow', args: [sellerAddress, selectedAsset.address, amountWei], value: isEth ? amountWei : BigInt(0) }, { onSuccess: (hash) => { setTxHash(hash); showToast("Deposit Sent...", 'info'); }, onError: (e) => { setTxType(null); showToast("Deposit Failed: " + (e as any).shortMessage || e.message, 'error'); } });
    } catch (err: any) { showToast("Error: " + err.message, 'error'); setTxType(null); }
  };

  const handleAcceptOrder = async (id: number) => {
    try {
      showToast("Accepting Order (Gasless)...", 'info');
      const { error } = await supabase.from('escrow_orders').upsert({ id: id, seller_address: userAddress, status: 'accepted' });
      if (error) throw error;
      showToast("Order Accepted!", 'success');
      fetchDbOrders();
    } catch (e: any) { console.error(e); showToast("Accept Failed: " + e.message, 'error'); }
  };

  const handleMarkShipped = async (id: number) => {
    try {
      showToast("Marking as Shipped (Gasless)...", 'info');
      const { error } = await supabase.from('escrow_orders').upsert({ id: id, seller_address: userAddress, status: 'shipped' });
      if (error) throw error;
      showToast("Order Shipped!", 'success');
      fetchDbOrders();
    } catch (e: any) { console.error(e); showToast("Ship Failed: " + e.message, 'error'); }
  };

  const handleCancelOrder = async (id: number, isAccepted: boolean) => {
    if (isAccepted) { showToast("Cannot cancel! Seller has accepted.", 'error'); return; }
    if(!confirm("Are you sure? This will refund all funds to you.")) return;
    setTxType('other');
    writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'cancelOrder', args: [BigInt(id)] }, { onSuccess: (hash) => { setTxHash(hash); showToast("Cancelling...", 'info'); }});
  };

  // NEW: CUSTOM RELEASE LOGIC (Replaces 25%/50% buttons)
  const handleCustomRelease = (id: number, lockedBalance: bigint, symbol: string) => {
    const inputVal = releaseInputs[id];
    if (!inputVal) { showToast("Enter an amount first", 'error'); return; }
    
    try {
      setTxType('other');
      // 1. Parse Input
      const decimals = symbol === 'ETH' ? 18 : 6;
      const amountWei = parseUnits(inputVal, decimals);

      // 2. Validate
      if (amountWei <= BigInt(0)) { showToast("Amount must be > 0", 'error'); return; }
      if (amountWei > lockedBalance) { showToast("Amount exceeds locked balance!", 'error'); return; }

      // 3. Send
      writeContract({ 
        address: CONTRACT_ADDRESS, 
        abi: CONTRACT_ABI, 
        functionName: 'releaseMilestone', 
        args: [BigInt(id), amountWei] 
      }, { 
        onSuccess: (hash) => { 
          setTxHash(hash); 
          showToast(`Releasing ${inputVal} ${symbol}...`, 'info'); 
          // Clear input
          setReleaseInputs(prev => ({ ...prev, [id]: '' }));
        }
      });
    } catch (e) {
      showToast("Invalid amount", 'error');
    }
  };

  const handleConfirmReceipt = (id: number, lockedBalance: bigint) => {
    setTxType('other');
    writeContract({ 
      address: CONTRACT_ADDRESS, 
      abi: CONTRACT_ABI, 
      functionName: 'releaseMilestone', 
      args: [BigInt(id), lockedBalance] 
    }, { 
      onSuccess: (hash) => { setTxHash(hash); showToast("Confirming Receipt & Releasing All Funds...", 'info'); }
    });
  };

  const handleRaiseDispute = (id: number) => {
    setTxType('other');
    writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'raiseDispute', args: [BigInt(id)] }, { onSuccess: (hash) => { setTxHash(hash); showToast("Raising Dispute...", 'error'); }});
  };

  const handleSendFunds = () => {
     if (!sendRecipient || !sendAmount) return;
     const amountWei = parseUnits(sendAmount, selectedAsset.symbol === 'ETH' ? 18 : 6);
     if (selectedAsset.symbol === 'ETH') { sendTransaction({ to: sendRecipient as `0x${string}`, value: amountWei }, { onSuccess: () => showToast("ETH Sent!", 'success')}); } 
     else { writeContract({ address: selectedAsset.address as `0x${string}`, abi: ERC20_ABI, functionName: 'transfer', args: [sendRecipient as `0x${string}`, amountWei] }, { onSuccess: () => showToast("USDC Sent!", 'success') }); }
  };

  const copyAddress = () => { if (userAddress) { navigator.clipboard.writeText(userAddress); showToast("Address Copied!", 'success'); } };

  // ==========================================
  // 6. RENDER
  // ==========================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white font-sans selection:bg-green-500/30 pb-20 relative">
      
      {/* TOAST */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-10 fade-in duration-300 ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : notification.type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-blue-500/10 border-blue-500/50 text-blue-400'}`}>
            {notification.type === 'success' && <CheckCircle2 className="w-5 h-5" />} {notification.type === 'error' && <AlertTriangle className="w-5 h-5" />} {notification.type === 'info' && <Loader2 className="w-5 h-5 animate-spin" />}
            <p className="text-sm font-bold">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="ml-2 opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* MODAL */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#111827] border border-slate-700 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden relative min-h-[600px] flex flex-col transition-all">
            {activeTab === 'wallets' && (
              <>
                {walletView === 'dashboard' ? (
                  <>
                    <div className="p-6 pb-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold shadow-lg shadow-blue-900/20">{user?.email?.address?.charAt(0).toUpperCase() || "U"}</div><div><p className="text-sm font-bold text-white">{user?.email?.address || "User"}</p><p className="text-[10px] text-slate-400 font-mono tracking-wide">{userAddress ? `${userAddress.slice(0,6)}...${userAddress.slice(-4)}` : "No Address"}</p></div></div><button onClick={() => setIsWalletModalOpen(false)} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 transition-colors"><X className="w-4 h-4 text-slate-400" /></button></div>
                    <div className="mx-6 p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 text-center relative overflow-hidden"><div className="absolute top-0 right-0 p-3 opacity-10"><Wallet className="w-24 h-24 text-white" /></div><div className="flex items-center justify-center gap-2 mb-1"><p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Net Worth</p><button onClick={handleRefresh} className="text-slate-500 hover:text-white"><RotateCw className={`w-3 h-3 ${ethLoading ? 'animate-spin' : ''}`} /></button></div><h2 className="text-4xl font-extrabold text-white tracking-tight">{totalPortfolioValue}</h2><div className="mt-6 flex gap-3"><button onClick={copyAddress} className="flex-1 bg-white/10 hover:bg-white/20 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all"><ArrowDownLeft className="w-4 h-4" /> Deposit</button><button onClick={() => setWalletView('send')} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-lg shadow-blue-900/20"><ArrowUpRight className="w-4 h-4" /> Send</button></div></div>
                    <div className="flex-1 px-6 pt-6 overflow-y-auto"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">My Assets</p><div className="space-y-3"><div onClick={() => setSelectedAsset(ASSETS[0])} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedAsset.symbol === 'ETH' ? 'bg-slate-800 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-[10px]">ETH</div><div><p className="text-sm font-bold text-white">Ethereum</p><p className="text-[10px] text-slate-500">Sepolia</p></div></div><div className="text-right"><p className="text-sm font-bold text-white">{safeFormat(ethBalance?.formatted)}</p><p className="text-[10px] text-emerald-400">{ethValue}</p></div></div><div onClick={() => setSelectedAsset(ASSETS[1])} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedAsset.symbol === 'USDC' ? 'bg-slate-800 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-[10px]">USD</div><div><p className="text-sm font-bold text-white">USDC</p><p className="text-[10px] text-slate-500">Stablecoin</p></div></div><div className="text-right"><p className="text-sm font-bold text-white">{safeFormat(usdcBalance?.formatted, 2)}</p><p className="text-[10px] text-emerald-400">{usdcValue}</p></div></div></div></div>
                  </>
                ) : (
                  <div className="flex flex-col h-full"><div className="p-6 pb-2 flex items-center justify-between"><button onClick={() => setWalletView('dashboard')} className="text-slate-400 hover:text-white transition-colors"><ArrowLeft className="w-6 h-6" /></button><h3 className="text-lg font-bold text-white">Send {selectedAsset.symbol}</h3><div className="w-6" /></div><div className="p-6 flex flex-col gap-6 flex-1"><div className="relative"><label className="text-xs font-semibold text-slate-400 mb-2 block">Select Asset</label><button onClick={() => setIsTokenListOpen(!isTokenListOpen)} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 flex items-center justify-between hover:border-slate-600 transition-all"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full ${selectedAsset.icon} flex items-center justify-center`}><span className="font-bold text-[10px] text-white">{selectedAsset.symbol}</span></div><span className="font-bold text-white">{selectedAsset.name}</span></div><ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isTokenListOpen ? 'rotate-180' : ''}`} /></button>{isTokenListOpen && (<div className="absolute top-full left-0 right-0 mt-2 bg-[#1f2937] border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden animate-fade-in-up">{ASSETS.map((token) => (<div key={token.symbol} onClick={() => { setSelectedAsset(token); setIsTokenListOpen(false); }} className="p-3 flex items-center gap-3 hover:bg-slate-700 cursor-pointer transition-colors border-b border-slate-700/50 last:border-0"><div className={`w-8 h-8 rounded-full ${token.icon} flex items-center justify-center`}><span className="font-bold text-[10px] text-white">{token.symbol}</span></div><div className="text-left"><p className="font-bold text-white text-sm">{token.name}</p><p className="text-[10px] text-slate-400">{token.type}</p></div>{selectedAsset.symbol === token.symbol && <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto" />}</div>))}</div>)}</div><div><div className="flex justify-between mb-2"><label className="text-xs font-semibold text-slate-400">Amount</label><span className="text-xs text-slate-500">Available: {selectedAsset.symbol === 'ETH' ? safeFormat(ethBalance?.formatted) : safeFormat(usdcBalance?.formatted, 2)} {selectedAsset.symbol}</span></div><input type="number" placeholder="0.00" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white text-lg focus:border-blue-500 outline-none" /></div><div><label className="text-xs font-semibold text-slate-400 mb-2 block">Recipient Address</label><input type="text" placeholder="0x..." value={sendRecipient} onChange={(e) => setSendRecipient(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white text-sm font-mono outline-none" /></div><div className="mt-auto pt-4">{isSendSuccess ? (<div className="bg-emerald-500/20 text-emerald-400 p-4 rounded-xl text-center mb-4"><CheckCircle className="w-6 h-6 mx-auto mb-2" /><p className="font-bold">Sent Successfully!</p></div>) : (<button onClick={handleSendFunds} disabled={isSending || !sendAmount || !sendRecipient} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2">{isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Preview transaction"}</button>)}</div></div></div>
                )}
              </>
            )}
            {/* ... other tabs ... */}
            <div className="bg-[#0f172a] border-t border-slate-800 p-2 flex justify-around items-center"><button onClick={() => { setActiveTab('wallets'); setWalletView('dashboard'); }} className={`flex flex-col items-center gap-1 p-2 rounded-xl w-20 transition-all ${activeTab === 'wallets' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}><Wallet className="w-5 h-5" /><span className="text-[10px] font-bold">Wallets</span></button><button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 p-2 rounded-xl w-20 transition-all ${activeTab === 'profile' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}><User className="w-5 h-5" /><span className="text-[10px] font-bold">Profile</span></button><button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 p-2 rounded-xl w-20 transition-all ${activeTab === 'settings' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}><Settings className="w-5 h-5" /><span className="text-[10px] font-bold">Settings</span></button></div>
          </div>
        </div>
      )}
      
      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center transform rotate-3 shadow-lg shadow-emerald-500/20"><Lock className="w-4 h-4 text-white" /></div><span className="text-xl font-bold tracking-tight">TrustLink</span></div>
        {authenticated ? (
          <div className="flex items-center gap-4">
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${isWrongNetwork ? "bg-red-500/10 border-red-500 text-red-400" : "bg-emerald-500/10 border-emerald-500 text-emerald-400"}`}>
              <Network className="w-3 h-3" />{chain?.name || "Sepolia"}
            </div>
            <div className="flex flex-col items-end mr-1 group relative">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">{user?.wallet?.connectorType === 'embedded' ? "Smart Wallet" : "Connected"}</span>
              <button onClick={() => setIsWalletModalOpen(true)} className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 -mr-2 rounded-lg transition-colors border border-transparent hover:border-emerald-500/30">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                <span className="font-mono text-sm font-bold text-white">{safeFormat(ethBalance?.formatted)} ETH</span>
                <Wallet className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              </button>
            </div>
            <button onClick={logout} className="bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-white p-2.5 rounded-full border border-white/10 transition-all ml-2"><LogOut className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={login} className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-full text-sm font-medium transition-all border border-white/5 backdrop-blur-sm">Log In / Sign Up</button>
        )}
      </nav>

      {/* MAIN */}
      <main className="flex flex-col items-center justify-center mt-10 px-4 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-emerald-200">Trust is no longer <br /><span className="text-white">a leap of faith.</span></h1>
        
        {/* DEPOSIT FORM */}
        <div className="w-full max-w-md bg-slate-800/50 border border-slate-700 p-8 rounded-2xl backdrop-blur-sm shadow-2xl relative z-10">
          {!authenticated ? <button onClick={login} className="w-full bg-emerald-500 hover:bg-emerald-400 py-3 rounded-xl font-bold transition-all">Connect Wallet</button> : (
            <div className="flex flex-col gap-4 text-left">
              {isWrongNetwork && <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg mb-2"><p className="text-yellow-400 text-xs font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Wallet on Wrong Network</p><button onClick={handleForceSwitch} className="text-yellow-400 underline text-xs mt-1">Switch to Sepolia</button></div>}
              <div className="relative"><button onClick={() => setIsTokenListOpen(!isTokenListOpen)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between text-white hover:border-slate-600 transition-all"><div className="flex items-center gap-2"><div className={`w-5 h-5 rounded-full ${selectedAsset.icon} flex items-center justify-center text-[8px] font-bold`}>{selectedAsset.symbol.slice(0,1)}</div><span>{selectedAsset.symbol}</span></div><ChevronDown className="w-4 h-4 text-slate-500" /></button>{isTokenListOpen && (<div className="absolute top-full left-0 right-0 mt-2 bg-[#1f2937] border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">{ASSETS.map((asset) => (<div key={asset.symbol} onClick={() => { setSelectedAsset(asset); setIsTokenListOpen(false); }} className="p-3 flex items-center gap-3 hover:bg-slate-700 cursor-pointer"><div className={`w-6 h-6 rounded-full ${asset.icon} flex items-center justify-center text-[10px]`}>{asset.symbol.slice(0,1)}</div><p className="font-bold text-white text-sm">{asset.name}</p></div>))}</div>)}</div>
              <div><label className="text-xs font-semibold text-slate-400 uppercase ml-1">Seller Address</label><input type="text" placeholder="0x..." value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white mt-1 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all" /></div>
              <div><label className="text-xs font-semibold text-slate-400 uppercase ml-1">Amount (1% Fee included)</label><input type="number" placeholder="0.00" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white mt-1 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all" /></div>
              <button onClick={handleCreateTransaction} disabled={isWriting || isConfirming || !sellerAddress || !amountInput} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-4 rounded-xl font-bold text-lg mt-2 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]">{(isWriting || isConfirming || isApproving) ? <Loader2 className="animate-spin" /> : (usdcAllowance !== undefined && selectedAsset.symbol === 'USDC' && BigInt(String(usdcAllowance)) < parseUnits(amountInput || "0", 6) ? "Approve USDC" : "Deposit & Lock Funds")}</button>
            </div>
          )}
        </div>

        {/* DASHBOARD */}
        <div className="w-full max-w-5xl mt-20 border-t border-white/10 pt-10 text-left flex flex-col md:flex-row gap-8">
          <div className="flex-1">
             <div className="flex gap-6 mb-6 border-b border-white/10 pb-1">
                <button onClick={() => setDashboardTab('buying')} className={`text-lg font-bold pb-4 border-b-2 transition-all ${dashboardTab === 'buying' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>I'm Buying</button>
                <button onClick={() => setDashboardTab('selling')} className={`text-lg font-bold pb-4 border-b-2 transition-all ${dashboardTab === 'selling' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>I'm Selling</button>
                <button onClick={handleRefresh} className="ml-auto text-slate-500 hover:text-white transition-colors" title="Refresh Data"><RefreshCcw className="w-5 h-5" /></button>
             </div>

             <div className="space-y-4">
               {(dashboardTab === 'buying' ? myBuyingOrders : mySellingOrders).map((order: any) => (
                 <div key={order.id} className={`bg-slate-800/40 border rounded-xl p-5 transition-all ${activeChatId === order.id ? 'border-emerald-500 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]' : 'border-slate-700 hover:border-slate-600'}`}>
                    <div className="flex justify-between items-start mb-4">
                       <div><div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold bg-slate-700 px-2 py-1 rounded text-slate-300">#{order.id}</span> <span className={`text-[10px] font-bold px-2 py-1 rounded ${order.statusColor}`}>{order.status}</span></div><p className="text-slate-400 text-xs">Counterparty: <span className="font-mono text-white">{dashboardTab === 'buying' ? order.seller.slice(0,6) : order.buyer.slice(0,6)}...</span></p></div>
                       <div className="text-right"><p className="font-bold text-lg text-white">{order.formattedLocked} <span className="text-sm text-slate-500">{order.symbol}</span></p><p className="text-xs text-slate-400">Total: {order.formattedTotal}</p></div>
                    </div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-4"><div className="bg-emerald-500 h-full transition-all" style={{ width: `${order.percentPaid}%` }}></div></div>
                    <div className="flex justify-between text-xs font-bold text-slate-400 mb-4"><span>Paid: {order.percentPaid}%</span><span>Locked: {100 - order.percentPaid}%</span></div>

                    <div className="flex gap-2 flex-wrap items-end">
                        <button onClick={() => setActiveChatId(order.id)} className={`flex-1 min-w-[80px] h-[42px] rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeChatId === order.id ? 'bg-slate-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}><MessageSquare className="w-3 h-3" /> Chat</button>
                        
                        {/* BUYER ACTIONS */}
                        {dashboardTab === 'buying' && !order.isCompleted && !order.isDisputed && (
                          <>
                             {/* Cancel only if not accepted */}
                             {!order.isAccepted && <button onClick={() => handleCancelOrder(order.id, order.isAccepted)} disabled={isWriting} className="bg-red-500 hover:bg-red-400 text-white px-4 h-[42px] rounded-lg text-xs font-bold transition-all">Cancel & Refund</button>}
                             
                             {/* Phase 1: Accepted but NOT Shipped (Custom Partial Release) */}
                             {order.isAccepted && !order.isShipped && (
                               <div className="flex flex-1 gap-2">
                                  <div className="relative flex-1">
                                    <input 
                                      type="number" 
                                      placeholder="0.00" 
                                      value={releaseInputs[order.id] || ''}
                                      onChange={(e) => setReleaseInputs(prev => ({...prev, [order.id]: e.target.value}))}
                                      className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-3 pr-12 h-[42px] text-xs text-white focus:border-emerald-500 outline-none"
                                    />
                                    <button 
                                      onClick={() => setReleaseInputs(prev => ({...prev, [order.id]: order.formattedLocked}))}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 uppercase font-bold"
                                    >
                                      Max
                                    </button>
                                  </div>
                                  <button onClick={() => handleCustomRelease(order.id, order.lockedBalance, order.symbol)} disabled={isWriting} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 h-[42px] rounded-lg text-xs font-bold transition-all">Release</button>
                                  <button onClick={() => handleRaiseDispute(order.id)} disabled={isWriting} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 px-3 h-[42px] rounded-lg transition-all"><AlertTriangle className="w-4 h-4" /></button>
                               </div>
                             )}

                             {/* Phase 2: Shipped (Final Release) */}
                             {order.isShipped && (
                               <>
                                 <button onClick={() => handleConfirmReceipt(order.id, order.lockedBalance)} disabled={isWriting} className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-white h-[42px] rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"><CheckCheck className="w-4 h-4" /> Confirm Receipt (100%)</button>
                                 <button onClick={() => handleRaiseDispute(order.id)} disabled={isWriting} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 px-3 h-[42px] rounded-lg transition-all"><AlertTriangle className="w-4 h-4" /></button>
                               </>
                             )}
                          </>
                        )}

                        {/* SELLER ACTIONS */}
                        {dashboardTab === 'selling' && !order.isCompleted && !order.isDisputed && (
                           <>
                              {!order.isAccepted && <button onClick={() => handleAcceptOrder(order.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white h-[42px] rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all"><ThumbsUp className="w-3 h-3" /> Accept (Free)</button>}
                              {order.isAccepted && !order.isShipped && <button onClick={() => handleMarkShipped(order.id)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white h-[42px] rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all"><Truck className="w-3 h-3" /> Mark Shipped</button>}
                              <button onClick={() => handleRaiseDispute(order.id)} disabled={isWriting} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 px-3 h-[42px] rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all"><AlertTriangle className="w-3 h-3" /></button>
                           </>
                        )}
                    </div>
                 </div>
               ))}
               {(dashboardTab === 'buying' ? myBuyingOrders : mySellingOrders).length === 0 && <div className="text-slate-500 text-center py-10 italic border border-dashed border-slate-700 rounded-xl">No active orders found.</div>}
             </div>
          </div>

          <div className="w-full md:w-80 bg-slate-800/50 border border-slate-700 rounded-2xl flex flex-col h-[500px] overflow-hidden sticky top-10">
              <div className="p-4 border-b border-slate-700 bg-slate-800 flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><p className="font-bold text-sm text-white">Live Chat</p></div>{activeChatId && <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300 border border-slate-600">Order #{activeChatId}</span>}</div>
              <div className="flex-1 bg-[#0f172a]/50 relative">
                 {!activeChatId ? (
                   <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50 p-6 text-center"><MessageSquare className="w-10 h-10 mb-2" /><p className="text-sm font-bold">Select an order</p><p className="text-xs">Click "Chat" on an order to open the encrypted channel.</p></div>
                 ) : (
                   <ChatBox peerAddress={dashboardTab === 'buying' ? myBuyingOrders.find((o: any) => o.id === activeChatId)?.seller : mySellingOrders.find((o: any) => o.id === activeChatId)?.buyer} />
                 )}
              </div>
          </div>
        </div>
      </main>
    </div>
  );
}
'use client';

// ==========================================
// 1. IMPORTS & CONFIGURATION
// ==========================================
import { usePrivy } from '@privy-io/react-auth';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts, useAccount, useSwitchChain, useBalance, useSendTransaction } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { parseEther, formatEther } from 'viem';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from './constants';
import React, { useEffect, useState, useMemo } from 'react';
import { 
  Shield, Lock, LogOut, Loader2, RefreshCcw, CheckCircle, AlertTriangle, 
  Network, Copy, Wallet, Plus, X, ArrowDownLeft, ArrowUpRight, ArrowLeft, 
  ChevronDown, User, Settings, Chrome, Twitter, MessageSquare, 
  Link as LinkIcon, Key, Eye, Fingerprint, Check, ShoppingBag, Truck, Undo2, 
  RotateCw 
} from 'lucide-react';

// --- ASSET CONFIGURATION ---
const ASSETS = [
  { 
    symbol: 'ETH', 
    name: 'Ethereum', 
    type: 'native', 
    icon: 'bg-slate-700', 
    address: undefined 
  },
  { 
    symbol: 'USDC', 
    name: 'USD Coin', 
    type: 'erc20', 
    icon: 'bg-blue-600', 
    // Official Sepolia USDC Address
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' 
  },
];

// --- UTILITY: Safe Number Formatting (Prevents NaN) ---
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
  const { 
    login, authenticated, user, logout, ready, createWallet, exportWallet,
    linkGoogle, linkTwitter, linkDiscord, linkPasskey,
    unlinkGoogle, unlinkTwitter, unlinkDiscord, unlinkPasskey
  } = usePrivy();

  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  // ==========================================
  // 3. STATE
  // ==========================================
  // Core App
  const [sellerAddress, setSellerAddress] = useState('');
  const [ethAmount, setEthAmount] = useState('');
  const [txHash, setTxHash] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'buying' | 'selling'>('buying'); 
  
  // Modal Navigation
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'wallets' | 'profile' | 'settings'>('wallets');
  const [walletView, setWalletView] = useState<'dashboard' | 'send'>('dashboard');
  
  // Transaction Form
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [isTokenListOpen, setIsTokenListOpen] = useState(false);
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');

  // Hydration Fix
  useEffect(() => setIsMounted(true), []);

  // Network Check
  const currentChainId = chain?.id;
  const isWrongNetwork = authenticated && chain && currentChainId !== sepolia.id;

  // Helper: Get Address
  const getUserAddress = () => {
    if (!user) return null;
    return user.wallet?.address || 
           user.linkedAccounts.find((a) => a.type === 'wallet' || a.type === 'embedded_wallet' as any)?.address || 
           null;
  };
  const userAddress = getUserAddress();
  const isEmbeddedWallet = user?.wallet?.connectorType === 'embedded';

  // Linked Accounts
  const googleAccount = user?.linkedAccounts.find((a) => a.type === 'google_oauth');
  const twitterAccount = user?.linkedAccounts.find((a) => a.type === 'twitter_oauth');
  const discordAccount = user?.linkedAccounts.find((a) => a.type === 'discord_oauth');
  const passkeyAccount = user?.linkedAccounts.find((a) => a.type === 'passkey');

  // ==========================================
  // 4. DATA FETCHING (AUTO-UPDATING)
  // ==========================================

  // --- 1. Fetch ETH Balance ---
  const { data: ethBalance, refetch: refetchEth, isLoading: ethLoading } = useBalance({
    address: userAddress as `0x${string}`,
    query: { enabled: !!userAddress, refetchInterval: 3000 } // Auto-update every 3s
  });

  // --- 2. Fetch USDC Balance ---
  const { data: usdcBalance, refetch: refetchUsdc, isLoading: usdcLoading } = useBalance({
    address: userAddress as `0x${string}`,
    token: ASSETS[1].address as `0x${string}`,
    query: { enabled: !!userAddress, refetchInterval: 3000 }
  });

  // --- 3. Compute Display Balance ---
  // This logic decides what big number to show on the dashboard card
  const displayBalance = useMemo(() => {
    if (selectedAsset.symbol === 'ETH') {
      return ethLoading ? "..." : safeFormat(ethBalance?.formatted);
    } else {
      return usdcLoading ? "..." : safeFormat(usdcBalance?.formatted, 2);
    }
  }, [selectedAsset, ethBalance, usdcBalance, ethLoading, usdcLoading]);

  // --- 4. Fetch Order History ---
  const { data: totalEscrows } = useReadContract({ abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrowCount' });
  const count = totalEscrows ? Number(totalEscrows) : 0;

  // Build index list (Last 10 items)
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
      args: [BigInt(id)],
    })),
    query: { refetchInterval: 3000 }
  });

  // Sort Orders
  const { myBuyingOrders, mySellingOrders } = useMemo(() => {
    const buying: any[] = [];
    const selling: any[] = [];
    
    if (escrowsData && userAddress) {
      escrowsData.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const escrow = result.result as any;
          const order = {
            id: indexesToFetch[index],
            buyer: String(escrow[0]),
            seller: String(escrow[1]),
            amount: escrow[2],
            isFunded: escrow[3],
            isCompleted: escrow[4],
            isDisputed: escrow[5]
          };
          if (order.buyer.toLowerCase() === userAddress.toLowerCase()) buying.push(order);
          if (order.seller.toLowerCase() === userAddress.toLowerCase()) selling.push(order);
        }
      });
    }
    return { myBuyingOrders: buying, mySellingOrders: selling };
  }, [escrowsData, userAddress, indexesToFetch]);

  // ==========================================
  // 5. BLOCKCHAIN ACTIONS
  // ==========================================
  
  const { writeContract, isPending: isWriting, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash as `0x${string}` });
  const { sendTransaction, isPending: isSending, isSuccess: isSendSuccess } = useSendTransaction();

  const handleRefresh = () => {
    refetchEth();
    refetchUsdc();
    refetchOrders();
  };

  const handleForceSwitch = async () => {
    try { switchChain({ chainId: sepolia.id }); } 
    catch (e) { alert("Please open your wallet and manually switch to Sepolia."); }
  };

  const handleCreateTransaction = () => {
    if (isWrongNetwork) { handleForceSwitch(); return; }
    if (!sellerAddress || !ethAmount) return;
    writeContract({
      address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'createEscrow', args: [sellerAddress], value: parseEther(ethAmount)
    }, { onSuccess: (hash) => setTxHash(hash) });
  };

  const handleRelease = (id: number) => {
    writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'releaseFunds', args: [BigInt(id)] });
  };

  const handleRefund = (id: number) => {
    writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'refundBuyer', args: [BigInt(id)] });
  };

  const handleSendFunds = () => {
     if (!sendRecipient || !sendAmount) return;
     if (selectedAsset.symbol === 'ETH') {
       sendTransaction({ to: sendRecipient as `0x${string}`, value: parseEther(sendAmount) });
     } else {
       alert("USDC sending enabled in Phase 2!");
     }
  };

  const copyAddress = () => {
    if (userAddress) { navigator.clipboard.writeText(userAddress); alert("Address Copied!"); }
  };

  // ==========================================
  // 6. RENDER
  // ==========================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white font-sans selection:bg-green-500/30 pb-20 relative">
      
      {/* --- MODAL --- */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#111827] border border-slate-700 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden relative min-h-[600px] flex flex-col transition-all">
            
            {/* WALLETS TAB */}
            {activeTab === 'wallets' && (
              <>
                {walletView === 'dashboard' ? (
                  <>
                    {/* Header */}
                    <div className="p-6 pb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold shadow-lg shadow-blue-900/20">
                          {user?.email?.address?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{user?.email?.address || "User"}</p>
                          <p className="text-[10px] text-slate-400 font-mono tracking-wide">
                            {userAddress ? `${userAddress.slice(0,6)}...${userAddress.slice(-4)}` : "No Address"}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setIsWalletModalOpen(false)} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 transition-colors"><X className="w-4 h-4 text-slate-400" /></button>
                    </div>

                    {/* Balance Card */}
                    <div className="mx-6 p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-10"><Wallet className="w-24 h-24 text-white" /></div>
                      <div className="flex items-center justify-center gap-2 mb-1">
                         <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Balance</p>
                         <button onClick={handleRefresh} className="text-slate-500 hover:text-white"><RotateCw className={`w-3 h-3 ${ethLoading ? 'animate-spin' : ''}`} /></button>
                      </div>
                      <h2 className="text-4xl font-extrabold text-white tracking-tight">
                        {displayBalance} <span className="text-lg text-slate-500">{selectedAsset.symbol}</span>
                      </h2>
                      <div className="mt-6 flex gap-3">
                        <button onClick={copyAddress} className="flex-1 bg-white/10 hover:bg-white/20 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all"><ArrowDownLeft className="w-4 h-4" /> Deposit</button>
                        <button onClick={() => setWalletView('send')} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-lg shadow-blue-900/20"><ArrowUpRight className="w-4 h-4" /> Send</button>
                      </div>
                    </div>

                    {/* Asset List (MANUAL MODE - Explicit Rows) */}
                    <div className="flex-1 px-6 pt-6 overflow-y-auto">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">My Assets</p>
                      <div className="space-y-3">
                        
                        {/* 1. ETHEREUM ROW */}
                        <div onClick={() => setSelectedAsset(ASSETS[0])} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedAsset.symbol === 'ETH' ? 'bg-slate-800 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-[10px]">ETH</div>
                            <div><p className="text-sm font-bold text-white">Ethereum</p><p className="text-[10px] text-slate-500">Sepolia</p></div>
                          </div>
                          <div className="text-right">
                            {/* SAFE FORMAT USED HERE */}
                            <p className="text-sm font-bold text-white">{ethLoading ? "..." : safeFormat(ethBalance?.formatted)}</p>
                            <p className="text-[10px] text-slate-500">{ethLoading ? "..." : "$0.00"}</p>
                          </div>
                        </div>

                        {/* 2. USDC ROW */}
                        <div onClick={() => setSelectedAsset(ASSETS[1])} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedAsset.symbol === 'USDC' ? 'bg-slate-800 border-emerald-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-[10px]">USD</div>
                            <div><p className="text-sm font-bold text-white">USDC</p><p className="text-[10px] text-slate-500">Stablecoin</p></div>
                          </div>
                          <div className="text-right">
                            {/* SAFE FORMAT USED HERE */}
                            <p className="text-sm font-bold text-white">{usdcLoading ? "..." : safeFormat(usdcBalance?.formatted, 2)}</p>
                            <p className="text-[10px] text-slate-500">{usdcLoading ? "..." : "$0.00"}</p>
                          </div>
                        </div>

                      </div>
                    </div>
                  </>
                ) : (
                  // SEND FORM
                  <div className="flex flex-col h-full">
                    <div className="p-6 pb-2 flex items-center justify-between"><button onClick={() => setWalletView('dashboard')} className="text-slate-400 hover:text-white transition-colors"><ArrowLeft className="w-6 h-6" /></button><h3 className="text-lg font-bold text-white">Send {selectedAsset.symbol}</h3><div className="w-6" /></div>
                    <div className="p-6 flex flex-col gap-6 flex-1">
                      <div className="relative"><label className="text-xs font-semibold text-slate-400 mb-2 block">Select Asset</label><button onClick={() => setIsTokenListOpen(!isTokenListOpen)} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 flex items-center justify-between hover:border-slate-600 transition-all"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full ${selectedAsset.icon} flex items-center justify-center`}><span className="font-bold text-[10px] text-white">{selectedAsset.symbol}</span></div><span className="font-bold text-white">{selectedAsset.name}</span></div><ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isTokenListOpen ? 'rotate-180' : ''}`} /></button>{isTokenListOpen && (<div className="absolute top-full left-0 right-0 mt-2 bg-[#1f2937] border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden animate-fade-in-up">{ASSETS.map((token) => (<div key={token.symbol} onClick={() => { setSelectedAsset(token); setIsTokenListOpen(false); }} className="p-3 flex items-center gap-3 hover:bg-slate-700 cursor-pointer transition-colors border-b border-slate-700/50 last:border-0"><div className={`w-8 h-8 rounded-full ${token.icon} flex items-center justify-center`}><span className="font-bold text-[10px] text-white">{token.symbol}</span></div><div className="text-left"><p className="font-bold text-white text-sm">{token.name}</p><p className="text-[10px] text-slate-400">{token.type}</p></div>{selectedAsset.symbol === token.symbol && <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto" />}</div>))}</div>)}</div>
                      <div><div className="flex justify-between mb-2"><label className="text-xs font-semibold text-slate-400">Amount</label><span className="text-xs text-slate-500">Available: {displayBalance}</span></div><input type="number" placeholder="0.00" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white text-lg focus:border-blue-500 outline-none" /></div>
                      <div><label className="text-xs font-semibold text-slate-400 mb-2 block">Recipient Address</label><input type="text" placeholder="0x..." value={sendRecipient} onChange={(e) => setSendRecipient(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white text-sm font-mono outline-none" /></div>
                      <div className="mt-auto pt-4">{isSendSuccess ? (<div className="bg-emerald-500/20 text-emerald-400 p-4 rounded-xl text-center mb-4"><CheckCircle className="w-6 h-6 mx-auto mb-2" /><p className="font-bold">Sent Successfully!</p></div>) : (<button onClick={handleSendFunds} disabled={isSending || !sendAmount || !sendRecipient} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2">{isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Preview transaction"}</button>)}</div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* PROFILE & SETTINGS TABS (Preserved) */}
            {activeTab === 'profile' && (
              <div className="flex flex-col h-full bg-[#111827]">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center"><h3 className="text-xl font-bold text-white">Profile</h3><button onClick={() => setIsWalletModalOpen(false)} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700"><X className="w-4 h-4 text-slate-400" /></button></div>
                <div className="p-6 flex-1 overflow-y-auto">
                  <div className="bg-slate-800/50 rounded-2xl p-4 mb-6 border border-slate-700"><p className="text-xs text-slate-400 uppercase font-bold mb-1">User</p><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><p className="text-white font-mono text-sm">{user?.email?.address || "No Email"}</p></div></div>
                  <p className="text-sm font-bold text-slate-400 mb-4">Linked Accounts</p>
                  <div className="space-y-3">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white"><Chrome className="w-4 h-4" /></div><div><p className="text-sm font-bold text-white">Google</p><p className="text-xs text-slate-500">{googleAccount ? googleAccount.email : "Not linked"}</p></div></div>{googleAccount ? <span className="text-emerald-500"><LinkIcon className="w-4 h-4" /></span> : <button onClick={linkGoogle} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-white font-bold border border-slate-700 transition-all">+ Connect</button>}</div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white"><Twitter className="w-4 h-4" /></div><div><p className="text-sm font-bold text-white">X</p><p className="text-xs text-slate-500">{twitterAccount ? twitterAccount.username : "Not linked"}</p></div></div>{twitterAccount ? <span className="text-emerald-500"><LinkIcon className="w-4 h-4" /></span> : <button onClick={linkTwitter} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-white font-bold border border-slate-700 transition-all">+ Connect</button>}</div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white"><MessageSquare className="w-4 h-4" /></div><div><p className="text-sm font-bold text-white">Discord</p><p className="text-xs text-slate-500">{discordAccount ? discordAccount.username : "Not linked"}</p></div></div>{discordAccount ? <span className="text-emerald-500"><LinkIcon className="w-4 h-4" /></span> : <button onClick={linkDiscord} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-white font-bold border border-slate-700 transition-all">+ Connect</button>}</div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="flex flex-col h-full bg-[#111827]">
                 <div className="p-6 border-b border-slate-800 flex justify-between items-center"><h3 className="text-xl font-bold text-white">Settings</h3><button onClick={() => setIsWalletModalOpen(false)} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700"><X className="w-4 h-4 text-slate-400" /></button></div>
                <div className="p-6 flex-1 text-left overflow-y-auto">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Security</p>
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl mb-4">
                    <div className="flex items-center gap-3 mb-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${passkeyAccount ? "bg-emerald-500/10" : "bg-purple-500/10"}`}><Fingerprint className={`w-5 h-5 ${passkeyAccount ? "text-emerald-500" : "text-purple-500"}`} /></div><div><div className="flex items-center gap-2"><p className="text-white font-bold text-sm">Passkey</p>{passkeyAccount && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">Active</span>}</div><p className="text-slate-500 text-xs mt-0.5">Biometric Security (FaceID/TouchID)</p></div></div>
                    {passkeyAccount ? (<div className="w-full bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center justify-center gap-2 text-emerald-400 text-sm font-bold"><Check className="w-4 h-4" /> Protected</div>) : (<button onClick={linkPasskey} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all"><Plus className="w-4 h-4" />Add Passkey</button>)}
                  </div>
                  {isEmbeddedWallet && (<div className={`bg-slate-900 border border-slate-800 p-5 rounded-xl transition-all ${!passkeyAccount ? "opacity-75 grayscale-[0.5]" : ""}`}><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><Key className="w-5 h-5 text-red-500" /></div><div><p className="text-white font-bold text-sm">Secrets</p><p className="text-slate-500 text-xs">Reveal Private Key (Requires Passkey).</p></div></div><button onClick={() => exportWallet()} disabled={!passkeyAccount} className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all"><Eye className="w-4 h-4" />{passkeyAccount ? "Reveal Private Key" : "Add Passkey First"}</button></div>)}
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 mt-8">App Info</p><p className="text-slate-600 text-sm">TrustLink v1.0.0</p>
                </div>
              </div>
            )}

            {/* NAV BAR */}
            <div className="bg-[#0f172a] border-t border-slate-800 p-2 flex justify-around items-center"><button onClick={() => { setActiveTab('wallets'); setWalletView('dashboard'); }} className={`flex flex-col items-center gap-1 p-2 rounded-xl w-20 transition-all ${activeTab === 'wallets' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}><Wallet className="w-5 h-5" /><span className="text-[10px] font-bold">Wallets</span></button><button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 p-2 rounded-xl w-20 transition-all ${activeTab === 'profile' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}><User className="w-5 h-5" /><span className="text-[10px] font-bold">Profile</span></button><button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 p-2 rounded-xl w-20 transition-all ${activeTab === 'settings' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}><Settings className="w-5 h-5" /><span className="text-[10px] font-bold">Settings</span></button></div>
          </div>
        </div>
      )}
      
      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center transform rotate-3 shadow-lg shadow-emerald-500/20"><Lock className="w-4 h-4 text-white" /></div><span className="text-xl font-bold tracking-tight">TrustLink</span></div>
        {authenticated ? (<div className="flex items-center gap-4"><div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${isWrongNetwork ? "bg-red-500/10 border-red-500 text-red-400" : "bg-emerald-500/10 border-emerald-500 text-emerald-400"}`}><Network className="w-3 h-3" />{chain?.name || "Sepolia"}</div><div className="flex flex-col items-end mr-1 group relative"><span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">{user?.wallet?.connectorType === 'embedded' ? "Smart Wallet" : "Connected"}</span><button onClick={() => setIsWalletModalOpen(true)} className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 -mr-2 rounded-lg transition-colors border border-transparent hover:border-emerald-500/30"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div><span className="font-mono text-sm font-bold text-white">{safeFormat(ethBalance?.formatted)} ETH</span><Wallet className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" /></button></div><button onClick={logout} className="bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-white p-2.5 rounded-full border border-white/10 transition-all ml-2"><LogOut className="w-4 h-4" /></button></div>) : (<button onClick={login} className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-full text-sm font-medium transition-all border border-white/5 backdrop-blur-sm">Log In / Sign Up</button>)}
      </nav>

      {/* MAIN */}
      <main className="flex flex-col items-center justify-center mt-10 px-4 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-emerald-200">Trust is no longer <br /><span className="text-white">a leap of faith.</span></h1>
        
        {/* DEPOSIT FORM */}
        <div className="w-full max-w-md bg-slate-800/50 border border-slate-700 p-8 rounded-2xl backdrop-blur-sm shadow-2xl relative z-10">
          {!isMounted ? (<div className="text-slate-500 py-10">Loading...</div>) : !authenticated ? (<div className="text-center py-6"><p className="text-slate-400 mb-6">Sign in to access your secure dashboard.</p><button onClick={login} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20">Connect Wallet / Email</button></div>) : isSuccess ? (<div className="text-center py-6"><Shield className="w-16 h-16 text-emerald-400 mx-auto mb-4" /><h3 className="text-2xl font-bold text-white mb-2">Funds Secured!</h3><button onClick={() => { setTxHash(''); setEthAmount(''); setSellerAddress(''); }} className="text-emerald-400 font-medium hover:text-emerald-300">Start Another Transaction</button></div>) : (
            <div className="flex flex-col gap-4 text-left">
              {!userAddress && authenticated && ready && (<div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg mb-2 text-center"><p className="text-blue-400 text-sm font-bold mb-2">Wallet Setup Required</p><button onClick={() => createWallet()} className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 mx-auto"><Plus className="w-4 h-4" />Create Embedded Wallet</button></div>)}
              {isWrongNetwork && (<div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg mb-2"><p className="text-yellow-400 text-xs font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Wallet on Wrong Network</p><button onClick={handleForceSwitch} className="text-yellow-400 underline text-xs mt-1">Switch to Sepolia</button></div>)}
              <div><label className="text-xs font-semibold text-slate-400 uppercase ml-1">Seller Address</label><input type="text" placeholder="0x..." value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white mt-1 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all" /></div>
              <div><label className="text-xs font-semibold text-slate-400 uppercase ml-1">Amount (ETH)</label><input type="number" placeholder="0.0" value={ethAmount} onChange={(e) => setEthAmount(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white mt-1 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all" /></div>
              <button onClick={handleCreateTransaction} disabled={isWriting || isConfirming || !sellerAddress || !ethAmount || !userAddress || isWrongNetwork} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-4 rounded-xl font-bold text-lg mt-2 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]">{(isWriting || isConfirming) ? <Loader2 className="animate-spin" /> : "Deposit & Lock Funds"}</button>
              {writeError && <p className="text-red-400 text-xs text-center mt-2">Transaction Failed.</p>}
            </div>
          )}
        </div>

        {/* DASHBOARD */}
        <div className="w-full max-w-4xl mt-20 border-t border-white/10 pt-10 text-left">
          <div className="flex items-center gap-6 mb-8 border-b border-white/10 pb-1">
             <button onClick={() => setDashboardTab('buying')} className={`text-lg font-bold pb-4 border-b-2 transition-all flex items-center gap-2 ${dashboardTab === 'buying' ? 'text-emerald-400 border-emerald-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}><ShoppingBag className="w-5 h-5" />I'm Buying</button>
             <button onClick={() => setDashboardTab('selling')} className={`text-lg font-bold pb-4 border-b-2 transition-all flex items-center gap-2 ${dashboardTab === 'selling' ? 'text-blue-400 border-blue-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}><Truck className="w-5 h-5" />I'm Selling</button>
             <button onClick={handleRefresh} className="ml-auto text-slate-500 hover:text-white transition-colors" title="Refresh Data"><RefreshCcw className="w-5 h-5" /></button>
          </div>

          {dashboardTab === 'buying' && (
            <div className="space-y-4 animate-fade-in">
              {myBuyingOrders.length > 0 ? (
                myBuyingOrders.map((order: any) => (
                  <div key={order.id} className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-emerald-500/30 transition-all">
                    <div className="flex-1"><div className="flex items-center gap-3 mb-2"><span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">Order #{order.id}</span><span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wide ${order.isCompleted ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}>{order.isCompleted ? "Completed" : "Funds Locked"}</span></div><p className="text-slate-300 text-sm">Seller: <span className="font-mono text-slate-500">{order.seller.slice(0,6)}...{order.seller.slice(-4)}</span></p><p className="text-slate-300 text-sm">Amount: <span className="font-bold text-white">{formatEther(order.amount)} ETH</span></p></div>
                    {!order.isCompleted && (<button onClick={() => handleRelease(order.id)} disabled={isWriting} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50">{isWriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Release Funds</button>)}
                  </div>
                ))
              ) : (<div className="text-slate-500 italic py-8 text-center bg-slate-800/20 rounded-xl border border-dashed border-slate-700">You haven't created any orders yet.</div>)}
            </div>
          )}

          {dashboardTab === 'selling' && (
            <div className="space-y-4 animate-fade-in">
              {mySellingOrders.length > 0 ? (
                mySellingOrders.map((order: any) => (
                  <div key={order.id} className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-blue-500/30 transition-all">
                    <div className="flex-1"><div className="flex items-center gap-3 mb-2"><span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">Sale #{order.id}</span><span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wide ${order.isCompleted ? "bg-emerald-500/20 text-emerald-400" : "bg-green-500/20 text-green-400"}`}>{order.isCompleted ? "Paid out" : "Ready to Ship"}</span></div><p className="text-slate-300 text-sm">Buyer: <span className="font-mono text-slate-500">{order.buyer.slice(0,6)}...{order.buyer.slice(-4)}</span></p><p className="text-slate-500 text-xs mt-1">Status: {order.isCompleted ? "Funds received in your wallet." : "Funds are locked. Safe to deliver item."}</p></div>
                    {!order.isCompleted && (<button onClick={() => handleRefund(order.id)} disabled={isWriting} className="bg-slate-700 hover:bg-red-500/20 hover:text-red-400 text-slate-300 border border-slate-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50">{isWriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Refund Buyer</button>)}
                  </div>
                ))
              ) : (<div className="text-slate-500 italic py-8 text-center bg-slate-800/20 rounded-xl border border-dashed border-slate-700">No incoming orders found.</div>)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
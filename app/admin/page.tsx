'use client';

// ==========================================
// 1. IMPORTS
// ==========================================
import OrderCard from '@/components/OrderCard';
import WalletModal from '@/components/WalletModal';
import { usePrivy } from '@privy-io/react-auth';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts, useAccount, useSwitchChain, useBalance } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { parseUnits, formatEther, formatUnits } from 'viem';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/app/constants';
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { 
  Lock, LogOut, Loader2, RefreshCcw, AlertTriangle, Network, Wallet, 
  ChevronDown, X, CheckCircle2 
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

export default function Home() {
  // ==========================================
  // 2. STATE & HOOKS
  // ==========================================
  const { login, authenticated, user, logout } = usePrivy();
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  const [sellerAddress, setSellerAddress] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [dbOrders, setDbOrders] = useState<Record<number, any>>({});
  const [dashboardTab, setDashboardTab] = useState<'buying' | 'selling'>('buying'); 
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [isTokenListOpen, setIsTokenListOpen] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  // Blockchain Transaction State
  const { writeContract, data: txHash, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Clear toast after 4s
  useEffect(() => { if (notification) { const t = setTimeout(() => setNotification(null), 4000); return () => clearTimeout(t); } }, [notification]);
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => setNotification({ message, type });

  // Handle Transaction Success
  useEffect(() => {
    if (isSuccess) {
        showToast("Transaction Confirmed!", 'success');
        setSellerAddress('');
        setAmountInput('');
        handleRefresh();
    }
  }, [isSuccess]);

  const userAddress = user?.wallet?.address;
  const isWrongNetwork = authenticated && chain && chain.id !== sepolia.id;

  // ==========================================
  // 3. DATA FETCHING
  // ==========================================
  const fetchDbOrders = async () => {
    const { data } = await supabase.from('escrow_orders').select('*');
    if (data) {
      const map: Record<number, any> = {};
      data.forEach((row: any) => { map[row.id] = row; });
      setDbOrders(map);
    }
  };
  
  useEffect(() => { fetchDbOrders(); }, []);

  // Balances
  const { data: ethBalance, refetch: refetchEth } = useBalance({ address: userAddress as `0x${string}` });
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: ASSETS[1].address as `0x${string}`, abi: ERC20_ABI, functionName: 'allowance',
    args: userAddress ? [userAddress as `0x${string}`, CONTRACT_ADDRESS as `0x${string}`] : undefined,
    query: { enabled: !!userAddress && selectedAsset.symbol === 'USDC' }
  });

  // Fetch Orders from Contract
  const { data: totalEscrows } = useReadContract({ abi: CONTRACT_ABI, address: CONTRACT_ADDRESS, functionName: 'escrowCount' });
  const count = totalEscrows ? Number(totalEscrows) : 0;
  
  // Get last 10 orders
  const indexesToFetch = useMemo(() => {
    const idxs = [];
    for (let i = count; i > 0 && i > count - 10; i--) idxs.push(i);
    return idxs;
  }, [count]);

  const { data: escrowsData, refetch: refetchOrders } = useReadContracts({
    contracts: indexesToFetch.map((id) => ({ 
    abi: CONTRACT_ABI, 
    address: CONTRACT_ADDRESS as `0x${string}`, 
    functionName: 'escrows', 
    args: [BigInt(id)] 
})),
    query: { refetchInterval: 5000 }
  });

  const handleRefresh = () => { refetchEth(); refetchOrders(); refetchAllowance(); fetchDbOrders(); };

  // Parse Orders
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

  // ==========================================
  // 4. MAIN ACTIONS (DEPOSIT)
  // ==========================================
  const handleCreateTransaction = async () => {
    if (isWrongNetwork) { switchChain({ chainId: sepolia.id }); return; }
    if (!sellerAddress || !amountInput) return;
    try {
      const isEth = selectedAsset.symbol === 'ETH';
      const amountWei = parseUnits(amountInput, isEth ? 18 : 6);

      // Approve USDC if needed
      if (!isEth) {
        const currentAllowance = usdcAllowance ? BigInt(String(usdcAllowance)) : BigInt(0);
        if (currentAllowance < amountWei) {
          writeContract({ address: selectedAsset.address as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACT_ADDRESS as `0x${string}`, amountWei] });
          showToast("Approval Request Sent...", 'info');
          return;
        }
      }
      // Create Escrow
      writeContract({ 
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'createEscrow', 
        args: [sellerAddress, selectedAsset.address, amountWei], 
        value: isEth ? amountWei : BigInt(0) 
      });
      showToast("Deposit Request Sent...", 'info');
    } catch (err: any) { showToast("Error: " + err.message, 'error'); }
  };

  // ==========================================
  // 5. RENDER
  // ==========================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white font-sans pb-20 relative">
      <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />

      {/* TOAST */}
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
        <div className="w-full max-w-md bg-slate-800/50 border border-slate-700 p-8 rounded-2xl backdrop-blur-sm shadow-2xl relative z-10">
            {!authenticated ? <button onClick={login} className="w-full bg-emerald-500 hover:bg-emerald-400 py-3 rounded-xl font-bold">Connect Wallet</button> : (
            <div className="flex flex-col gap-4">
                <div className="relative">
                    <button onClick={() => setIsTokenListOpen(!isTokenListOpen)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 flex justify-between items-center">
                        <div className="flex items-center gap-2"><div className={`w-5 h-5 rounded-full ${selectedAsset.icon} flex items-center justify-center text-[8px]`}>{selectedAsset.symbol[0]}</div><span>{selectedAsset.symbol}</span></div>
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                    </button>
                    {isTokenListOpen && <div className="absolute top-full w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl z-20 overflow-hidden">{ASSETS.map(a => <div key={a.symbol} onClick={() => { setSelectedAsset(a); setIsTokenListOpen(false); }} className="p-3 hover:bg-slate-700 cursor-pointer flex gap-3"><div className={`w-6 h-6 rounded-full ${a.icon} flex items-center justify-center text-[10px]`}>{a.symbol[0]}</div>{a.name}</div>)}</div>}
                </div>
                <div><label className="text-xs text-slate-400 ml-1">SELLER ADDRESS</label><input value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} placeholder="0x..." className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500" /></div>
                <div><label className="text-xs text-slate-400 ml-1">AMOUNT</label><input type="number" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} placeholder="0.00" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 mt-1 outline-none focus:border-emerald-500" /></div>
                
                <button onClick={handleCreateTransaction} disabled={isWriting || isConfirming || !sellerAddress || !amountInput} className="w-full bg-emerald-500 hover:bg-emerald-400 py-4 rounded-xl font-bold mt-2 disabled:opacity-50">
                    {(isWriting || isConfirming) ? <Loader2 className="animate-spin mx-auto" /> : "Deposit & Lock Funds"}
                </button>
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
import { usePrivy } from '@privy-io/react-auth';
import { useBalance, useSendTransaction, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { X, Copy, LogOut, Key, AlertTriangle, Wallet, RefreshCw, Send, ChevronLeft, Loader2, ArrowDown } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { formatEther, formatUnits, parseEther, parseUnits, isAddress } from 'viem';

type Tab = 'wallets' | 'profile' | 'settings';
type View = 'list' | 'send';

// CONSTANTS
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; 
const MOCK_ETH_PRICE = 2800; 

// ABI for sending USDC
const ERC20_ABI = [
  { inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'transfer', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' }
];

export default function WalletModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, logout, linkGoogle, linkTwitter, linkEmail, unlinkGoogle, unlinkTwitter, unlinkEmail, exportWallet } = usePrivy();
  
  // FIX 1: Safe Address Handling (Handle undefined)
  const address = user?.wallet?.address as `0x${string}` | undefined;
  
  // State
  const [activeTab, setActiveTab] = useState<Tab>('wallets');
  const [walletView, setWalletView] = useState<View>('list');
  
  // Send Form State
  const [sendToken, setSendToken] = useState<'ETH' | 'USDC'>('ETH');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  // FIX 2: Chain Guard
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongNetwork = chainId !== sepolia.id;

  // 1. Fetch Balances (Only if address exists)
  const { data: ethBalance, refetch: refetchEth } = useBalance({ 
    address, 
    query: { enabled: !!address } 
  });
  
  const { data: usdcBalance, refetch: refetchUsdc } = useBalance({ 
    address, 
    token: USDC_ADDRESS as `0x${string}`,
    query: { enabled: !!address } 
  });

  // 2. Transaction Hooks
  const { sendTransaction, data: ethHash, isPending: isSendingEth, error: ethError, reset: resetEth } = useSendTransaction();
  const { writeContract, data: tokenHash, isPending: isSendingToken, error: tokenError, reset: resetToken } = useWriteContract();
  
  const txHash = sendToken === 'ETH' ? ethHash : tokenHash;
  const txError = sendToken === 'ETH' ? ethError : tokenError;
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // 3. Totals Calculation
  const totalValueUSD = useMemo(() => {
    const ethQty = ethBalance ? parseFloat(formatEther(ethBalance.value)) : 0;
    const usdcQty = usdcBalance ? parseFloat(formatUnits(usdcBalance.value, 6)) : 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((ethQty * MOCK_ETH_PRICE) + usdcQty);
  }, [ethBalance, usdcBalance]);

  // Reset on success
  useEffect(() => {
    if (isSuccess) {
      alert("Transaction Sent Successfully!");
      setAmount('');
      setRecipient('');
      setWalletView('list');
      resetEth();
      resetToken();
      refetchEth();
      refetchUsdc();
    }
  }, [isSuccess]);

  if (!isOpen) return null;

  // Actions
  const handleCopy = () => { if (address) { navigator.clipboard.writeText(address); alert("Address copied!"); } };
  const refreshBalances = () => { refetchEth(); refetchUsdc(); };
  
  // FIX 3: Max Button Logic
  const handleMax = () => {
    if (sendToken === 'ETH' && ethBalance) {
        // Leave a tiny bit for gas (0.0001 ETH)
        const val = parseFloat(ethBalance.formatted) - 0.0001;
        setAmount(val > 0 ? val.toString() : '0');
    }
    if (sendToken === 'USDC' && usdcBalance) {
        setAmount(usdcBalance.formatted);
    }
  };

  const handleSend = () => {
    if (isWrongNetwork) { switchChain({ chainId: sepolia.id }); return; }
    if (!isAddress(recipient) || !amount) return;
    
    try {
      if (sendToken === 'ETH') {
        sendTransaction({ to: recipient as `0x${string}`, value: parseEther(amount) });
      } else {
        writeContract({
          address: USDC_ADDRESS as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipient as `0x${string}`, parseUnits(amount, 6)]
        });
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative min-h-[550px] flex flex-col">
        
        {/* HEADER */}
        <div className="bg-slate-950 p-4 pb-0">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            <div className="flex justify-around border-b border-slate-800">
                {['wallets', 'profile', 'settings'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab as Tab)} className={`pb-4 px-4 text-sm font-bold capitalize ${activeTab === tab ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500'}`}>{tab}</button>
                ))}
            </div>
        </div>

        {/* BODY */}
        <div className="p-6 flex-1 overflow-y-auto">
            
            {/* --- TAB: WALLETS --- */}
            {activeTab === 'wallets' && (
                <>
                  {/* VIEW 1: LIST */}
                  {walletView === 'list' && (
                    <div className="space-y-6">
                        {/* Balance Card */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 opacity-10"><Wallet className="w-24 h-24 text-white" /></div>
                            <div className="flex items-center justify-center gap-2 mb-1">
                                 <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Total Balance <span className="text-[10px] lowercase">(est)</span></p>
                                 <button onClick={refreshBalances} className="text-slate-500 hover:text-white"><RefreshCw className="w-3 h-3" /></button>
                            </div>
                            <h2 className="text-4xl font-extrabold text-white mb-2 tracking-tight">{totalValueUSD}</h2>
                            <button onClick={handleCopy} className="flex items-center justify-center gap-2 mx-auto text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                                {address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'No Address'} <Copy className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleCopy} className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2">
                                <ArrowDown className="w-4 h-4"/> Deposit
                            </button>
                            <button onClick={() => setWalletView('send')} className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
                                <Send className="w-4 h-4"/> Send
                            </button>
                        </div>

                        {/* Asset List */}
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">My Assets</p>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700">
                                    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-xs border border-slate-600">ETH</div><div><p className="text-sm font-bold text-white">Ethereum</p><p className="text-[10px] text-slate-500">Sepolia</p></div></div>
                                    <div className="text-right"><p className="text-sm font-bold text-white">{ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.00'}</p></div>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700">
                                    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">USD</div><div><p className="text-sm font-bold text-white">USDC</p><p className="text-[10px] text-slate-500">Stablecoin</p></div></div>
                                    <div className="text-right"><p className="text-sm font-bold text-white">{usdcBalance ? parseFloat(formatUnits(usdcBalance.value, 6)).toFixed(2) : '0.00'}</p></div>
                                </div>
                            </div>
                        </div>
                    </div>
                  )}

                  {/* VIEW 2: SEND FORM */}
                  {walletView === 'send' && (
                    <div className="h-full flex flex-col">
                        <button onClick={() => setWalletView('list')} className="flex items-center gap-1 text-slate-400 hover:text-white mb-6 text-sm font-bold"><ChevronLeft className="w-4 h-4" /> Back to Wallets</button>
                        
                        <div className="space-y-4">
                           <h3 className="text-xl font-bold text-white">Send Assets</h3>
                           
                           {/* Token Select */}
                           <div className="bg-slate-800 p-1 rounded-xl flex border border-slate-700">
                              {['ETH', 'USDC'].map(t => (
                                <button key={t} onClick={() => setSendToken(t as any)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${sendToken === t ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>{t}</button>
                              ))}
                           </div>

                           {/* Inputs */}
                           <div>
                             <label className="text-xs font-bold text-slate-500 mb-1 block">To Address</label>
                             <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x..." className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white focus:border-emerald-500 outline-none" />
                           </div>
                           <div>
                             <div className="flex justify-between mb-1">
                                <label className="text-xs font-bold text-slate-500 block">Amount</label>
                                <button onClick={handleMax} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold">MAX</button>
                             </div>
                             <div className="relative">
                               <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white focus:border-emerald-500 outline-none" />
                               <span className="absolute right-4 top-4 text-sm font-bold text-slate-500">{sendToken}</span>
                             </div>
                           </div>
                           
                           {/* Error Display */}
                           {txError && <div className="text-red-400 text-xs bg-red-900/20 p-3 rounded-lg border border-red-900/50 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {txError.message.slice(0, 50)}...</div>}

                           {/* Send Action */}
                           <div className="pt-4">
                             <button onClick={handleSend} disabled={isSendingEth || isSendingToken || isConfirming || !amount || !recipient} className={`w-full text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 ${isWrongNetwork ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                                {(isSendingEth || isSendingToken || isConfirming) ? <Loader2 className="animate-spin w-5 h-5"/> : <Send className="w-5 h-5" />}
                                {isWrongNetwork ? "Switch Network" : isConfirming ? "Confirming..." : "Send Transaction"}
                             </button>
                           </div>
                        </div>
                    </div>
                  )}
                </>
            )}
            
            {/* --- TAB: PROFILE (Kept Original) --- */}
            {activeTab === 'profile' && (
               <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                     <div className="flex items-center gap-3"><div className="bg-white text-black font-bold w-8 h-8 rounded-full flex items-center justify-center">G</div><div><p className="text-white font-bold text-sm">Google</p><p className="text-xs text-slate-400">{user?.google ? 'Verified' : 'Not Linked'}</p></div></div>
                     {user?.google ? <button onClick={() => unlinkGoogle(user.google!.subject)} className="text-red-400 text-xs hover:underline">Unlink</button> : <button onClick={linkGoogle} className="bg-white text-black px-3 py-1 rounded-lg text-xs font-bold">Connect</button>}
                  </div>
                  <div className="text-center text-xs text-slate-500 mt-10">Social verification features are ready.</div>
               </div>
            )}

            {/* --- TAB: SETTINGS (Kept Original) --- */}
            {activeTab === 'settings' && (
                <div className="space-y-4">
                    <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl">
                        <div className="flex items-center gap-2 mb-2"><AlertTriangle className="text-amber-500 w-5 h-5" /><h3 className="text-amber-500 font-bold text-sm">Security Zone</h3></div>
                        <p className="text-slate-400 text-xs mb-4">Back up your recovery key to secure your assets.</p>
                        <button onClick={exportWallet} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-all border border-slate-600"><Key className="w-4 h-4" /> Export Private Key</button>
                    </div>
                    <button onClick={logout} className="w-full flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 py-4 rounded-xl font-bold transition-all mt-8"><LogOut className="w-4 h-4" /> Log Out</button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
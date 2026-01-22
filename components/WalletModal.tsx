import { usePrivy } from '@privy-io/react-auth';
import { useBalance } from 'wagmi';
import { X, Copy, LogOut, Key, CheckCircle2, AlertTriangle, Wallet, RefreshCw } from 'lucide-react';
import { useState, useMemo } from 'react';
import { formatEther, formatUnits } from 'viem';

type Tab = 'wallets' | 'profile' | 'settings';

// SEPOLIA USDC ADDRESS
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; 
const MOCK_ETH_PRICE = 2800; // Hardcoded for MVP display

export default function WalletModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, logout, linkGoogle, linkTwitter, linkEmail, unlinkGoogle, unlinkTwitter, unlinkEmail, exportWallet } = usePrivy();
  const address = user?.wallet?.address as `0x${string}`;
  
  // 1. Fetch ETH Balance
  const { data: ethBalance, refetch: refetchEth } = useBalance({ address });
  
  // 2. Fetch USDC Balance
  const { data: usdcBalance, refetch: refetchUsdc } = useBalance({ 
    address, 
    token: USDC_ADDRESS as `0x${string}` 
  });
  
  const [activeTab, setActiveTab] = useState<Tab>('wallets');

  // 3. Calculate Total Net Worth in USD
  const totalValueUSD = useMemo(() => {
    const ethQty = ethBalance ? parseFloat(formatEther(ethBalance.value)) : 0;
    const usdcQty = usdcBalance ? parseFloat(formatUnits(usdcBalance.value, 6)) : 0;
    
    const ethValue = ethQty * MOCK_ETH_PRICE;
    const total = ethValue + usdcQty;
    
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total);
  }, [ethBalance, usdcBalance]);

  if (!isOpen) return null;

  const copyAddress = () => {
    if (address) { navigator.clipboard.writeText(address); alert("Address copied!"); }
  };

  const refreshBalances = () => { refetchEth(); refetchUsdc(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative min-h-[500px] flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-950 p-4 pb-0">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            <div className="flex justify-around border-b border-slate-800">
                {['wallets', 'profile', 'settings'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab as Tab)} className={`pb-4 px-4 text-sm font-bold capitalize ${activeTab === tab ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500'}`}>{tab}</button>
                ))}
            </div>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">
            {activeTab === 'wallets' && (
                <div className="space-y-6">
                    {/* TOTAL BALANCE CARD (USD) */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10"><Wallet className="w-24 h-24 text-white" /></div>
                        <div className="flex items-center justify-center gap-2 mb-1">
                             <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Total Balance</p>
                             <button onClick={refreshBalances} className="text-slate-500 hover:text-white"><RefreshCw className="w-3 h-3" /></button>
                        </div>
                        <h2 className="text-4xl font-extrabold text-white mb-2 tracking-tight">{totalValueUSD}</h2>
                        <button onClick={copyAddress} className="flex items-center justify-center gap-2 mx-auto text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                            {address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'No Address'} <Copy className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20">Deposit</button>
                        <button className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20">Send</button>
                    </div>

                    {/* ASSET LIST */}
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
            
            {/* PROFILE TAB (Full Version Restored) */}
            {activeTab === 'profile' && (
                <div className="space-y-4">
                     <div className="text-center mb-6">
                        <h3 className="text-white font-bold text-lg">Verification Badges</h3>
                        <p className="text-slate-400 text-xs">Link accounts to increase your trust score.</p>
                     </div>

                     {/* Google */}
                     <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center gap-3"><div className="bg-white text-black font-bold w-8 h-8 rounded-full flex items-center justify-center">G</div><div><p className="text-white font-bold text-sm">Google</p><p className="text-xs text-slate-400">{user?.google ? 'Verified' : 'Not Linked'}</p></div></div>
                        {user?.google ? <button onClick={() => unlinkGoogle(user.google!.subject)} className="text-red-400 text-xs hover:underline">Unlink</button> : <button onClick={linkGoogle} className="bg-white text-black px-3 py-1 rounded-lg text-xs font-bold">Connect</button>}
                     </div>

                     {/* Twitter / X */}
                     <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-400 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center">X</div>
                            <div>
                                <p className="text-white font-bold text-sm">Twitter / X</p>
                                <p className="text-xs text-slate-400">{user?.twitter ? 'Verified' : 'Not Linked'}</p>
                            </div>
                        </div>
                        {user?.twitter ? (
                            <button onClick={() => unlinkTwitter(user.twitter!.subject)} className="text-red-400 text-xs hover:underline">Unlink</button>
                        ) : (
                            <button onClick={linkTwitter} className="bg-white text-black px-3 py-1 rounded-lg text-xs font-bold">Connect</button>
                        )}
                    </div>

                    {/* Email */}
                    <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-500 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center">@</div>
                            <div>
                                <p className="text-white font-bold text-sm">Email</p>
                                <p className="text-xs text-slate-400">{user?.email ? 'Verified' : 'Not Linked'}</p>
                            </div>
                        </div>
                        {user?.email ? (
                            <div className="text-emerald-400"><CheckCircle2 className="w-5 h-5" /></div>
                        ) : (
                            <button onClick={linkEmail} className="bg-white text-black px-3 py-1 rounded-lg text-xs font-bold">Connect</button>
                        )}
                    </div>
                </div>
            )}

            {/* SETTINGS TAB */}
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
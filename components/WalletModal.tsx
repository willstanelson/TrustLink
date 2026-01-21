import { usePrivy } from '@privy-io/react-auth';
import { usePrivyWagmi } from '@privy-io/wagmi';
import { useBalance } from 'wagmi';
import { X, Copy, LogOut, Shield, Key, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { formatEther } from 'viem';

type Tab = 'wallets' | 'profile' | 'settings';

export default function WalletModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, logout, linkGoogle, linkTwitter, linkEmail, unlinkGoogle, unlinkTwitter, unlinkEmail, exportWallet } = usePrivy();
  const { wallet: activeWallet } = usePrivyWagmi();
  const { data: balance } = useBalance({ address: activeWallet?.address as `0x${string}` });
  
  const [activeTab, setActiveTab] = useState<Tab>('wallets');

  if (!isOpen) return null;

  const copyAddress = () => {
    if (activeWallet?.address) {
      navigator.clipboard.writeText(activeWallet.address);
      alert("Address copied!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative">
        
        {/* Header / Tabs */}
        <div className="bg-slate-950 p-4 pb-0">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
            </button>
            
            <div className="flex justify-around border-b border-slate-800">
                <button onClick={() => setActiveTab('wallets')} className={`pb-4 px-4 text-sm font-bold ${activeTab === 'wallets' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500'}`}>
                    Wallets
                </button>
                <button onClick={() => setActiveTab('profile')} className={`pb-4 px-4 text-sm font-bold ${activeTab === 'profile' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500'}`}>
                    Profile & Trust
                </button>
                <button onClick={() => setActiveTab('settings')} className={`pb-4 px-4 text-sm font-bold ${activeTab === 'settings' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500'}`}>
                    Settings
                </button>
            </div>
        </div>

        {/* BODY */}
        <div className="p-6 min-h-[300px]">
            
            {/* TAB 1: WALLET BALANCE */}
            {activeTab === 'wallets' && (
                <div className="text-center space-y-6">
                    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                        <p className="text-slate-400 text-sm mb-1">Total Balance</p>
                        <h2 className="text-4xl font-bold text-white mb-2">
                            {balance ? parseFloat(formatEther(balance.value)).toFixed(4) : '0.00'} 
                            <span className="text-lg text-slate-500 ml-2">ETH</span>
                        </h2>
                        <button onClick={copyAddress} className="flex items-center justify-center gap-2 mx-auto text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1 rounded-full">
                            {activeWallet?.address.slice(0,6)}...{activeWallet?.address.slice(-4)} <Copy className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-all">
                            Deposit
                        </button>
                        <button className="bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold transition-all">
                            Send
                        </button>
                    </div>
                </div>
            )}

            {/* TAB 2: PROFILE (THE TRUST SYSTEM) */}
            {activeTab === 'profile' && (
                <div className="space-y-4">
                    <div className="text-center mb-6">
                        <h3 className="text-white font-bold text-lg">Verification Badges</h3>
                        <p className="text-slate-400 text-xs">Link accounts to increase your trust score.</p>
                    </div>

                    {/* Google */}
                    <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="bg-white text-black font-bold w-8 h-8 rounded-full flex items-center justify-center">G</div>
                            <div>
                                <p className="text-white font-bold text-sm">Google</p>
                                <p className="text-xs text-slate-400">{user?.google ? 'Verified' : 'Not Linked'}</p>
                            </div>
                        </div>
                        {user?.google ? (
                            <button onClick={() => unlinkGoogle(user.google!.subject)} className="text-red-400 text-xs hover:underline">Unlink</button>
                        ) : (
                            <button onClick={linkGoogle} className="bg-white text-black px-3 py-1 rounded-lg text-xs font-bold">Connect</button>
                        )}
                    </div>

                    {/* Twitter */}
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

            {/* TAB 3: SETTINGS (SECURITY) */}
            {activeTab === 'settings' && (
                <div className="space-y-4">
                    <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="text-amber-500 w-5 h-5" />
                            <h3 className="text-amber-500 font-bold text-sm">Security Zone</h3>
                        </div>
                        <p className="text-slate-400 text-xs mb-4">
                            Your wallet is embedded in this browser. For maximum safety, you should back up your recovery key.
                        </p>
                        <button 
                            onClick={exportWallet}
                            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-all border border-slate-600"
                        >
                            <Key className="w-4 h-4" /> Export Private Key
                        </button>
                    </div>

                    <button 
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 py-4 rounded-xl font-bold transition-all mt-8"
                    >
                        <LogOut className="w-4 h-4" /> Log Out
                    </button>

                    <p className="text-center text-slate-600 text-xs mt-4">TrustLink v1.0.0 (Beta)</p>
                </div>
            )}

        </div>
      </div>
    </div>
  );
}
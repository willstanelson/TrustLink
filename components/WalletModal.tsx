import { usePrivy } from '@privy-io/react-auth';
import {
  useBalance, useSendTransaction, useWriteContract,
  useWaitForTransactionReceipt, useChainId, useSwitchChain, useAccount,
} from 'wagmi';
// FIX 1: Removed unused CheckCircle2 import
import { X, Copy, LogOut, Key, AlertTriangle, Wallet, RefreshCw, Send, ChevronLeft, Loader2, ArrowDown, Repeat } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { formatEther, formatUnits, parseEther, parseUnits, isAddress } from 'viem';
import { CHAIN_CONFIG } from '@/app/constants';

type Tab = 'wallets' | 'profile' | 'settings';
type View = 'list' | 'send' | 'deposit';
type TokenType = 'NATIVE' | 'USDC';

const MOCK_NATIVE_PRICE = 1.50;

const ERC20_ABI = [
  {
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

function Toast({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) {
  const colors = {
    success: 'bg-emerald-900/80 border-emerald-500/40 text-emerald-300',
    error: 'bg-red-900/80 border-red-500/40 text-red-300',
    info: 'bg-blue-900/80 border-blue-500/40 text-blue-300',
  };
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-4 py-2 rounded-xl border text-sm font-bold shadow-xl ${colors[type]} animate-in slide-in-from-bottom-5`}>
      {message}
    </div>
  );
}

// FIX 2: Derive a safe fallback so activeChain is never undefined,
// even if CHAIN_CONFIG does not contain the current or default chainId.
const FALLBACK_CHAIN_ID = Object.keys(CHAIN_CONFIG).length
  ? parseInt(Object.keys(CHAIN_CONFIG)[0])
  : 9746;

export default function WalletModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, logout, linkGoogle, linkTwitter, linkEmail, unlinkGoogle, unlinkTwitter, unlinkEmail, exportWallet } = usePrivy();
  const { address: wagmiAddress } = useAccount();
  const address = (user?.wallet?.address || wagmiAddress) as `0x${string}` | undefined;

  const [activeTab, setActiveTab] = useState<Tab>('wallets');
  const [walletView, setWalletView] = useState<View>('list');
  const [sendToken, setSendToken] = useState<TokenType>('NATIVE');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isUnsupportedNetwork = !CHAIN_CONFIG[chainId];

  // FIX 2: Safe active chain -- never undefined
  const activeChainId = isUnsupportedNetwork ? FALLBACK_CHAIN_ID : chainId;
  const activeChain = CHAIN_CONFIG[activeChainId] ?? CHAIN_CONFIG[FALLBACK_CHAIN_ID];

  const {
    sendTransaction, data: nativeHash, isPending: isSendingNative,
    error: nativeError, reset: resetNativeTx,
  } = useSendTransaction();

  const {
    writeContract, data: tokenHash, isPending: isSendingToken,
    error: tokenError, reset: resetTokenTx,
  } = useWriteContract();

  // FIX 4 & 5: Reset send form + clear tx state on chain change so stale
  // token selections and old error banners don't carry over between networks.
  useEffect(() => {
    setSendToken('NATIVE');
    setAmount('');
    setRecipient('');
    resetNativeTx();
    resetTokenTx();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChainId]);

  const { data: nativeBalance, refetch: refetchNative } = useBalance({
    address, chainId: activeChainId, query: { enabled: !!address },
  });

  const { data: usdcBalance, refetch: refetchUsdc } = useBalance({
    address,
    token: activeChain?.usdcAddress as `0x${string}` | undefined,
    chainId: activeChainId,
    query: { enabled: !!address && !!activeChain?.usdcAddress },
  });

  const txHash = sendToken === 'NATIVE' ? nativeHash : tokenHash;
  const txError = sendToken === 'NATIVE' ? nativeError : tokenError;
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // FIX 8: Use usdcBalance.decimals instead of hardcoded 6
  const totalValueUSD = useMemo(() => {
    const nativeQty = nativeBalance ? parseFloat(formatEther(nativeBalance.value)) : 0;
    const usdcDecimals = usdcBalance?.decimals ?? 6;
    const usdcQty = usdcBalance ? parseFloat(formatUnits(usdcBalance.value, usdcDecimals)) : 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      nativeQty * MOCK_NATIVE_PRICE + usdcQty
    );
  }, [nativeBalance, usdcBalance]);

  useEffect(() => {
    if (isSuccess) {
      showToast('Transaction sent successfully!', 'success');
      setAmount(''); setRecipient(''); setWalletView('list');
      resetNativeTx(); resetTokenTx();
      refetchNative(); refetchUsdc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab !== 'wallets') setWalletView('list');
  };

  if (!isOpen) return null;

  const handleCopy = () => {
    if (address) { navigator.clipboard.writeText(address); showToast('Address copied to clipboard!', 'info'); }
  };

  const refreshBalances = () => {
    refetchNative(); refetchUsdc(); showToast('Balances refreshed', 'info');
  };

  // FIX 6: Clamp USDC max to its own decimals (max 6) to prevent parseUnits() overflow
  const handleMax = () => {
    if (sendToken === 'NATIVE' && nativeBalance) {
      const val = parseFloat(nativeBalance.formatted) - 0.0001;
      setAmount(val > 0 ? val.toFixed(6) : '0');
    }
    if (sendToken === 'USDC' && usdcBalance) {
      const safeDecimals = Math.min(usdcBalance.decimals ?? 6, 6);
      setAmount(parseFloat(usdcBalance.formatted).toFixed(safeDecimals));
    }
  };

  const getAmountError = (): string | null => {
    if (!amount || parseFloat(amount) <= 0) return null;
    if (sendToken === 'NATIVE' && nativeBalance && parseFloat(amount) > parseFloat(nativeBalance.formatted))
      return `Amount exceeds ${activeChain.nativeSymbol} balance`;
    if (sendToken === 'USDC' && usdcBalance && parseFloat(amount) > parseFloat(usdcBalance.formatted))
      return 'Amount exceeds USDC balance';
    return null;
  };

  const amountError = getAmountError();

  const handleSend = () => {
    if (isUnsupportedNetwork) { showToast('Please switch to a supported network first.', 'error'); return; }
    if (!isAddress(recipient)) { showToast('Invalid recipient address', 'error'); return; }
    if (!amount || parseFloat(amount) <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (amountError) { showToast(amountError, 'error'); return; }
    try {
      if (sendToken === 'NATIVE') {
        // FIX 3: Explicit chainId prevents wagmi from broadcasting on the wrong network
        sendTransaction({ to: recipient as `0x${string}`, value: parseEther(amount), chainId: activeChainId });
      } else {
        writeContract({
          address: activeChain.usdcAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipient as `0x${string}`, parseUnits(amount, usdcBalance?.decimals ?? 6)],
          chainId: activeChainId, // FIX 3
        });
      }
    } catch (e) { console.error(e); }
  };

  const isBusy = isSendingNative || isSendingToken || isConfirming;
  const supportedChains = Object.entries(CHAIN_CONFIG) as [string, typeof activeChain][];

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative min-h-[550px] flex flex-col animate-in zoom-in-95 duration-200">

          {/* HEADER */}
          <div className="bg-slate-950 p-4 pb-0">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            <div className="flex justify-around border-b border-slate-800">
              {(['wallets', 'profile', 'settings'] as Tab[]).map((tab) => (
                <button key={tab} onClick={() => handleTabChange(tab)}
                  className={`pb-4 px-4 text-sm font-bold capitalize ${activeTab === tab ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500'}`}>
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* BODY */}
          <div className="p-6 flex-1 overflow-y-auto">

            {activeTab === 'wallets' && (
              <>
                {walletView === 'list' && (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-10"><Wallet className="w-24 h-24 text-white" /></div>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Total Balance <span className="text-[10px] lowercase">(est)</span></p>
                        <button onClick={refreshBalances} className="text-slate-500 hover:text-white"><RefreshCw className="w-3 h-3" /></button>
                      </div>
                      <h2 className="text-4xl font-extrabold text-white mb-2 tracking-tight">{totalValueUSD}</h2>
                      <button onClick={handleCopy} className="flex items-center justify-center gap-2 mx-auto text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'No Address'} <Copy className="w-3 h-3" />
                      </button>
                      {/* FIX 2 companion: Warn about unsupported network on main card */}
                      {isUnsupportedNetwork && (
                        <div className="mt-3 flex items-center justify-center gap-1 text-xs text-amber-400 bg-amber-900/20 px-3 py-1 rounded-full border border-amber-500/20">
                          <AlertTriangle className="w-3 h-3" /> Unsupported network — showing {activeChain.name} balances
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={() => setWalletView('deposit')} className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1 text-sm">
                        <ArrowDown className="w-4 h-4" /> Deposit
                      </button>
                      <button onClick={() => setWalletView('send')} className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1 text-sm">
                        <Send className="w-4 h-4" /> Send
                      </button>
                      <button onClick={() => showToast('In-app swapping will unlock at Mainnet launch!', 'info')} className="bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1 text-sm">
                        <Repeat className="w-4 h-4" /> Swap
                      </button>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">My Assets</p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-[10px] border border-purple-500 tracking-tighter">
                              {activeChain.nativeSymbol.slice(0, 4)}
                            </div>
                            <div><p className="text-sm font-bold text-white">{activeChain.name}</p><p className="text-[10px] text-slate-500">{activeChain.name} Network</p></div>
                          </div>
                          <p className="text-sm font-bold text-white">
                            {nativeBalance ? parseFloat(formatEther(nativeBalance.value)).toFixed(4) : '0.0000'}
                          </p>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">USD</div>
                            <div><p className="text-sm font-bold text-white">USDC</p><p className="text-[10px] text-slate-500">Stablecoin</p></div>
                          </div>
                          {/* FIX 8: Use usdcBalance.decimals */}
                          <p className="text-sm font-bold text-white">
                            {usdcBalance ? parseFloat(formatUnits(usdcBalance.value, usdcBalance.decimals ?? 6)).toFixed(2) : '0.00'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {walletView === 'deposit' && (
                  <div className="h-full flex flex-col">
                    <button onClick={() => setWalletView('list')} className="flex items-center gap-1 text-slate-400 hover:text-white mb-6 text-sm font-bold">
                      <ChevronLeft className="w-4 h-4" /> Back to Wallets
                    </button>
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-white">Receive / Deposit</h3>
                      <p className="text-slate-400 text-sm">Send {activeChain.nativeSymbol} or USDC to your wallet on the {activeChain.name} Network.</p>
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 break-all text-white font-mono text-sm text-center">
                        {address ?? 'No address connected'}
                      </div>
                      <button onClick={handleCopy} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-all">
                        <Copy className="w-4 h-4" /> Copy Address
                      </button>
                      <div className="bg-amber-900/20 border border-amber-500/30 p-3 rounded-xl flex items-start gap-2">
                        <AlertTriangle className="text-amber-500 w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-amber-400 text-xs">Only send assets on the {activeChain.name} Network (Chain ID {activeChainId}). Sending on other networks may result in lost funds.</p>
                      </div>
                    </div>
                  </div>
                )}

                {walletView === 'send' && (
                  <div className="h-full flex flex-col">
                    <button onClick={() => setWalletView('list')} className="flex items-center gap-1 text-slate-400 hover:text-white mb-6 text-sm font-bold">
                      <ChevronLeft className="w-4 h-4" /> Back to Wallets
                    </button>
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-white">Send Assets</h3>

                      {/* FIX 7: Unsupported network now renders actionable chain-switch buttons */}
                      {isUnsupportedNetwork && (
                        <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl space-y-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="text-red-400 w-4 h-4 shrink-0" />
                            <p className="text-red-400 text-xs font-bold">Unsupported network. Switch to continue:</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {supportedChains.map(([id, chain]) => (
                              <button key={id} onClick={() => switchChain({ chainId: parseInt(id) })}
                                className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-600 transition-all">
                                {chain.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-800 p-1 rounded-xl flex border border-slate-700">
                        {(['NATIVE', 'USDC'] as TokenType[]).map((t) => (
                          <button key={t} onClick={() => setSendToken(t)}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold ${sendToken === t ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                            {t === 'NATIVE' ? activeChain.nativeSymbol : 'USDC'}
                          </button>
                        ))}
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">To Address</label>
                        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x..."
                          className={`w-full bg-slate-800 border rounded-xl p-4 text-white focus:border-emerald-500 outline-none ${recipient && !isAddress(recipient) ? 'border-red-500' : 'border-slate-700'}`} />
                        {recipient && !isAddress(recipient) && <p className="text-red-400 text-xs mt-1">Invalid Ethereum address</p>}
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <label className="text-xs font-bold text-slate-500 block">Amount</label>
                          <button onClick={handleMax} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold">MAX</button>
                        </div>
                        <div className="relative">
                          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                            className={`w-full bg-slate-800 border rounded-xl p-4 text-white focus:border-emerald-500 outline-none ${amountError ? 'border-red-500' : 'border-slate-700'}`} />
                          <span className="absolute right-4 top-4 text-sm font-bold text-slate-500">{sendToken === 'NATIVE' ? activeChain.nativeSymbol : 'USDC'}</span>
                        </div>
                        {amountError && <p className="text-red-400 text-xs mt-1">{amountError}</p>}
                      </div>

                      {txError && (
                        <div className="text-red-400 text-xs bg-red-900/20 p-3 rounded-lg border border-red-900/50 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          {txError.message ? txError.message.slice(0, 120) : 'Transaction failed'}
                        </div>
                      )}

                      <div className="pt-4">
                        <button onClick={handleSend} disabled={isBusy || isUnsupportedNetwork || !!amountError || !amount || !recipient}
                          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                          {isBusy ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                          {isConfirming ? 'Confirming...' : 'Send Transaction'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h3 className="text-white font-bold text-lg">Verification Badges</h3>
                  <p className="text-slate-400 text-xs">Link accounts to increase your trust score.</p>
                </div>
                <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="bg-white text-black font-bold w-8 h-8 rounded-full flex items-center justify-center">G</div>
                    <div><p className="text-white font-bold text-sm">Google</p><p className="text-xs text-slate-400">{user?.google ? 'Verified' : 'Not Linked'}</p></div>
                  </div>
                  {user?.google ? <button onClick={() => unlinkGoogle(user.google!.subject)} className="text-red-400 text-xs hover:underline">Unlink</button>
                    : <button onClick={linkGoogle} className="bg-white text-black px-3 py-1 rounded-lg text-xs font-bold">Connect</button>}
                </div>
                <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-400 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center">X</div>
                    <div><p className="text-white font-bold text-sm">Twitter / X</p><p className="text-xs text-slate-400">{user?.twitter ? 'Verified' : 'Not Linked'}</p></div>
                  </div>
                  {user?.twitter ? <button onClick={() => unlinkTwitter(user.twitter!.subject)} className="text-red-400 text-xs hover:underline">Unlink</button>
                    : <button onClick={linkTwitter} className="bg-white text-black px-3 py-1 rounded-lg text-xs font-bold">Connect</button>}
                </div>
                <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center">@</div>
                    <div><p className="text-white font-bold text-sm">Email</p><p className="text-xs text-slate-400">{user?.email ? user.email.address : 'Not Linked'}</p></div>
                  </div>
                  {user?.email ? <button onClick={() => unlinkEmail(user.email!.address)} className="text-red-400 text-xs hover:underline">Unlink</button>
                    : <button onClick={linkEmail} className="bg-white text-black px-3 py-1 rounded-lg text-xs font-bold">Connect</button>}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-4">
                <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="text-amber-500 w-5 h-5" />
                    <h3 className="text-amber-500 font-bold text-sm">Security Zone</h3>
                  </div>
                  <p className="text-slate-400 text-xs mb-4">Back up your recovery key to secure your assets.</p>
                  <button onClick={exportWallet} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-all border border-slate-600">
                    <Key className="w-4 h-4" /> Export Private Key
                  </button>
                </div>
                <button onClick={logout} className="w-full flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 py-4 rounded-xl font-bold transition-all mt-8">
                  <LogOut className="w-4 h-4" /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

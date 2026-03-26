import { useState, useEffect, useRef, useMemo } from 'react';
import { formatEther, formatUnits, parseUnits } from 'viem';
import { 
  MessageCircle, AlertTriangle, CheckCircle, Package, 
  ThumbsUp, Truck, CheckCheck, Loader2, BellRing 
} from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { supabase } from '../lib/supabaseClient'; 
import dynamic from 'next/dynamic'; 
import TrustBadge from './TrustBadge';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../app/constants';

// ✅ NEW: Added Plasma Chain ID for strict network locking
const PLASMA_CHAIN_ID = 9746;

const SecureChat = dynamic(() => import('./SecureChat'), { 
  ssr: false,
  loading: () => <div className="hidden">Loading Chat...</div>
});

type Order = {
  id: number | string;
  buyer: string;
  seller: string;
  amount: bigint;
  lockedBalance: bigint;
  status: string; 
  token_symbol: string;
  token: string;
  isAccepted: boolean;
  isShipped: boolean;
  isDisputed: boolean;
  isCompleted: boolean;
  formattedTotal: string;
  formattedLocked: string;
  percentPaid: number;
  statusColor: string;
  type: string; 
};

export default function OrderCard({ order, isSellerView, userAddress, onUpdate }: { order: Order, isSellerView: boolean, userAddress: string, onUpdate: () => void }) {
  const [showChat, setShowChat] = useState(false);
  const [releaseAmount, setReleaseAmount] = useState('');
  const [hasUnread, setHasUnread] = useState(false); 
  const [isDbLoading, setIsDbLoading] = useState(false);

  const [showSplitWarning, setShowSplitWarning] = useState(false);
  const [pendingReleaseAmount, setPendingReleaseAmount] = useState('');
  
  const chatOpenRef = useRef(showChat);

  // ✅ FIX: Added error catcher to the Wagmi hook
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  
  const actionRef = useRef('');

  const isFiat = order.type === 'FIAT';
  const rawOrderId = String(order.id).replace('NGN-', '');
  const peerAddress = isSellerView ? order.buyer : order.seller;

  const displayId = useMemo(() => {
      const numId = Number(rawOrderId);
      if (isNaN(numId)) return order.id;
      const scrambledHex = (numId * 83911).toString(16).toUpperCase();
      return isFiat ? `NGN-${scrambledHex}` : `ORD-${scrambledHex}`;
  }, [rawOrderId, isFiat, order.id]);

  const sendNotification = async (to: string, subject: string, message: string) => {
      if (!to || !to.includes('@')) return; 
      try {
          await fetch('/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to, subject, message })
          });
      } catch (err) {
          console.error("Failed to send email notification", err);
      }
  };

  // ✅ FIX: Catch silent Wagmi errors and show them to the user
  useEffect(() => {
      if (writeError) {
          const errorMsg = (writeError as any).shortMessage || writeError.message;
          alert(`Transaction Failed: ${errorMsg}`);
          actionRef.current = '';
      }
  }, [writeError]);

  useEffect(() => {
    if (isSuccess) {
        if (actionRef.current === 'release' && !isFiat) {
            fetch('/api/profile/increment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyer: order.buyer, seller: order.seller })
            });
            sendNotification(order.seller, 'Funds Released!', `The buyer has released crypto funds from the smart contract for order ${displayId}. Check your wallet!`);
            actionRef.current = ''; 
        }
        setTimeout(onUpdate, 2000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  const isBusy = isPending || isConfirming || isDbLoading;

  useEffect(() => {
      chatOpenRef.current = showChat;
      if (showChat) {
          localStorage.setItem(`chat_read_${rawOrderId}`, Date.now().toString());
      }
  }, [showChat, rawOrderId]);

  useEffect(() => {
    if (!userAddress) return;

    const checkHistory = async () => {
        const { data } = await supabase
            .from('messages')
            .select('created_at, sender_address')
            .eq('order_id', Number(rawOrderId)) 
            .order('created_at', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            const isFromOther = data[0].sender_address.toLowerCase() !== userAddress.toLowerCase();
            const lastRead = localStorage.getItem(`chat_read_${rawOrderId}`);
            const msgTime = new Date(data[0].created_at).getTime();

            if (isFromOther && (!lastRead || msgTime > Number(lastRead))) {
                setHasUnread(true);
            }
        }
    };
    checkHistory();

    const channel = supabase
        .channel(`notify-${rawOrderId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${Number(rawOrderId)}` }, (payload) => { 
            if (payload.new.sender_address.toLowerCase() !== userAddress.toLowerCase()) {
                if (!chatOpenRef.current) {
                    setHasUnread(true);
                } else {
                    localStorage.setItem(`chat_read_${rawOrderId}`, Date.now().toString());
                }
            }
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [order.id, userAddress, rawOrderId]);

  const openChat = () => {
    setHasUnread(false);
    setShowChat(true);
    localStorage.setItem(`chat_read_${rawOrderId}`, Date.now().toString());
  };

  const closeChat = () => {
    setShowChat(false);
    localStorage.setItem(`chat_read_${rawOrderId}`, Date.now().toString());
  };

  const handleAccept = async () => {
    setIsDbLoading(true);
    const payload: any = { id: Number(rawOrderId), seller_address: userAddress, status: 'accepted' };
    if (!isFiat) {
        payload.buyer_wallet_address = order.buyer;
        payload.amount = Number(order.formattedTotal.replace(/,/g, ''));
        payload.currency = order.token_symbol;
    }
    const { error } = await supabase.from('escrow_orders').upsert(payload);
    setIsDbLoading(false);
    
    if (error) alert(`Database Error: ${error.message}`); 
    else {
        sendNotification(order.buyer, 'Order Accepted!', `The seller has accepted your order (${displayId}). They are preparing your item/service.`);
        onUpdate();
    }
  };

  const handleMarkShipped = async () => {
    setIsDbLoading(true);
    const payload: any = { id: Number(rawOrderId), seller_address: userAddress, status: 'shipped' };
    if (!isFiat) {
        payload.buyer_wallet_address = order.buyer;
        payload.amount = Number(order.formattedTotal.replace(/,/g, ''));
        payload.currency = order.token_symbol;
    }
    const { error } = await supabase.from('escrow_orders').upsert(payload);
    setIsDbLoading(false);
    
    if (error) alert(`Database Error: ${error.message}`); 
    else {
        sendNotification(order.buyer, 'Order Shipped!', `The seller has marked your order (${displayId}) as shipped/delivered. Please verify and release the funds when you are satisfied.`);
        onUpdate();
    }
  };

  const handleReleaseClick = (amountStr: string) => {
      if (!amountStr) return;
      const cleanAmountStr = String(amountStr).replace(/,/g, '');
      const cleanLockedStr = String(order.formattedLocked).replace(/,/g, '');

      const releaseNum = Number(cleanAmountStr);
      const lockedNum = Number(cleanLockedStr);

      // ✅ FIX: Added rigid math safety checks
      if (releaseNum <= 0) {
          alert("Release amount must be greater than zero.");
          return;
      }
      
      if (releaseNum > lockedNum) {
          alert(`You cannot release more than the locked amount (${lockedNum} ${order.token_symbol}). Note: Enter the token amount, not a percentage.`);
          return;
      }

      if (releaseNum < lockedNum) {
          setPendingReleaseAmount(cleanAmountStr);
          setShowSplitWarning(true); 
      } else {
          executeRelease(cleanAmountStr); 
      }
  };

  const executeRelease = async (cleanAmountStr: string) => {
    if (isFiat) {
        setIsDbLoading(true);
        try {
            const releaseNum = Number(cleanAmountStr); 
            const response = await fetch('/api/paystack/release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: rawOrderId, releaseAmount: releaseNum })
            });

            const data = await response.json();
            if (data.status) {
                alert(data.message); 
                sendNotification(order.seller, 'Funds Released!', `Great news! The buyer has released ${releaseNum} NGN for order ${displayId}. It is currently processing to your bank account.`);
                onUpdate();
            } else alert(`Release Failed: ${data.message}`);
        } catch (error) {
            console.error(error);
            alert("Network error processing release.");
        } finally {
            setIsDbLoading(false);
            setReleaseAmount(''); 
        }
    } else {
        const decimals = order.token_symbol === 'USDC' ? 6 : 18;
        actionRef.current = 'release'; 
        // ✅ FIX: Explicitly locked to the Plasma network
        writeContract({ 
            chainId: PLASMA_CHAIN_ID,
            address: CONTRACT_ADDRESS, 
            abi: CONTRACT_ABI, 
            functionName: 'releaseMilestone', 
            args: [BigInt(rawOrderId), parseUnits(cleanAmountStr, decimals)] 
        });
    }
  };

  const handleDispute = async () => {
    if (isFiat) {
        setIsDbLoading(true);
        const { error } = await supabase.from('escrow_orders').update({ status: 'disputed' }).eq('id', Number(rawOrderId));
        setIsDbLoading(false);
        if (!error) {
            sendNotification(peerAddress, 'Order Disputed 🚨', `A dispute has been raised on order ${displayId}. An admin will review the chat logs and make a final ruling.`);
            onUpdate();
        }
    } else {
        // ✅ FIX: Explicitly locked to the Plasma network
        writeContract({ chainId: PLASMA_CHAIN_ID, address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'raiseDispute', args: [BigInt(rawOrderId)] });
    }
  };

  const handleCancel = async () => {
    if (isFiat) {
        setIsDbLoading(true);
        const { error } = await supabase.from('escrow_orders').update({ status: 'cancelled' }).eq('id', Number(rawOrderId));
        setIsDbLoading(false);
        if (!error) onUpdate();
    } else {
        // ✅ FIX: Explicitly locked to the Plasma network
        writeContract({ chainId: PLASMA_CHAIN_ID, address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'cancelOrder', args: [BigInt(rawOrderId)] });
    }
  };

  return (
    <>
      <div className={`bg-slate-800/40 border rounded-xl p-5 mb-4 transition-all relative ${showChat ? 'border-emerald-500 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]' : 'border-slate-700 hover:border-slate-600'}`}>
        
        {/* HEADER INFO */}
        <div className="flex justify-between items-start mb-4">
           <div className="flex gap-2 items-center">
              <span className="bg-slate-800 text-slate-400 text-xs font-mono px-2 py-1 rounded">{displayId}</span>
              <span className={`text-[10px] font-bold px-2 py-1 rounded border ${order.statusColor}`}>
                 {order.status}
              </span>
           </div>
           <div className="text-right">
              <div className="text-white font-bold text-lg">
                  {order.formattedLocked} <span className="text-sm text-slate-500">{order.token_symbol}</span>
              </div>
              <div className="text-xs text-slate-500">Total: {order.formattedTotal}</div>
           </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
           <div className="bg-emerald-500 h-full transition-all" style={{ width: `${order.percentPaid}%` }}></div>
        </div>
        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-6">
           <span>Paid: {order.percentPaid}%</span>
           <span>Locked: {100 - order.percentPaid}%</span>
        </div>

        {/* COUNTERPARTY & TRUST BADGE */}
        <div className="flex items-center gap-2 mb-6 text-xs text-slate-400">
           <span>{isSellerView ? 'Buyer:' : 'Seller:'}</span>
           <TrustBadge address={peerAddress} />
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-wrap gap-3">
           
           <button 
             onClick={openChat}
             className={`relative flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all border ${hasUnread ? 'bg-slate-700 text-white border-emerald-500' : 'bg-slate-800 text-white border-slate-600 hover:bg-slate-700'}`}
           >
             {hasUnread ? <BellRing className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> : <MessageCircle className="w-3.5 h-3.5" />}
             {showChat ? 'Chat Open' : (hasUnread ? 'New Message!' : 'Chat')}
             
             {hasUnread && (
               <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-slate-900"></span>
               </span>
             )}
           </button>

           {/* CONTEXT AWARE ACTIONS */}
           {order.status !== 'PAID' && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
              <>
                  {/* BUYER CONTROLS */}
                  {!isSellerView && (
                      <>
                          {!order.isAccepted && (
                              <button onClick={handleCancel} disabled={isBusy} className="bg-red-500 hover:bg-red-400 text-white px-4 rounded-lg text-xs font-bold flex items-center justify-center">
                                  {isBusy ? <Loader2 className="animate-spin w-4 h-4"/> : "Cancel"}
                              </button>
                          )}
                          
                          {order.isAccepted && !order.isShipped && (
                              <div className="flex-[2] flex gap-2">
                                  <input 
                                      type="number" 
                                      placeholder="0.00" 
                                      value={releaseAmount} 
                                      onChange={(e) => setReleaseAmount(e.target.value)} 
                                      className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-2 text-xs text-white focus:border-emerald-500 outline-none" 
                                  />
                                  <button 
                                      onClick={() => handleReleaseClick(releaseAmount)} 
                                      disabled={isBusy || !releaseAmount} 
                                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center"
                                  >
                                      {isBusy ? <Loader2 className="animate-spin w-4 h-4 mx-auto"/> : "Split Release"}
                                  </button>
                              </div>
                          )}

                          {order.isShipped && (
                              <div className="flex-[2] flex gap-2">
                                  <button 
                                      onClick={() => handleReleaseClick(order.formattedLocked)} 
                                      disabled={isBusy} 
                                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold py-3 flex items-center justify-center"
                                  >
                                      {isBusy ? <Loader2 className="animate-spin w-4 h-4 mx-auto"/> : "Release Full Amount"}
                                  </button>
                              </div>
                          )}

                          {order.isAccepted && (
                              <button onClick={handleDispute} disabled={isBusy} className="bg-red-900/20 text-red-400 border border-red-900/30 px-3 rounded-lg flex items-center justify-center">
                                  <AlertTriangle className="w-4 h-4" />
                              </button>
                          )}
                      </>
                  )}

                  {/* SELLER CONTROLS */}
                  {isSellerView && (
                      <>
                          {!order.isAccepted && <button onClick={handleAccept} disabled={isBusy} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2">{isBusy ? <Loader2 className="animate-spin w-4 h-4 mx-auto"/> : <><ThumbsUp className="w-3.5 h-3.5" /> Accept Order</>}</button>}
                          {order.isAccepted && !order.isShipped && <button onClick={handleMarkShipped} disabled={isBusy} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2">{isBusy ? <Loader2 className="animate-spin w-4 h-4 mx-auto"/> : <><Truck className="w-3.5 h-3.5" /> Mark Shipped</>}</button>}
                          {order.isShipped && <div className="flex-[2] bg-slate-700 text-slate-400 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"><CheckCheck className="w-3.5 h-3.5" /> Shipped - Waiting</div>}
                          <button onClick={handleDispute} disabled={isBusy} className="bg-red-900/20 text-red-400 border border-red-900/30 px-3 rounded-lg"><AlertTriangle className="w-4 h-4" /></button>
                      </>
                  )}
              </>
           )}
        </div>

        <SecureChat 
           isOpen={showChat} 
           onClose={closeChat} 
           peerAddress={peerAddress} 
           orderId={Number(rawOrderId)} 
        />
      </div>

      {/* 🔥 THE SEVERE WARNING MODAL */}
      {showSplitWarning && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-slate-900 border border-red-500/50 p-6 rounded-3xl max-w-sm w-full shadow-[0_0_50px_rgba(239,68,68,0.15)] relative animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-center w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full mb-4 mx-auto">
                      <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-black text-white text-center mb-2">Split Release Warning</h3>
                  <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed px-2">
                      You are about to release <strong className="text-white bg-slate-800 px-2 py-0.5 rounded">{pendingReleaseAmount} {isFiat ? 'NGN' : order.token_symbol}</strong> while keeping the rest locked in escrow. <br/><br/>
                      <span className="text-red-400 font-bold uppercase tracking-wider text-xs">High Risk Action</span><br/>
                      If the seller vanishes after this payment, your remaining funds are safe, but <span className="text-white underline">you cannot claw back this partial payment.</span>
                  </p>
                  <div className="flex flex-col gap-3">
                      <button 
                          onClick={() => { setShowSplitWarning(false); executeRelease(pendingReleaseAmount); }} 
                          className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all"
                      >
                          I Understand, Release Funds
                      </button>
                      <button 
                          onClick={() => setShowSplitWarning(false)} 
                          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3.5 rounded-xl font-bold transition-all"
                      >
                          Cancel
                      </button>
                  </div>
              </div>
          </div>
      )}
    </>
  );
}
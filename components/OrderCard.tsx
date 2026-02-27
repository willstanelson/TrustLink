import { useState, useEffect } from 'react';
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
  
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess) { setTimeout(onUpdate, 2000); }

  const peerAddress = isSellerView ? order.buyer : order.seller;
  const isBusy = isPending || isConfirming || isDbLoading;

  const isFiat = order.type === 'FIAT';
  const rawOrderId = String(order.id).replace('NGN-', '');

  useEffect(() => {
    if (!userAddress) return;

    const checkHistory = async () => {
        const { data } = await supabase
            .from('messages')
            .select('sender_address')
            .eq('order_id', Number(rawOrderId)) 
            .order('created_at', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            if (data[0].sender_address.toLowerCase() !== userAddress.toLowerCase()) {
                setHasUnread(true);
            }
        }
    };
    checkHistory();

    const channel = supabase
        .channel(`notify-${rawOrderId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${Number(rawOrderId)}` }, (payload) => { 
            if (payload.new.sender_address.toLowerCase() !== userAddress.toLowerCase()) {
                setHasUnread(true);
            }
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [order.id, userAddress, rawOrderId]);

  const openChat = () => {
    setHasUnread(false);
    setShowChat(true);
  };

  // ✅ DATABASE ACTIONS (Fixed with strictly Number format)
  const handleAccept = async () => {
    setIsDbLoading(true);
    const { error } = await supabase.from('escrow_orders').update({ seller_address: userAddress, status: 'accepted' }).eq('id', Number(rawOrderId));
    setIsDbLoading(false);
    if (!error) onUpdate();
  };

  const handleMarkShipped = async () => {
    setIsDbLoading(true);
    const { error } = await supabase.from('escrow_orders').update({ seller_address: userAddress, status: 'shipped' }).eq('id', Number(rawOrderId));
    setIsDbLoading(false);
    if (!error) onUpdate();
  };

  const handleRelease = async (amountStr: string) => {
    if (!amountStr) return;
    
    if (isFiat) {
        setIsDbLoading(true);
        const { error } = await supabase.from('escrow_orders').update({ status: 'success' }).eq('id', Number(rawOrderId));
        setIsDbLoading(false);
        if (!error) onUpdate();
    } else {
        const decimals = order.token_symbol === 'ETH' ? 18 : 6;
        writeContract({ 
            address: CONTRACT_ADDRESS, 
            abi: CONTRACT_ABI, 
            functionName: 'releaseMilestone', 
            args: [BigInt(rawOrderId), parseUnits(amountStr, decimals)] 
        });
    }
  };

  const handleDispute = async () => {
    if (isFiat) {
        setIsDbLoading(true);
        const { error } = await supabase.from('escrow_orders').update({ status: 'disputed' }).eq('id', Number(rawOrderId));
        setIsDbLoading(false);
        if (!error) onUpdate();
    } else {
        writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'raiseDispute', args: [BigInt(rawOrderId)] });
    }
  };

  const handleCancel = async () => {
    if (isFiat) {
        setIsDbLoading(true);
        const { error } = await supabase.from('escrow_orders').update({ status: 'cancelled' }).eq('id', Number(rawOrderId));
        setIsDbLoading(false);
        if (!error) onUpdate();
    } else {
        writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'cancelOrder', args: [BigInt(rawOrderId)] });
    }
  };

  return (
    <div className={`bg-slate-800/40 border rounded-xl p-5 mb-4 transition-all ${showChat ? 'border-emerald-500 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]' : 'border-slate-700 hover:border-slate-600'}`}>
      
      {/* HEADER INFO */}
      <div className="flex justify-between items-start mb-4">
         <div className="flex gap-2 items-center">
            <span className="bg-slate-800 text-slate-400 text-xs font-mono px-2 py-1 rounded">#{order.id}</span>
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
      <div className="flex items-center gap-2 mb-6 text-xs text-slate-400 bg-slate-950/30 p-2 rounded-lg">
         <span>{isSellerView ? 'Buyer:' : 'Seller:'}</span>
         <span className="font-mono text-emerald-400">
            {peerAddress && peerAddress.length > 10 ? `${peerAddress.slice(0,6)}...${peerAddress.slice(-4)}` : peerAddress}
         </span>
         {!isFiat && <TrustBadge address={peerAddress} />}
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
                        {!order.isAccepted && <button onClick={handleCancel} disabled={isBusy} className="bg-red-500 hover:bg-red-400 text-white px-4 rounded-lg text-xs font-bold">{isBusy ? <Loader2 className="animate-spin w-4 h-4"/> : "Cancel"}</button>}
                        {order.isAccepted && (
                            <div className="flex-[2] flex gap-2">
                                <input type="number" placeholder="0.00" value={releaseAmount} onChange={(e) => setReleaseAmount(e.target.value)} className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-2 text-xs text-white focus:border-emerald-500 outline-none" />
                                <button onClick={() => handleRelease(releaseAmount || order.formattedLocked)} disabled={isBusy} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold">{isBusy ? <Loader2 className="animate-spin w-4 h-4 mx-auto"/> : "Release"}</button>
                            </div>
                        )}
                        {order.isAccepted && <button onClick={handleDispute} disabled={isBusy} className="bg-red-900/20 text-red-400 border border-red-900/30 px-3 rounded-lg"><AlertTriangle className="w-4 h-4" /></button>}
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
         onClose={() => setShowChat(false)} 
         peerAddress={peerAddress} 
         orderId={Number(rawOrderId)} 
      />
    </div>
  );
}
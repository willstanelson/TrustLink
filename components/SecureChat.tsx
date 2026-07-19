import { useEffect, useState, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Send, X, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface SecureChatProps {
  peerAddress: string;
  orderId?: number;
  requestId?: number;
  context?: 'escrow' | 'marketplace_request' | 'marketplace_order';
  isOpen: boolean;
  onClose: () => void;
}

export default function SecureChat({
  peerAddress,
  orderId,
  requestId,
  context = 'escrow',
  isOpen,
  onClose,
}: SecureChatProps) {
  const { user } = usePrivy();
  const address = user?.wallet?.address;

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const identifier = orderId ? `order-${orderId}` : `request-${requestId}`;

  // 1. Load & Subscribe to Messages
  useEffect(() => {
    if (!isOpen || (!orderId && !requestId)) return;

    const fetchMessages = async () => {
      setLoading(true);
      const query = supabase.from('messages').select('*');

      if (orderId) {
        query.eq('order_id', orderId);
      } else if (requestId) {
        query.eq('request_id', requestId);
      }

      const { data } = await query.order('created_at', { ascending: true });

      if (data) setMessages(data);
      setLoading(false);
    };

    fetchMessages();

    // Realtime Subscription
    const filterField = orderId ? `order_id=eq.${orderId}` : `request_id=eq.${requestId}`;
    const channel = supabase
      .channel(identifier)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: filterField },
        (payload) => {
          setMessages((prev) => {
            // Avoid duplicate additions from optimistic rendering
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, orderId, requestId, identifier]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isOpen]);

  // 2. Send Message
  const sendMessage = async () => {
    if (!inputText.trim() || !address || (!orderId && !requestId)) return;

    const content = inputText;
    setInputText(''); // Optimistic clear

    const payload: Record<string, any> = {
      sender_address: address,
      content: content,
    };

    if (orderId) payload.order_id = orderId;
    if (requestId) payload.request_id = requestId;

    const { data, error } = await supabase.from('messages').insert(payload).select().single();

    if (error) {
      alert('Failed to send: ' + error.message);
      setInputText(content); // Restore text on error
    } else if (data) {
      setMessages((prev) => [...prev, data]);
    }
  };

  if (!isOpen) return null;

  const headerTitle =
    context === 'marketplace_request'
      ? `Proposal Discussion #${requestId}`
      : context === 'marketplace_order'
        ? `Order Chat #${orderId}`
        : `Secure Dispute Chat #${orderId}`;

  return (
    <div className="fixed bottom-4 right-4 w-80 h-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 font-sans">
      {/* Header */}
      <div className="bg-slate-950 p-3 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span className="text-white font-bold text-xs">{headerTitle}</span>
        </div>
        <button type="button" onClick={onClose}>
          <X className="w-4 h-4 text-slate-400 hover:text-white" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">
        {loading ? (
          <div className="flex justify-center mt-10">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-655 text-xs mt-10">
            No messages yet.
            <br />
            Start the negotiation.
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_address?.toLowerCase() === address?.toLowerCase();
            return (
              <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] p-2 rounded-xl text-xs leading-relaxed ${
                    isMe
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={!inputText.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white p-2 rounded-lg"
          type="button"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
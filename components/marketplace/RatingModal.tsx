'use client';

import React, { useState } from 'react';
import { Star, X, Loader2, Award } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import toast from 'react-hot-toast';

interface RatingModalProps {
  orderId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RatingModal({ orderId, onClose, onSuccess }: RatingModalProps) {
  const { getAccessToken } = usePrivy();
  const [stars, setStars] = useState(5);
  const [hoveredStars, setHoveredStars] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/marketplace/rate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: orderId,
          stars,
          comment: comment.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit rating');
      }

      toast.success('Thank you! Rating saved.');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Verification error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-slate-950/20">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base tracking-tight">
              Rate Your Experience
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-all"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-xs text-slate-400">
              How was your transaction for Order #{orderId}? Your rating helps other buyers find trustworthy vendors.
            </p>
          </div>

          {/* Star Rating selector */}
          <div className="flex justify-center items-center gap-2 pt-2">
            {[1, 2, 3, 4, 5].map((starValue) => {
              const active = starValue <= (hoveredStars ?? stars);
              return (
                <button
                  key={starValue}
                  type="button"
                  onClick={() => setStars(starValue)}
                  onMouseEnter={() => setHoveredStars(starValue)}
                  onMouseLeave={() => setHoveredStars(null)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-9 h-9 transition-colors ${
                      active
                        ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                        : 'text-slate-700'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Optional review comment */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Comments (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you like or dislike? Leave feedback about delivery speed, response times, or product quality."
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-xl text-xs text-slate-300 placeholder-slate-650 outline-none resize-none transition-all"
            />
            <span className="text-[9px] text-slate-500 block text-right">
              {comment.length}/500 characters
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white text-xs font-bold transition-all border border-slate-800"
              type="button"
              disabled={isSubmitting}
            >
              Skip
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-1.5"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Review'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

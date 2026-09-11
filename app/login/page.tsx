'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrivy, useLoginWithEmail, useLoginWithOAuth } from '@privy-io/react-auth';
import {
  ArrowRight,
  Wallet,
  ShieldCheck,
  Building2,
  Zap,
  Gift,
  Check,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Lock,
} from 'lucide-react';

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();
  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail();
  const { initOAuth } = useLoginWithOAuth();

  // Authentication Step: 'email' (Step 1) or 'awaiting_code' (Step 2 - Headless Inline OTP)
  const [authStep, setAuthStep] = useState<'email' | 'awaiting_code'>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const otpInputRef = useRef<HTMLInputElement>(null);

  // Route Guard: Redirect authenticated users to /escrow
  useEffect(() => {
    if (ready && authenticated) {
      router.replace('/escrow');
    }
  }, [ready, authenticated, router]);

  // Auto-focus OTP input when entering code step
  useEffect(() => {
    if (authStep === 'awaiting_code') {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 50);
    }
  }, [authStep]);

  // Safeguard: Flicker-Free Loading Guard
  if (!ready || authenticated) {
    return (
      <div className="h-screen w-full bg-[#0b0e17] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Securing session…</span>
        </div>
      </div>
    );
  }

  // Step 1: Headless Send Code
  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setResendSuccess(false);

    try {
      await sendCode({ email: cleanEmail });
      setAuthStep('awaiting_code');
    } catch (err: any) {
      console.error('sendCode error:', err);
      setErrorMessage(err?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Headless Verify OTP Code
  const handleVerifyCode = async (codeToVerify?: string) => {
    const code = (codeToVerify || otpCode).trim();
    if (!code || code.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await loginWithCode({ code });
      // Upon success, Privy updates authenticated to true, triggering router.replace('/escrow')
    } catch (err: any) {
      console.error('loginWithCode error:', err);
      setErrorMessage(err?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtpCode(val);
    setErrorMessage(null);
    if (val.length === 6) {
      handleVerifyCode(val);
    }
  };

  const handleResendCode = async () => {
    if (isResending) return;
    setIsResending(true);
    setErrorMessage(null);
    setResendSuccess(false);

    try {
      await sendCode({ email: email.trim() });
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  const handleChangeEmail = () => {
    setAuthStep('email');
    setOtpCode('');
    setErrorMessage(null);
  };

  const handleGoogleLogin = async () => {
    try {
      await initOAuth({ provider: 'google' });
    } catch (err) {
      console.warn('OAuth direct initiation failed, falling back to Privy modal:', err);
      login({ loginMethods: ['google'] });
    }
  };

  const handleWalletLogin = () => {
    login({ loginMethods: ['wallet'] });
  };

  const isCurrentSubmitting =
    isSubmitting ||
    emailState.status === 'sending-code' ||
    emailState.status === 'submitting-code';

  return (
    <div className="h-screen max-h-screen w-full overflow-hidden bg-[#0b0e17] text-white flex flex-col lg:flex-row selection:bg-violet-500 selection:text-white relative">
      {/* ── Keyframe Animations ── */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pulseSlow {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(1.08); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}} />

      {/* ─────────────────────────────────────────────────────────────
          LEFT COLUMN — Centered Branding & Simple Sign-In Hub (40–44%)
          Strict 100vh Non-Scrollable Layout with justify-between
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[44%] xl:w-[40%] h-full flex flex-col justify-between py-6 lg:py-8 px-6 sm:px-10 lg:px-12 xl:px-14 bg-[#0b0e17] lg:border-r border-white/5 z-10 overflow-hidden relative">
        {/* Layered Ambient Breathing Glow Orbs (Left Column) */}
        <div
          className="w-[350px] h-[350px] rounded-full blur-[120px] pointer-events-none absolute -top-20 -left-20 bg-emerald-500/[0.08]"
          style={{ animation: 'pulseSlow 10s ease-in-out infinite' }}
        />
        <div
          className="w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none absolute -bottom-10 -right-10 bg-violet-600/[0.08]"
          style={{ animation: 'pulseSlow 12s ease-in-out infinite' }}
        />

        {/* Top spacer to balance layout vertically */}
        <div className="h-4 flex-shrink-0" />

        {/* Center: Centered Branding & Auth Form Container */}
        <div className="my-auto max-w-sm w-full mx-auto py-2 flex flex-col items-center text-center relative z-10 space-y-5">
          {/* Header Group: Repositioned Centered Logo + Typography */}
          <div className="flex flex-col items-center text-center">
            {/* Full Brand Logo with Natural Proportions */}
            <div className="flex justify-center mb-6">
              <Link href="/" className="inline-block transition-transform hover:scale-[1.02]">
                <Image
                  src="/logo.png"
                  alt="TrustLink Software Firm"
                  width={280}
                  height={140}
                  className="h-20 sm:h-24 w-auto object-contain drop-shadow-md"
                  priority
                />
              </Link>
            </div>

            {/* Headline & Subtitle with Generous Breathing Room */}
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-center text-white">
              {authStep === 'email' ? 'Welcome to TrustLink Escrow' : 'Verify Your Email'}
            </h1>
            <p className="text-sm text-slate-400 text-center max-w-sm mx-auto mt-2 leading-relaxed">
              {authStep === 'email' ? (
                'Enter your email to sign in or create an account. No complicated setup required.'
              ) : (
                <span>
                  Enter the 6-digit code sent to <strong className="text-white font-semibold">{email}</strong>.
                </span>
              )}
            </p>
          </div>

          {/* Form & Action Area (Neatly centered within max-w-sm container) */}
          <div className="w-full text-left space-y-5">
            {/* STEP 1: Email Input with Micro-Interactions */}
            {authStep === 'email' ? (
              <form onSubmit={handleSendCode} className="space-y-3">
                <div className="relative flex items-center border border-white/10 bg-white/[0.04] focus-within:border-emerald-500/50 focus-within:shadow-[0_0_25px_rgba(16,185,129,0.15)] transition-all duration-300 rounded-2xl p-1.5 shadow-sm">
                  <input
                    id="email-login-input"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage(null);
                    }}
                    placeholder="Enter your email address..."
                    required
                    autoFocus
                    disabled={isCurrentSubmitting}
                    className="flex-1 bg-transparent px-3.5 py-2 text-sm text-white placeholder:text-slate-500 outline-none w-full disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!email.trim() || !email.includes('@') || isCurrentSubmitting}
                    aria-label="Continue with email"
                    title="Continue with email"
                    className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-600/30"
                  >
                    {isCurrentSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* STEP 2: Headless Inline OTP Input */
              <form onSubmit={(e) => { e.preventDefault(); handleVerifyCode(); }} className="space-y-3">
                <div className="relative flex items-center border border-white/10 bg-white/[0.04] focus-within:border-emerald-500/50 focus-within:shadow-[0_0_25px_rgba(16,185,129,0.15)] transition-all duration-300 rounded-2xl p-1.5 shadow-sm">
                  <input
                    ref={otpInputRef}
                    id="otp-login-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={handleOtpInputChange}
                    placeholder="••••••"
                    disabled={isCurrentSubmitting}
                    className="flex-1 bg-transparent px-3 py-2 text-center text-lg font-mono font-bold tracking-[0.35em] text-violet-300 placeholder:text-slate-600 outline-none w-full disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={otpCode.length !== 6 || isCurrentSubmitting}
                    aria-label="Verify code"
                    title="Verify code"
                    className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-600/30"
                  >
                    {isCurrentSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* OTP Actions: Resend & Change Email */}
                <div className="flex items-center justify-between text-[11px] pt-1 px-1">
                  <button
                    type="button"
                    onClick={handleChangeEmail}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Change email</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isResending}
                    className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50"
                  >
                    {isResending ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <span>Resend code</span>
                    )}
                  </button>
                </div>

                {resendSuccess && (
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] text-center">
                    A new verification code has been sent!
                  </div>
                )}
              </form>
            )}

            {/* Error Message Display */}
            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <span className="truncate">{errorMessage}</span>
              </div>
            )}

            {/* Minimal "OR" Divider with Generous Spacing */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-[#0b0e17] px-3 text-slate-500 font-semibold tracking-wider">
                  OR
                </span>
              </div>
            </div>

            {/* Alternative Auth Buttons with Micro-Interactions */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-2.5 px-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-slate-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-sm hover:text-white"
              >
                <GoogleIcon className="w-4 h-4" />
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={handleWalletLogin}
                className="w-full py-2.5 px-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-slate-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-sm hover:text-white"
              >
                <Wallet className="w-4 h-4 text-violet-400" />
                <span>Login with Crypto Wallet</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: Centered Exact Copyright Footer (Pinned) */}
        <div className="pt-4 border-t border-white/5 flex-shrink-0">
          <p className="text-center text-xs text-slate-500 font-medium tracking-wide">
            © Copyright 2026 -- Trustlink Software Firm -- All Rights Reserved
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT COLUMN — Product Showcase & Everyday Messaging (56–60%)
          Floating Product Showcase + Multi-Layered Ambient Depth
          ───────────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 h-full flex-col justify-center items-center p-6 lg:p-10 xl:p-12 relative bg-[#060812] overflow-hidden">
        {/* Layered Ambient Radial Gradient Orbs with slow breathing pulses */}
        <div
          className="w-[450px] h-[450px] rounded-full blur-[120px] pointer-events-none absolute top-6 -right-16 bg-[#8b5cf620]"
          style={{ animation: 'pulseSlow 9s ease-in-out infinite' }}
        />
        <div
          className="w-[450px] h-[450px] rounded-full blur-[120px] pointer-events-none absolute -bottom-10 left-6 bg-[#10b98125]"
          style={{ animation: 'pulseSlow 11s ease-in-out infinite' }}
        />
        <div
          className="w-[400px] h-[400px] rounded-full blur-[130px] pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[rgba(6,182,212,0.12)]"
          style={{ animation: 'pulseSlow 8s ease-in-out infinite' }}
        />

        {/* Watermark Emblem in Background */}
        <div className="absolute -right-16 -bottom-16 opacity-[0.03] pointer-events-none select-none">
          <Image
            src="/logo-icon.png"
            alt=""
            width={400}
            height={400}
            className="w-80 h-80 object-contain"
            unoptimized
          />
        </div>

        {/* Showcase Content Container: fits smoothly within 100vh */}
        <div className="relative max-w-xl w-full z-10 space-y-2">
          {/* Floating Central TrustLink Emblem with Dimensional Glow */}
          <div className="flex justify-center -mb-6 relative z-20">
            <div
              className="relative"
              style={{ animation: 'float 6s ease-in-out infinite' }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 to-violet-600/40 rounded-full blur-xl scale-125 pointer-events-none" />
              <div className="relative px-4 py-2 rounded-2xl bg-[#14182b]/90 border border-white/15 shadow-2xl backdrop-blur-xl flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="TrustLink Software Firm"
                  width={140}
                  height={60}
                  className="h-8 w-auto object-contain drop-shadow-[0_0_12px_rgba(139,92,246,0.5)]"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Framed Live Dashboard Preview Mockup: Multi-layered Border Shine & Glassmorphism */}
          <div className="relative rounded-2xl p-[1px] bg-gradient-to-b from-white/15 via-white/5 to-transparent hover:from-emerald-500/30 hover:via-violet-500/20 hover:to-white/10 transition-all duration-500 group">
            <div className="max-h-[50vh] bg-white/[0.03] border border-white/10 backdrop-blur-2xl rounded-2xl p-4 xl:p-5 pt-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] hover:border-white/20 transition-all duration-500 flex flex-col justify-between overflow-hidden">
              {/* Mockup Header Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white tracking-wide">TrustLink Escrow Vault</div>
                    <div className="text-[9px] text-slate-400">Live multi-rail deal ledger</div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Secured
                </div>
              </div>

              {/* Metric Ribbon Mockup */}
              <div className="grid grid-cols-2 gap-2.5 mt-3">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                  <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                    Locked in Escrow
                  </div>
                  <div className="text-lg font-bold text-white tracking-tight mt-0.5">
                    $0.00
                  </div>
                  <div className="text-[9px] text-violet-400 font-medium">
                    0 Active Holds
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                  <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                    Wallet Balance
                  </div>
                  <div className="text-lg font-bold text-white tracking-tight mt-0.5">
                    $27.00
                  </div>
                  <div className="text-[9px] text-slate-400">
                    Available in balance
                  </div>
                </div>
              </div>

              {/* Supported Everyday Methods */}
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Supported Everyday Methods
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300 bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded-lg">
                    <Building2 className="w-3 h-3 text-blue-400" />
                    Bank Transfer
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300 bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded-lg">
                    <Zap className="w-3 h-3 text-violet-400" />
                    Cryptocurrency
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300 bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded-lg">
                    <Gift className="w-3 h-3 text-amber-400" />
                    Gift Cards
                  </span>
                </div>
              </div>

              {/* Recent Deals Ledger Preview */}
              <div className="mt-3 pt-2.5 border-t border-white/10 space-y-1.5">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Recent Escrows
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="font-semibold text-white text-[11px] truncate">iPhone 15 Pro Max</span>
                      <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">Bank</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className="font-bold text-white text-[11px]">$950.00</span>
                      <span className="text-[9px] text-emerald-400 block font-semibold leading-tight">Protected</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      <span className="font-semibold text-white text-[11px] truncate">Web Design Milestone #1</span>
                      <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">Crypto</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className="font-bold text-white text-[11px]">250.00 USDC</span>
                      <span className="text-[9px] text-blue-400 block font-semibold leading-tight">In Escrow</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Security Footer */}
              <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-slate-400">
                <Lock className="w-3 h-3 text-violet-400 flex-shrink-0" />
                <span>Funds are never released without your explicit approval.</span>
              </div>
            </div>
          </div>

          {/* Centered Value Proposition: Headline, Paragraph, & Trust Badges */}
          <div className="text-center mx-auto max-w-xl">
            <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-center text-white mt-6">
              Trust is no longer a leap of Faith...
            </h2>
            <p className="text-sm text-slate-400 text-center max-w-lg mx-auto mt-3 leading-relaxed">
              TrustLink protects your money until you get exactly what you paid for. Pay easily
              using bank transfer, crypto, or gift cards. Safe, straightforward escrow designed
              for everyday business.
            </p>

            {/* Centered Trust Badges Row */}
            <div className="flex items-center justify-center gap-6 mt-5 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Zero Surprise Fees</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Buyer &amp; Seller Shield</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Dispute Resolution</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

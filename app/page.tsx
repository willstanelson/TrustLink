import Link from 'next/link';
import { Lock, ShieldCheck, ArrowRight, Bitcoin, Banknote, MessageSquare, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans selection:bg-emerald-500/30 overflow-hidden relative">
      
      {/* Background Glow Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* NAVBAR */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center rotate-3 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">TrustLink</span>
        </div>
        <Link href="/dashboard" className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-6 py-2.5 rounded-full text-sm font-extrabold transition-all shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)] hover:shadow-[0_0_25px_-3px_rgba(16,185,129,0.6)]">
          Launch App
        </Link>
      </nav>

      {/* HERO SECTION */}
      <main className="relative z-10 flex flex-col items-center justify-center mt-24 px-4 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700 text-xs font-bold text-slate-300 mb-8 backdrop-blur-sm">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
          Crypto & Fiat Escrow is Live
        </div>
        
        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
          Trust is no longer <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">
            a leap of faith.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          The ultimate peer-to-peer escrow platform. Securely lock your NGN or Crypto in a decentralized vault until both parties are 100% satisfied. 
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Link href="/dashboard" className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-extrabold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:-translate-y-1">
            Start Trading Now <ArrowRight className="w-5 h-5" />
          </Link>
          <a href="#how-it-works" className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-xl border border-slate-700 text-lg font-bold transition-all">
            How it works
          </a>
        </div>
      </main>

      {/* FEATURES GRID */}
      <section id="how-it-works" className="relative z-10 max-w-7xl mx-auto px-6 mt-32 mb-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold mb-4">Built for total peace of mind.</h2>
          <p className="text-slate-400">Never get scammed on a peer-to-peer trade again.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-3xl backdrop-blur-sm hover:border-emerald-500/50 transition-all">
            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/30">
              <Banknote className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Fiat & Crypto Native</h3>
            <p className="text-slate-400 leading-relaxed">
              Whether you are paying via Nigerian bank transfer (NGN) or directly on the blockchain with ETH and USDC, we secure your funds.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-3xl backdrop-blur-sm hover:border-emerald-500/50 transition-all">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Zero-Trust Escrow</h3>
            <p className="text-slate-400 leading-relaxed">
              Funds are locked in our secure infrastructure. The seller knows you have the money, and you know they can't touch it until they deliver.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-3xl backdrop-blur-sm hover:border-emerald-500/50 transition-all">
            <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/30">
              <MessageSquare className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Encrypted P2P Chat</h3>
            <p className="text-slate-400 leading-relaxed">
              Communicate directly with your buyer or seller inside the dashboard. All negotiations and details stay securely tied to the order.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between text-slate-500 text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Lock className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-slate-300">TrustLink</span> © {new Date().getFullYear()}
          </div>
          <div className="flex gap-6">
            <Link href="/support" className="hover:text-emerald-400 transition-colors">Terms of Service</Link>
            <Link href="/support" className="hover:text-emerald-400 transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
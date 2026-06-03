'use client';

import { useState, useRef, useEffect, MouseEvent } from 'react';
import Link from 'next/link';
import { 
  Terminal, Shield, Hexagon, ChevronDown, 
  Box, Cpu, Network, Lock, Code2, 
  Layers, Menu, X, Compass, HelpCircle, 
  History, Settings, Activity
} from 'lucide-react';

export default function Web3LandingPage() {
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('infrastructure');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // MOUSE TRACKING STATE & REFS
  const heroRef = useRef<HTMLDivElement>(null);
  const [mouseSettings, setMouseSettings] = useState({ rx: 0, ry: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!heroRef.current) return;
      
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      
      // Calculate cursor position relative to the center of the screen
      const centerX = innerWidth / 2;
      const centerY = innerHeight / 2;
      const x = clientX - centerX;
      const y = clientY - centerY;
      
      // Calculate subtle rotation and translation
      const maxRotation = 5; // Degrees
      const maxTranslation = 10; // Pixels
      
      const rx = (y / centerY) * maxRotation; // Rotate around X-axis (up/down)
      const ry = -(x / centerX) * maxRotation; // Rotate around Y-axis (left/right)
      const tx = (x / centerX) * maxTranslation; // Translate X
      const ty = (y / centerY) * maxTranslation; // Translate Y
      
      setMouseSettings({ rx, ry, tx, ty });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    // THE THEME: CodePen structure on TrustLink Slate Blue Background
    <div className="min-h-screen bg-[#0f172a] text-white font-sans selection:bg-[#ffdd40]/30 overflow-x-hidden relative flex">
      
      {/* ─── BACKGROUND MESH/GLOWS ─── */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0"></div>
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[130px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[160px] pointer-events-none z-0"></div>

      {/* ─── CODEPEN STRUCTURAL LEFT SIDEBAR ─── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#0b0f19]/90 backdrop-blur-xl border-r border-[#333333] p-6 flex flex-col justify-between
        transition-transform duration-300 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="space-y-8">
          {/* Brand Logo Identity */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-900 border border-[#444444] rounded flex items-center justify-center">
                <Hexagon className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black tracking-tight text-white leading-none">TrustLink</span>
                <span className="text-[10px] font-mono font-bold text-[#aaaaaa] tracking-widest mt-1">FIRM LABS</span>
              </div>
            </div>
            <button className="lg:hidden text-[#aaaaaa] hover:text-white" onClick={() => setIsMobileSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Groupings (CodePen Style Text/Hover) */}
          <div className="space-y-6">
            <div>
              <div className="text-[11px] font-black text-[#666666] uppercase tracking-widest px-3 mb-2">Explore</div>
              <div className="flex flex-col gap-0.5">
                <a 
                  href="#infrastructure" 
                  onClick={() => setActiveSidebarTab('infrastructure')}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-bold transition-all ${activeSidebarTab === 'infrastructure' ? 'bg-[#333333] text-white' : 'text-[#aaaaaa] hover:text-white hover:bg-[#1e1f26]'}`}
                >
                  <Layers className="w-4 h-4" /> Infrastructure
                </a>
                <a 
            href="#protocols" 
                  onClick={() => setActiveSidebarTab('protocols')}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-bold transition-all ${activeSidebarTab === 'protocols' ? 'bg-[#333333] text-white' : 'text-[#aaaaaa] hover:text-white hover:bg-[#1e1f26]'}`}
                >
                  <Compass className="w-4 h-4" /> Protocols
                </a>
                <a 
                  href="#developers" 
                  onClick={() => setActiveSidebarTab('developers')}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-bold transition-all ${activeSidebarTab === 'developers' ? 'bg-[#333333] text-white' : 'text-[#aaaaaa] hover:text-white hover:bg-[#1e1f26]'}`}
                >
                  <Terminal className="w-4 h-4" /> Developers
                </a>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-black text-[#666666] uppercase tracking-widest px-3 mb-2">Firm State</div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between px-3 py-2 text-xs font-mono text-[#aaaaaa] bg-[#1e1f26] rounded border border-[#333333]">
                  <span className="flex items-center gap-2 font-bold"><Activity className="w-3.5 h-3.5 text-emerald-400" /> Consensus</span>
                  <span className="text-white font-bold font-sans">Strict</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Settings Anchor */}
        <div className="pt-4 border-t border-[#333333] flex flex-col gap-1">
          <a href="#support" className="flex items-center gap-3 px-3 py-2 rounded text-xs font-bold text-[#666666] hover:text-white transition-colors">
            <HelpCircle className="w-4 h-4" /> System Documentation
          </a>
        </div>
      </aside>

      {/* ─── RIGHT SIDE MAIN LAYOUT HOLDER ─── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen relative z-10">
        
        {/* TOP NAVIGATION HEADER (CodePen Thin Styles) */}
        <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b border-[#333333] bg-[#0f172a]/90 backdrop-blur-md w-full">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-[#aaaaaa] hover:text-white p-1.5 bg-[#1e1f26] border border-[#333333] rounded" onClick={() => setIsMobileSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="font-mono text-xl font-black text-white tracking-tight">TrustLink</div>
          </div>

          {/* ACCESS PORTAL MEGA-MENU DROPDOWN */}
          <div className="relative">
            <button 
              onClick={() => setIsPortalOpen(!isPortalOpen)}
              className="flex items-center gap-2 bg-[#1e1f26] hover:bg-[#333333] text-white border border-[#444444] px-4 py-2 rounded-md text-xs font-black transition-all hover:border-[#ffdd40]"
            >
              Access Portal <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isPortalOpen ? 'rotate-180 text-[#ffdd40]' : 'text-slate-400'}`} />
            </button>

            {isPortalOpen && (
              <div className="absolute right-0 top-full mt-3 w-[340px] bg-[#1e1f26]/95 backdrop-blur-xl border border-[#444444] rounded-xl shadow-2xl p-2 animate-in slide-in-from-top-2 duration-200 z-50">
                <Link href="/dashboard" className="block p-4 rounded-lg bg-[#2c303a] border border-[#444444] hover:bg-[#ffdd40]/5 hover:border-[#ffdd40]/40 transition-all mb-2 group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-white" />
                      <span className="font-bold text-white group-hover:text-[#ffdd40] transition-colors">TrustLink Escrow</span>
                    </div>
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#98e16a]/15 text-[10px] font-mono font-bold text-[#98e16a] uppercase tracking-wider border border-[#98e16a]/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#98e16a]"></span> Live
                    </span>
                  </div>
                  <p className="text-xs text-[#aaaaaa] leading-relaxed">Secure Web2/Web3 matching rails, automated milestone enforcement, and multi-asset protection.</p>
                </Link>

                <div className="px-3 pb-2 pt-3">
                  <div className="text-[11px] font-black text-[#666666] uppercase tracking-widest mb-3">In Development</div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-[#333333] hover:bg-[#1e1f26] opacity-70">
                      <div className="flex items-center gap-3">
                        <Terminal className="w-4 h-4 text-[#aaaaaa]" />
                        <div>
                          <div className="text-sm font-bold text-white">TrustMe Academy</div>
                          <div className="text-[10px] text-[#aaaaaa]">Prompt & System Engineering</div>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono bg-[#333333] text-[#aaaaaa] px-2 py-0.5 rounded-full">DEV</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* PARALLAX HERO HERO LAYOUT CONTENT GRID (Mouse Tracking Applied Here) */}
        <div ref={heroRef} className="w-full px-6 py-12 md:py-24 max-w-[1300px] mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-16 flex-1 perspective">
          
          {/* LEFT SIDE: Heading Copy (CodePen Styles) */}
          <div className="flex-1 max-w-xl shrink-0 z-10 text-center md:text-left">
            
            <h1 className="text-5xl sm:text-6xl md:text-[5.5rem] font-extrabold tracking-tighter leading-[1.0] mb-8 text-white">
              The Firm for a<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-blue-300">
                On-Chain Economy.
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-[#aaaaaa] mb-12 leading-relaxed font-medium">
              Engineering immutable Web3 protocols, secure smart contract architecture, and seamless fiat-to-crypto bridges for the decentralized future.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              {/* CODEPEN NEON YELLOW BUTTON STYLE */}
              <Link href="/dashboard" className="flex items-center justify-center bg-[#ffdd40] hover:bg-white text-black px-10 py-4 rounded-xl text-lg font-black transition-all hover:-translate-y-0.5">
                Launch Escrow dApp
              </Link>
              <a href="#infrastructure" className="flex items-center justify-center bg-[#1e1f26] hover:bg-[#333333] text-white border border-[#444444] px-10 py-4 rounded-xl text-lg font-black transition-all hover:border-[#ffdd40]/50">
                Engineering Labs
              </a>
            </div>
          </div>

          {/* RIGHT SIDE: Dynamic Parallax Code Cards (CodePen Colors & Mouse Tracking) */}
          <div className="flex-1 w-full relative h-[480px] hidden md:block preserve-3d">
            
            {/* The CodePen-style glowing yellow frame container */}
            <div className="absolute inset-4 border border-[#ffdd40]/10 rounded-2xl bg-[#0b0f19]/30"></div>

            {/* CARD 1: Solidity (CodePen Syntax Colors & Parallax Multiplier 1.2) */}
            <div 
              style={{
                transform: `translate3d(${mouseSettings.tx * 1.2}px, ${mouseSettings.ty * 1.2}px, 50px) rotateX(${mouseSettings.rx}deg) rotateY(${mouseSettings.ry}deg)`,
                transition: 'transform 0.1s ease-out'
              }}
              className="absolute top-4 left-0 w-[360px] bg-[#1e1f26]/95 backdrop-blur-sm border border-[#333333] rounded-lg shadow-2xl p-4 group z-20 hover:border-[#ffdd40]/50"
            >
              <div className="flex justify-between items-center mb-3 border-b border-[#333333] pb-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f44336]/60"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffdd40]/60"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#98e16a]/60"></div>
                </div>
                <span className="text-[11px] font-mono font-bold text-[#aaaaaa] flex items-center gap-1.5">
                  <Box className="w-3 h-3 text-[#ffdd40]" /> Escrow.sol
                </span>
              </div>
              <pre className="font-mono text-[13px] leading-relaxed text-[#aaaaaa]">
                <span className="text-[#c678dd]">function</span> <span className="text-[#61afef]">releaseFunds</span>() <span className="text-[#c678dd]">external</span> {'{\n'}
                {'  '}require(msg.sender == buyer, <span className="text-[#d19a66]">"Auth Failed"</span>);<br/>
                {'  '}uint256 amount = lockedBalance;<br/>
                {'  '}lockedBalance = <span className="text-[#d19a66]">0</span>;<br/>
                {'  '}token.<span className="text-[#61afef]">transfer</span>(seller, amount);<br/>
                {'  '}<span className="text-[#98e16a]">emit</span> FundsReleased(amount);<br/>
                {'}'}
              </pre>
            </div>

            {/* CARD 2: TypeScript Webhook (CodePen Colors & Parallax Multiplier 0.8) */}
            <div 
              style={{
                transform: `translate3d(${mouseSettings.tx * 0.8}px, ${mouseSettings.ty * 0.8}px, 0px) rotateX(${mouseSettings.rx}deg) rotateY(${mouseSettings.ry}deg)`,
                transition: 'transform 0.1s ease-out'
              }}
              className="absolute top-40 right-4 w-[370px] bg-[#1e1f26]/95 backdrop-blur-sm border border-[#333333] rounded-lg shadow-2xl p-4 group z-10 hover:border-[#ffdd40]/50"
            >
              <div className="flex justify-between items-center mb-3 border-b border-[#333333] pb-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#333333]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#333333]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#333333]"></div>
                </div>
                <span className="text-[11px] font-mono font-bold text-blue-400 flex items-center gap-1.5">
                  <Terminal className="w-3 h-3" /> webhook-bridge.ts
                </span>
              </div>
              <pre className="font-mono text-[13px] leading-relaxed text-[#aaaaaa]">
                <span className="text-[#c678dd]">const</span> sig = req.headers[<span className="text-[#d19a66]">"x-paystack-sig"</span>];<br/>
                <span className="text-[#c678dd]">if</span> (!<span className="text-[#61afef]">verifySignature</span>(req.body, sig)) {'{\n'}
                {'  '}<span className="text-[#c678dd]">throw new</span> <span className="text-[#98e16a]">Error</span>(<span className="text-[#d19a66]">"Invalid Sig"</span>);<br/>
                {'}'}<br/>
                <span className="text-[#c678dd]">await</span> chainEngine.<span className="text-[#61afef]">verifySettlement</span>(orderId);
              </pre>
            </div>

            {/* CARD 3: Interface Controls (CodePen Colors & Parallax Multiplier 1.4) */}
            <div 
              style={{
                transform: `translate3d(${mouseSettings.tx * 1.4}px, ${mouseSettings.ty * 1.4}px, 70px) rotateX(${mouseSettings.rx}deg) rotateY(${mouseSettings.ry}deg)`,
                transition: 'transform 0.1s ease-out'
              }}
              className="absolute bottom-6 left-12 w-[340px] bg-[#1e1f26]/95 backdrop-blur-sm border border-[#333333] rounded-lg shadow-2xl p-4 group z-30 hover:border-[#ffdd40]/50"
            >
              <div className="flex justify-between items-center mb-3 border-b border-[#333333] pb-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#333333]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#333333]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#333333]"></div>
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                  <Code2 className="w-3 h-3" /> OrderDashboard.tsx
                </span>
              </div>
              <pre className="font-mono text-[13px] leading-relaxed text-[#aaaaaa]">
                {'<'}<span className="text-[#c678dd]">button</span><br/>
                {'  '}onClick={'{'}<span className="text-[#61afef]">handleRelease</span>{'}'}<br/>
                {'  '}disabled={'{'}isSyncing{'}'}<br/>
                {'  '}className=<span className="text-[#d19a66]">"bg-[#ffdd40] text-black"</span><br/>
                {'>'}<br/>
                {'  {'}isSyncing ? <span className="text-[#aaaaaa]">'Syncing...'</span> : <span className="text-white">'Release Funds'</span>{'}'}<br/>
                {'}</'}<span className="text-[#c678dd]">button</span>{'>'}
              </pre>
            </div>
          </div>
        </div>

        {/* CORE INFRASTRUCTURE (CodePen Muted Gray Theme) */}
        <section id="infrastructure" className="relative z-10 max-w-[1300px] mx-auto px-6 mt-16 mb-32 flex-none">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b border-[#333333] pb-6">
            <div>
              <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Core Infrastructure</h2>
              <p className="text-[#aaaaaa] font-mono text-sm">/ SYSTEM ENGINEERING LABS</p>
            </div>
            <div className="text-right hidden md:block">
              <div className="text-2xl font-bold text-white font-mono">99.9%</div>
              <div className="text-[11px] text-[#ffdd40] uppercase tracking-widest font-black">Audit Consensus</div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-[#1e1f26]/80 border border-[#333333] p-8 rounded-3xl backdrop-blur-sm hover:border-[#ffdd40]/40 transition-all group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
                <Network className="w-6 h-6 text-blue-400 group-hover:text-[#ffdd40] transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Protocol Architecture</h3>
              <p className="text-[#aaaaaa] text-sm leading-relaxed mb-6">
                EVM-compatible contracts engineered for gas-efficiency, security, and high-volume asset flows. Audited by leading cryptographers.
              </p>
              <div className="text-[11px] font-black text-[#666666] uppercase tracking-widest">SOLIDITY / RUST / VYPER</div>
            </div>

            <div className="bg-[#1e1f26]/80 border border-[#333333] p-8 rounded-3xl backdrop-blur-sm hover:border-[#ffdd40]/40 transition-all group">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Zero-Knowledge ID</h3>
              <p className="text-[#aaaaaa] text-sm leading-relaxed mb-6">
                Implementing privacy-preserving DID protocols for compliance and risk scoring without compromising user anonymity.
              </p>
              <div className="text-[11px] font-black text-[#666666] uppercase tracking-widest">ZK-SNARKS / DID / REPUTATION</div>
            </div>

            <div className="bg-[#1e1f26]/80 border border-[#333333] p-8 rounded-3xl backdrop-blur-sm hover:border-[#ffdd40]/40 transition-all group">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
                <Box className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Fiat Settlement Rails</h3>
              <p className="text-[#aaaaaa] text-sm leading-relaxed mb-6">
                Optimized API bridges connecting centralized banking systems with decentralized liquidity pools for instant fiat settlement.
              </p>
              <div className="text-[11px] font-black text-[#666666] uppercase tracking-widest">PAYSTACK / STRIPE / ISO-20022</div>
            </div>
          </div>
        </section>

        {/* SECURE FOOTER LINE (CodePen Colors) */}
        <footer className="border-t border-[#333333] bg-[#0b0f19]/40 mt-auto w-full flex-none relative z-10">
          <div className="max-w-[1300px] mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between text-[#aaaaaa] text-xs font-medium">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-[#dddddd]">TrustLink Firm Systems</span> © {new Date().getFullYear()}
            </div>
            <div className="flex gap-6">
              <Link href="/support" className="hover:text-white transition-colors">Privacy Infrastructure</Link>
              <Link href="/support" className="hover:text-white transition-colors">Immutable Terms</Link>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
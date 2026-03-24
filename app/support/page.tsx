'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, HelpCircle, FileText, Shield, AlertTriangle, Scale, Lock } from 'lucide-react';

export default function SupportPage() {
    const [activeTab, setActiveTab] = useState<'FAQ' | 'TOS' | 'PRIVACY'>('FAQ');

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white font-sans pb-20">
            {/* Minimal Header */}
            <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5"/>
                    </Link>
                    <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/30">
                        <Scale className="w-5 h-5 text-emerald-400" />
                    </div>
                    <span className="text-xl font-black tracking-tight text-white">
                        TrustLink <span className="text-slate-500 font-mono text-sm uppercase tracking-widest ml-2">Support & Legal</span>
                    </span>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 mt-12">
                
                {/* TABS */}
                <div className="flex flex-wrap gap-4 border-b border-slate-800 mb-8">
                    <button 
                        onClick={() => setActiveTab('FAQ')} 
                        className={`flex items-center gap-2 text-sm sm:text-base font-bold pb-4 border-b-2 transition-all ${activeTab === 'FAQ' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <HelpCircle className="w-4 h-4" /> Frequently Asked Questions
                    </button>
                    <button 
                        onClick={() => setActiveTab('TOS')} 
                        className={`flex items-center gap-2 text-sm sm:text-base font-bold pb-4 border-b-2 transition-all ${activeTab === 'TOS' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <FileText className="w-4 h-4" /> Terms of Service
                    </button>
                    <button 
                        onClick={() => setActiveTab('PRIVACY')} 
                        className={`flex items-center gap-2 text-sm sm:text-base font-bold pb-4 border-b-2 transition-all ${activeTab === 'PRIVACY' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <Shield className="w-4 h-4" /> Privacy Policy
                    </button>
                </div>

                {/* TAB CONTENT: FAQ */}
                {activeTab === 'FAQ' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <h2 className="text-3xl font-extrabold mb-6">How TrustLink Works</h2>
                        
                        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Lock className="w-5 h-5 text-emerald-400"/> What is TrustLink?</h3>
                            <p className="text-slate-400 leading-relaxed">TrustLink is a secure escrow agent. We lock a buyer's funds (either Fiat NGN via Paystack or Crypto via Smart Contracts) and hold them safely until the seller delivers the agreed-upon goods or services. Once both parties are satisfied, the funds are released.</p>
                        </div>

                        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-yellow-500"/> How do Split/Partial Payments work?</h3>
                            <p className="text-slate-400 leading-relaxed">Buyers can choose to release a portion of the locked funds before the final delivery (e.g., for material costs). <strong>Warning:</strong> Partial releases are final and irreversible. If you release 50% of the funds and the seller vanishes, TrustLink can only refund the remaining 50% locked in escrow.</p>
                        </div>

                        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Scale className="w-5 h-5 text-red-400"/> What happens in a dispute?</h3>
                            <p className="text-slate-400 leading-relaxed">If a transaction goes wrong, either party can click "Dispute". The funds remain frozen, and a TrustLink Administrator will review the on-platform chat logs to determine the rightful owner. The Admin's ruling is final. Users found committing fraud will have their Trust Score permanently reduced to 0%.</p>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: TERMS OF SERVICE */}
                {activeTab === 'TOS' && (
                    <div className="space-y-8 animate-in fade-in duration-300 text-slate-300 leading-relaxed">
                        <h2 className="text-3xl font-extrabold text-white mb-2">Terms of Service</h2>
                        <p className="text-sm text-slate-500 mb-8">Last Updated: March 2026</p>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">1. Neutral Escrow Agent</h3>
                            <p>TrustLink acts strictly as a neutral, third-party escrow agent. We do not own, inspect, guarantee, or take possession of the physical or digital goods being transacted. Our sole responsibility is the secure custody of Fiat (NGN) or Cryptocurrency pending the mutual agreement of the Buyer and Seller, or the resolution of a dispute.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">2. Milestone & Partial Releases</h3>
                            <p>Buyers have the option to release portions of the locked escrow balance to the Seller prior to the completion of the transaction. <strong>The Buyer assumes all risk for partial releases.</strong> Once funds are released from the TrustLink Smart Contract or Fiat holding accounts, they cannot be recovered, clawed back, or refunded under any circumstances.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">3. Dispute Resolution & Authority</h3>
                            <p>In the event of a dispute, funds will remain locked indefinitely until a TrustLink Administrator intervenes. By using this platform, both parties agree that the TrustLink Administrator has absolute and final authority to distribute the funds based on the evidence provided in the TrustLink Secure Chat. External communication (WhatsApp, Telegram, etc.) will not be considered as binding evidence.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">4. Fraud & The Reputation System</h3>
                            <p>TrustLink maintains a public Trust Score for all wallets and emails. If an Administrator determines that a user has acted maliciously, attempted to defraud another user, or collected a partial payment without intent to deliver, TrustLink reserves the right to issue a "Severe Strike." A Severe Strike permanently drops the user's public Trust Score to 0%, warning all future users of fraudulent activity.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">5. Limitation of Liability</h3>
                            <p>To the maximum extent permitted by law, TrustLink and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, resulting from your use of the platform, the failure of a counterparty to deliver goods, or the outcome of a dispute resolution.</p>
                        </section>
                    </div>
                )}

                {/* TAB CONTENT: PRIVACY POLICY */}
                {activeTab === 'PRIVACY' && (
                    <div className="space-y-8 animate-in fade-in duration-300 text-slate-300 leading-relaxed">
                        <h2 className="text-3xl font-extrabold text-white mb-2">Privacy Policy</h2>
                        <p className="text-sm text-slate-500 mb-8">Last Updated: March 2026</p>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">Data Collection</h3>
                            <p>We collect only the minimum data required to facilitate secure escrow transactions. This includes your email address, Web3 wallet address, and on-platform chat messages. For fiat transactions, bank account details are securely processed via Paystack and are not stored in plain text on our servers.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">Chat Privacy</h3>
                            <p>Messages sent through the TrustLink Secure Chat are stored in our database for the sole purpose of transaction history and dispute resolution. In the event of a dispute, TrustLink Administrators will review these logs to make a fair ruling. We do not sell, rent, or share your chat data with third-party advertisers.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">Public Profiles</h3>
                            <p>To ensure a safe ecosystem, your transaction statistics (Total Orders, Successful Orders, Disputes Lost) are public and tied to your wallet address or email. This data forms your public Trust Score.</p>
                        </section>
                    </div>
                )}

            </main>
        </div>
    );
}
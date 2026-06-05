'use client';
import React, { useState, useEffect, useRef } from 'react';
import MasterTopbar from '@/components/dashboard/MasterTopbar';
import DynamicSidebar from '@/components/dashboard/DynamicSidebar';
import XpressDashboard from '@/components/xpress/XpressDashboard';
import { useAuth } from '@/context/AuthContext'; 

// Error Boundary wrapper to prevent full page crashes
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <div className="p-8 text-red-400 border border-red-500/20 bg-red-500/10 rounded-xl">Failed to load module. Please refresh the page.</div>;
    }
    return this.props.children;
  }
}

export default function AppShell() {
  const [appMode, setAppMode] = useState<'xpress' | 'market'>('xpress');
  const [activeTab, setActiveTab] = useState('xpress-home');
  const previousMode = useRef(appMode);
  
  // Real Database Hooks
  const { profileData } = useAuth();
  const isVerifiedSeller = profileData?.tier_2_verified || false; 
  // Strict TS fix using nullish coalescing
  const hasGlobalAlert = (profileData?.unread_notifications ?? 0) > 0; 

  // Fixed useEffect: Dependency array trimmed to exactly what triggers the lifecycle
  useEffect(() => {
    if (previousMode.current !== appMode) {
      // Using a functional state update prevents needing activeTab in the dependency array
      setActiveTab((prev) => {
        if (appMode === 'xpress' && !prev.startsWith('xpress')) return 'xpress-home';
        if (appMode === 'market' && !prev.startsWith('market') && !prev.startsWith('seller')) return 'market-discover';
        return prev;
      });
      previousMode.current = appMode;
    }
  }, [appMode]);

  const renderContent = () => {
    switch (activeTab) {
      case 'xpress-home': return <XpressDashboard />;
      case 'xpress-escrows': return <div className="text-white p-8">Escrow List Table goes here...</div>;
      case 'market-discover': return <div className="text-white p-8">Market Discovery logic goes here...</div>;
      default: return <div className="text-white p-8">Module not found.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] font-sans overflow-hidden flex flex-col">
      <MasterTopbar appMode={appMode} setAppMode={setAppMode} hasGlobalAlert={hasGlobalAlert} />

      <div className="flex flex-1 overflow-hidden relative">
        <DynamicSidebar appMode={appMode} activeTab={activeTab} setActiveTab={setActiveTab} isVerifiedSeller={isVerifiedSeller} />
        
        <main className="flex-1 md:ml-64 overflow-y-auto bg-[#0b0f19]">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
export default function AppShell() {
  const [appMode, setAppMode] = useState<'xpress' | 'market'>('xpress');
  const [activeTab, setActiveTab] = useState('xpress-home');
  const previousMode = useRef(appMode);
  
  // 1. Properly typed local state for the profile
  const [profileData, setProfileData] = useState<{ tier_2_verified: boolean; unread_notifications: number } | null>(null);

  // 2. Destructure ONLY what AuthContext actually provides
  const { supabase, walletAddress, sessionReady } = useAuth();

  // 3. Fetch the profile data when the session is ready
  useEffect(() => {
    async function fetchProfile() {
      if (!sessionReady || !walletAddress) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('tier_2_verified, unread_notifications')
        .eq('wallet_address', walletAddress)
        .single();
        
      if (!error && data) {
        setProfileData(data);
      }
    }
    
    fetchProfile();
  }, [sessionReady, walletAddress, supabase]);

  // 4. Safely derive UI states
  const isVerifiedSeller = profileData?.tier_2_verified || false; 
  const hasGlobalAlert = (profileData?.unread_notifications ?? 0) > 0; 

  // Fixed useEffect for Tab Switching
  useEffect(() => {
    if (previousMode.current !== appMode) {
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
}git
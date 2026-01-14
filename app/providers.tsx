'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { createConfig, WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { sepolia } from 'wagmi/chains';
import { http } from 'wagmi';

const queryClient = new QueryClient();

const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId="cmkbibcbl00lxjo0cym764uvc"
      config={{
        // 1. Visual Settings
        appearance: {
          theme: 'dark',
          accentColor: '#10b981', // Emerald Green
          logo: 'https://auth.privy.io/logos/privy-logo.png',
          // We removed 'showWalletLoginFirst' to let Privy handle the layout naturally
        },
        
        // 2. REMOVED 'loginMethodsAndOrder' 
        // We deleted this section. Now, whatever you enable in the Dashboard 
        // (Google, Twitter, Wallets, Passkeys) will automatically appear.

        // 3. Embedded Wallet Config
        embeddedWallets: {
          createOnLogin: 'users-without-wallets', 
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
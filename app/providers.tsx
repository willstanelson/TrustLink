'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { sepolia } from 'wagmi/chains';
import { http } from 'wagmi';
import React from 'react';

// 1. Setup the React Query Client (Required by Wagmi)
const queryClient = new QueryClient();

// 2. Setup the Wagmi Config using Privy's custom wrapper
export const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      // 👇 IMPORTANT: PUT YOUR ACTUAL PRIVY APP ID HERE!
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "YOUR_PRIVY_APP_ID_HERE"} 
      config={{
        // ✅ THE FIX: Tell Privy to specifically lock onto Sepolia
        defaultChain: sepolia,
        supportedChains: [sepolia],
        
        appearance: { 
          theme: 'dark', 
          accentColor: '#10b981', // TrustLink Emerald
          logo: 'https://trust-link-sooty.vercel.app/favicon.ico' // Optional
        },
        // 🔥 THIS IS THE TICKET TO YOUR INCENTIVES!
    walletConnectCloudProjectId: '836bc2231c157ce81b1030811a1512d5',
        // ✅ THIS IS THE MAGIC LINE: It creates the embedded wallet for Gmail users!
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
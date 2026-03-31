'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import { defineChain } from 'viem'; // <-- Import defineChain
import React from 'react';

// ==========================================
// 1. DEFINE THE PLASMA TESTNET
// ==========================================
export const plasmaTestnet = defineChain({
  id: 9746,
  name: 'Plasma Testnet',
  network: 'plasma-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Plasma',
    symbol: 'XPL', // The native token is XPL, not ETH
  },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.plasma.to'] },
    public: { http: ['https://testnet-rpc.plasma.to'] },
  },
  blockExplorers: {
    default: { name: 'PlasmaScan', url: 'https://testnet.plasmascan.to' },
  },
});

// 2. Setup the React Query Client (Required by Wagmi)
const queryClient = new QueryClient();

// 3. Setup the Wagmi Config targeting Plasma instead of Sepolia
export const wagmiConfig = createConfig({
  chains: [plasmaTestnet],
  transports: {
    [plasmaTestnet.id]: http(),
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "YOUR_PRIVY_APP_ID_HERE"} 
      config={{
        // ✅ Switch default and supported chains to Plasma
        defaultChain: plasmaTestnet,
        supportedChains: [plasmaTestnet],
        
        appearance: { 
          theme: 'dark', 
          accentColor: '#10b981', // TrustLink Emerald
          logo: 'https://trustlink.com.ng/favicon.ico' 
        },
        walletConnectCloudProjectId: '836bc2231c157ce81b1030811a1512d5',
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
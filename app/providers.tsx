'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import { defineChain } from 'viem';
import { baseSepolia, bscTestnet, optimismSepolia, polygonAmoy } from 'viem/chains';
import React, { useState } from 'react';

// 🚀 THE FIX: Import AuthProvider here, inside the Client Component boundary
import { AuthProvider } from '@/context/AuthContext';

// ==========================================
// 1. DEFINE THE PLASMA TESTNET
// ==========================================
export const plasmaTestnet = defineChain({
  id: 9746,
  name: 'Plasma Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Plasma',
    symbol: 'XPL',
  },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.plasma.to'] },
    public: { http: ['https://testnet-rpc.plasma.to'] },
  },
  blockExplorers: {
    default: { name: 'PlasmaScan', url: 'https://testnet.plasmascan.to' },
  },
});

// ==========================================
// 2. WAGMI CONFIG
// ==========================================
export const wagmiConfig = createConfig({
  chains: [plasmaTestnet, baseSepolia, bscTestnet, optimismSepolia, polygonAmoy],
  transports: {
    [plasmaTestnet.id]: http(),
    [baseSepolia.id]: http(),
    [bscTestnet.id]: http(),
    [optimismSepolia.id]: http(),
    [polygonAmoy.id]: http(),
  },
});

// ==========================================
// 3. PROVIDERS
// ==========================================
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'YOUR_PRIVY_APP_ID_HERE'}
      config={{
        defaultChain: plasmaTestnet,
        supportedChains: [plasmaTestnet, baseSepolia, bscTestnet, optimismSepolia, polygonAmoy],
        appearance: {
          theme: 'dark',
          accentColor: '#10b981',
          logo: 'https://trustlink.com.ng/favicon.ico',
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
          {/* 🚀 THE FIX: AuthProvider safely executes entirely on the client side */}
          <AuthProvider>
            {children}
          </AuthProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
import { useMemo } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { useWalletClient } from 'wagmi';

export function clientToSigner(client: any) {
  const { account, chain, transport } = client;
  
  // 1. Define Network
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  // 2. Create Provider (Robust for Embedded Wallets)
  const provider = new BrowserProvider(transport, network);
  
  // 3. Create Signer
  const signer = new JsonRpcSigner(provider, account.address);
  return signer;
}

export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  // Fetch the wallet client from Wagmi
  const { data: client } = useWalletClient({ chainId });
  
  return useMemo(() => {
    if (!client) return undefined;
    return clientToSigner(client);
  }, [client]);
}
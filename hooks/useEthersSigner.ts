import { useMemo } from 'react';
import { providers } from 'ethers';
import { useWalletClient } from 'wagmi';

export function clientToSigner(client: any) {
  const { account, chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  // In v5, we use Web3Provider instead of BrowserProvider
  const provider = new providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);
  return signer;
}

export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: client } = useWalletClient({ chainId });
  return useMemo(() => (client ? clientToSigner(client) : undefined), [client]);
}
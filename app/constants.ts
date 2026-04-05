// 1. The Universal Escrow Contract Address
export const CONTRACT_ADDRESS = "0x27aCD1C45583B005CB071B23eF147702A618420E" as `0x${string}`;

// 2. The Multi-Chain Configuration Dictionary
export const CHAIN_CONFIG: Record<number, { name: string; nativeSymbol: string; usdcAddress: `0x${string}` }> = {
  9746: { // Plasma Testnet
    name: 'Plasma',
    nativeSymbol: 'XPL',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' // Your existing Plasma test USDC
  },
  84532: { // Base Sepolia
    name: 'Base',
    nativeSymbol: 'ETH',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' // Official Circle Testnet USDC
  },
  97: { // BSC Testnet
    name: 'BNB Chain',
    nativeSymbol: 'tBNB',
    usdcAddress: '0x64544969ed7EBf5f083679233325356EBe738930' // Standard BSC Testnet stablecoin
  },
  11155420: { // Optimism Sepolia
    name: 'Optimism',
    nativeSymbol: 'ETH',
    usdcAddress: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7' // Official Circle Testnet USDC
  },
  80002: { // Polygon Amoy
    name: 'Polygon',
    nativeSymbol: 'POL',
    usdcAddress: '0x41E94Eb019C0762f9Bfcf9Cb1EE62ce5169AF1fa' // Official Circle Testnet USDC
  }
};

// 3. The Escrow Smart Contract ABI
export const CONTRACT_ABI = [
  {
    "inputs": [],
    "name": "escrowCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "escrows",
    "outputs": [
      { "internalType": "uint256", "name": "id", "type": "uint256" },
      { "internalType": "address", "name": "buyer", "type": "address" },
      { "internalType": "address", "name": "seller", "type": "address" },
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "uint256", "name": "lockedBalance", "type": "uint256" },
      { "internalType": "bool", "name": "isAccepted", "type": "bool" },
      { "internalType": "bool", "name": "isShipped", "type": "bool" },
      { "internalType": "bool", "name": "isDisputed", "type": "bool" },
      { "internalType": "bool", "name": "isCompleted", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "_seller", "type": "address" },
      { "internalType": "address", "name": "_token", "type": "address" },
      { "internalType": "uint256", "name": "_amount", "type": "uint256" }
    ],
    "name": "createEscrow",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_escrowId", "type": "uint256" }, { "internalType": "uint256", "name": "_amount", "type": "uint256" }],
    "name": "releaseMilestone",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_escrowId", "type": "uint256" }],
    "name": "raiseDispute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_escrowId", "type": "uint256" }],
    "name": "cancelOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
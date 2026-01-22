// ✅ BEST PRACTICE: Force the type at the source
export const CONTRACT_ADDRESS = "0x1F67f8587D443520E4B3EFC3D1f6f657b653C829" as `0x${string}`;

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
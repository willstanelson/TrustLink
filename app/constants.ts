// 1. Your Deployed Contract Address (V3)
export const CONTRACT_ADDRESS = "0x1F67f8587D443520E4B3EFC3D1f6f657b653C829"; 

// 2. The Full V3 Interface (ABI)
export const CONTRACT_ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "initiator", "type": "address" }], "name": "DisputeRaised", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" }, { "indexed": false, "internalType": "address", "name": "winner", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "DisputeResolved", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "buyer", "type": "address" }, { "indexed": true, "internalType": "address", "name": "seller", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "address", "name": "token", "type": "address" }], "name": "EscrowCreated", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "amountReleased", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "feeTaken", "type": "uint256" }], "name": "MilestoneReleased", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" }], "name": "OrderAccepted", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" }], "name": "OrderCancelled", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" }], "name": "OrderShipped", "type": "event" },
  { "inputs": [], "name": "AUTO_RELEASE_TIME", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "FEE_PERCENT", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }], "name": "acceptOrder", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }], "name": "cancelOrder", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "_seller", "type": "address" }, { "internalType": "address", "name": "_token", "type": "address" }, { "internalType": "uint256", "name": "_amount", "type": "uint256" }], "name": "createEscrow", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [], "name": "escrowCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "escrows", "outputs": [
      { "internalType": "uint256", "name": "id", "type": "uint256" },
      { "internalType": "address", "name": "buyer", "type": "address" },
      { "internalType": "address", "name": "seller", "type": "address" },
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "uint256", "name": "totalAmount", "type": "uint256" },
      { "internalType": "uint256", "name": "lockedBalance", "type": "uint256" },
      { "internalType": "bool", "name": "isAccepted", "type": "bool" },
      { "internalType": "bool", "name": "isShipped", "type": "bool" },
      { "internalType": "bool", "name": "isDisputed", "type": "bool" },
      { "internalType": "bool", "name": "isCompleted", "type": "bool" },
      { "internalType": "uint256", "name": "createdAt", "type": "uint256" }
    ], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "feeCollector", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }], "name": "markShipped", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }], "name": "raiseDispute", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }, { "internalType": "uint256", "name": "_amountToRelease", "type": "uint256" }], "name": "releaseMilestone", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }, { "internalType": "address", "name": "_winner", "type": "address" }], "name": "resolveDispute", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }], "name": "withdrawStuckFunds", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];
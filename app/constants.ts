import {
  sepolia,
  bscTestnet,
  baseSepolia,
  optimismSepolia,
  polygonAmoy,
} from 'viem/chains';
import { defineChain } from 'viem';
import type { Chain } from 'viem';

export const CONTRACT_ADDRESS = "0x5025F74946fa6091cE61C7A85E87099F8EF35086" as `0x${string}`;
export const CONTRACT_ABI = [ 
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "initiator",
          "type": "address"
        }
      ],
      "name": "DisputeRaised",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "winner",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "DisputeResolved",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "buyer",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "seller",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "token",
          "type": "address"
        }
      ],
      "name": "EscrowCreated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "address",
          "name": "newCollector",
          "type": "address"
        }
      ],
      "name": "FeeCollectorUpdated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "newFeePercent",
          "type": "uint256"
        }
      ],
      "name": "FeeUpdated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amountReleased",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "feeTaken",
          "type": "uint256"
        }
      ],
      "name": "MilestoneReleased",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        }
      ],
      "name": "OrderAccepted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        }
      ],
      "name": "OrderCancelled",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        }
      ],
      "name": "OrderShipped",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "AUTO_RELEASE_TIME",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_FEE",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_orderId",
          "type": "uint256"
        }
      ],
      "name": "acceptOrder",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_orderId",
          "type": "uint256"
        }
      ],
      "name": "cancelOrder",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_seller",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_token",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "_amount",
          "type": "uint256"
        }
      ],
      "name": "createEscrow",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "escrowCount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "escrows",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "buyer",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "seller",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "token",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "totalAmount",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "lockedBalance",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "isAccepted",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "isShipped",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "isDisputed",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "isCompleted",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "createdAt",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "feeCollector",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "feePercent",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_orderId",
          "type": "uint256"
        }
      ],
      "name": "markShipped",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_orderId",
          "type": "uint256"
        }
      ],
      "name": "raiseDispute",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_orderId",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_amountToRelease",
          "type": "uint256"
        }
      ],
      "name": "releaseMilestone",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_orderId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "_winner",
          "type": "address"
        }
      ],
      "name": "resolveDispute",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_newCollector",
          "type": "address"
        }
      ],
      "name": "setFeeCollector",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_newFee",
          "type": "uint256"
        }
      ],
      "name": "setFeePercent",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_orderId",
          "type": "uint256"
        }
      ],
      "name": "withdrawStuckFunds",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ] as const;

export const plasmaTestnet = defineChain({
  id: 9746,
  name: 'Plasma Testnet',
  nativeCurrency: { name: 'Plasma', symbol: 'XPL', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.plasma.to'] },
    public: { http: ['https://testnet-rpc.plasma.to'] },
  },
  blockExplorers: {
    default: { name: 'PlasmaScan', url: 'https://testnet.plasmascan.to' },
  },
});

export const DEFAULT_CHAIN_ID = 9746;

export const SUPPORTED_CHAIN_IDS = [9746, 97, 80002, 84532, 11155111, 11155420] as const;

export const CHAIN_CONFIG: Record<number, {
  name: string;
  nativeSymbol: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  usdcAddress: `0x${string}`;
  viemChain: Chain;
}> = {
  9746: {
    name: 'Plasma Testnet',
    nativeSymbol: 'XPL',
    nativeCurrency: { name: 'Plasma', symbol: 'XPL', decimals: 18 },
    usdcAddress: '0xf884b63217d3427677c7b045370bb269fabf1fa7',
    viemChain: plasmaTestnet,
  },
  97: {
    name: 'BSC Testnet',
    nativeSymbol: 'BNB',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    usdcAddress: '0x03f0f06cD3B43b62e928e10Eaf05f0eB10D55683',
    viemChain: { ...bscTestnet, nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 } },
  },
  80002: {
    name: 'Polygon Amoy',
    nativeSymbol: 'POL',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    usdcAddress: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    viemChain: { ...polygonAmoy, nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 } },
  },
  84532: {
    name: 'Base Sepolia',
    nativeSymbol: 'ETH',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    viemChain: { ...baseSepolia, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } },
  },
  11155111: {
    name: 'Ethereum Sepolia',
    nativeSymbol: 'ETH',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    viemChain: { ...sepolia, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } },
  },
  11155420: {
    name: 'Optimism Sepolia',
    nativeSymbol: 'OP',
    nativeCurrency: { name: 'Optimism', symbol: 'OP', decimals: 18 },
    usdcAddress: '0x5fd84259d66Cd46123540766Be93DFE6D43130D',
    viemChain: { ...optimismSepolia, nativeCurrency: { name: 'Optimism', symbol: 'OP', decimals: 18 } },
  },
};
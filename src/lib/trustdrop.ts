// TrustDrop contract ABI and address constants.
// Deployed on Arc Testnet: 0xbfba2549c088af4ec9bc088e6692b3068e661f2b

export const TRUSTDROP_ABI = [
  // Write functions
  {
    name: 'createVault',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'pqPublicKey', type: 'bytes32' },
      { name: 'checkInInterval', type: 'uint256' },
      { name: 'graceWindow', type: 'uint256' },
      { name: 'beneficiaries', type: 'address[]' },
      { name: 'shares', type: 'uint256[]' },
    ],
    outputs: [{ name: 'vaultId', type: 'uint256' }],
  },
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'checkIn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'pqSignature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'pqSignature', type: 'bytes' },
    ],
    outputs: [],
  },
  // Read functions
  {
    name: 'vaultStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'balance', type: 'uint256' },
      { name: 'lastCheckIn', type: 'uint256' },
      { name: 'nextDeadline', type: 'uint256' },
      { name: 'lapsed', type: 'bool' },
      { name: 'settled', type: 'bool' },
    ],
  },
  {
    name: 'getBeneficiaries',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [
      { name: 'beneficiaries', type: 'address[]' },
      { name: 'shares', type: 'uint256[]' },
    ],
  },
  {
    name: 'isLapsed',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'nextVaultId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Events
  {
    name: 'VaultCreated',
    type: 'event',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'checkInInterval', type: 'uint256', indexed: false },
      { name: 'graceWindow', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'CheckedIn',
    type: 'event',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'nonce', type: 'uint256', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Claimed',
    type: 'event',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'claimedBy', type: 'address', indexed: true },
      { name: 'totalAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Withdrawn',
    type: 'event',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Filled after deploy
export const TRUSTDROP_ADDRESS = (import.meta.env.VITE_TRUSTDROP_ADDRESS ?? '') as `0x${string}`;

export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const;

export const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/** Format seconds into human-readable duration. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)} days`;
}

/** Format Unix timestamp to locale string. */
export function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

/** Countdown from now to a future timestamp. */
export function formatCountdown(futureTs: number): string {
  const diff = futureTs - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'Lapsed';
  return formatDuration(diff);
}

export type VaultStatus = {
  owner: string;
  balance: bigint;
  lastCheckIn: bigint;
  nextDeadline: bigint;
  lapsed: boolean;
  settled: boolean;
};

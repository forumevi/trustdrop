# TrustDrop

**A USDC inheritance vault on Arc. If you stop checking in, your beneficiaries can claim.**

Built with [Arc Studio](https://studio.arc.io)

TrustDrop is a dead man's switch for USDC. You lock funds into a vault, set a check-in interval (weekly, monthly, yearly), and designate beneficiaries with percentage shares. As long as you check in regularly with a post-quantum SLH-DSA signature, the money stays yours. If you stop — because you can't, not because someone stole your wallet — your beneficiaries can claim after the grace window expires.

The SLH-DSA key is kept offline, separate from your EVM wallet. A stolen wallet key cannot fake a proof of life.

## What makes it Arc-native

- **USDC as gas**: the vault, deposits, payouts, and gas fees are all one asset. Beneficiaries with empty wallets can still claim.
- **Sub-second finality**: claims settle in under a second, no pending state.
- **SLH-DSA precompile**: Arc has a built-in post-quantum signature verifier at `0x1800000000000000000000000000000000000004`. TrustDrop uses it to verify every check-in and withdrawal on-chain.

## How it works

| Step | Who | What happens |
|---|---|---|
| Create vault | Owner | Locks USDC, sets interval + grace window, names beneficiaries and shares |
| Check in | Owner | Submits SLH-DSA signature every interval to prove they are alive |
| Withdraw | Owner | Retrieves funds any time they are not lapsed, with SLH-DSA proof |
| Claim | Anyone | After interval + grace window with no check-in, sends USDC to beneficiaries |

## Contract

- **Arc Testnet**: `0xbfba2549c088af4ec9bc088e6692b3068e661f2b`
- Source: `contracts/TrustDrop.sol`
- 67 Foundry tests: unit, fuzz, invariant, revert paths
- No owner admin, no upgrade path, no pause function

## Tech stack

- Solidity 0.8.28, Foundry, OpenZeppelin
- React + TypeScript + Vite, wagmi v2, ConnectKit
- Arc mainnet (chain ID 5042), USDC at `0x3600000000000000000000000000000000000000`
- SLH-DSA verifier precompile at `0x1800000000000000000000000000000000000004`

## Development

### Prerequisites

- [Bun](https://bun.sh)
- [Foundry](https://getfoundry.sh)

### Install

```bash
bun install
```

### Environment variables

| Variable | Purpose |
|---|---|
| `VITE_TRUSTDROP_ADDRESS` | Deployed TrustDrop contract address |
| `RPC_PROXY_BASE_URL` | Optional — Arc Studio RPC proxy base URL (set automatically in Arc Studio) |
| `RPC_PROXY_TOKEN` | Optional — Arc Studio RPC proxy token (set automatically in Arc Studio) |
| `RPC_PROXY_CHAINS` | Optional — chains available via the proxy (set automatically in Arc Studio) |

### Run

```bash
bun run dev
```

### Test contracts

```bash
forge test
```

### Build

```bash
bun run build
```

### Deploy to Arc mainnet

```bash
export PRIVATE_KEY=<your_private_key>

forge create contracts/TrustDrop.sol:TrustDrop \
  --rpc-url https://rpc.mainnet.arc.io \
  --private-key $PRIVATE_KEY \
  --broadcast
```

After deploy, set `VITE_TRUSTDROP_ADDRESS` to the deployed address and update `src/config.ts` to use the Arc mainnet chain.

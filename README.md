# TrustDrop

**A USDC inheritance vault on Arc. Lock funds, check in to prove you're alive, and if you stop checking in your beneficiaries claim everything automatically.**

Built with [Arc Studio](https://studio.arc.io)

---

## The problem

Every crypto holder faces the same question: what happens to my USDC if I'm incapacitated or die? Hardware wallets get lost. Seed phrases sit in drawers. Exchange accounts get frozen. There is no reliable, trustless way to pass on USDC.

TrustDrop fixes this with a dead man's switch. You lock USDC in a vault and check in periodically — once a month, once a year, whatever you choose. As long as you check in, only you control the funds. If you stop checking in, your designated beneficiaries can claim everything after a grace period.

The twist: check-ins require a **post-quantum SLH-DSA signature**, verified on-chain through Arc's built-in PQ precompile. Even if your EVM wallet is stolen, an attacker can't fake a check-in without the offline key card. The key that proves you're alive is separate from the key that moves money.

## How it works

| Step | Who | What |
|---|---|---|
| Create vault | Owner | Lock USDC, set check-in interval and grace window, name beneficiaries with shares |
| Check in | Owner | Submit a post-quantum signature — proves you're alive, resets the clock |
| Withdraw | Owner | Reclaim all funds any time (requires PQ signature) |
| Claim | Anyone | Once the vault lapses, distribute USDC to beneficiaries by their share |

## Why Arc

- **USDC as gas**: the vault, deposits, check-ins and payouts are all the same asset — no second token needed
- **Sub-second finality**: a claim lands in under a second, not "pending for 10 minutes"
- **SLH-DSA precompile**: Arc has a built-in post-quantum signature verifier at `0x1800...0004` — verifying a 7,856-byte SLH-DSA signature on-chain costs fractions of a cent

## Live on Arc Mainnet

- **Contract**: [`0x11526Cad05a63174392e7C7157929733eb5D8751`](https://explorer.arc.io/address/0x11526Cad05a63174392e7C7157929733eb5D8751)
- **Deploy tx**: [`0x6cfd4c...`](https://explorer.arc.io/tx/0x6cfd4cfed7ac1aa7b151038f552540fd30235ada4c154d6cf34688ec69399076)
- **Chain ID**: 5042

## Tech stack

- Solidity 0.8.28 + Foundry (67 tests: unit, fuzz, invariant)
- React 18, Vite, TypeScript, Tailwind CSS
- wagmi v2 + viem v2 + ConnectKit
- Arc mainnet, USDC at `0x3600000000000000000000000000000000000000`
- SLH-DSA precompile at `0x1800000000000000000000000000000000000004`

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
| `VITE_TRUSTDROP_ADDRESS` | TrustDrop contract address on Arc mainnet |
| `RPC_PROXY_BASE_URL` | RPC proxy base URL (optional outside Arc Studio) |
| `RPC_PROXY_TOKEN` | RPC proxy token (optional outside Arc Studio) |

### Run

```bash
bun run dev
```

### Test contracts

```bash
bun run contracts:test
```

### Build

```bash
bun run build
```

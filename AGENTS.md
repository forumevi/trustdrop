# TrustDrop

> Built with Arc Studio — https://studio.arc.io

Dead man's switch USDC inheritance vault on Arc mainnet. Lock USDC, check in periodically with a post-quantum SLH-DSA signature, and if you stop checking in your beneficiaries can claim the funds.

---

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry
- Chain: Arc Mainnet (Chain ID: 5042)
- Token: USDC at 0x3600000000000000000000000000000000000000
- PQ Verifier: Arc SLH-DSA precompile at 0x1800000000000000000000000000000000000004

## Deployed Contracts

| Contract | Network | Address | Explorer |
|---|---|---|---|
| TrustDrop | Arc Mainnet | 0x11526Cad05a63174392e7C7157929733eb5D8751 | https://explorer.arc.io/address/0x11526Cad05a63174392e7C7157929733eb5D8751 |
| TrustDrop | Arc Testnet | 0xbfba2549c088af4ec9bc088e6692b3068e661f2b | https://explorer.testnet.arc.io/address/0xbfba2549c088af4ec9bc088e6692b3068e661f2b |

Deploy tx (mainnet): 0x6cfd4cfed7ac1aa7b151038f552540fd30235ada4c154d6cf34688ec69399076
Deployer: 0x292685C0e1572Ec472cD8d4a971C9F26e262E27d

## Key Files

- `contracts/TrustDrop.sol` — main vault contract
- `contracts/test/TrustDrop.*.t.sol` — 67 Foundry tests
- `src/lib/trustdrop.ts` — ABI + address constants
- `src/components/CreateVaultForm.tsx` — vault creation UI
- `src/components/VaultCard.tsx` — vault status + actions UI
- `src/App.tsx` — thin composition root

## Environment Variables

- `VITE_TRUSTDROP_ADDRESS` — mainnet contract address (set in .env)

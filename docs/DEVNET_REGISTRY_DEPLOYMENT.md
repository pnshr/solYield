# Devnet Registry Deployment

## Summary

The registry program has been deployed to Solana devnet and the registry
config PDA initialised. The deployment manifest is committed at
[`deployments/devnet/registry.json`](../deployments/devnet/registry.json).

| Field | Value |
| --- | --- |
| Cluster | devnet |
| Registry program ID | `HiLF1P7LguVyBbzMSN3hK4ErGxfxaS6TMPbR6R73Dtdn` |
| Registry config PDA | `6nvRCSjroNvqsVeAzTKmdfjUEfgDarHdLXvwect6gXvY` |
| Governance authority | `9B4MhXCsqr2SyQNRw4KoakcwriqN637GhpjxCnaafSmd` |
| Program data address | `ZRg2ehqsY2PVDnPTvomkJA48ui6T9S2vGVKN9H21osu` |
| Program data slot | 468043978 |
| Init signature | `3w3hCf3ye6SombevDTGbCh7tbMge1TqrNTJ3WpSYbwecZNGYsdtEzh8uV3jegbVp3cVmsC6bHdhALzokqVs1JVmv` |
| Deployed at | 2026-06-08T15:23:39.564Z |
| Verified at | 2026-06-08T15:23:54.974Z |

## How to verify

```sh
npm run verify:devnet:registry
```

This calls `scripts/verify-devnet-registry.ts`, which checks that:

1. The program account at `HiLF1P7LguVyBbzMSN3hK4ErGxfxaS6TMPbR6R73Dtdn` is
   executable and owned by the BPF Upgradeable Loader.
2. The registry config PDA (`6nvRCSjroNvqsVeAzTKmdfjUEfgDarHdLXvwect6gXvY`)
   is initialised and its `governance_authority` matches the keypair.
3. The `programDataSlot` in the manifest matches the on-chain `last_deploy_slot`
   in the `ProgramData` account.

Pass `--write` to update `deployments/devnet/registry.json` with the current
on-chain state.

## How to reproduce

### Prerequisites

- Solana CLI `2.2.20`
- Anchor CLI `0.31.1`
- A devnet-funded wallet at `REGISTRY_AUTHORITY_KEYPAIR` (≥ 3 SOL for BPF
  program account rent + deploy buffer)

### Steps

```sh
# 1. Build the registry program
anchor build

# 2. (Optional) Preview commands without executing
npm run deploy:devnet:plan

# 3. Deploy and initialise
DEVNET_RPC_URL=https://api.devnet.solana.com \
REGISTRY_AUTHORITY_KEYPAIR=~/.config/solana/id.json \
npm run deploy:devnet

# 4. Verify
npm run verify:devnet:registry
```

The deploy script (`scripts/deploy-devnet.ts`) runs `anchor deploy` for the
registry program, then calls `initializeRegistryIfNeeded` via the SDK to create
the config PDA, and finally writes the manifest.

## Adapter registration

The deployed registry has `adapterCount: 1`: the Kamino USDC adapter is
proposed and **approved** on devnet, demonstrating the full governance path
on-chain.

| Field | Value |
| --- | --- |
| Adapter entry PDA | `FP6g94PEm5hcFoK3keZuKVwT4F6AyAjfUeoRLJuiyszf` |
| Adapter program ID | `G4g2RMwZs2dH2sVe3ChQ4VpM2DNZu8EESdRyHTc3P9T4` |
| Supported mint | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (USDC) |
| Version | 1 |
| Status | Approved |
| Propose signature | `VmJML8XvGsSmQaqGXgCtJjMpH5kosRnmYrGoZisVkd1Ryuh4DZ1sYGMNcvk938GRBHQwQcTipQBC3fv5QgGvLqj` |
| Approve signature | `5bDxJWzzTaYrvF3apvyNY6RUyEnR8boGsowWx7VdFZtGxEYxUVa3pgU18KTdgZHhTKggK1gDsmq1kytHJYhURP6P` |

To register another adapter:

1. Build the adapter program and note its program ID.
2. Use `proposeAdapter` + `approveAdapter` from the SDK (or
   `examples/register-adapter.ts` / `examples/approve-adapter.ts`) with the
   governance authority keypair.
3. Run `npm run verify:devnet:registry -- --write` to record the new
   `adapterCount` in the manifest.

See `docs/DEPLOYMENT.md` for the full deployment guide.

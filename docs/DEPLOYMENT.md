# Deployment Guide

This guide covers local builds, tests, mainnet-fork tests, and devnet registry
deployment.

## Toolchain

Use:

- Anchor `0.31.1`
- Solana `2.2.20`
- Node.js `20+`

`Cargo.lock` is part of the reproducible build. Solana `2.2.20`'s SBF toolchain
uses a Rust compiler that predates some current transitive crate releases, so a
plain dependency refresh can pull in crates that no longer compile for SBF. If
you update dependencies, rerun `anchor build` before publishing the change.

Install dependencies:

```sh
npm install
```

## Local Build

```sh
npm run build
```

## Local Tests

```sh
npm run typecheck
npm run test:unit
npm run test:integration
```

Full Anchor test entrypoint:

```sh
npm test
```

## Mainnet-Fork Setup

Set:

```text
MAINNET_RPC_URL=<RPC_URL>
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
ANCHOR_WALLET=<LOCAL_KEYPAIR>
FORK_USER_PUBKEY=<ANCHOR_WALLET_PUBLIC_KEY>
```

Generate a validator command:

```sh
npm run clone:mainnet -- marginfi
```

The script prints JSON containing:

- Selected adapter account set.
- Local workspace programs loaded with `--bpf-program`.
- Required clone accounts.
- Optional SOL and USDC account fixtures.
- Full `solana-test-validator` command.
- Matching test command.

Run `anchor build` before starting the printed validator command. The command
loads the local dispatcher, registry, and selected adapter binaries directly
from `target/deploy/*.so`, so a separate local `anchor deploy` is not required
for fork tests. It also includes `--warp-slot` from `FORK_WARP_SLOT`. With
`FORK_PREFETCH_ACCOUNTS=1` and no explicit `FORK_WARP_SLOT`, the script uses the
current mainnet slot from `MAINNET_RPC_URL` and writes regular cloned accounts
to JSON fixtures loaded with `--account`. This avoids public-RPC batch clone
limits. Without prefetch, the legacy default remains `500000000`.

Start the printed validator command, then run:

```sh
npm run test:fork:marginfi
```

Run all fork files:

```sh
npm run test:fork
```

Run one fork file:

```sh
npm run test:fork:kamino
npm run test:fork:marginfi
npm run test:fork:jupiter
npm run test:fork:maple
npm run test:fork:drift
```

MarginFi, Kamino, Maple, and Drift are passing fork paths today (Drift via the
official protocol-v2 v2.161.0 binary built from source, because the deployed
mainnet binary removed all user-facing instructions — see
`docs/MAINNET_FORK_TEST_RESULTS.md`). Jupiter has a typed real CPI adapter
path but is still blocked in fork execution on keeper-gated oracle freshness for
the JLP Perps product. Maple custodies preloaded syrupUSDC in a PDA vault; it
does not fake CCIP mint/redeem.

## Mainnet RPC Requirements

The RPC endpoint must support:

- Current mainnet account fetches for `--clone`.
- Upgradeable program fetches for `--clone-upgradeable-program`.
- Enough throughput for local-validator startup.

Paid or dedicated RPC is recommended. Public RPCs may rate-limit or serve stale
data during clone-heavy startup.

## Deterministic Fixtures

When `FORK_USER_PUBKEY` is set, the clone script writes:

```text
.mainnet-fork-fixtures/funded-user-sol-account.json
.mainnet-fork-fixtures/funded-usdc-token-account.json
.mainnet-fork-fixtures/funded-syrupusdc-token-account.json
```

Defaults:

- `FORK_USER_SOL_LAMPORTS=100000000000`
- `FORK_USER_USDC_AMOUNT=1000000000`
- `FORK_USER_SYRUP_AMOUNT=1000000000`

`FORK_USER_USDC_AMOUNT` and `FORK_USER_SYRUP_AMOUNT` are raw token base units.

## Expected Runtime

Typical local timings:

- Clone command generation: under 5 seconds.
- Validator startup for MarginFi, Kamino, Jupiter, Maple, or Drift: 1-4 minutes,
  RPC-dependent.
- Any single adapter fork test: 2-5 minutes after validator is healthy.

Known flaky areas:

- RPC rate limits.
- Protocol account layout changes.
- Ledger reuse without `--reset`.
- Wallet mismatch between `FORK_USER_PUBKEY` and `ANCHOR_WALLET`.
- Running tests before local validator RPC is ready.
- Jupiter Doves/Edge oracle freshness; static cloned oracle accounts can become
  stale before the first JLP CPI. Mainnet Doves update replay is not currently
  enough because Doves validates the original keeper signer.
- Drift SDK/on-chain IDL drift; pin or generate the exact deployed Drift IDL
  before claiming the Drift fork path as passing.

## Devnet Registry Deployment

Plan commands without executing:

```sh
npm run deploy:devnet:plan
```

Deploy and initialize:

```sh
DEVNET_RPC_URL=https://api.devnet.solana.com \
REGISTRY_AUTHORITY_KEYPAIR=~/.config/solana/id.json \
npm run deploy:devnet
```

The script:

1. Runs `anchor build`.
2. Runs `anchor deploy --program-name registry` against devnet.
3. Loads `target/idl/registry.json`.
4. Derives `[b"registry_config"]`.
5. Initializes the registry if the PDA does not already exist.

Useful flags:

- `--skip-build`
- `--skip-deploy`
- `--skip-init`
- `--print-only`

Environment:

```text
DEVNET_RPC_URL=https://api.devnet.solana.com
REGISTRY_AUTHORITY_KEYPAIR=~/.config/solana/id.json
REGISTRY_PROGRAM_ID=HiLF1P7LguVyBbzMSN3hK4ErGxfxaS6TMPbR6R73Dtdn
```

The first initializer becomes registry governance authority. Store that key
safely or transfer governance after deployment.

## Deployment Manifest

A successful `npm run deploy:devnet:registry` (alias of `deploy:devnet`) writes a
manifest to `deployments/devnet/registry.json` recording the on-chain program id,
`registry_config` PDA, governance authority, and init signature. The schema and
field meanings are documented in [`deployments/README.md`](../deployments/README.md).
The path is configurable with `DEVNET_MANIFEST_PATH`.

`deployments/devnet/registry.example.json` is a committed **placeholder schema**
(angle-bracket values) — it is not a real deployment. The real manifest only
exists once a genuine devnet deploy has been performed.

## Verifying A Devnet Deployment

Anyone can independently confirm the deployment with read-only RPC calls:

```sh
npm run verify:devnet:registry
```

This reads `deployments/devnet/registry.json` and checks it against live devnet:
the registry program account exists and is executable, is owned by the BPF
upgradeable loader, the `registry_config` PDA exists and is owned by the registry
program, and the manifest program id / config PDA / governance authority match
chain. The exit code is non-zero if any check fails. The script never sends a
transaction.

Regenerate (or enrich) the manifest from current on-chain state — only succeeds
if `registry_config` already exists on-chain:

```sh
npm run verify:devnet:registry -- --write
```

Optional flags: `--manifest <path>`, `--rpc-url <url>`,
`--registry-program-id <base58>`, `--init-signature <sig>`,
`--deployed-at <iso8601>`.

## Adapter Registration On Devnet

After deploying an adapter program, use the SDK example:

```sh
ADAPTER_PROGRAM_ID=<ADAPTER_PROGRAM_ID> \
SUPPORTED_MINT=<MINT> \
ADAPTER_VERSION=1 \
PROTOCOL_NAME="Example Adapter" \
METADATA_URI=https://example.com/adapter.json \
ts-node examples/register-adapter.ts
```

Approve:

```sh
ADAPTER_PROGRAM_ID=<ADAPTER_PROGRAM_ID> \
SUPPORTED_MINT=<MINT> \
ADAPTER_VERSION=1 \
ts-node examples/approve-adapter.ts
```

Do not approve adapters for production use beyond the exact position model they
document. In particular, the Maple adapter is a syrupUSDC asset-position adapter,
not a CCIP mint/redeem adapter.

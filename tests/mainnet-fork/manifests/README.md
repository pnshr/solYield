# Mainnet-Fork Run Manifests

A **run manifest** is the machine-readable provenance record for a single
mainnet-fork test run. It freezes *exactly* which mainnet state a fork run used
(by slot and per-account content hash) plus the exact commands and the real test
outcome, so a third party can reproduce — and audit — the run.

A manifest is an **artifact of an actual run**. It is emitted by tooling from
real on-chain state and the real mocha exit code; it is never authored by hand.

## Files

- `*.example.json` — the manifest **schema** with placeholder (angle-bracket)
  values. Committed as documentation. NOT a real run.
- `<adapter>.json` — a **real** run manifest, emitted by the fork harness. These
  only exist once a genuine fork run has been performed in a given environment.

## Schema

| Field | Type | Meaning |
| --- | --- | --- |
| `adapter` | string | Adapter id (`kamino` / `marginfi` / `jupiter` / `maple` / `drift`). |
| `displayName` | string | Human-readable adapter name. |
| `repoCommit` | string \| null | `git rev-parse HEAD` at generation time. |
| `generatedAt` | string | ISO-8601 timestamp the manifest was written. |
| `cluster` | string | Always `"mainnet-fork"`. |
| `rpcUrl` | string | RPC the mainnet state was cloned from. |
| `baseSlot` | number | Slot the account fixtures were cloned at. |
| `warpSlot` | string | `--warp-slot` the local validator was started at. |
| `localPrograms` | array | `{label, programId, soPath, soSha256}` for each locally built `.so` loaded with `--bpf-program`. |
| `clonedAccounts` | array | `{label, address, kind, dataSha256}` for each cloned mainnet account. `dataSha256` is the reproducibility anchor. |
| `fundedFixtures` | array | `{label, address, fixtureSha256}` for synthetic SOL/USDC/syrupUSDC fixtures. |
| `commands` | object | `{clone, validator, test}` — the exact commands used. |
| `testOutcome` | object | `{status, mochaExitCode, durationMs, runAt}`. `status` ∈ `passed` \| `failed` \| `not-run`. |
| `notes` | string | Free-form provenance / caveat note. |

## Honesty rules

- `testOutcome.status` is `"passed"` **only** when the mocha process actually
  exited `0`. It is never set by hand.
- The `dataSha256` / `soSha256` values pin the precise bytes used, so a reviewer
  can diff a re-clone against the recorded run.
- A blocked adapter records `status: "failed"` (or `"not-run"`) plus the blocker
  in `notes`; it is not omitted or relabelled as passing.

## Reproducing a run from a manifest

1. Check out `repoCommit` and `anchor build` (matches the recorded `soSha256`).
2. Re-clone the listed `clonedAccounts` from any mainnet RPC and confirm each
   `dataSha256` (state may have changed; mismatches are expected for mutable
   accounts and explain valuation drift).
3. Start the validator with `commands.validator` and run `commands.test`.

See `docs/MAINNET_FORK_TEST_RESULTS.md` for the current per-adapter status and
the full clone → validator → test procedure.

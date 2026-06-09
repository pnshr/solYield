# Mainnet-Fork Test Results

This document is the single source of truth for the **status and reproducibility**
of the five adapter mainnet-fork tests. It pairs with the machine-readable run
manifests in [`tests/mainnet-fork/manifests/`](../tests/mainnet-fork/manifests/).

> Honesty policy: a row is only marked **PASS (verified)** when the fork test has
> actually exited `0` and a run manifest with `testOutcome.status: "passed"` is
> committed. Blocked adapters keep their real CPI path and record the precise
> blocker — failing tests are never deleted or relabelled. When an earlier
> root-cause analysis turns out to be wrong, it is corrected here, not erased.

## Status summary (re-verified 2026-06-09, dedicated RPC, fresh clones)

| Adapter | CPI path | Fork status | Run manifest | Note |
| --- | --- | --- | --- | --- |
| Kamino USDC | `depositReserveLiquidity` / `redeemReserveCollateral` | **PASS (verified)** — mocha exit 0, `1 passing` | `kamino-usdc.json` | Current mainnet program + state, cloned at warp slot. |
| MarginFi USDC | `lending_account_deposit` / `lending_account_withdraw` | **PASS (verified)** — mocha exit 0, `1 passing` | `marginfi-usdc.json` | Current mainnet program + state. |
| Maple syrupUSDC | SPL custody of syrupUSDC in PDA vault | **PASS (verified)** — mocha exit 0, `1 passing` | `maple-syrup.json` | Values in native syrupUSDC units. Not CCIP mint/redeem. |
| Drift Insurance Fund | `add_insurance_fund_stake` / `request_remove_insurance_fund_stake` | **PASS (verified)** — mocha exit 0, `1 passing` | `drift-insurance-fund.json` | **Historical-binary fork** (see below): official protocol-v2 v2.161.0 binary built from source + real current mainnet account state. |
| Jupiter LP | `addLiquidity2` / `removeLiquidity2` | **Blocked** | `jupiter-lp.json` (failed) | `StaleOraclePrice (6003)`: fork-validator clock vs Doves/Edge oracle timestamps; under investigation (see Jupiter section). |

All passing runs go through the full path: **dispatcher → registry
(approve/pause/reject checks) → adapter → real protocol program**, and assert
real token movements plus rejection of pending/paused entries and wrong mints.

## Drift: why the fork loads a historical binary (full disclosure)

**The currently deployed mainnet Drift program no longer contains
insurance-fund staking — or any user-facing instruction.** Verified directly
against live mainnet on 2026-06-09 by simulating instructions with their
canonical Anchor discriminators (`sha256("global:<name>")[:8]`):

| Probe (live mainnet simulation) | Result |
| --- | --- |
| `admin_withdraw_from_insurance_fund_vault` | dispatches (fails later for missing args — instruction exists) |
| `initialize_user_stats`, `initialize_user`, `deposit`, `withdraw`, `place_perp_order` | `InstructionFallbackNotFound (101)` — **removed** |
| `initialize_insurance_fund_stake`, `add_insurance_fund_stake`, `request_remove_insurance_fund_stake`, `remove_insurance_fund_stake` | `InstructionFallbackNotFound (101)` — **removed** |

Supporting on-chain facts:

- Last program deploy: slot **410,633,860** (`ProgramData
  7dLgmtcTavcguNoynVimF9ZNVb13FvhXVRfj2HyrDGaP`).
- The admin drained the USDC insurance-fund vault
  (`2CqkQvYxp9Mq4PqLvAQ1eryYxebUh4Liyn5YMDtXsYci`) via
  `AdminWithdrawFromInsuranceFundVault` at slot **410,454,545**; the vault now
  holds 0.00486 USDC.
- Third-party integrations that still reference Drift accounts report the
  Drift USDC oracle as stale by ~15M slots (the entire post-wind-down period).

**Correction of the earlier analysis.** A previous revision of this document
claimed the blocker was "wrong discriminators — correct values unknown". That
was a misdiagnosis: the sha256 discriminators used by the adapter and the SDK
IDL are correct (the still-dispatching admin instruction proves the deployed
binary uses standard Anchor dispatch). The instructions themselves were
removed from the deployed binary. No discriminator change could ever have
fixed this.

**Methodology.** Because the feature no longer exists in the deployed binary,
the fork loads the **last released open-source Drift binary** — protocol-v2
tag `v2.161.0` (2026-03-30), built from official sources with
[`scripts/build-drift-v2161.sh`](../scripts/build-drift-v2161.sh) — at the
Drift program id, on top of **unmodified, freshly cloned current mainnet
account state** (Drift state, USDC spot market, vaults, oracle). The run
manifest pins the sha256 of the built binary. This is clearly labelled in the
manifest `notes`; no account state is fabricated or edited.

Two real adapter bugs were found and fixed once the CPI path became
exercisable (commit `dcdf024`): the `SpotMarket` insurance-fund field offsets
were wrong (`insurance_fund.vault` is at byte 304, `insurance_fund.total_shares`
at byte 336 of the account; verified against cloned mainnet account bytes).

## Jupiter: current blocker

`StaleOraclePrice (6003)` at `perpetuals/src/state/oracle.rs:265`. Latest
re-run (fresh consistent clone, warp slot = clone slot) shows
`require_gte!(oracle.last_update_time = 5, current_unix_time − max_age = 91158)`
— both sides are near Unix epoch zero, which means the fork validator's bank
clock does not track the warp slot. This narrows the blocker from "keeper
signatures cannot be replayed" to **fork-clock calibration**, which is still
under investigation. The committed manifest records the real failing run.

## Reproducible run procedure

The harness reads configuration from `.env` (see `.env.example`). Each run is:
**clone mainnet state → start a local validator preloaded with that state and
the locally built programs → run the adapter's mocha fork test against it.**

```sh
# 0. Build programs
anchor build

# 1. Configure .env for the clone step
#    MAINNET_RPC_URL=<dedicated RPC; public endpoints rate-limit clones>
#    FORK_PREFETCH_ACCOUNTS=1
#    FORK_USER_PUBKEY=<pubkey of ANCHOR_WALLET>
#    For Drift only: build the historical binary first, then set
#    DRIFT_LOCAL_SO=.mainnet-fork-fixtures/drift-v2.161.0.so
bash scripts/build-drift-v2161.sh        # Drift only, once

# 2. Clone state + generate the validator command
npm run clone:mainnet -- <kamino|marginfi|maple|drift|jupiter>
#    Writes fixtures under .mainnet-fork-fixtures/ and prints the exact
#    solana-test-validator command. Run it (keep --reset, fresh ledger).

# 3. Reconfigure .env for the test step and run
#    ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
#    ANCHOR_WALLET=<local keypair>
#    FORK_USER_PUBKEY=<same pubkey>
#    FORK_WARP_SLOT=<warpSlot printed by the clone step>
#    FORK_EMIT_MANIFEST=1
npm run test:fork:<adapter>
```

`run-mainnet-fork-tests.ts` runs each adapter in its own mocha process and
emits that adapter's run manifest from the **real** mocha exit code and
measured duration. The clone slot and warp slot come from the same snapshot,
which matters: protocol freshness checks (Kamino reserve `last_update`,
oracles) fail if fixtures and warp slot are taken at different times.

## Environment notes (honesty caveats)

- **Dedicated RPC required for cloning.** Public endpoints rate-limit the
  multi-account clone sets (Jupiter clones 43 accounts). The RPC URL lives in
  `.env`, which is gitignored; committed manifests record only the bare RPC
  host, never credentials.
- **WSL/Windows split on the development machine.** The Linux
  `solana-test-validator` runs in WSL with a WSL-native ledger
  (`/tmp/<adapter>-ledger`); the TypeScript client runs on Windows node and
  reaches the validator via forwarded `127.0.0.1:8899`. A reviewer on a single
  Linux host needs none of this.
- **Corporate TLS-intercepting proxy.** The clone fetch used
  `NODE_TLS_REJECT_UNAUTHORIZED=0` to traverse it; only public on-chain
  account data was fetched.

## Run manifests

Committed manifests (all emitted by `scripts/emit-fork-manifest.ts` from the
on-disk built `.so` files, the cloned fixtures, and the real mocha exit code
of the run that just happened):

- `kamino-usdc.json` — `passed`, exit 0 (re-run 2026-06-09).
- `marginfi-usdc.json` — `passed`, exit 0 (re-run 2026-06-09).
- `maple-syrup.json` — `passed`, exit 0 (re-run 2026-06-09).
- `drift-insurance-fund.json` — `passed`, exit 0 (2026-06-09, historical-binary
  fork; binary sha256 pinned in `localPrograms`, methodology in `notes`).
- `jupiter-lp.json` — `failed`, exit 1 (real failing run; blocker above).

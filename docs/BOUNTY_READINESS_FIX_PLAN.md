# Bounty Readiness Fix Plan

Current score: 68 / 100

Target score: 90+

Status: not submission-ready. The dispatcher, registry, adapter template, SDK,
docs, and several real adapter paths are in place, but the repository cannot be
claimed bounty-ready until all P0 blockers below are closed and verified with
commands.

## Baseline Verification

Toolchain:

- Anchor CLI: 0.31.1
- Solana CLI: 2.2.20
- Node.js: 20+

Commands run in Phase 1:

| Command | Status | Notes |
| --- | --- | --- |
| `npm.cmd run typecheck` | Pass | TypeScript compiles with `tsc --noEmit`. |
| `anchor build` | Pass with warnings | Anchor cfg warnings, deprecated realloc warnings, and Drift dead-code warning remain. |
| `anchor test --skip-build` | Pass with pending tests | 36 passing, 5 pending real-adapter integration suites. |
| `npm.cmd run deploy:devnet:plan` | Pass | Prints deployment plan only; no devnet deployment proof yet. |

## Repository File Map

Core programs:

- Dispatcher: `programs/dispatcher/src/lib.rs`
- Registry: `programs/registry/src/lib.rs`
- Adapter template: `programs/adapters/adapter-template/src/lib.rs`

Real adapter programs:

- Kamino USDC: `programs/adapters/kamino-usdc/src/lib.rs`,
  `programs/adapters/kamino-usdc/src/constants.rs`,
  `programs/adapters/kamino-usdc/README.md`
- MarginFi USDC: `programs/adapters/marginfi-usdc/src/lib.rs`,
  `programs/adapters/marginfi-usdc/src/constants.rs`,
  `programs/adapters/marginfi-usdc/README.md`
- Jupiter LP: `programs/adapters/jupiter-lp/src/lib.rs`,
  `programs/adapters/jupiter-lp/src/constants.rs`,
  `programs/adapters/jupiter-lp/README.md`
- Maple syrupUSDC: `programs/adapters/maple-syrup/src/lib.rs`,
  `programs/adapters/maple-syrup/src/constants.rs`,
  `programs/adapters/maple-syrup/README.md`
- Drift Insurance Fund: `programs/adapters/drift-insurance-fund/src/lib.rs`,
  `programs/adapters/drift-insurance-fund/src/constants.rs`,
  `programs/adapters/drift-insurance-fund/README.md`

Fork and deployment tooling:

- Fork clone planner: `scripts/clone-mainnet-accounts.ts`
- Fork test runner: `scripts/run-mainnet-fork-tests.ts`
- Devnet deployment: `scripts/deploy-devnet.ts`
- Fork tests: `tests/mainnet-fork/*.test.ts`
- Fork support flows: `tests/support/*-flow.ts`

Docs and submission surface:

- README: `README.md`
- Spec: `docs/SPEC.md`
- Build guide: `docs/BUILD_ADAPTER.md`
- Architecture: `docs/ARCHITECTURE.md`
- Deployment: `docs/DEPLOYMENT.md`
- Integration notes: `docs/INTEGRATION_NOTES.md`
- Quality checklist: `docs/QUALITY_CHECKLIST.md`
- This fix plan: `docs/BOUNTY_READINESS_FIX_PLAN.md`

## Adapter-by-Adapter Status

| Adapter | Current status | Main blocker | Verification command |
| --- | --- | --- | --- |
| Kamino USDC | Mostly credible direct Kamino Lend reserve path | Needs final reproducible fork log and no-regression check | `npm run test:fork:kamino` after fork validator setup |
| MarginFi USDC | Mostly credible MarginFi v2 lending path | Needs final reproducible fork log and no-regression check | `npm run test:fork:marginfi` after fork validator setup |
| Jupiter LP | Blocked fork path | Current JLP/Perps path requires Doves/Edge freshness; Doves replay fails keeper signer validation | `npm run test:fork:jupiter` must pass |
| Maple syrupUSDC | Partial but honest syrupUSDC custody adapter | Not full USDC-to-Syrup/Maple mint/redeem; decide whether to complete or explicitly submit as receipt-token custody | `npm run test:fork:maple` after fork validator setup |
| Drift Insurance Fund | Blocked fork path | Drift setup fails before dispatcher deposit due exact deployed IDL/client/discriminator alignment | `npm run test:fork:drift` must pass |

## P0 Blockers

### P0-1: Jupiter mainnet-fork path does not pass

Problem:

- Jupiter adapter has typed CPI construction, but the fork test is blocked by
  protocol oracle freshness and Doves keeper-signer constraints.
- Phase 2 verified that the legacy USDC Doves account was the wrong CPI oracle
  account; the adapter/test now use the current custody `doves_ag_oracle` /
  Edge account `6Jp2xZUTWdDD2ZyUPRzeMdc6AFQ5K3pFgZxk2EijfjnM`.
- Phase 2 also cloned the Doves/Pyth-Lazer update dependencies and replayed the
  real mainnet instruction shape. The unsplit replay hit the expected
  transaction-size error (`1283 > 1232`). Splitting it into
  `UpdateManyWithPythLazer` plus per-asset `UpdateAgPrice2` transactions fixed
  size, but Doves then failed with `InvalidSigner(6006)` because the signed
  payload is bound to the original keeper signer.
- Controlled fork-clock attempts with `--warp-slot` and `--ticks-per-slot`
  moved the Clock sysvar but were not stable enough for Jupiter's five-second
  freshness window across all JLP basket oracles.

Files to modify:

- `programs/adapters/jupiter-lp/src/lib.rs`
- `programs/adapters/jupiter-lp/src/constants.rs`
- `tests/support/jupiter-lp-flow.ts`
- `tests/mainnet-fork/jupiter-lp-mainnet-fork.test.ts`
- `scripts/clone-mainnet-accounts.ts`
- `docs/INTEGRATION_NOTES.md`
- `docs/DEPLOYMENT.md`
- `README.md`

Fix requirements:

- Implement a real judge-defensible Jupiter fork path without patching oracle
  account data or substituting unauthorized keeper signers.
- If the current Jupiter Perps JLP path remains the target, add an official
  public Jupiter/Doves oracle update path, run an authorized keeper in the fork,
  or provide a reproducible clock-control runner that demonstrably clears the
  five-second freshness window for every required basket oracle.
- If the current target cannot be made reproducible, replace it with a valid
  Jupiter LP/yield adapter path backed by real public accounts and CPI details.

Verification:

```sh
anchor build
MAINNET_RPC_URL=<RPC_URL> FORK_PREFETCH_ACCOUNTS=1 FORK_USER_PUBKEY=<WALLET_PUBKEY> npm run clone:mainnet -- jupiter
# Start the printed solana-test-validator command.
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET=<KEYPAIR> npm run test:fork:jupiter
```

Pass condition:

- The test registers the adapter, approves it, deposits through dispatcher,
  verifies JLP/protocol position state, queries `current_value` through
  dispatcher, withdraws through dispatcher, and rejects wrong mint, paused
  adapter, and unapproved adapter.

### P0-2: Drift mainnet-fork path does not pass

Problem:

- Drift adapter has typed Insurance Fund CPI construction, but the fork support
  setup currently fails before dispatcher deposit.

Files to modify:

- `programs/adapters/drift-insurance-fund/src/lib.rs`
- `programs/adapters/drift-insurance-fund/src/constants.rs`
- `tests/support/drift-insurance-fund-flow.ts`
- `tests/mainnet-fork/drift-insurance-fund-mainnet-fork.test.ts`
- `scripts/clone-mainnet-accounts.ts`
- `package.json` and `package-lock.json` if the Drift SDK version must be pinned
  or changed
- `docs/INTEGRATION_NOTES.md`
- `docs/DEPLOYMENT.md`
- `README.md`

Fix requirements:

- Pin or generate the exact Drift deployed IDL/client shape needed by the fork
  setup instructions.
- Prove `initializeUserStats`, `initializeInsuranceFundStake`, deposit,
  request-withdraw, and current-value paths against cloned mainnet Drift state.
- Do not guess instruction bytes; use verified IDL, SDK, or audited primary
  source for discriminators and account order.

Verification:

```sh
anchor build
MAINNET_RPC_URL=<RPC_URL> FORK_PREFETCH_ACCOUNTS=1 FORK_USER_PUBKEY=<WALLET_PUBKEY> npm run clone:mainnet -- drift
# Start the printed solana-test-validator command.
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET=<KEYPAIR> npm run test:fork:drift
```

Pass condition:

- The test registers the adapter, approves it, deposits through dispatcher into
  Drift IF, observes protocol stake/share state, queries `current_value`,
  requests withdraw through dispatcher, records pending withdrawal state, and
  rejects wrong mint, paused adapter, and unapproved adapter.

### P0-3: Registry devnet deployment is not proven

Problem:

- The deployment script exists and `deploy:devnet:plan` passes, but there is no
  recorded devnet program deployment, registry PDA, or transaction signature.

Files to modify:

- `scripts/deploy-devnet.ts` if deployment output needs more proof fields
- `docs/DEPLOYMENT.md`
- `README.md`
- Add a deployment artifact document, for example
  `docs/DEVNET_REGISTRY_DEPLOYMENT.md`

Fix requirements:

- Deploy the registry program to devnet.
- Initialize the registry PDA.
- Record program id, registry config PDA, governance authority, deployment
  signature or transaction, initialization signature, RPC URL, and date.

Verification:

```sh
npm run deploy:devnet
solana program show HiLF1P7LguVyBbzMSN3hK4ErGxfxaS6TMPbR6R73Dtdn --url https://api.devnet.solana.com
```

Pass condition:

- A judge can independently verify the devnet program and registry PDA from the
  documented ids/signatures.

### P0-4: Public GitHub repository is not clean/publish-ready

Problem:

- The local repository has no configured remote in the inspected workspace, and
  tracked-source publication has not been proven.

Files to modify:

- `.gitignore`
- `README.md`
- `docs/QUALITY_CHECKLIST.md`
- Any generated or private files accidentally staged before publication

Fix requirements:

- Ensure only source, docs, lockfiles, scripts, tests, SDK, and examples are
  tracked.
- Ensure `.anchor/`, `target/`, `.mainnet-fork-fixtures/`,
  `.mainnet-fork-ledger/`, `.env`, logs, and private keypairs remain ignored.
- Commit and push to a public GitHub repository.

Verification:

```sh
git status --short --ignored
git remote -v
git ls-remote --heads origin
npm run typecheck
anchor build
anchor test --skip-build
```

Pass condition:

- The public repository is reachable, clean, and reproducible from a fresh clone.

## P1 Blockers

### P1-1: Maple is partial, not full Maple/Syrup mint-redeem

Current state:

- Maple adapter custodies pre-existing syrupUSDC in a PDA vault and returns
  native syrupUSDC value.

Files to modify if completing full Maple path:

- `programs/adapters/maple-syrup/src/lib.rs`
- `programs/adapters/maple-syrup/src/constants.rs`
- `tests/support/maple-syrup-flow.ts`
- `tests/mainnet-fork/maple-syrup-mainnet-fork.test.ts`
- `scripts/clone-mainnet-accounts.ts`
- `docs/INTEGRATION_NOTES.md`
- `docs/SPEC.md`
- `docs/ARCHITECTURE.md`

Acceptable outcomes:

- Preferred: implement full judge-defensible Maple/Syrup protocol path if public
  Solana-side CPI/account details are available.
- Fallback: keep receipt-token custody path, but document it as partial and do
  not claim full USDC-to-Syrup integration.

Verification:

```sh
npm run test:fork:maple
```

### P1-2: Fork test logs are not reproducible enough

Files to modify:

- `scripts/run-mainnet-fork-tests.ts`
- `scripts/clone-mainnet-accounts.ts`
- `docs/DEPLOYMENT.md`
- Add a test evidence document, for example `docs/MAINNET_FORK_TEST_RESULTS.md`

Fix requirements:

- Record exact command, RPC type, fork slot, adapter, pass/fail result, and known
  flaky areas.
- Support one-adapter runs and all-adapter runs with clear preconditions.

Verification:

```sh
npm run clone:mainnet -- <adapter>
npm run test:fork:<adapter>
```

### P1-3: README and docs must distinguish complete, partial, and blocked work

Files to modify:

- `README.md`
- `docs/SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/INTEGRATION_NOTES.md`
- `docs/QUALITY_CHECKLIST.md`

Fix requirements:

- Keep the adapter status table honest.
- Remove or soften any checklist wording that implies final bounty readiness
  before all P0s are closed.
- Link to the devnet deployment artifact and fork test results once available.

Verification:

```sh
rg -n "ready|passing|blocked|partial|devnet|all five" README.md docs
```

## Exact P0 Fix Order

1. Fix Jupiter mainnet-fork path.
2. Fix Drift mainnet-fork path.
3. Run all five individual fork tests and record evidence.
4. Deploy and initialize registry on devnet, then record proof.
5. Clean the repository, commit, push, and verify the public GitHub remote.

Reasoning:

- Jupiter and Drift are the highest-risk unknowns and determine whether the
  submission can ever reach 90+.
- Devnet deployment should happen after code stabilizes.
- Public repository cleanup should be the final packaging step after all proof
  artifacts are accurate.

## Final Verification Gate for 90+

Run and record:

```sh
npm run typecheck
anchor build
anchor test --skip-build
npm run deploy:devnet:plan
npm run test:fork:kamino
npm run test:fork:marginfi
npm run test:fork:jupiter
npm run test:fork:maple
npm run test:fork:drift
```

Required evidence:

- All five fork tests pass end-to-end through dispatcher, registry, adapter, and
  protocol.
- Registry devnet program and PDA are independently verifiable.
- README and docs accurately reflect the final state.
- Public GitHub repository is clean and reproducible.

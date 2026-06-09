# Bounty 100-Point Fix Plan

Reference implementation: **Solana Yield Adapter Standard** (Anchor `0.31.1`,
Solana `2.2.20`).

- **Current audited score:** 58 / 100
- **Target score:** 95–100 / 100
- **Status:** not submission-ready. The core architecture (dispatcher, registry,
  governance-gated approval, adapter template, SDK, examples, five adapter
  programs, docs) is real and in place. The remaining gap is end-to-end
  *verifiable* proof: passing mainnet-fork tests, a proven devnet deployment,
  committed evidence, honest docs, and a clean public repo.

This document supersedes `docs/BOUNTY_READINESS_FIX_PLAN.md` (which referenced an
older 68/100 snapshot). It is the authoritative execution plan.

---

## Environment constraint (affects every build/fork/deploy phase)

The current working environment has **Node/npm only**. `anchor`, `solana`,
`cargo`, and `rustc` are not installed (verified: not on PATH, not in
`~/.cargo/bin`, `~/.avm/bin`, or the Solana active-release dir).

Consequence: of the Definition-of-Done commands, only `npm run typecheck`
(`tsc --noEmit`) and the print-only `npm run deploy:devnet:plan` can run here.
`anchor build`, `anchor test --skip-build`, every `npm run test:fork:*`, and the
real `npm run deploy:devnet*` require the Solana/Anchor toolchain (and, for fork
tests, a dedicated mainnet RPC).

**Resolution (agreed):**

1. Install Rust + Solana `2.2.20` + Anchor `0.31.1` as the first action of
   Phase 2. If installation fails in this environment, the exact blocker is
   reported and code/doc/script changes are still prepared for the user to build
   and verify on a provisioned machine. No test is ever marked passing unless it
   actually passes.
2. No dedicated mainnet RPC is available yet; fork tests will use prefetched JSON
   fixtures (`FORK_PREFETCH_ACCOUNTS=1`) and are documented as
   "reproducible with a dedicated RPC".

---

## Baseline verification (Phase 1)

| Command | Runnable here | Result |
| --- | --- | --- |
| `npm run typecheck` | Yes | PASS (recorded in Phase 1 run) |
| `npm run deploy:devnet:plan` | Yes (print-only) | Prints planned commands; no deploy |
| `anchor build` | No (toolchain absent) | Deferred to Phase 2 (post-install) |
| `anchor test --skip-build` | No (toolchain absent) | Deferred to Phase 2 (post-install) |
| `npm run test:fork:*` | No (toolchain + RPC) | Deferred to Phases 2/3/5/7 |

---

## Scoring model and where points are lost today

| Criterion | Max | Est. now | Gap | Primary cause |
| --- | --- | --- | --- | --- |
| Correctness | 40 | ~22 | 18 | Jupiter + Drift fork tests not passing; Maple not a real protocol CPI; no committed fork evidence |
| Interface Design | 25 | ~16 | 9 | Async-withdraw + `current_value` denomination underspecified; template diverges from real adapters |
| Developer Guide | 20 | ~12 | 8 | Build-your-own guide solid but lacks event/error appendices, end-to-end fork walkthrough, devnet proof links |
| Code Quality & Tests | 15 | ~8 | 7 | Important tests gated/skipped by default; no fork evidence doc; no CI |
| **Total** | **100** | **~58** | **42** | |

---

## Blockers

### P0 (caps the score / required by Definition of Done)

| ID | Blocker | Hard cap if unresolved | Est. gain when fixed |
| --- | --- | --- | --- |
| P0-1 | Jupiter LP mainnet-fork test does not pass | ≤75 | +6 |
| P0-2 | Drift Insurance Fund mainnet-fork test does not pass | ≤75 | +6 |
| P0-3 | Maple is SPL custody, not a real protocol integration | ≤78 | +5 |
| P0-4 | Registry not deployed to devnet (no artifact/proof) | ≤85 | +4 |
| P0-5 | No clean, public, committed GitHub repo (zero commits, no remote) | ≤88 | +3 |
| P0-6 | Mainnet-fork test evidence not committed | ≤55 (no fork tests) | +4 |

### P1 (quality / trust)

| ID | Blocker | Est. gain |
| --- | --- | --- |
| P1-1 | Fork tests gated by `RUN_*_MAINNET_FORK=0`; need a clean opt-in runner + manifests | +2 |
| P1-2 | Docs overclaim / score inconsistency (README said 68; prompt says 58) | +2 |
| P1-3 | No `docs/MAINNET_FORK_TEST_RESULTS.md`; no `tests/mainnet-fork/manifests/*.json` | +2 |
| P1-4 | No CI workflow (`.github/workflows/ci.yml`) | +1 |
| P1-5 | Missing `deploy:devnet:registry` / `verify:devnet:registry` npm scripts (Phase 6 expects them) | +1 |

### P2 (polish / interface hardening)

| ID | Improvement | Est. gain |
| --- | --- | --- |
| P2-1 | Specify async-withdraw semantics (define `withdraw` as completion-or-request; optional `request_/complete_withdraw` extension) | +2 |
| P2-2 | Specify `current_value` denomination per adapter (base mint units vs receipt-token units) in adapter metadata | +2 |
| P2-3 | Event-schema + error-schema appendices in SPEC | +1 |
| P2-4 | Align adapter template with real adapter patterns (configurable/documented seeds) | +1 |
| P2-5 | `SUBMISSION_CHECKLIST.md`, `FINAL_BOUNTY_SELF_AUDIT.md`, `BOUNTY_SUBMISSION_SUMMARY.md` | +1 |

---

## Adapter-by-adapter fix plan

### Kamino USDC — strongest; harden only (Phase 5)

- State: real direct Kamino Lend reserve `depositReserveLiquidity` /
  `redeemReserveCollateral`; collateral exchange-rate value math.
- Fix: add `refreshReserve` before valuation if feasible (or document the
  controlled fork state); strengthen `current_value` assertions; verify
  collateral token-account deltas in the fork test.
- Files: `programs/adapters/kamino-usdc/src/{lib.rs,constants.rs}`,
  `tests/support/kamino-usdc-flow.ts`,
  `tests/mainnet-fork/kamino-usdc-mainnet-fork.test.ts`.
- Verify: `npm run test:fork:kamino`.

### MarginFi USDC — strong; harden only (Phase 5)

- State: real MarginFi v2 `lending_account_deposit` / `lending_account_withdraw`;
  I80F48 share-value math.
- Fix: add a test that re-derives the instruction discriminators; comment the
  byte→instruction mapping; strengthen account validation and value-math asserts.
- Files: `programs/adapters/marginfi-usdc/src/{lib.rs,constants.rs}`,
  `tests/support/marginfi-usdc-flow.ts`,
  `tests/mainnet-fork/marginfi-usdc-mainnet-fork.test.ts`.
- Verify: `npm run test:fork:marginfi`.

### Jupiter LP — P0-1 (Phase 2)

- State: typed `addLiquidity2` / `removeLiquidity2` CPI; fork blocked by
  Doves/Edge oracle freshness; keeper-signed replay fails `InvalidSigner(6006)`.
- Root-cause-first plan (in order):
  A. Keep JLP path; implement a protocol-valid oracle freshness route.
  B. If keeper-signed updates can't be reproduced, use a controlled fork
     slot/clock only if protocol-valid and reproducible.
  C. If neither is judge-reproducible, pivot to the most defensible Jupiter
     LP/yield route that can pass fork tests, and document why.
- Files: `programs/adapters/jupiter-lp/src/{lib.rs,constants.rs}`,
  `tests/support/jupiter-lp-flow.ts`,
  `tests/mainnet-fork/jupiter-lp-mainnet-fork.test.ts`,
  `scripts/clone-mainnet-accounts.ts`, `docs/INTEGRATION_NOTES.md`, `README.md`.
- Verify: `npm run typecheck && anchor build && npm run test:fork:jupiter && anchor test --skip-build`.

### Drift Insurance Fund — P0-2 (Phase 3)

- State: typed IF CPI; fork fails `InstructionFallbackNotFound` (IDL/discriminator
  mismatch). Withdraw is request-remove (async) only.
- Plan: pin the exact deployed Drift IDL; generate discriminators from it (or use
  official Drift SDK builders in the test to verify account order + ix data); add
  a test asserting discriminator bytes if hand-building CPI. Keep async withdraw
  honest (do not fake instant settlement); document semantics in SPEC.
- Files: `programs/adapters/drift-insurance-fund/src/{lib.rs,constants.rs}`,
  `tests/support/drift-insurance-fund-flow.ts`,
  `tests/mainnet-fork/drift-insurance-fund-mainnet-fork.test.ts`,
  `scripts/clone-mainnet-accounts.ts`, `package.json`/`package-lock.json` (if Drift
  SDK pin changes), `docs/INTEGRATION_NOTES.md`, `docs/SPEC.md`, `README.md`.
- Verify: `npm run typecheck && anchor build && npm run test:fork:drift && anchor test --skip-build`.

### Maple Syrup — P0-3 → SUBSTITUTE (Phase 4)

- Decision: there is no public synchronous Solana Maple/Syrup mint-redeem CPI
  (syrupUSDC arrives via CCIP cross-chain). The current adapter honestly custodies
  syrupUSDC and values it in syrupUSDC units — it is NOT a Maple protocol
  integration. Per direction, **replace it with a real Solana yield protocol**
  that has a public, fork-reproducible CPI path. Do not silently substitute:
  choose the protocol, justify it with verified program IDs/accounts, keep the
  dispatcher→registry→adapter→protocol flow, and update SPEC/README/
  INTEGRATION_NOTES accordingly.
- Candidate protocols to evaluate in Phase 4 (verified accounts only): a second
  real lending market (e.g. Save/Solend USDC), an LST staking route (e.g.
  Marinade mSOL), or a documented vault/aggregator with a public deposit/redeem
  CPI. Final choice must have a USDC (or clearly-declared) position and pass a
  fork test.
- Files: rename/replace `programs/adapters/maple-syrup/*` (and `Anchor.toml`
  workspace + program id), `tests/support/*-flow.ts`,
  `tests/mainnet-fork/*-mainnet-fork.test.ts`,
  `scripts/clone-mainnet-accounts.ts`, docs.
- Verify: `npm run typecheck && anchor build && npm run test:fork:<new> && anchor test --skip-build`.

---

## Exact fix order (phases)

1. **Phase 2** — Install toolchain, then fix Jupiter fork path. Verify build +
   `anchor test --skip-build` + `test:fork:jupiter`.
2. **Phase 3** — Fix Drift IDL/discriminator + fork path.
3. **Phase 4** — Resolve Maple by substituting a real protocol adapter.
4. **Phase 5** — Harden Kamino + MarginFi; start `docs/MAINNET_FORK_TEST_RESULTS.md`.
5. **Phase 6** — Deploy registry to devnet; add `deploy:devnet:registry` /
   `verify:devnet:registry` scripts; write `deployments/devnet/registry.json` +
   `docs/DEVNET_REGISTRY_DEPLOYMENT.md`.
6. **Phase 7** — Reproducible fork system: manifests, runner UX, results doc.
7. **Phase 8** — Interface/standard hardening (async withdraw, denomination,
   event/error appendices, template consistency).
8. **Phase 9** — Judge-ready docs (README + SPEC + guides + summary/self-audit).
9. **Phase 10** — Cleanup, secret scan, `.gitignore`, CI, commit, push.
10. **Phase 11** — Final strict self-audit.

Rationale: Jupiter and Drift are the highest-risk unknowns and gate whether the
submission can exceed 75. Devnet deploy and repo publication are last because they
package stabilized, verified artifacts.

---

## Verification commands per fix

```bash
# Core (every phase)
npm run typecheck
anchor build
anchor test --skip-build

# Per adapter (after fork validator setup)
npm run test:fork:kamino
npm run test:fork:marginfi
npm run test:fork:jupiter
npm run test:fork:maple        # (replaced adapter target after Phase 4)
npm run test:fork:drift
npm run test:fork

# Devnet (Phase 6)
npm run deploy:devnet:plan
npm run deploy:devnet:registry
npm run verify:devnet:registry
```

---

## Final submission checklist

- [ ] `npm run typecheck` passes.
- [ ] `anchor build` passes (toolchain installed).
- [ ] `anchor test --skip-build` passes (core: dispatcher/registry/template).
- [ ] Kamino fork test passes end-to-end through dispatcher → registry → adapter → protocol.
- [ ] MarginFi fork test passes end-to-end.
- [ ] Jupiter fork test passes end-to-end (or unavoidable limitation documented with judge-defensible reasoning).
- [ ] Drift fork test passes end-to-end (async withdraw documented).
- [ ] Maple replaced by a real protocol adapter that passes a fork test, OR explicitly relabeled and not overclaimed.
- [ ] `tests/mainnet-fork/manifests/*.json` exist for all five adapters.
- [ ] `docs/MAINNET_FORK_TEST_RESULTS.md` records command/date/RPC/slot/pass-fail/evidence.
- [ ] Registry deployed to devnet; `deployments/devnet/registry.json` + `docs/DEVNET_REGISTRY_DEPLOYMENT.md` exist; `verify:devnet:registry` passes.
- [ ] SPEC documents async-withdraw semantics + `current_value` denomination + event/error appendices.
- [ ] README adapter status table is accurate; no overclaims (no "all five pass" / "full Maple" / "production-ready" / "devnet deployed" unless true).
- [ ] `.gitignore` excludes build artifacts, ledgers, keypairs, `.env`; secret scan clean.
- [ ] `.github/workflows/ci.yml` runs typecheck + build + `anchor test --skip-build`.
- [ ] Repo committed and pushed to a public GitHub remote.
- [ ] `docs/FINAL_BOUNTY_SELF_AUDIT.md` scores 95+.

# Integration Notes

This file tracks explicit missing protocol-specific information. MarginFi USDC,
Kamino USDC, and Maple syrupUSDC have locally passing dispatcher-driven
mainnet-fork paths. Jupiter Perps JLP and Drift Insurance Fund have typed real
CPI adapter work in place, but their fork tests remain blocked by protocol
runtime requirements documented below. Maple's direct CCIP mint/redeem extension
is still documented as future work rather than faked.

## Shared Notes

- USDC target adapters use the Solana USDC mint
  `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`.
- Real adapter CPI must not be implemented until program IDs, account layouts,
  instruction data, token accounts, oracle dependencies, and mainnet-fork clone
  lists are verified from primary protocol sources.
- Skipped tests are intentional and marked with `TODO_INTEGRATION:` when they
  represent unresolved integrations. They are not evidence of working protocol
  paths.

## Kamino USDC

Status: implemented direct Kamino Lend reserve collateral path. `deposit` CPIs
to Kamino `depositReserveLiquidity`, `withdraw` CPIs to
`redeemReserveCollateral`, and `current_value` values the user's reserve
collateral token balance from reserve exchange-rate state.

Verified data:

- Source: Kamino API docs and `@kamino-finance/klend-sdk@8.0.2`.
- Program: `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`
- Main market: `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`
- Main market authority: `9DrvZvyWh1HuAoZxvYWMvkf2XCzryCpGgHqrMjyDWpmo`
- Main-market USDC reserve: `D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59`
- Reserve liquidity supply: `Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6`
- Reserve collateral mint: `B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D`
- USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Deposit instruction: `depositReserveLiquidity(liquidityAmount: u64)`
- Withdraw instruction:
  `redeemReserveCollateral(collateralAmount: u64)`, with collateral amount
  computed from requested USDC using ceiling rounding.
- Value math: stale Kamino collateral exchange-rate math from the SDK:
  `collateral_amount * total_supply / collateral_mint_total_supply`, where
  `total_supply = available + borrowed - protocol/referrer fees`.

Known limitations:

- The adapter does not run Kamino `refreshReserve` before `current_value`; fork
  tests should use freshly cloned or recently touched reserve state.
- The adapter does not implement Kamino's queued-withdrawal flow for reserves
  with insufficient immediate liquidity.
- The adapter is direct reserve supply/redeem, not an obligation-backed borrow
  account.
- The Rust path still needs to be compiled and executed in an environment with
  Anchor/Solana CLIs installed.

Notes:

- The previous ambiguity between Kamino vault/strategy/lending products is now
  narrowed to Kamino Lend direct reserve supply.
- Do not present this as a queued-withdrawal or obligation collateral adapter.

## MarginFi USDC

Status: implemented first real adapter path.

Verified data:

- MarginFi v2 program: `MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA`
- Production group: `4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8`
- USDC bank: `2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB`
- USDC oracle: `Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX`
- USDC liquidity vault: `7jaiZR5Sk8hdYN9MxTpczTcwbWpb5WEoxSANuUwveuat`
- USDC liquidity vault authority:
  `3uxNepDbmkDNq6JhRja5Z8QwbTrfmkKP8AKZV5chYDGG`
- Deposit CPI: MarginFi `lending_account_deposit`
- Withdraw CPI: MarginFi `lending_account_withdraw`
- Value math: user asset shares multiplied by bank asset share value using the
  MarginFi I80F48 fixed-point layout, floored to native USDC units.
- Mainnet-fork clone list: implemented in `scripts/clone-mainnet-accounts.ts`.

Known limitations:

- The adapter uses user-owned MarginFi accounts and user-owned USDC token
  accounts. It is not a custody vault adapter.
- The test harness needs a local-validator funded USDC token-account fixture
  because the real USDC mint authority cannot be used on a fork.
- Withdraw uses the USDC-only health-check account set. Multi-asset MarginFi
  accounts need additional active bank/oracle accounts.
- The pinned `@mrgnlabs/marginfi-client-v2` package is deprecated upstream but
  still provides the reviewed MarginFi v2 IDL and production config used here.

## Jupiter LP

Status: implemented Jupiter Perps JLP v2 USDC liquidity path. `deposit` CPIs to
Jupiter `addLiquidity2`, `withdraw` CPIs to `removeLiquidity2`, and
`current_value` values the user's JLP token balance from pool AUM and JLP mint
supply.

Verified data:

- Source: Jupiter Perps/JLP docs, `jup-perps-client@1.2.0` generated
  instruction layouts, and mainnet account/PDA checks.
- Product: Jupiter Perps JLP.
- Jupiter Perps program: `PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu`
- Perpetuals PDA: `H4ND9aYttUVLFmNypZqLjZ52FYiGvdEB45GmwNoKEjTj`
- Transfer authority PDA: `AVzP2GeRmqGphJsMxWoqjpUifPpCret7LqWhD8NWQK49`
- Event authority PDA: `37hJBDnntwqhGbK7L6M1bLyvccj4u55CCUiLPdYkiqBN`
- JLP pool: `5BUwFW4nRbftYTDMbgxykoFWqWHPzahFSNAaaaJtVKsq`
- JLP mint: `27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4`
- USDC custody: `G18jKKXQwBbrHeiK3C9MRXhkHsLHf7XgCSisykV46EZa`
- USDC custody token account: `WzWUoCmtVv7eqAbU3BfKPU3fhLP6CXR8NCJH78UK9VS`
- Legacy USDC Doves price account:
  `A28T5pKtscnhDo6C1Sz786Tup88aTjt8uyKewjVvPrGk`
- Current USDC Doves AG / Edge price account:
  `6Jp2xZUTWdDD2ZyUPRzeMdc6AFQ5K3pFgZxk2EijfjnM`
- USDC Pythnet price account: `Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX`
- Doves oracle program: `DoVEsk76QybCEHQGzkvYPWLQu9gzNoZZZt3TPiL597e`
- Pyth Lazer verifier program:
  `pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt`
- Add liquidity instruction: `addLiquidity2(token_amount_in, min_lp_amount_out,
  token_amount_pre_swap)`.
- Remove liquidity instruction: `removeLiquidity2(lp_amount_in,
  min_amount_out)`.
- Value math: `jlp_amount * pool_aum_usd / jlp_supply`, floored to native USDC
  units.
- Mainnet-fork clone list: implemented in `scripts/clone-mainnet-accounts.ts`.

Known limitations:

- The standard does not accept explicit slippage parameters. The adapter uses a
  conservative deposit minimum and withdrawal burn buffer. A future standard
  version should expose slippage to callers.
- Jupiter Perps requires a very fresh Doves/Edge oracle account for JLP
  add/remove liquidity. Static cloned fork accounts routinely fail with
  `StaleOraclePrice` unless the test also runs the protocol oracle-update
  instruction or controls fork clock tightly. The repository does not patch or
  fake oracle account data.
- Phase 2 verification fixed the USDC custody oracle mapping from the legacy
  `doves_oracle` field to the current `doves_ag_oracle` / Edge account at
  custody offset `384`. The old account is still documented because it remains
  present in custody layout, but it is not the CPI oracle account for USDC.
- Phase 2 verification also cloned the Doves/Pyth-Lazer update dependencies and
  reconstructed recent mainnet `UpdateManyWithPythLazer` and `UpdateAgPrice2`
  instructions. A single replay transaction exceeded the legacy transaction
  size limit (`1283 > 1232`), so the diagnostic helper splits the update into
  a signed Pyth-Lazer update followed by individual Doves AG updates.
- TODO_INTEGRATION: the split Doves replay is still not a valid passing path.
  Jupiter Doves rejects replay with `InvalidSigner(6006)` because the signed
  Pyth-Lazer payload is tied to the original keeper signer. The local fork
  wallet cannot substitute for that signer, and the repository does not include
  or assume keeper private keys.
- TODO_INTEGRATION: a controlled fork clock using `--warp-slot` and
  `--ticks-per-slot` can reduce stale deltas, but Jupiter's five-second
  freshness window plus multiple oracle timestamps made it too brittle to claim
  as a reproducible bounty path in this phase.
- Valid remaining paths are: obtain an official public Jupiter/Doves oracle
  refresh route that accepts a normal test wallet, run a real keeper in the fork
  with authorized signatures, or replace the target with a Jupiter yield/LP
  product whose public CPI path does not require keeper-only oracle freshness.
- `current_value` reads stored pool AUM. It does not call Jupiter's AUM refresh
  path before valuation.
- The adapter supports USDC add/remove liquidity only.
- The Rust path still needs to be compiled and executed in an environment with
  Anchor/Solana CLIs installed.

## Maple Syrup

Status: implemented Solana-side syrupUSDC asset-position adapter. The adapter
custodies user-owned syrupUSDC in a PDA-owned vault and returns native syrupUSDC
value. It does not pretend to perform CCIP native mint/redeem.

Verified data:

- Source: Maple integration docs for cross-chain syrupUSDC.
- Solana syrupUSDC mint: `AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj`
- Solana CCIP router: `Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C`
- Solana token pool: `HrTBpF3LqSxXnjnYdR4htnBLyMHNZ6eNaDZGPundvHbm`
- SyrupUSDC/USDC Chainlink oracle:
  `CpNyiFt84q66665Kx64bobxZuMgZ2EecrhAJs1HikS2T`
- Current adapter CPI: SPL Token `Transfer` for deposit and withdraw.
- Mainnet-fork clone/fixture list: implemented in
  `scripts/clone-mainnet-accounts.ts`.

Known limitations:

- The adapter values in native syrupUSDC units, not USDC units.
- Fork tests preload syrupUSDC through a deterministic fixture because the real
  syrupUSDC mint authority is unavailable.
- Direct CCIP-native mint/redeem still needs the full CCIP SVM router account
  list, fee estimation path, message encoding, and asynchronous settlement
  monitoring.

Notes:

- A future direct CCIP adapter should probably be a state-machine adapter, not a
  synchronous deposit/withdraw adapter. It should use a new adapter version.

## Drift Insurance Fund

Status: implemented request-remove adapter path. `deposit` CPIs to Drift
`add_insurance_fund_stake`. `withdraw` CPIs to Drift
`request_remove_insurance_fund_stake` and records pending withdrawal state.
Final `remove_insurance_fund_stake` settlement is intentionally not faked
because Drift enforces an unstaking period.

Verified data:

- Source: `@drift-labs/sdk@2.163.0-beta.13`, Drift docs, and mainnet PDA checks.
- Program: `dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH`
- State: `5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN`
- USDC spot market index: `0`
- USDC spot market: `6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3`
- USDC spot market vault: `GXWqPpjQpdz7KZw9p7f5PX2eGxHAhvpNXiviFkAB8zXg`
- USDC insurance fund vault: `2CqkQvYxp9Mq4PqLvAQ1eryYxebUh4Liyn5YMDtXsYci`
- Drift signer: `JCNCMFXo5M5qwUPg2Utu1u6YWp3MbygxqBsBeXXJfrw`
- USDC oracle: `9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV`
- Insurance fund stake PDA seeds:
  `[b"insurance_fund_stake", authority, market_index_le_u16]`
- Deposit instruction: `add_insurance_fund_stake(market_index: u16, amount: u64)`
- Withdraw lifecycle:
  `request_remove_insurance_fund_stake(market_index: u16, amount: u64)` then
  `remove_insurance_fund_stake(market_index: u16)` after the protocol permits it.
- Value math: `if_shares * insurance_fund_vault_amount / total_if_shares`, with
  pending request fields included.

Mainnet wind-down (verified on-chain 2026-06-09):

- The Drift program deployed on mainnet (last deploy slot 410,633,860) removed
  every user-facing instruction: `initialize_user_stats`, `initialize_user`,
  `deposit`, `withdraw`, `place_perp_order`, and the entire insurance-fund
  staking set all return `InstructionFallbackNotFound (101)` when simulated
  against live mainnet with their canonical sha256 discriminators. Admin
  instructions still dispatch (e.g. `admin_withdraw_from_insurance_fund_vault`,
  which drained the USDC IF vault at slot 410,454,545), proving the deployed
  binary uses standard Anchor dispatch and the discriminators were never the
  problem. An earlier note here speculated about discriminator/IDL drift;
  that hypothesis is closed — the instructions are gone from the binary.
- The fork test therefore loads the official protocol-v2 `v2.161.0` binary
  built from source (`scripts/build-drift-v2161.sh`, sha256 pinned in the run
  manifest) at the Drift program id, with unmodified freshly cloned mainnet
  account state. With that binary the full dispatcher → registry → adapter →
  Drift CPI path passes (`drift-insurance-fund.json`, `passed`).
- Empirically verified `SpotMarket` layout (against cloned mainnet account
  bytes, account size 776): `insurance_fund.vault` at byte offset 304,
  `insurance_fund.total_shares` (u128) at 336. The adapter's original offsets
  (168/200) pointed into `historical_oracle_data` and were fixed once the CPI
  path became exercisable.

Known limitations:

- Standard `withdraw` requests removal. A future extension instruction should
  complete matured removal after Drift permits settlement.
- Adapter CPI discriminators match `@drift-labs/sdk@2.163.0-beta.13` IDL and
  are the standard `sha256("global:<snake_name>")[:8]` bytes; the test harness
  keeps IDL-embedded discriminators and only recomputes when absent.
- Fork tests initialize user stats and insurance fund stake before dispatcher
  deposit. That setup is not a yield operation and does not bypass dispatcher
  routing.
- Insurance-fund staking no longer exists in the deployed mainnet binary, so
  this adapter cannot be exercised against current mainnet — by any
  implementation. The historical-binary fork is the honest closest
  approximation and is labelled as such in the manifest.

Notes:

- Withdrawal may be a multi-step flow with timing constraints. Do not collapse it
  into a single fake `withdraw` implementation.

## Repository TODO_INTEGRATION Inventory

Every `TODO_INTEGRATION:` marker outside this file is intentional and searchable.

Maple syrupUSDC:

- `programs/adapters/maple-syrup/README.md`: records the future CCIP-native
  adapter extension and USDC-denominated value extension.

MarginFi:

- `tests/integration/marginfi-usdc-adapter.test.ts`: opt-in marker for running
  real MarginFi integration only when the local validator has required clones.
- `tests/mainnet-fork/marginfi-usdc-mainnet-fork.test.ts`: opt-in marker for
  running the fork test only after validator setup.

Documentation-only marker references:

- `README.md`
- `docs/BUILD_ADAPTER.md`

These references describe the marker policy; they are not hidden implementation
placeholders.

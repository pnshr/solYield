# Adapter Standard Specification

This document defines the public Solana Yield Adapter Standard used by this
reference implementation.

## Goals

- Keep the adapter interface minimal.
- Let the dispatcher make only registry and standard-interface decisions.
- Keep protocol-specific validation inside each adapter.
- Avoid fake integrations, invented accounts, or unverifiable CPI layouts.

## Standard Interface

Every compliant adapter exposes:

- `deposit(amount: u64)`
- `withdraw(amount: u64)`
- `current_value()`

`deposit` and `withdraw` must reject `amount = 0`.

`current_value` returns an unsigned 64-bit value in native units of the adapter's
supported mint. For USDC, `1_000_000` means 1 USDC.

The adapter writes the value to Solana return data as eight little-endian bytes.
The dispatcher reads return data and emits `CurrentValueQueried`.

## Standard CPI Prefix

The dispatcher CPIs into adapters with this account prefix:

```text
adapter_config, user_position, owner, mint
```

For `deposit` and `withdraw`, `user_position` is writable. For `current_value`,
it is read-only.

Protocol-specific accounts are appended after the prefix. The dispatcher does
not interpret those accounts. The adapter must validate all appended accounts
before touching funds or calling an external protocol.

## Dispatcher

The dispatcher instructions are:

- `deposit(amount: u64)`
- `withdraw(amount: u64)`
- `current_value()`

Before CPI, the dispatcher validates:

- `AdapterEntry` is the canonical PDA for adapter program, mint, and version.
- `AdapterEntry.status == Approved`.
- Passed adapter program id equals `AdapterEntry.adapter_program_id`.
- Requested mint equals `AdapterEntry.supported_mint`.
- `deposit` and `withdraw` amounts are nonzero.

Status handling:

- `Pending` -> `AdapterNotApproved`
- `Paused` -> `AdapterPaused`
- `Deprecated` -> `AdapterDeprecated`

Dispatcher events:

- `DepositRouted`
- `WithdrawRouted`
- `CurrentValueQueried`

Dispatcher errors:

- `AdapterNotApproved`
- `AdapterPaused`
- `AdapterDeprecated`
- `InvalidAdapterProgram`
- `InvalidMint`
- `InvalidAmount`
- `InvalidRegistryEntry`
- `CpiFailed`

## Registry

The registry is a governance-gated adapter allowlist. The dispatcher should only
route to approved registry entries.

PDA seeds:

```text
RegistryConfig = [b"registry_config"]
AdapterEntry   = [b"adapter_entry", adapter_program_id, supported_mint, adapter_version_le_u16]
```

`adapter_version_le_u16` is a two-byte little-endian `u16`.

### RegistryConfig

```text
governance_authority: Pubkey
adapter_count: u64
bump: u8
```

### AdapterEntry

```text
adapter_program_id: Pubkey
protocol_name: String
adapter_version: u16
supported_mint: Pubkey
status: AdapterStatus
metadata_uri: String
created_slot: u64
updated_slot: u64
bump: u8
```

String limits:

- `protocol_name`: 64 bytes
- `metadata_uri`: 256 bytes

### AdapterStatus

- `Pending`: Proposed but not routable.
- `Approved`: Routable by the dispatcher.
- `Paused`: Temporarily not routable.
- `Deprecated`: Permanently retired.

Allowed transitions:

- `Pending -> Approved`
- `Approved -> Paused`
- `Paused -> Approved`
- `Pending | Approved | Paused -> Deprecated`

`Deprecated` is terminal.

### Registry Instructions

- `initialize_registry`
- `propose_adapter`
- `approve_adapter`
- `pause_adapter`
- `unpause_adapter`
- `deprecate_adapter`
- `update_adapter_metadata`
- `transfer_governance`

All registry mutations after initialization require the current governance
authority.

## Adapter Template

The template has:

- `AdapterConfig`
- `UserPosition`
- `initialize_adapter`
- `initialize_position`
- `deposit`
- `withdraw`
- `current_value`

Template config PDA:

```text
[b"adapter_config", supported_mint, version_le_u16]
```

Template position PDA:

```text
[b"user_position", adapter_config, owner]
```

The template uses deterministic mock accounting and does not move tokens. It is
for adapter authors and compliance tests, not production yield.

## MarginFi USDC Adapter

MarginFi USDC is the first implemented real adapter path.

Verified constants:

- MarginFi v2 program: `MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA`
- Production group: `4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8`
- USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- USDC bank: `2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB`
- USDC liquidity vault: `7jaiZR5Sk8hdYN9MxTpczTcwbWpb5WEoxSANuUwveuat`
- USDC liquidity vault authority:
  `3uxNepDbmkDNq6JhRja5Z8QwbTrfmkKP8AKZV5chYDGG`
- Primary oracle: `Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX`

Position model:

- User owns the MarginFi account.
- User owns the USDC token account.
- Adapter stores the selected MarginFi account and bank in `UserPosition`.
- Adapter does not custody user funds.

`deposit` calls MarginFi `lending_account_deposit`.

`withdraw` calls MarginFi `lending_account_withdraw` and requires the USDC bank
and primary oracle as health-check remaining accounts.

`current_value` reads MarginFi asset shares and bank share value using reviewed
I80F48 fixed-point offsets, then returns native USDC units.

## Kamino USDC Adapter

Kamino USDC is implemented as a direct Kamino Lend reserve adapter.

Verified constants:

- Kamino Lend program: `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`
- Main market: `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`
- Main market authority: `9DrvZvyWh1HuAoZxvYWMvkf2XCzryCpGgHqrMjyDWpmo`
- USDC reserve: `D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59`
- USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Reserve liquidity supply: `Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6`
- Reserve collateral mint: `B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D`

Position model:

- User owns the USDC token account.
- User owns the reserve collateral token account.
- Adapter stores the selected reserve and collateral token account.
- Adapter does not custody funds and does not create a Kamino obligation.

`deposit` calls Kamino `depositReserveLiquidity`.

`withdraw` converts requested USDC into collateral tokens with ceiling rounding
and calls Kamino `redeemReserveCollateral`.

`current_value` reads the user's collateral token balance and Kamino reserve
state, then returns native USDC units using the reserve collateral exchange
rate.

Known limitations:

- `current_value` does not run Kamino `refreshReserve`; callers should use fresh
  fork/mainnet reserve state or add a refresh extension.
- The queued-withdrawal path is not implemented for cases where immediate
  reserve liquidity is insufficient.
- This is a direct reserve supply adapter, not an obligation collateral or
  borrow adapter.

## Drift Insurance Fund Adapter

Drift Insurance Fund is implemented as a delayed-withdrawal adapter path.

Position model:

- User owns the Drift insurance fund stake PDA.
- User owns the Drift user stats PDA.
- User owns the USDC token account.
- Adapter stores the selected market index, stake PDA, and user stats PDA.
- Adapter does not custody funds.

`deposit` calls Drift `add_insurance_fund_stake`.

`withdraw` calls Drift `request_remove_insurance_fund_stake`. This is a request
state transition, not immediate token settlement. Final settlement with
`remove_insurance_fund_stake` requires Drift's unstaking period and should be a
future extension instruction rather than a fake synchronous withdraw.

`current_value` reads Drift IF shares, pending withdrawal fields,
`SpotMarket.insurance_fund.total_shares`, and the IF vault token amount, then
returns native USDC units.

## Jupiter LP Adapter

Jupiter LP is implemented as a Jupiter Perps JLP v2 USDC liquidity adapter.

Verified constants:

- Jupiter Perps program: `PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu`
- Perpetuals PDA: `H4ND9aYttUVLFmNypZqLjZ52FYiGvdEB45GmwNoKEjTj`
- Transfer authority PDA: `AVzP2GeRmqGphJsMxWoqjpUifPpCret7LqWhD8NWQK49`
- JLP pool: `5BUwFW4nRbftYTDMbgxykoFWqWHPzahFSNAaaaJtVKsq`
- JLP mint: `27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4`
- USDC custody: `G18jKKXQwBbrHeiK3C9MRXhkHsLHf7XgCSisykV46EZa`
- USDC custody token account: `WzWUoCmtVv7eqAbU3BfKPU3fhLP6CXR8NCJH78UK9VS`
- Legacy USDC Doves price account:
  `A28T5pKtscnhDo6C1Sz786Tup88aTjt8uyKewjVvPrGk`
- Current USDC Doves AG / Edge price account:
  `6Jp2xZUTWdDD2ZyUPRzeMdc6AFQ5K3pFgZxk2EijfjnM`
- USDC Pythnet price account: `Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX`

Position model:

- User owns the USDC token account.
- User owns the JLP token account.
- Adapter stores the selected pool, USDC custody, and JLP token account.
- Adapter does not custody funds.

`deposit` calls Jupiter Perps `addLiquidity2`.

`withdraw` converts a requested minimum USDC amount into a JLP burn amount using
pool AUM and JLP supply, then calls Jupiter Perps `removeLiquidity2` with
`min_amount_out = amount`.

`current_value` reads the user's JLP balance, pool `aum_usd`, and JLP supply,
then returns native USDC units:

```text
value = user_jlp_amount * pool_aum_usd / jlp_supply
```

Known limitations:

- The standard does not yet carry explicit slippage parameters. The adapter uses
  conservative built-in guards; a production extension should expose caller
  slippage.
- `current_value` relies on the pool's stored AUM and does not refresh Jupiter
  protocol state.
- This adapter supports USDC add/remove liquidity only.

## Maple syrupUSDC Adapter

Maple syrupUSDC is implemented as a Solana-side asset-position adapter for the
yield-bearing syrupUSDC SPL token.

Verified constants:

- syrupUSDC mint: `AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj`
- SPL Token program: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- CCIP router, documented for future extension:
  `Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C`
- CCIP token pool, documented for future extension:
  `HrTBpF3LqSxXnjnYdR4htnBLyMHNZ6eNaDZGPundvHbm`
- SyrupUSDC/USDC oracle, documented for future extension:
  `CpNyiFt84q66665Kx64bobxZuMgZ2EecrhAJs1HikS2T`

Position model:

- User owns the syrupUSDC token account.
- The adapter position PDA owns a syrupUSDC vault token account.
- Adapter stores the vault token account.
- Adapter does not pretend to perform CCIP native mint/redeem.

`deposit` transfers syrupUSDC from the user into the PDA-owned vault.

`withdraw` transfers syrupUSDC from the vault back to the user using PDA signer
seeds.

`current_value` converts the vault token amount into USDC units using the
Chainlink SYRUPUSDC-USDC exchange-rate feed (validated by feed address, owner
program, and feed version; floor rounding).

Known limitations:

- This is a syrupUSDC asset-position adapter, not direct CCIP mint/redeem.
- The Chainlink feed updates on deviation (roughly daily); production
  deployments should layer an explicit staleness policy on top of the
  identity checks.

## Async-Withdraw Semantics

Some protocols enforce a mandatory unstaking or cooldown period before funds
can be returned to the user. The standard defines two tiers:

### Synchronous withdraw

The default. `withdraw(amount)` must atomically return `amount` of the
supported mint to `owner` within the same transaction. The dispatcher treats a
successful transaction as evidence that funds have been delivered.

### Asynchronous (request-remove) withdraw

Used when the underlying protocol enforces a cooldown (e.g. Drift Insurance
Fund). The adapter's `withdraw` call MUST:

1. Initiate the protocol's withdrawal request (e.g. `request_remove_insurance_fund_stake`).
2. Record the pending withdrawal in `UserPosition`.
3. NOT claim that funds have been delivered.

A future `complete_withdraw` extension instruction may be added to the adapter
to settle the unstaking once the cooldown has elapsed. `complete_withdraw` is
NOT part of the current standard surface and is handled outside the dispatcher.

Adapters that implement async withdrawal must document this semantics clearly in
both the adapter metadata URI and `docs/INTEGRATION_NOTES.md`.

### current_value denomination

`current_value` MUST return a `u64` in native units of the adapter's
`supported_mint`. For USDC-based adapters this is micro-USDC (`1_000_000` = 1 USDC).

All five reference adapters conform: USDC-based adapters return micro-USDC
directly, and the Maple adapter converts its syrupUSDC position into USDC
units through the Chainlink SYRUPUSDC-USDC exchange-rate feed on-chain. An
adapter that cannot value its position in supported-mint units must declare
the deviation in its `metadata_uri` and in `docs/INTEGRATION_NOTES.md`; the
dispatcher forwards the raw `u64`, and callers interpret it using adapter
metadata.

## Event Schema

### Dispatcher events

```rust
DepositRouted  { adapter_entry: Pubkey, owner: Pubkey, mint: Pubkey, amount: u64 }
WithdrawRouted { adapter_entry: Pubkey, owner: Pubkey, mint: Pubkey, amount: u64 }
CurrentValueQueried { adapter_entry: Pubkey, owner: Pubkey, mint: Pubkey, value: u64 }
```

### Adapter template events

```rust
Deposited     { owner: Pubkey, mint: Pubkey, amount: u64 }
Withdrawn     { owner: Pubkey, mint: Pubkey, amount: u64 }
ValueReturned { owner: Pubkey, mint: Pubkey, value: u64 }
```

Real adapters emit protocol-specific events alongside the standard events.

## Error Schema

### Dispatcher errors

| Error | Code | Meaning |
| --- | --- | --- |
| `AdapterNotApproved` | 6000 | Entry status is Pending |
| `AdapterPaused` | 6001 | Entry status is Paused |
| `AdapterDeprecated` | 6002 | Entry status is Deprecated |
| `InvalidAdapterProgram` | 6003 | Passed program ≠ entry program |
| `InvalidMint` | 6004 | Passed mint ≠ entry supported_mint |
| `InvalidAmount` | 6005 | amount = 0 |
| `InvalidRegistryEntry` | 6006 | PDA derivation mismatch |
| `CpiFailed` | 6007 | Downstream adapter returned error |

### Adapter template errors

| Error | Code | Meaning |
| --- | --- | --- |
| `InvalidOwner` | 6000 | owner mismatch on UserPosition |
| `InvalidMint` | 6001 | mint mismatch on AdapterConfig |
| `InvalidAmount` | 6002 | amount = 0 |

Real adapters extend this table with protocol-specific errors.

## Compatibility Rules

A production adapter should:

- Preserve `deposit`, `withdraw`, and `current_value` names and semantics.
- Reject wrong mint and wrong owner before CPI.
- Reject zero amounts.
- Validate all protocol accounts before CPI.
- Emit adapter events for deposit, withdraw, and value.
- Return `current_value` in native supported-mint units (or document divergence).
- Declare async-withdraw semantics in metadata if `withdraw` initiates a request.
- Include honest local and mainnet-fork tests.

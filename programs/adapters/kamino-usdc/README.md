# Kamino USDC Adapter

## Protocol

Kamino Lend.

## Target Asset

USDC in Kamino's main lending market.

## Underlying Position Model

This adapter uses the direct Kamino Lend reserve collateral model:

- `deposit` calls `depositReserveLiquidity`.
- Kamino mints reserve collateral tokens to the user's collateral token account.
- `withdraw` converts requested USDC into collateral tokens and calls
  `redeemReserveCollateral`.
- `current_value` values the user's collateral token balance against the reserve
  collateral exchange rate.

The adapter does not create or manage a Kamino obligation and does not custody
funds.

## Required Protocol Accounts

- Kamino Lend program
- Main lending market
- Lending market authority PDA
- USDC reserve
- USDC mint
- Reserve liquidity supply vault
- Reserve collateral mint
- User USDC token account
- User reserve collateral token account
- SPL token program
- Instructions sysvar

## Program IDs And Accounts

- Kamino Lend program: `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`
- Main market: `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`
- Main market authority: `9DrvZvyWh1HuAoZxvYWMvkf2XCzryCpGgHqrMjyDWpmo`
- USDC reserve: `D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59`
- USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Reserve liquidity supply: `Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6`
- Reserve collateral mint: `B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D`

## Value Calculation

The adapter mirrors Kamino SDK stale exchange-rate math:

```text
total_supply =
  liquidity.total_available_amount
  + floor(liquidity.borrowed_amount_sf / 2^60)
  - floor(accumulated_protocol_fees_sf / 2^60)
  - floor(accumulated_referrer_fees_sf / 2^60)
  - floor(pending_referrer_fees_sf / 2^60)

value = user_collateral_amount * total_supply / collateral_mint_total_supply
```

If either side of the exchange rate is zero, the adapter uses Kamino's initial
1:1 collateral rate.

## Deposit Flow

The dispatcher routes `deposit(amount)` into this adapter. The adapter validates
the registry mint, user owner, reserve ownership, reserve PDAs, user token
accounts, and instructions sysvar, then CPIs into Kamino
`depositReserveLiquidity`.

## Withdraw Flow

The dispatcher routes `withdraw(amount)` in native USDC units. The adapter
converts that USDC amount to reserve collateral tokens with ceiling rounding,
then CPIs into Kamino `redeemReserveCollateral`.

## current_value Flow

`current_value` reads the user's reserve collateral token balance and the Kamino
reserve state, then returns native USDC units through Solana return data.

## Known Limitations

- The adapter does not run Kamino `refreshReserve` before `current_value`; fork
  tests should operate on freshly cloned or recently touched reserve state.
- The adapter does not implement Kamino's queued-withdrawal flow for reserves
  with insufficient immediately available liquidity.
- The adapter is a direct reserve supply adapter, not an obligation collateral
  or borrow adapter.

## Test Requirements

- Mainnet-fork deposit through dispatcher and registry.
- Current value after deposit.
- Withdraw through dispatcher and registry.
- Reject wrong mint, paused adapter, and unapproved adapter.
- Re-run against a fork with fresh Kamino reserve state before submission.

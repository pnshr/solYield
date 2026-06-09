# Drift Insurance Fund Adapter

## Protocol

Drift Protocol.

## Target Asset

USDC insurance fund stake for Drift spot market index `0`.

## Position Model

The adapter uses the user's Drift insurance fund stake PDA and user stats PDA.
It does not custody funds. User USDC moves from the user's token account into
Drift through Drift's own CPI.

Standard `withdraw(amount)` maps to Drift's
`request_remove_insurance_fund_stake(market_index, amount)` instruction. Drift
requires a later `remove_insurance_fund_stake(market_index)` after the protocol
unstaking period. The adapter records the pending withdrawal amount and reports
value including pending withdrawal fields; it does not fake immediate token
settlement.

## Required Protocol Accounts

Deposit:

- Drift program
- Drift state
- USDC spot market
- User insurance fund stake PDA
- User stats PDA
- USDC spot market vault
- USDC insurance fund vault
- Drift signer PDA
- User USDC token account
- SPL token program

Withdraw request:

- Drift program
- USDC spot market
- User insurance fund stake PDA
- User stats PDA
- USDC insurance fund vault

Current value:

- Drift program
- USDC spot market
- User insurance fund stake PDA
- USDC insurance fund vault

## Program IDs

- Drift program: `dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH`
- Drift state: `5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN`
- USDC spot market: `6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3`
- USDC spot market vault: `GXWqPpjQpdz7KZw9p7f5PX2eGxHAhvpNXiviFkAB8zXg`
- USDC insurance fund vault: `2CqkQvYxp9Mq4PqLvAQ1eryYxebUh4Liyn5YMDtXsYci`
- Drift signer: `JCNCMFXo5M5qwUPg2Utu1u6YWp3MbygxqBsBeXXJfrw`
- USDC oracle: `9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV`

## Share/Value Calculation

The adapter reads:

- `InsuranceFundStake.if_shares`
- `InsuranceFundStake.last_withdraw_request_shares`
- `InsuranceFundStake.last_withdraw_request_value`
- `SpotMarket.insurance_fund.total_shares`
- SPL token amount of the insurance fund vault

Value is:

```text
active_shares * insurance_fund_vault_amount / total_if_shares
  + min(
      last_withdraw_request_value,
      last_withdraw_request_shares * insurance_fund_vault_amount / total_if_shares
    )
```

The result is returned as native USDC units.

## Test Requirements

The mainnet-fork test must:

- Clone Drift program, state, USDC spot market, spot vault, IF vault, oracle, and
  USDC mint.
- Preload the fork wallet with SOL and USDC.
- Initialize Drift user stats and insurance fund stake with the official Drift
  IDL before routing yield operations.
- Register and approve the adapter in the registry.
- Deposit via dispatcher.
- Query `current_value` via dispatcher.
- Request withdraw via dispatcher.
- Assert `pending_withdraw_amount` rather than pretending final token settlement
  is immediate.

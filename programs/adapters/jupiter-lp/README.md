# Jupiter LP Adapter

## Protocol

Jupiter Perps.

## Target Asset

USDC liquidity into Jupiter Perps JLP.

## Expected Underlying Position Model

The user supplies USDC to the Jupiter Perps JLP pool and receives JLP shares in a
user-owned JLP token account. The adapter stores the selected pool, USDC custody,
and user JLP token account in `JupiterLpPosition`.

The adapter does not custody funds.

## Required Protocol Accounts

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

## Share/Value Calculation Method

`current_value` reads:

- user JLP token balance
- JLP mint supply
- JLP pool `aum_usd`

It returns:

```text
value_usdc_native = user_jlp_amount * pool_aum_usd / jlp_mint_supply
```

The Jupiter client docs describe `aum_usd` as 6-decimal USD/native USDC units.

## Deposit Flow

`deposit(amount)`:

1. Validates USDC funding account, user JLP token account, pool, custody, oracle,
   mint, and PDA accounts.
2. Computes a conservative minimum LP amount from pool AUM and JLP supply.
3. CPIs to Jupiter Perps `addLiquidity2`.
4. Stores the updated JLP balance and value.

## Withdraw Flow

`withdraw(amount)`:

1. Treats `amount` as minimum requested USDC native units.
2. Converts the requested USDC amount into a JLP burn amount using pool AUM and
   JLP supply.
3. Adds a small burn buffer to account for Jupiter remove-liquidity fees.
4. CPIs to Jupiter Perps `removeLiquidity2` with `min_amount_out = amount`.
5. Stores the updated JLP balance and value.

## current_value Flow

`current_value` does not CPI. It values the user's JLP shares from the current
pool AUM and JLP mint supply and writes the result to Solana return data.

## Known Limitations

- The standard `deposit`/`withdraw` calls do not carry explicit slippage
  parameters. This adapter uses conservative built-in guards; a production vault
  should add an extension instruction or versioned standard fields for slippage.
- `current_value` uses the pool's stored AUM. A caller that needs freshly
  refreshed Jupiter AUM should refresh the relevant protocol state before
  querying.
- The adapter targets USDC liquidity into JLP only, not arbitrary JLP basket
  assets.

## Test Requirements

- Mainnet-fork test must clone the Jupiter Perps program, Doves oracle program,
  Pyth Lazer verifier, pool, perpetuals, JLP mint, USDC custody, custody vault,
  Doves AG / Edge price account, Pythnet price account, and USDC mint.
- Fork wallet must have a funded USDC token account and SOL for transaction
  fees/ATA creation.
- TODO_INTEGRATION: the current fork path still fails Jupiter Perps oracle
  freshness. Replaying recent mainnet Doves updates with the local fork wallet
  fails `InvalidSigner(6006)` because the Pyth Lazer payload is keeper-signed.

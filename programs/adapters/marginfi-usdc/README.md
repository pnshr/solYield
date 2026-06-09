# MarginFi USDC Adapter

## Protocol

MarginFi v2.

## Target Asset

USDC lending position in the verified production MarginFi USDC bank.

## Position Model

The adapter uses a user-owned MarginFi account and a user-owned USDC token
account. The adapter position PDA binds:

- standard owner
- MarginFi account
- MarginFi USDC bank
- net deposited amount
- current floored asset shares
- last native USDC value

The adapter does not custody funds.

## Verified Accounts

- MarginFi program: `MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA`
- MarginFi group: `4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8`
- USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- USDC bank: `2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB`
- USDC oracle: `Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX`
- USDC liquidity vault: `7jaiZR5Sk8hdYN9MxTpczTcwbWpb5WEoxSANuUwveuat`
- USDC liquidity vault authority:
  `3uxNepDbmkDNq6JhRja5Z8QwbTrfmkKP8AKZV5chYDGG`

## Flow

`deposit` validates the standard mint/owner checks, validates MarginFi program
state, validates the owner USDC token account, and CPIs to
`lending_account_deposit`.

`withdraw` validates the same protocol accounts plus the MarginFi liquidity
vault authority and requires the USDC bank + oracle as health-check remaining
accounts before CPI to `lending_account_withdraw`.

`current_value` reads the user MarginFi account and bank directly. It finds the
USDC asset shares, multiplies by the bank asset share value using I80F48
fixed-point math, floors to native USDC units, returns that `u64`, and emits
`MarginfiUsdcValue`.

## Tests

The integration and mainnet-fork tests are opt-in because they require a local
validator with cloned MarginFi accounts and a funded USDC token-account fixture.

Use:

```sh
FORK_USER_PUBKEY=<TEST_WALLET_PUBKEY> npm run clone:mainnet
npm run test:mainnet-fork
```

## Known Limitations

- The adapter supports the USDC-only MarginFi account path first.
- Multi-asset MarginFi accounts require additional health-check banks/oracles.
- The test fixture preloads a funded USDC token account because the real USDC
  mint authority cannot mint on a fork.
- The pinned MarginFi TypeScript SDK is deprecated upstream but still provides
  the reviewed IDL/config used for this implementation.

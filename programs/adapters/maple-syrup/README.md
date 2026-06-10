# Maple Syrup Adapter

## Protocol

Maple/Syrup.

## Target Asset

syrupUSDC on Solana.

## Expected Underlying Position Model

Maple syrupUSDC is live on Solana as a yield-bearing SPL token bridged through
CCIP. This adapter implements an honest Solana-side asset-position flow:

- The user already owns syrupUSDC on Solana.
- `deposit` transfers syrupUSDC from the user into a PDA-owned vault token
  account.
- `withdraw` transfers syrupUSDC from the vault back to the user.
- `current_value` returns the vault position valued in USDC units via the
  Chainlink SYRUPUSDC-USDC exchange-rate feed
  (`CpNyiFt84q66665Kx64bobxZuMgZ2EecrhAJs1HikS2T`).

The adapter does not pretend to perform CCIP native mint/redeem or a direct
Solana Maple lending CPI.

## Required Protocol Accounts

- syrupUSDC mint: `AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj`
- SPL Token program: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- CCIP router, documented for future extension:
  `Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C`
- CCIP token pool, documented for future extension:
  `HrTBpF3LqSxXnjnYdR4htnBLyMHNZ6eNaDZGPundvHbm`
- SyrupUSDC/USDC Chainlink oracle, documented for future extension:
  `CpNyiFt84q66665Kx64bobxZuMgZ2EecrhAJs1HikS2T`

## Program IDs

The current adapter CPIs to the SPL Token program only. No direct Solana Maple
lending program is assumed.

TODO_INTEGRATION: A future CCIP-native adapter version must use the Chainlink
CCIP SVM router account model and should be versioned separately from this
asset-position adapter.

## Share/Value Calculation Method

Shares equal the syrupUSDC token amount held in the PDA-owned vault.
`current_value` converts the vault's syrupUSDC amount into USDC units using
the Chainlink exchange-rate feed (floor rounding).

TODO_INTEGRATION: A future USDC-denominated value extension can use the
syrupUSDC/USDC Chainlink oracle, but that would change the current standard's
"native supported mint units" semantics and should be versioned deliberately.

## Deposit Flow

`deposit(amount)` validates the user's syrupUSDC token account, the PDA-owned
vault token account, and the SPL Token program before transferring `amount` into
the vault.

## Withdraw Flow

`withdraw(amount)` validates the vault and user destination syrupUSDC account,
then transfers `amount` back to the user using the `UserPosition` PDA as the
vault authority.

## current_value Flow

`current_value` validates the vault token account and returns its syrupUSDC token
amount through Solana return data.

## Known Limitations

- This is not CCIP native mint/redeem.
- The fork test preloads the user's syrupUSDC token account with a deterministic
  fixture because the test cannot mint real syrupUSDC.
- The adapter values in syrupUSDC native units, not USDC units.

## Test Requirements

- Mainnet-fork test must clone the syrupUSDC mint and fund the user's syrupUSDC
  ATA fixture.
- Failure tests cover pending/paused registry entries and wrong mint rejection.
- Future CCIP-native work needs separate tests for message construction, fees,
  and asynchronous settlement.

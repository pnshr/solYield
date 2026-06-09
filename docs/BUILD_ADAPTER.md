# Build Your Own Adapter

This guide is for a team that wants to build a new yield adapter in one day
using the reference template.

## Starting Point

Copy:

```text
programs/adapters/adapter-template
```

Then:

1. Rename the crate, package, and Rust module.
2. Set a fresh program id.
3. Keep the standard instruction names:
   - `initialize_position`
   - `deposit`
   - `withdraw`
   - `current_value`
4. Keep `AdapterConfig` and `UserPosition`, or extend them conservatively.
5. Keep the dispatcher CPI account prefix:

```text
adapter_config, user_position, owner, mint
```

Append protocol-specific accounts after that prefix.

## Template Accounts

`AdapterConfig`:

```text
authority: Pubkey
supported_mint: Pubkey
protocol_program_id: Pubkey
version: u16
bump: u8
```

PDA:

```text
[b"adapter_config", supported_mint, version_le_u16]
```

`UserPosition`:

```text
owner: Pubkey
deposited_amount: u64
shares: u64
last_value: u64
bump: u8
```

PDA:

```text
[b"user_position", adapter_config, owner]
```

## Replace Mock Accounting

The template increments and decrements mock values. A real adapter must replace
that with protocol state.

For `deposit`:

1. Reject zero amount.
2. Verify `mint == AdapterConfig.supported_mint`.
3. Verify signer owns `UserPosition`.
4. Validate token accounts, vaults, markets, oracles, authorities, and protocol
   program id.
5. Move funds or call the protocol through reviewed CPI.
6. Read resulting protocol state.
7. Update `deposited_amount`, `shares`, and `last_value`.
8. Emit an adapter deposit event.

For `withdraw`:

1. Reject zero amount.
2. Verify owner and mint.
3. Validate all withdraw-specific health, oracle, vault, queue, or authority
   accounts.
4. Call the real protocol withdraw CPI.
5. Update position state from protocol state.
6. Emit an adapter withdraw event.

For `current_value`:

1. Verify owner and mint.
2. Read protocol state without mutating funds.
3. Convert shares or receipt tokens to native supported-mint units.
4. Write eight little-endian bytes with Solana return data.
5. Emit an adapter value event.

## Protocol Account Discipline

Do not rely on comments, examples, or memory for account order. Verify against:

- Official protocol source or IDL.
- Mainnet account owners and layouts.
- Official SDK instruction builders where appropriate.
- Mainnet-fork tests using cloned accounts.

Every appended account must be validated inside the adapter before CPI.

## Error Discipline

Use clear errors:

- `InvalidAmount`
- `InvalidMint`
- `InvalidOwner`
- `ProtocolCpiFailed`
- `MathOverflow`
- `UnsupportedOperation`

Use `UnsupportedOperation` only for an explicitly incomplete skeleton. Do not
return success after changing local accounting if no real protocol action
occurred.

## Tests

Minimum test set:

- Compliance tests for the standard interface.
- Unit tests for PDA derivation and validation.
- Integration tests for dispatcher + registry + adapter.
- Mainnet-fork tests for real protocol CPI.
- Rejection tests for wrong mint, wrong owner, zero amount, paused adapter, and
  unapproved adapter.

The compliance suite lives at:

```text
tests/integration/adapter-compliance.test.ts
```

## Documentation

Each adapter should document:

- Protocol and target product.
- Target asset.
- Position model.
- Required protocol accounts.
- Program IDs.
- Share/value calculation.
- Deposit flow.
- Withdraw flow.
- `current_value` flow.
- Missing integration data.
- Test requirements.

Track unresolved details in `docs/INTEGRATION_NOTES.md` with searchable
`TODO_INTEGRATION:` markers in code or tests.

## One-Day Adapter Checklist

- [ ] Copy and rename the template.
- [ ] Generate a fresh program id.
- [ ] Keep `deposit`, `withdraw`, and `current_value`.
- [ ] Preserve the standard account prefix.
- [ ] Add verified protocol constants.
- [ ] Replace mock accounting with real CPI.
- [ ] Validate all appended accounts.
- [ ] Reject wrong owner, wrong mint, and zero amounts.
- [ ] Return `current_value` as native units.
- [ ] Emit adapter events.
- [ ] Run compliance tests.
- [ ] Add protocol integration tests.
- [ ] Add mainnet-fork tests.
- [ ] Update adapter README and integration notes.

Reference patterns:

- Kamino demonstrates a direct reserve collateral adapter.
- Jupiter demonstrates a USDC-to-LP-share adapter.
- Maple demonstrates a yield-bearing SPL-token asset-position adapter without
  faking CCIP native mint/redeem.
- Drift demonstrates how to model a delayed-withdrawal protocol without faking
  immediate settlement.

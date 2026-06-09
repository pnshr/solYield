# Examples

Run examples after `anchor build` so `target/idl/*.json` exists.

Common environment:

```sh
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
ANCHOR_WALLET=~/.config/solana/id.json
```

Register an adapter:

```sh
ADAPTER_PROGRAM_ID=<ADAPTER_PROGRAM_ID> \
SUPPORTED_MINT=<MINT> \
ADAPTER_VERSION=1 \
PROTOCOL_NAME="Example Adapter" \
METADATA_URI=https://example.com/adapter.json \
ts-node examples/register-adapter.ts
```

Approve an adapter:

```sh
ADAPTER_PROGRAM_ID=<ADAPTER_PROGRAM_ID> \
SUPPORTED_MINT=<MINT> \
ADAPTER_VERSION=1 \
ts-node examples/approve-adapter.ts
```

Update adapter metadata:

```sh
ADAPTER_PROGRAM_ID=<ADAPTER_PROGRAM_ID> \
SUPPORTED_MINT=<MINT> \
ADAPTER_VERSION=1 \
NEW_METADATA_URI=https://example.com/adapter-v2.json \
ts-node examples/update-metadata.ts
```

Transfer registry governance:

```sh
NEW_GOVERNANCE_AUTHORITY=<NEW_AUTHORITY_PUBKEY> \
ts-node examples/transfer-governance.ts
```

Route through the dispatcher:

```sh
AMOUNT=1000000 \
ADAPTER_ENTRY=<ADAPTER_ENTRY_PDA> \
ADAPTER_PROGRAM_ID=<ADAPTER_PROGRAM_ID> \
ADAPTER_CONFIG=<ADAPTER_CONFIG> \
SUPPORTED_MINT=<MINT> \
ADAPTER_POSITION=<ADAPTER_POSITION> \
REMAINING_ACCOUNTS_JSON='[]' \
ts-node examples/deposit.ts
```

`withdraw.ts` uses the same environment plus `AMOUNT`.

`current-value.ts` uses the same environment except `AMOUNT`. It simulates the
dispatcher call and prints the standard `CurrentValueQueried` value.

Real adapters usually require protocol-specific remaining accounts. Keep those
accounts in the exact order required by the adapter, and do not reuse placeholder
account lists.

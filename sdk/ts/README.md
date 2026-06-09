# TypeScript SDK

The TypeScript SDK provides small Anchor helpers for registry governance and
dispatcher routing. It intentionally avoids protocol-specific abstractions.

## Helpers

- `deriveRegistryConfigPda`
- `deriveAdapterEntryPda`
- `initializeRegistry`
- `proposeAdapter`
- `approveAdapter`
- `pauseAdapter`
- `unpauseAdapter`
- `deprecateAdapter`
- `dispatcherDeposit`
- `dispatcherWithdraw`
- `dispatcherCurrentValue`

## Usage

```ts
import {
  deriveAdapterEntryPda,
  proposeAdapter,
} from "./sdk/ts/src";
```

The helpers accept generic Anchor `Program` clients. Load the relevant IDLs from
`target/idl` after running `anchor build`, or use generated Anchor clients in an
application.

`dispatcherCurrentValue` uses Anchor simulation and parses the standard
`CurrentValueQueried` event because read-only Solana transactions do not return a
JavaScript value from `.rpc()`.

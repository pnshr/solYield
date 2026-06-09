import { runMarginfiUsdcDispatcherFlow } from "../support/marginfi-usdc-flow";

const runMainnetFork = process.env.RUN_MARGINFI_MAINNET_FORK === "1";
const suite = runMainnetFork ? describe : describe.skip;

suite("marginfi usdc mainnet-fork integration", () => {
  it("registers, approves, deposits, values, withdraws, and rejects invalid routes", async () => {
    await runMarginfiUsdcDispatcherFlow();
  });
});

if (!runMainnetFork) {
  // TODO_INTEGRATION: Prefer npm run test:fork:marginfi, which sets
  // RUN_MARGINFI_MAINNET_FORK=1 after the local validator has been started with
  // scripts/clone-mainnet-accounts.ts output. The fork must include MarginFi
  // program/accounts, USDC mint, and funded wallet fixtures.
}

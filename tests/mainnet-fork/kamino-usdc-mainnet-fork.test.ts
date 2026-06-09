import { runKaminoUsdcDispatcherFlow } from "../support/kamino-usdc-flow";

const runKaminoMainnetFork = process.env.RUN_KAMINO_MAINNET_FORK === "1";
const kaminoSuite = runKaminoMainnetFork ? describe : describe.skip;

kaminoSuite("kamino usdc mainnet-fork integration", () => {
  it("registers, approves, deposits, values, withdraws, and rejects invalid routes", async () => {
    await runKaminoUsdcDispatcherFlow();
  });
});

if (!runKaminoMainnetFork) {
  // Prefer npm run test:fork:kamino after starting a local validator with
  // scripts/clone-mainnet-accounts.ts output. The fork must include Kamino
  // program/accounts, USDC mint, reserve collateral mint, reserve liquidity
  // supply, and funded wallet fixtures.
}

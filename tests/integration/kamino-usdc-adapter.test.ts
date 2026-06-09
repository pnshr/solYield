import { runKaminoUsdcDispatcherFlow } from "../support/kamino-usdc-flow";

const runKaminoIntegration = process.env.RUN_KAMINO_INTEGRATION === "1";
const kaminoSuite = runKaminoIntegration ? describe : describe.skip;

kaminoSuite("kamino usdc adapter integration", () => {
  it("registers, approves, deposits, values, withdraws, and rejects invalid routes", async () => {
    await runKaminoUsdcDispatcherFlow();
  });
});

if (!runKaminoIntegration) {
  // Set RUN_KAMINO_INTEGRATION=1 only when the local validator has Kamino
  // program/accounts, USDC mint, reserve collateral mint, reserve liquidity
  // supply, and funded wallet fixtures.
}

import { runJupiterLpDispatcherFlow } from "../support/jupiter-lp-flow";

const runJupiterMainnetFork = process.env.RUN_JUPITER_MAINNET_FORK === "1";
const jupiterSuite = runJupiterMainnetFork ? describe : describe.skip;

jupiterSuite("jupiter lp mainnet-fork integration", () => {
  it("registers, approves, deposits USDC into JLP, values, withdraws, and rejects invalid routes", async () => {
    await runJupiterLpDispatcherFlow();
  });
});

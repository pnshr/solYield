import { runJupiterLpDispatcherFlow } from "../support/jupiter-lp-flow";

const runJupiterIntegration = process.env.RUN_JUPITER_INTEGRATION === "1";
const jupiterSuite = runJupiterIntegration ? describe : describe.skip;

jupiterSuite("jupiter lp adapter integration", () => {
  it("routes USDC deposit/current_value/withdraw through dispatcher into Jupiter JLP", async () => {
    await runJupiterLpDispatcherFlow();
  });
});

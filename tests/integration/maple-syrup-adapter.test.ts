import { runMapleSyrupDispatcherFlow } from "../support/maple-syrup-flow";

const runMapleIntegration = process.env.RUN_MAPLE_INTEGRATION === "1";
const mapleSuite = runMapleIntegration ? describe : describe.skip;

mapleSuite("maple syrup adapter integration", () => {
  it("routes syrupUSDC deposit/current_value/withdraw through dispatcher", async () => {
    await runMapleSyrupDispatcherFlow();
  });
});

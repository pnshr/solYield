import { runMapleSyrupDispatcherFlow } from "../support/maple-syrup-flow";

const runMapleMainnetFork = process.env.RUN_MAPLE_MAINNET_FORK === "1";
const mapleSuite = runMapleMainnetFork ? describe : describe.skip;

mapleSuite("maple syrup mainnet-fork integration", () => {
  it("registers, approves, custodies syrupUSDC, values, withdraws, and rejects invalid routes", async () => {
    await runMapleSyrupDispatcherFlow();
  });
});

const runDriftMainnetFork = process.env.RUN_DRIFT_MAINNET_FORK === "1";
const driftSuite = runDriftMainnetFork ? describe : describe.skip;

driftSuite("drift insurance fund mainnet-fork integration", () => {
  it("registers, approves, deposits, values, requests withdraw, and rejects invalid routes", async () => {
    const { runDriftInsuranceFundDispatcherFlow } = require(
      "../support/drift-insurance-fund-flow",
    );
    await runDriftInsuranceFundDispatcherFlow();
  });
});

if (!runDriftMainnetFork) {
  // Prefer npm run test:fork:drift after starting a local validator with
  // scripts/clone-mainnet-accounts.ts output. Drift withdraw is a request-remove
  // state transition; final token settlement requires the protocol unstaking
  // period and is intentionally not faked.
}

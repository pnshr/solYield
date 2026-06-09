const runIntegration = process.env.RUN_DRIFT_INTEGRATION === "1";
const suite = runIntegration ? describe : describe.skip;

suite("drift insurance fund adapter integration", () => {
  it("registers, approves, deposits, values, requests withdraw, and rejects invalid routes", async () => {
    const { runDriftInsuranceFundDispatcherFlow } = await import(
      "../support/drift-insurance-fund-flow"
    );
    await runDriftInsuranceFundDispatcherFlow();
  });
});

if (!runIntegration) {
  // Set RUN_DRIFT_INTEGRATION=1 only when the local validator has Drift
  // program/accounts, USDC mint, funded user USDC token account, and Drift
  // user-stats/stake setup can be initialized.
}

export {};

import { runMarginfiUsdcDispatcherFlow } from "../support/marginfi-usdc-flow";

const runIntegration = process.env.RUN_MARGINFI_INTEGRATION === "1";
const suite = runIntegration ? describe : describe.skip;

suite("marginfi usdc adapter integration", () => {
  it("routes deposit/current_value/withdraw through dispatcher into MarginFi", async () => {
    await runMarginfiUsdcDispatcherFlow();
  });
});

if (!runIntegration) {
  // TODO_INTEGRATION: Set RUN_MARGINFI_INTEGRATION=1 only when the local
  // validator has the MarginFi program/accounts and a funded USDC token account
  // fixture loaded. This test intentionally does not fake protocol CPI.
}

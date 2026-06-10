import "dotenv/config";

/**
 * Registers a suite that needs a running local validator (anchor test, or a
 * manually started solana-test-validator with ANCHOR_PROVIDER_URL exported).
 *
 * Without ANCHOR_PROVIDER_URL the suite body is not executed at all —
 * AnchorProvider.env() at suite scope would otherwise throw at module load —
 * and a single visibly-skipped placeholder test is registered instead, so CI
 * environments without a validator stay green while reporting the skip.
 */
export function describeWithValidator(
  title: string,
  fn: (this: Mocha.Suite) => void,
): Mocha.Suite {
  if (process.env.ANCHOR_PROVIDER_URL) {
    return describe(title, fn);
  }
  return describe(title, function () {
    it.skip("requires a local validator (set ANCHOR_PROVIDER_URL)", () => {});
  });
}

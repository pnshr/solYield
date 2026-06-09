import "dotenv/config";
import { transferGovernance } from "../sdk/ts/src";
import {
  DEFAULT_PROGRAM_IDS,
  loadWorkspaceProgram,
  providerFromEnv,
  pubkeyFromEnv,
} from "./common";

async function main(): Promise<void> {
  const provider = providerFromEnv();
  const registryProgram = loadWorkspaceProgram(
    "registry",
    pubkeyFromEnv("REGISTRY_PROGRAM_ID", DEFAULT_PROGRAM_IDS.registry),
    provider,
  );
  const result = await transferGovernance({
    registryProgram,
    newGovernanceAuthority: pubkeyFromEnv("NEW_GOVERNANCE_AUTHORITY"),
  });

  console.log(
    JSON.stringify(
      {
        signature: result.signature,
        registryConfig: result.registryConfig.toBase58(),
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

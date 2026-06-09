import "dotenv/config";
import {
  deriveAdapterEntryPda,
  updateAdapterMetadata,
} from "../sdk/ts/src";
import {
  DEFAULT_PROGRAM_IDS,
  loadWorkspaceProgram,
  numberFromEnv,
  providerFromEnv,
  pubkeyFromEnv,
  stringFromEnv,
} from "./common";

async function main(): Promise<void> {
  const provider = providerFromEnv();
  const registryProgram = loadWorkspaceProgram(
    "registry",
    pubkeyFromEnv("REGISTRY_PROGRAM_ID", DEFAULT_PROGRAM_IDS.registry),
    provider,
  );
  const [adapterEntry] = deriveAdapterEntryPda(
    registryProgram.programId,
    pubkeyFromEnv("ADAPTER_PROGRAM_ID"),
    pubkeyFromEnv("SUPPORTED_MINT"),
    numberFromEnv("ADAPTER_VERSION"),
  );
  const result = await updateAdapterMetadata({
    registryProgram,
    adapterEntry,
    metadataUri: process.env.NEW_METADATA_URI ?? stringFromEnv("METADATA_URI"),
  });

  console.log(
    JSON.stringify(
      {
        signature: result.signature,
        registryConfig: result.registryConfig.toBase58(),
        adapterEntry: result.adapterEntry.toBase58(),
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

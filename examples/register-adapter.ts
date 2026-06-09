import "dotenv/config";
import {
  deriveAdapterEntryPda,
  proposeAdapter,
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
  const adapterProgramId = pubkeyFromEnv("ADAPTER_PROGRAM_ID");
  const supportedMint = pubkeyFromEnv("SUPPORTED_MINT");
  const adapterVersion = numberFromEnv("ADAPTER_VERSION");
  const [adapterEntry] = deriveAdapterEntryPda(
    registryProgram.programId,
    adapterProgramId,
    supportedMint,
    adapterVersion,
  );
  const result = await proposeAdapter({
    registryProgram,
    adapterProgramId,
    protocolName: stringFromEnv("PROTOCOL_NAME"),
    adapterVersion,
    supportedMint,
    metadataUri: stringFromEnv("METADATA_URI"),
  });

  console.log(
    JSON.stringify(
      {
        signature: result.signature,
        registryConfig: result.registryConfig.toBase58(),
        adapterEntry: adapterEntry.toBase58(),
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

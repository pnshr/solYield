import "dotenv/config";
import { dispatcherWithdraw } from "../sdk/ts/src";
import {
  DEFAULT_PROGRAM_IDS,
  loadWorkspaceProgram,
  providerFromEnv,
  pubkeyFromEnv,
  remainingAccountsFromEnv,
  stringFromEnv,
} from "./common";

async function main(): Promise<void> {
  const provider = providerFromEnv();
  const dispatcherProgram = loadWorkspaceProgram(
    "dispatcher",
    pubkeyFromEnv("DISPATCHER_PROGRAM_ID", DEFAULT_PROGRAM_IDS.dispatcher),
    provider,
  );
  const result = await dispatcherWithdraw({
    dispatcherProgram,
    amount: stringFromEnv("AMOUNT"),
    adapterEntry: pubkeyFromEnv("ADAPTER_ENTRY"),
    adapterProgram: pubkeyFromEnv("ADAPTER_PROGRAM_ID"),
    adapterConfig: pubkeyFromEnv("ADAPTER_CONFIG"),
    requestedMint: pubkeyFromEnv("SUPPORTED_MINT"),
    adapterPosition: pubkeyFromEnv("ADAPTER_POSITION"),
    remainingAccounts: remainingAccountsFromEnv(),
  });

  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

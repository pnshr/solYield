import * as anchor from "@coral-xyz/anchor";
import { readFileSync } from "fs";
import { join } from "path";
import { AccountMeta, PublicKey } from "@solana/web3.js";
import { AnchorProgram } from "../sdk/ts/src";

export const DEFAULT_PROGRAM_IDS = {
  dispatcher: "FEKsMuAAp5Z6oxzsRkQLvHbMpvxJzVcV5JmGFD9KSC2A",
  registry: "HiLF1P7LguVyBbzMSN3hK4ErGxfxaS6TMPbR6R73Dtdn",
};

export function providerFromEnv(): anchor.AnchorProvider {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  return provider;
}

export function loadWorkspaceProgram(
  idlName: string,
  programId: PublicKey,
  provider: anchor.AnchorProvider,
): AnchorProgram {
  const idlPath = join(process.cwd(), "target", "idl", `${idlName}.json`);
  const idl = JSON.parse(readFileSync(idlPath, "utf8")) as anchor.Idl;
  return new anchor.Program(
    { ...idl, address: programId.toBase58() },
    provider,
  ) as AnchorProgram;
}

export function pubkeyFromEnv(name: string, fallback?: string): PublicKey {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return new PublicKey(value);
}

export function numberFromEnv(name: string, fallback?: number): number {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Missing required environment variable ${name}.`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }
  return parsed;
}

export function stringFromEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

export function remainingAccountsFromEnv(): AccountMeta[] {
  const raw = process.env.REMAINING_ACCOUNTS_JSON;
  if (raw === undefined || raw.trim() === "") {
    return [];
  }

  const accounts = JSON.parse(raw) as Array<{
    pubkey: string;
    isWritable?: boolean;
    isSigner?: boolean;
  }>;

  return accounts.map((account) => ({
    pubkey: new PublicKey(account.pubkey),
    isWritable: account.isWritable ?? false,
    isSigner: account.isSigner ?? false,
  }));
}

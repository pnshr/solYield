import "dotenv/config";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { dirname, isAbsolute, join, resolve } from "path";
import { Connection, PublicKey } from "@solana/web3.js";
import { deriveRegistryConfigPda } from "../sdk/ts/src";

/**
 * Verifies a real on-chain devnet registry deployment against a committed
 * manifest, and (optionally) regenerates that manifest from on-chain state.
 *
 * This script performs ONLY read-only RPC calls plus a local file write when
 * `--write` is passed. It never sends a transaction, so it can be run by anyone
 * to independently confirm that the deployment described by
 * `deployments/devnet/registry.json` actually exists on devnet.
 */

const DEFAULT_MANIFEST_PATH = "deployments/devnet/registry.json";
const DEFAULT_DEVNET_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_REGISTRY_PROGRAM_ID =
  "HiLF1P7LguVyBbzMSN3hK4ErGxfxaS6TMPbR6R73Dtdn";

// BPFLoaderUpgradeable program id. Upgradeable programs are owned by this
// loader and their account data points at a separate ProgramData account.
const BPF_LOADER_UPGRADEABLE_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);

// RegistryConfig layout (Anchor): 8-byte discriminator, then:
//   governance_authority: Pubkey (32)  @ offset 8
//   adapter_count: u64 (8)             @ offset 40
//   bump: u8 (1)                       @ offset 48
const REGISTRY_CONFIG_MIN_LEN = 49;
const GOVERNANCE_AUTHORITY_OFFSET = 8;
const ADAPTER_COUNT_OFFSET = 40;
const BUMP_OFFSET = 48;

type DeploymentManifest = {
  cluster: string;
  rpcUrl: string;
  registryProgramId: string;
  registryConfig: string;
  governanceAuthority: string;
  adapterCount: number;
  programDataAddress: string | null;
  programDataSlot: number | null;
  lastVerifiedSlot: number | null;
  initSignature: string | null;
  deployedAt: string | null;
  verifiedAt: string;
  notes?: string;
};

type CliOptions = {
  manifestPath: string;
  rpcUrl: string | undefined;
  registryProgramId: PublicKey | undefined;
  write: boolean;
  initSignature: string | undefined;
  deployedAt: string | undefined;
};

type OnChainRegistryState = {
  registryProgramId: PublicKey;
  programExecutable: boolean;
  programOwner: PublicKey;
  programDataAddress: PublicKey | null;
  programDataSlot: number | null;
  registryConfig: PublicKey;
  registryConfigExists: boolean;
  registryConfigOwner: PublicKey | null;
  governanceAuthority: PublicKey | null;
  adapterCount: number | null;
  slot: number;
};

async function main(): Promise<void> {
  const options = readOptions();

  const manifest = existsSync(options.manifestPath)
    ? (JSON.parse(
        readFileSync(options.manifestPath, "utf8"),
      ) as DeploymentManifest)
    : undefined;

  const rpcUrl =
    options.rpcUrl ??
    manifest?.rpcUrl ??
    process.env.DEVNET_RPC_URL ??
    DEFAULT_DEVNET_RPC_URL;
  const registryProgramId =
    options.registryProgramId ??
    (manifest !== undefined
      ? new PublicKey(manifest.registryProgramId)
      : new PublicKey(
          process.env.REGISTRY_PROGRAM_ID ?? DEFAULT_REGISTRY_PROGRAM_ID,
        ));

  const connection = new Connection(rpcUrl, "confirmed");
  const onChain = await readOnChainState(connection, registryProgramId);

  const checks = buildChecks(onChain, manifest);
  const ok = checks.every((check) => check.ok);

  const report = {
    cluster: "devnet",
    rpcUrl,
    manifestPath: options.manifestPath,
    manifestPresent: manifest !== undefined,
    registryProgramId: registryProgramId.toBase58(),
    onChain: {
      programExecutable: onChain.programExecutable,
      programOwner: onChain.programOwner.toBase58(),
      programDataAddress: onChain.programDataAddress?.toBase58() ?? null,
      registryConfig: onChain.registryConfig.toBase58(),
      registryConfigExists: onChain.registryConfigExists,
      registryConfigOwner: onChain.registryConfigOwner?.toBase58() ?? null,
      governanceAuthority: onChain.governanceAuthority?.toBase58() ?? null,
      adapterCount: onChain.adapterCount,
      slot: onChain.slot,
    },
    checks,
    ok,
  };

  console.log(JSON.stringify(report, null, 2));

  if (options.write) {
    if (!onChain.registryConfigExists) {
      throw new Error(
        "Refusing to write manifest: registry_config does not exist on-chain. " +
          "Deploy and initialize the registry first.",
      );
    }
    writeManifest(options, onChain, rpcUrl, manifest);
  }

  if (!ok) {
    throw new Error(
      "Devnet registry verification failed. See checks above for details.",
    );
  }
}

function readOptions(): CliOptions {
  return {
    manifestPath: expandPath(flagValue("--manifest") ?? DEFAULT_MANIFEST_PATH),
    rpcUrl: flagValue("--rpc-url"),
    registryProgramId: flagValue("--registry-program-id")
      ? new PublicKey(flagValue("--registry-program-id") as string)
      : undefined,
    write: hasFlag("--write"),
    initSignature: flagValue("--init-signature"),
    deployedAt: flagValue("--deployed-at"),
  };
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function flagValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function readOnChainState(
  connection: Connection,
  registryProgramId: PublicKey,
): Promise<OnChainRegistryState> {
  const slot = await connection.getSlot("confirmed");
  const programAccount = await connection.getAccountInfo(registryProgramId);
  const [registryConfig] = deriveRegistryConfigPda(registryProgramId);
  const configAccount = await connection.getAccountInfo(registryConfig);

  let programDataAddress: PublicKey | null = null;
  let programDataSlot: number | null = null;
  if (
    programAccount !== null &&
    programAccount.owner.equals(BPF_LOADER_UPGRADEABLE_ID) &&
    programAccount.data.length >= 36
  ) {
    // Upgradeable program account data: 4-byte enum (=2) + 32-byte ProgramData
    // address.
    programDataAddress = new PublicKey(programAccount.data.subarray(4, 36));
    const programData = await connection.getAccountInfo(programDataAddress);
    if (programData !== null && programData.data.length >= 12) {
      // ProgramData layout: 4-byte enum (=3) + 8-byte slot (LE) + ...
      programDataSlot = Number(programData.data.readBigUInt64LE(4));
    }
  }

  let governanceAuthority: PublicKey | null = null;
  let adapterCount: number | null = null;
  if (configAccount !== null && configAccount.data.length >= REGISTRY_CONFIG_MIN_LEN) {
    governanceAuthority = new PublicKey(
      configAccount.data.subarray(
        GOVERNANCE_AUTHORITY_OFFSET,
        GOVERNANCE_AUTHORITY_OFFSET + 32,
      ),
    );
    adapterCount = Number(
      configAccount.data.readBigUInt64LE(ADAPTER_COUNT_OFFSET),
    );
    void BUMP_OFFSET;
  }

  return {
    registryProgramId,
    programExecutable: programAccount?.executable ?? false,
    programOwner: programAccount?.owner ?? PublicKey.default,
    programDataAddress,
    programDataSlot,
    registryConfig,
    registryConfigExists: configAccount !== null,
    registryConfigOwner: configAccount?.owner ?? null,
    governanceAuthority,
    adapterCount,
    slot,
  };
}

type Check = { name: string; ok: boolean; detail: string };

function buildChecks(
  onChain: OnChainRegistryState,
  manifest: DeploymentManifest | undefined,
): Check[] {
  const checks: Check[] = [];

  checks.push({
    name: "program_account_exists",
    ok: !onChain.programOwner.equals(PublicKey.default),
    detail: `owner=${onChain.programOwner.toBase58()}`,
  });
  checks.push({
    name: "program_executable",
    ok: onChain.programExecutable,
    detail: `executable=${onChain.programExecutable}`,
  });
  checks.push({
    name: "program_owned_by_upgradeable_loader",
    ok: onChain.programOwner.equals(BPF_LOADER_UPGRADEABLE_ID),
    detail: `owner=${onChain.programOwner.toBase58()}`,
  });
  checks.push({
    name: "registry_config_exists",
    ok: onChain.registryConfigExists,
    detail: `pda=${onChain.registryConfig.toBase58()}`,
  });
  checks.push({
    name: "registry_config_owned_by_program",
    ok: onChain.registryConfigOwner?.equals(onChain.registryProgramId) ?? false,
    detail: `owner=${onChain.registryConfigOwner?.toBase58() ?? "none"}`,
  });

  if (manifest !== undefined) {
    checks.push({
      name: "manifest_program_id_matches",
      ok: manifest.registryProgramId === onChain.registryProgramId.toBase58(),
      detail: `manifest=${manifest.registryProgramId}`,
    });
    checks.push({
      name: "manifest_registry_config_matches",
      ok: manifest.registryConfig === onChain.registryConfig.toBase58(),
      detail: `manifest=${manifest.registryConfig}`,
    });
    checks.push({
      name: "manifest_governance_authority_matches",
      ok:
        onChain.governanceAuthority !== null &&
        manifest.governanceAuthority ===
          onChain.governanceAuthority.toBase58(),
      detail: `manifest=${manifest.governanceAuthority} onchain=${
        onChain.governanceAuthority?.toBase58() ?? "none"
      }`,
    });
  }

  return checks;
}

function writeManifest(
  options: CliOptions,
  onChain: OnChainRegistryState,
  rpcUrl: string,
  previous: DeploymentManifest | undefined,
): void {
  const manifest: DeploymentManifest = {
    cluster: "devnet",
    rpcUrl,
    registryProgramId: onChain.registryProgramId.toBase58(),
    registryConfig: onChain.registryConfig.toBase58(),
    governanceAuthority: onChain.governanceAuthority!.toBase58(),
    adapterCount: onChain.adapterCount ?? 0,
    programDataAddress: onChain.programDataAddress?.toBase58() ?? null,
    programDataSlot: onChain.programDataSlot,
    lastVerifiedSlot: onChain.slot,
    initSignature:
      options.initSignature ?? previous?.initSignature ?? null,
    deployedAt: options.deployedAt ?? previous?.deployedAt ?? null,
    verifiedAt: new Date().toISOString(),
    notes:
      previous?.notes ??
      "Generated from live devnet state by scripts/verify-devnet-registry.ts --write.",
  };

  mkdirSync(dirname(options.manifestPath), { recursive: true });
  writeFileSync(
    options.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  console.log(`\nWrote manifest to ${options.manifestPath}`);
}

function expandPath(path: string): string {
  return isAbsolute(path) ? path : resolve(join(process.cwd(), path));
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

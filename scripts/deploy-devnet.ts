import "dotenv/config";
import * as anchor from "@coral-xyz/anchor";
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, isAbsolute, join, resolve } from "path";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  AnchorProgram,
  deriveRegistryConfigPda,
} from "../sdk/ts/src";

const DEFAULT_DEVNET_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_REGISTRY_PROGRAM_ID =
  "HiLF1P7LguVyBbzMSN3hK4ErGxfxaS6TMPbR6R73Dtdn";
const DEFAULT_MANIFEST_PATH = "deployments/devnet/registry.json";

type DeployOptions = {
  rpcUrl: string;
  walletPath: string;
  registryProgramId: PublicKey;
  skipBuild: boolean;
  skipDeploy: boolean;
  skipInit: boolean;
  printOnly: boolean;
};

type CommandResult = {
  command: string;
  skipped: boolean;
};

async function main(): Promise<void> {
  const options = readOptions();
  const summary: Record<string, unknown> = {
    phase: "phase-9-devnet-deployment",
    rpcUrl: options.rpcUrl,
    walletPath: options.walletPath,
    registryProgramId: options.registryProgramId.toBase58(),
  };

  if (options.printOnly) {
    summary.commands = plannedCommands(options);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  summary.build = runAnchorCommand(
    ["build"],
    options,
    options.skipBuild,
  );
  summary.deploy = runAnchorCommand(
    [
      "deploy",
      "--program-name",
      "registry",
      "--provider.cluster",
      options.rpcUrl,
      "--provider.wallet",
      options.walletPath,
    ],
    options,
    options.skipDeploy,
  );

  if (!options.skipInit) {
    const registry = await initializeRegistryIfNeeded(options);
    summary.registry = registry;
    summary.manifest = writeDeploymentManifest(options, registry);
  } else {
    summary.registry = { skipped: true };
  }

  console.log(JSON.stringify(summary, null, 2));
}

function writeDeploymentManifest(
  options: DeployOptions,
  registry: Record<string, unknown>,
): Record<string, unknown> {
  const manifestPath = expandPath(
    process.env.DEVNET_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH,
  );
  const registryConfig = registry.registryConfig as string | undefined;
  const governanceAuthority = registry.governanceAuthority as string | undefined;
  if (registryConfig === undefined || governanceAuthority === undefined) {
    return { written: false, reason: "Missing on-chain registry state." };
  }

  const previous = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>)
    : undefined;

  const manifest = {
    cluster: "devnet",
    rpcUrl: options.rpcUrl,
    registryProgramId: options.registryProgramId.toBase58(),
    registryConfig,
    governanceAuthority,
    adapterCount: 0,
    programDataAddress: (previous?.programDataAddress as string | null) ?? null,
    programDataSlot: (previous?.programDataSlot as number | null) ?? null,
    lastVerifiedSlot: (previous?.lastVerifiedSlot as number | null) ?? null,
    initSignature:
      (registry.signature as string | undefined) ??
      (previous?.initSignature as string | null) ??
      null,
    deployedAt:
      (previous?.deployedAt as string | null) ?? new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
    notes:
      "Written by scripts/deploy-devnet.ts after a real devnet deploy+init. " +
      "Run `npm run verify:devnet:registry -- --write` to enrich and confirm " +
      "this manifest against live on-chain state.",
  };

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { written: true, manifestPath, manifest };
}

function readOptions(): DeployOptions {
  return {
    rpcUrl: process.env.DEVNET_RPC_URL ?? DEFAULT_DEVNET_RPC_URL,
    walletPath: expandPath(
      process.env.REGISTRY_AUTHORITY_KEYPAIR ??
        process.env.ANCHOR_WALLET ??
        "~/.config/solana/id.json",
    ),
    registryProgramId: new PublicKey(
      process.env.REGISTRY_PROGRAM_ID ?? DEFAULT_REGISTRY_PROGRAM_ID,
    ),
    skipBuild: hasFlag("--skip-build"),
    skipDeploy: hasFlag("--skip-deploy"),
    skipInit: hasFlag("--skip-init"),
    printOnly: hasFlag("--print-only"),
  };
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function plannedCommands(options: DeployOptions): string[] {
  return [
    "anchor build",
    [
      "anchor",
      "deploy",
      "--program-name",
      "registry",
      "--provider.cluster",
      options.rpcUrl,
      "--provider.wallet",
      options.walletPath,
    ].join(" "),
    "initialize registry PDA through the Anchor TypeScript client",
  ];
}

function runAnchorCommand(
  args: string[],
  options: DeployOptions,
  skipped: boolean,
): CommandResult {
  const command = ["anchor", ...args].join(" ");
  if (skipped) {
    return { command, skipped: true };
  }

  const result = spawnSync("anchor", args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ANCHOR_PROVIDER_URL: options.rpcUrl,
      ANCHOR_WALLET: options.walletPath,
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}.`);
  }

  return { command, skipped: false };
}

async function initializeRegistryIfNeeded(
  options: DeployOptions,
): Promise<Record<string, unknown>> {
  const idlPath = join(process.cwd(), "target", "idl", "registry.json");
  if (!existsSync(idlPath)) {
    throw new Error(
      "Missing target/idl/registry.json. Run anchor build before initialization.",
    );
  }
  const keypair = readKeypair(options.walletPath);
  const wallet = new anchor.Wallet(keypair);
  const connection = new anchor.web3.Connection(options.rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idl = JSON.parse(readFileSync(idlPath, "utf8")) as anchor.Idl;
  const registryProgram = new anchor.Program(
    { ...idl, address: options.registryProgramId.toBase58() },
    provider,
  ) as AnchorProgram;
  const [registryConfig] = deriveRegistryConfigPda(options.registryProgramId);
  const existing = await connection.getAccountInfo(registryConfig);

  if (existing !== null) {
    return {
      initialized: false,
      reason: "RegistryConfig already exists.",
      registryConfig: registryConfig.toBase58(),
      governanceAuthority: wallet.publicKey.toBase58(),
    };
  }

  const signature = await registryProgram.methods
    .initializeRegistry()
    .accounts({
      registryConfig,
      governanceAuthority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return {
    initialized: true,
    signature,
    registryConfig: registryConfig.toBase58(),
    governanceAuthority: wallet.publicKey.toBase58(),
  };
}

function readKeypair(path: string): Keypair {
  const secret = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function expandPath(path: string): string {
  if (path === "~") {
    return homedir();
  }
  if (path.startsWith("~/") || path.startsWith("~\\")) {
    return resolve(join(homedir(), path.slice(2)));
  }
  return isAbsolute(path) ? path : resolve(path);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

type AdapterId = "kamino" | "marginfi" | "jupiter" | "maple" | "drift";

type LocalProgram = { label: string; programId: string; soPath: string };
type ClonedAccount = {
  label: string;
  address: string;
  kind: "account" | "upgradeable-program";
  fixturePath: string | null;
};
type FundedFixture = { label: string; address: string; fixturePath: string };

type AdapterManifestConfig = {
  displayName: string;
  manifestFile: string;
  localPrograms: LocalProgram[];
  clonedAccounts: ClonedAccount[];
  fundedFixtures: FundedFixture[];
  // Durable honesty caveats for this adapter. Used as the manifest `notes`
  // when the caller (e.g. the fork harness) does not supply explicit notes,
  // so auto-emitted manifests keep the structural caveats instead of "".
  defaultNotes?: string;
};

export type EmitForkManifestOptions = {
  exitCode: number;
  warpSlot?: string;
  baseSlot?: number;
  durationMs?: number | null;
  rpcUrl?: string;
  notes?: string;
};

const FIX = ".mainnet-fork-fixtures";
const ACCT = `${FIX}/mainnet-accounts`;

const dispatcher: LocalProgram = {
  label: "dispatcher",
  programId: "FEKsMuAAp5Z6oxzsRkQLvHbMpvxJzVcV5JmGFD9KSC2A",
  soPath: "target/deploy/dispatcher.so",
};
const registry: LocalProgram = {
  label: "registry",
  programId: "HiLF1P7LguVyBbzMSN3hK4ErGxfxaS6TMPbR6R73Dtdn",
  soPath: "target/deploy/registry.so",
};
const usdcMintFixture: ClonedAccount = {
  label: "USDC mint",
  address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  kind: "account",
  fixturePath: `${ACCT}/usdc-mint-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.json`,
};
const fundedSol: FundedFixture = {
  label: "funded user SOL account",
  address: "9B4MhXCsqr2SyQNRw4KoakcwriqN637GhpjxCnaafSmd",
  fixturePath: `${FIX}/funded-user-sol-account.json`,
};
const fundedUsdc: FundedFixture = {
  label: "funded USDC token account",
  address: "5JHYHnWR2Ngt43krW6zynw9RCcmYGCwcFzinpZnt1ijN",
  fixturePath: `${FIX}/funded-usdc-token-account.json`,
};

const configs: Record<AdapterId, AdapterManifestConfig> = {
  marginfi: {
    displayName: "MarginFi USDC",
    manifestFile: "marginfi-usdc.json",
    defaultNotes:
      "Fresh validator (--reset, fresh /tmp ledger) required per run due to non-idempotent test setup. WSL Ubuntu-24.04 validator reached from the node client over forwarded localhost. Clone fetch used NODE_TLS_REJECT_UNAUTHORIZED=0 to traverse a corporate TLS-intercepting proxy; only public on-chain account data was fetched.",
    localPrograms: [
      dispatcher,
      registry,
      {
        label: "marginfi-usdc adapter",
        programId: "ZZcKiv9h3ACNoXubmys1zWY9yFTjif6x6tb3Us4voyr",
        soPath: "target/deploy/marginfi_usdc.so",
      },
    ],
    clonedAccounts: [
      {
        label: "MarginFi v2 program",
        address: "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA",
        kind: "upgradeable-program",
        fixturePath: null,
      },
      {
        label: "MarginFi production group",
        address: "4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8",
        kind: "account",
        fixturePath: `${ACCT}/marginfi-production-group-4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8.json`,
      },
      {
        label: "MarginFi USDC bank",
        address: "2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB",
        kind: "account",
        fixturePath: `${ACCT}/marginfi-usdc-bank-2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB.json`,
      },
      {
        label: "MarginFi USDC liquidity vault",
        address: "7jaiZR5Sk8hdYN9MxTpczTcwbWpb5WEoxSANuUwveuat",
        kind: "account",
        fixturePath: `${ACCT}/marginfi-usdc-liquidity-vault-7jaiZR5Sk8hdYN9MxTpczTcwbWpb5WEoxSANuUwveuat.json`,
      },
      {
        label: "MarginFi USDC oracle",
        address: "Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX",
        kind: "account",
        fixturePath: `${ACCT}/marginfi-usdc-oracle-Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX.json`,
      },
      usdcMintFixture,
    ],
    fundedFixtures: [fundedSol, fundedUsdc],
  },
  kamino: {
    displayName: "Kamino USDC",
    manifestFile: "kamino-usdc.json",
    defaultNotes:
      "Fresh validator (--reset, fresh /tmp ledger) required per run due to non-idempotent test setup. Direct reserve mint/redeem path; current_value does not refresh reserve/oracle and queued withdrawals are not covered. WSL Ubuntu-24.04 validator reached from the node client over forwarded localhost. Clone fetch used NODE_TLS_REJECT_UNAUTHORIZED=0 to traverse a corporate TLS-intercepting proxy; only public on-chain account data was fetched.",
    localPrograms: [
      dispatcher,
      registry,
      {
        label: "kamino-usdc adapter",
        programId: "G4g2RMwZs2dH2sVe3ChQ4VpM2DNZu8EESdRyHTc3P9T4",
        soPath: "target/deploy/kamino_usdc.so",
      },
    ],
    clonedAccounts: [
      {
        label: "Kamino Lend program",
        address: "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
        kind: "upgradeable-program",
        fixturePath: null,
      },
      {
        label: "Kamino main lending market",
        address: "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
        kind: "account",
        fixturePath: `${ACCT}/kamino-main-lending-market-7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF.json`,
      },
      {
        label: "Kamino main-market USDC reserve",
        address: "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
        kind: "account",
        fixturePath: `${ACCT}/kamino-main-market-usdc-reserve-D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59.json`,
      },
      {
        label: "Kamino USDC reserve liquidity supply",
        address: "Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6",
        kind: "account",
        fixturePath: `${ACCT}/kamino-usdc-reserve-liquidity-supply-Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6.json`,
      },
      {
        label: "Kamino USDC reserve collateral mint",
        address: "B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D",
        kind: "account",
        fixturePath: `${ACCT}/kamino-usdc-reserve-collateral-mint-B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D.json`,
      },
      usdcMintFixture,
    ],
    fundedFixtures: [fundedSol, fundedUsdc],
  },
  jupiter: {
    displayName: "Jupiter LP",
    manifestFile: "jupiter-lp.json",
    localPrograms: [
      dispatcher,
      registry,
      {
        label: "jupiter-lp adapter",
        programId: "daJFQSrSNB3zApEGUjZuWEXnVhM2vmjpDptc1cG9s6D",
        soPath: "target/deploy/jupiter_lp.so",
      },
    ],
    clonedAccounts: [],
    fundedFixtures: [fundedSol, fundedUsdc],
  },
  maple: {
    displayName: "Maple syrupUSDC",
    manifestFile: "maple-syrup.json",
    localPrograms: [
      dispatcher,
      registry,
      {
        label: "maple-syrup adapter",
        programId: "CnAVx7eyK1MZdkQVAWZMVE9B9aXFcxKmv8bS8dEpgvsC",
        soPath: "target/deploy/maple_syrup.so",
      },
    ],
    clonedAccounts: [],
    fundedFixtures: [fundedSol],
  },
  drift: {
    displayName: "Drift Insurance Fund",
    manifestFile: "drift-insurance-fund.json",
    defaultNotes:
      "HISTORICAL-BINARY FORK: the Drift program loaded into the fork is the official open-source protocol-v2 v2.161.0 binary built from source (scripts/build-drift-v2161.sh), NOT the currently deployed mainnet binary. Reason: the mainnet deployment at slot 410633860 removed every user-facing instruction (deposit/withdraw/initialize_user/all insurance-fund staking return InstructionFallbackNotFound when simulated against live mainnet; only admin instructions dispatch), and the admin drained the USDC insurance-fund vault at slot 410454545. Insurance-fund staking therefore no longer exists on mainnet and cannot pass against the deployed binary for any implementation. All cloned ACCOUNT state (Drift state, USDC spot market, vaults, oracle) is real current mainnet state. Fresh validator per run; WSL validator + node client over forwarded localhost.",
    localPrograms: [
      dispatcher,
      registry,
      {
        label: "drift-insurance-fund adapter",
        programId: "mWDRjDXGpQupue6j74cdWJD7BJ1XygdaxU7vc52BLve",
        soPath: "target/deploy/drift_insurance_fund.so",
      },
      {
        label:
          "drift program (official protocol-v2 v2.161.0 built from source; scripts/build-drift-v2161.sh)",
        programId: "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
        soPath: `${FIX}/drift-v2.161.0.so`,
      },
    ],
    clonedAccounts: [
      {
        label: "Drift state",
        address: "5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN",
        kind: "account",
        fixturePath: `${ACCT}/drift-state-5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN.json`,
      },
      {
        label: "Drift USDC spot market",
        address: "6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3",
        kind: "account",
        fixturePath: `${ACCT}/drift-usdc-spot-market-6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3.json`,
      },
      {
        label: "Drift USDC spot market vault",
        address: "GXWqPpjQpdz7KZw9p7f5PX2eGxHAhvpNXiviFkAB8zXg",
        kind: "account",
        fixturePath: `${ACCT}/drift-usdc-spot-market-vault-GXWqPpjQpdz7KZw9p7f5PX2eGxHAhvpNXiviFkAB8zXg.json`,
      },
      {
        label: "Drift USDC insurance fund vault",
        address: "2CqkQvYxp9Mq4PqLvAQ1eryYxebUh4Liyn5YMDtXsYci",
        kind: "account",
        fixturePath: `${ACCT}/drift-usdc-insurance-fund-vault-2CqkQvYxp9Mq4PqLvAQ1eryYxebUh4Liyn5YMDtXsYci.json`,
      },
      {
        label: "Drift USDC oracle",
        address: "9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV",
        kind: "account",
        fixturePath: `${ACCT}/drift-usdc-oracle-9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV.json`,
      },
      usdcMintFixture,
    ],
    fundedFixtures: [fundedSol, fundedUsdc],
  },
};

function sha256OfFile(path: string): string {
  const abs = join(process.cwd(), path);
  if (!existsSync(abs)) {
    throw new Error(`Cannot hash missing file: ${path}`);
  }
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function gitHead(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

export function emitForkManifest(
  adapter: AdapterId,
  options: EmitForkManifestOptions,
): { manifestFile: string; status: string; outPath: string } {
  const cfg = configs[adapter];
  if (!cfg) {
    throw new Error(
      `Unknown adapter "${adapter}". Use one of: ${Object.keys(configs).join(", ")}.`,
    );
  }

  const mochaExitCode = options.exitCode;
  const warpSlot = options.warpSlot ?? "0";
  const baseSlot = options.baseSlot ?? Number.parseInt(warpSlot, 10);
  const durationMs = options.durationMs ?? null;
  const rpcUrl = options.rpcUrl ?? "https://solana-rpc.publicnode.com";
  const notes = options.notes ?? cfg.defaultNotes ?? "";

  // Honesty rule: status is "passed" ONLY when mocha actually exited 0.
  const status =
    mochaExitCode === 0 ? "passed" : Number.isNaN(mochaExitCode) ? "not-run" : "failed";

  const manifest = {
    adapter,
    displayName: cfg.displayName,
    repoCommit: gitHead(),
    generatedAt: new Date().toISOString(),
    cluster: "mainnet-fork",
    rpcUrl,
    baseSlot,
    warpSlot,
    localPrograms: cfg.localPrograms.map((p) => ({
      label: p.label,
      programId: p.programId,
      soPath: p.soPath,
      soSha256: sha256OfFile(p.soPath),
    })),
    clonedAccounts: cfg.clonedAccounts.map((a) => ({
      label: a.label,
      address: a.address,
      kind: a.kind,
      dataSha256: a.fixturePath ? sha256OfFile(a.fixturePath) : null,
    })),
    fundedFixtures: cfg.fundedFixtures.map((f) => ({
      label: f.label,
      address: f.address,
      fixtureSha256: sha256OfFile(f.fixturePath),
    })),
    commands: {
      clone: `npm run clone:mainnet -- ${adapter}`,
      validator: `bash .mainnet-fork-fixtures/start-${adapter}-validator.sh`,
      test: `npm run test:fork:${adapter}`,
    },
    testOutcome: {
      status,
      mochaExitCode: Number.isNaN(mochaExitCode) ? null : mochaExitCode,
      durationMs,
      runAt: new Date().toISOString(),
    },
    notes,
  };

  const outPath = join(
    process.cwd(),
    "tests/mainnet-fork/manifests",
    cfg.manifestFile,
  );
  writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${cfg.manifestFile} (testOutcome.status=${status}).`);
  return { manifestFile: cfg.manifestFile, status, outPath };
}

function main(): void {
  const adapter = process.argv[2] as AdapterId | undefined;
  if (!adapter || !(adapter in configs)) {
    throw new Error(
      `Usage: emit-fork-manifest.ts <${Object.keys(configs).join("|")}> --exit-code=N --warp-slot=S [--base-slot=S] [--duration-ms=N] [--rpc-url=URL] [--notes="..."]`,
    );
  }

  const exitCodeRaw = flag("exit-code");
  if (exitCodeRaw === undefined) {
    throw new Error("--exit-code is required (the real mocha process exit code).");
  }
  const baseSlotRaw = flag("base-slot");
  const durationRaw = flag("duration-ms");

  emitForkManifest(adapter, {
    exitCode: Number.parseInt(exitCodeRaw, 10),
    warpSlot: flag("warp-slot"),
    baseSlot: baseSlotRaw ? Number.parseInt(baseSlotRaw, 10) : undefined,
    durationMs: durationRaw ? Number.parseInt(durationRaw, 10) : null,
    rpcUrl: flag("rpc-url"),
    notes: flag("notes"),
  });
}

if (require.main === module) {
  main();
}

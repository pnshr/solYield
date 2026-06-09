import "dotenv/config";
import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { emitForkManifest } from "./emit-fork-manifest";

type AdapterId = "kamino" | "marginfi" | "jupiter" | "maple" | "drift";
type AdapterTarget = AdapterId | "all";

type AdapterTestPlan = {
  file: string;
  envFlag: string;
};

const adapterIds: AdapterId[] = [
  "kamino",
  "marginfi",
  "jupiter",
  "maple",
  "drift",
];

const adapterTests: Record<AdapterId, AdapterTestPlan> = {
  kamino: {
    file: "tests/mainnet-fork/kamino-usdc-mainnet-fork.test.ts",
    envFlag: "RUN_KAMINO_MAINNET_FORK",
  },
  marginfi: {
    file: "tests/mainnet-fork/marginfi-usdc-mainnet-fork.test.ts",
    envFlag: "RUN_MARGINFI_MAINNET_FORK",
  },
  jupiter: {
    file: "tests/mainnet-fork/jupiter-lp-mainnet-fork.test.ts",
    envFlag: "RUN_JUPITER_MAINNET_FORK",
  },
  maple: {
    file: "tests/mainnet-fork/maple-syrup-mainnet-fork.test.ts",
    envFlag: "RUN_MAPLE_MAINNET_FORK",
  },
  drift: {
    file: "tests/mainnet-fork/drift-insurance-fund-mainnet-fork.test.ts",
    envFlag: "RUN_DRIFT_MAINNET_FORK",
  },
};

const adapterAliases: Record<string, AdapterTarget> = {
  all: "all",
  kamino: "kamino",
  "kamino-usdc": "kamino",
  marginfi: "marginfi",
  "marginfi-usdc": "marginfi",
  jupiter: "jupiter",
  "jupiter-lp": "jupiter",
  maple: "maple",
  "maple-syrup": "maple",
  "maple-syrup-usdc": "maple",
  drift: "drift",
  "drift-insurance-fund": "drift",
};

function normalizeAdapterTarget(value: string | undefined): AdapterTarget {
  const raw = (value ?? process.env.FORK_ADAPTER ?? "all")
    .trim()
    .toLowerCase();
  const target = adapterAliases[raw];
  if (target === undefined) {
    throw new Error(
      `Unknown fork adapter "${raw}". Use one of: ${Object.keys(adapterAliases).join(", ")}.`,
    );
  }
  return target;
}

function selectedAdapterIds(target: AdapterTarget): AdapterId[] {
  return target === "all" ? adapterIds : [target];
}

// Parse the cloned-state warp slot from the generated validator start script so
// the auto-emitted manifest records the same `--warp-slot` the validator used.
function readWarpSlot(adapter: AdapterId): string | undefined {
  const scriptPath = join(
    process.cwd(),
    ".mainnet-fork-fixtures",
    `start-${adapter}-validator.sh`,
  );
  if (!existsSync(scriptPath)) {
    return undefined;
  }
  const match = readFileSync(scriptPath, "utf8").match(/--warp-slot\s+(\d+)/);
  return match ? match[1] : undefined;
}

function runAdapterTest(
  id: AdapterId,
  target: AdapterTarget,
  extraMochaArgs: string[],
): Promise<{ exitCode: number; durationMs: number }> {
  const mochaBin = process.execPath;
  const mochaCli = join(process.cwd(), "node_modules", "mocha", "bin", "mocha.js");
  const args = [
    mochaCli,
    "-r",
    "ts-node/register",
    adapterTests[id].file,
    "--timeout",
    process.env.MAINNET_FORK_TEST_TIMEOUT_MS ?? "120000",
    ...extraMochaArgs,
  ];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MAINNET_FORK_ADAPTER: target,
    [adapterTests[id].envFlag]: "1",
  };

  const startedAt = Date.now();
  const child = spawn(mochaBin, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  return new Promise((resolve) => {
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, durationMs: Date.now() - startedAt });
    });
  });
}

async function main(): Promise<void> {
  const target = normalizeAdapterTarget(process.argv[2]);
  const extraMochaArgs = process.argv.slice(3);
  const selectedIds = selectedAdapterIds(target);
  // Auto-emit run manifests by default; opt out with FORK_EMIT_MANIFEST=0.
  const emitManifests = process.env.FORK_EMIT_MANIFEST !== "0";

  console.log(
    JSON.stringify(
      {
        phase: "phase-8-mainnet-fork",
        adapter: target,
        adapters: selectedIds,
        emitManifests,
        timeoutMs: process.env.MAINNET_FORK_TEST_TIMEOUT_MS ?? "120000",
      },
      null,
      2,
    ),
  );

  // Run each adapter in its OWN mocha process so we get a per-adapter exit code
  // and duration, then emit that adapter's manifest from the REAL outcome.
  let firstFailure = 0;
  for (const id of selectedIds) {
    const { exitCode, durationMs } = await runAdapterTest(id, target, extraMochaArgs);
    if (exitCode !== 0 && firstFailure === 0) {
      firstFailure = exitCode;
    }

    if (emitManifests) {
      try {
        const { manifestFile, status } = emitForkManifest(id, {
          exitCode,
          warpSlot: readWarpSlot(id) ?? process.env.FORK_WARP_SLOT,
          durationMs,
          rpcUrl: process.env.MAINNET_RPC_URL,
        });
        console.log(`[manifest] ${id} -> ${manifestFile} (status=${status}).`);
      } catch (error) {
        // Manifest emission is best-effort; never let it mask the test result.
        console.warn(`[manifest] failed to emit for ${id}:`, error);
      }
    }
  }

  if (firstFailure !== 0) {
    throw new Error(`Mainnet-fork tests failed with exit code ${firstFailure}.`);
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

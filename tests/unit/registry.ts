import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

const REGISTRY_CONFIG_SEED = Buffer.from("registry_config");
const ADAPTER_ENTRY_SEED = Buffer.from("adapter_entry");

type WorkspaceProgram = Program & {
  account: Record<string, { fetch: (address: PublicKey) => Promise<any> }>;
};

function adapterVersionSeed(adapterVersion: number): Buffer {
  const seed = Buffer.alloc(2);
  seed.writeUInt16LE(adapterVersion);
  return seed;
}

function findRegistryConfigPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([REGISTRY_CONFIG_SEED], programId)[0];
}

function findAdapterEntryPda(
  programId: PublicKey,
  adapterProgramId: PublicKey,
  supportedMint: PublicKey,
  adapterVersion: number,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      ADAPTER_ENTRY_SEED,
      adapterProgramId.toBuffer(),
      supportedMint.toBuffer(),
      adapterVersionSeed(adapterVersion),
    ],
    programId,
  )[0];
}

function hasStatus(status: unknown, expected: string): boolean {
  return (
    typeof status === "object" &&
    status !== null &&
    Object.prototype.hasOwnProperty.call(status, expected)
  );
}

async function expectAnchorError(
  action: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await action;
    assert.fail(`Expected Anchor error ${expectedCode}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.include(message, expectedCode);
  }
}

describe("registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const registry = anchor.workspace.Registry as WorkspaceProgram;
  const registryConfig = findRegistryConfigPda(registry.programId);

  const nonGovernance = Keypair.generate();
  const newGovernance = Keypair.generate();

  const primaryAdapterProgramId = Keypair.generate().publicKey;
  const primarySupportedMint = Keypair.generate().publicKey;
  const primaryAdapterVersion = 1;
  const primaryAdapterEntry = findAdapterEntryPda(
    registry.programId,
    primaryAdapterProgramId,
    primarySupportedMint,
    primaryAdapterVersion,
  );

  const pendingAdapterProgramId = Keypair.generate().publicKey;
  const pendingSupportedMint = Keypair.generate().publicKey;
  const pendingAdapterVersion = 2;
  const pendingAdapterEntry = findAdapterEntryPda(
    registry.programId,
    pendingAdapterProgramId,
    pendingSupportedMint,
    pendingAdapterVersion,
  );

  before(async () => {
    for (const keypair of [nonGovernance, newGovernance]) {
      const signature = await provider.connection.requestAirdrop(
        keypair.publicKey,
        2 * LAMPORTS_PER_SOL,
      );
      await provider.connection.confirmTransaction(signature, "confirmed");
    }
  });

  it("initializes registry", async () => {
    await registry.methods
      .initializeRegistry()
      .accounts({
        registryConfig,
        governanceAuthority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await registry.account.registryConfig.fetch(registryConfig);
    assert.strictEqual(
      config.governanceAuthority.toBase58(),
      provider.wallet.publicKey.toBase58(),
    );
    assert.strictEqual(config.adapterCount.toNumber(), 0);
  });

  it("proposes adapter", async () => {
    await registry.methods
      .proposeAdapter(
        primaryAdapterProgramId,
        "Kamino USDC",
        primaryAdapterVersion,
        primarySupportedMint,
        "https://example.com/adapters/kamino-usdc.json",
      )
      .accounts({
        registryConfig,
        adapterEntry: primaryAdapterEntry,
        governanceAuthority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await registry.account.registryConfig.fetch(registryConfig);
    const entry = await registry.account.adapterEntry.fetch(primaryAdapterEntry);

    assert.strictEqual(config.adapterCount.toNumber(), 1);
    assert.strictEqual(
      entry.adapterProgramId.toBase58(),
      primaryAdapterProgramId.toBase58(),
    );
    assert.strictEqual(entry.protocolName, "Kamino USDC");
    assert.strictEqual(entry.adapterVersion, primaryAdapterVersion);
    assert.strictEqual(
      entry.supportedMint.toBase58(),
      primarySupportedMint.toBase58(),
    );
    assert.isTrue(hasStatus(entry.status, "pending"));
  });

  it("approves adapter", async () => {
    await registry.methods
      .approveAdapter()
      .accounts({
        registryConfig,
        adapterEntry: primaryAdapterEntry,
        governanceAuthority: provider.wallet.publicKey,
      })
      .rpc();

    const entry = await registry.account.adapterEntry.fetch(primaryAdapterEntry);
    assert.isTrue(hasStatus(entry.status, "approved"));
  });

  it("rejects propose by non-governance", async () => {
    const adapterProgramId = Keypair.generate().publicKey;
    const supportedMint = Keypair.generate().publicKey;
    const adapterEntry = findAdapterEntryPda(
      registry.programId,
      adapterProgramId,
      supportedMint,
      1,
    );

    await expectAnchorError(
      registry.methods
        .proposeAdapter(
          adapterProgramId,
          "Unauthorized Adapter",
          1,
          supportedMint,
          "https://example.com/adapters/unauthorized.json",
        )
        .accounts({
          registryConfig,
          adapterEntry,
          governanceAuthority: nonGovernance.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([nonGovernance])
        .rpc(),
      "UnauthorizedGovernance",
    );
  });

  it("rejects approve by non-governance", async () => {
    await registry.methods
      .proposeAdapter(
        pendingAdapterProgramId,
        "Pending Adapter",
        pendingAdapterVersion,
        pendingSupportedMint,
        "https://example.com/adapters/pending.json",
      )
      .accounts({
        registryConfig,
        adapterEntry: pendingAdapterEntry,
        governanceAuthority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await expectAnchorError(
      registry.methods
        .approveAdapter()
        .accounts({
          registryConfig,
          adapterEntry: pendingAdapterEntry,
          governanceAuthority: nonGovernance.publicKey,
        })
        .signers([nonGovernance])
        .rpc(),
      "UnauthorizedGovernance",
    );
  });

  it("rejects empty protocol name", async () => {
    const adapterProgramId = Keypair.generate().publicKey;
    const supportedMint = Keypair.generate().publicKey;
    const adapterEntry = findAdapterEntryPda(
      registry.programId,
      adapterProgramId,
      supportedMint,
      1,
    );

    await expectAnchorError(
      registry.methods
        .proposeAdapter(
          adapterProgramId,
          " ",
          1,
          supportedMint,
          "https://example.com/adapters/empty-protocol.json",
        )
        .accounts({
          registryConfig,
          adapterEntry,
          governanceAuthority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      "EmptyProtocolName",
    );
  });

  it("rejects invalid status transitions", async () => {
    await expectAnchorError(
      registry.methods
        .pauseAdapter()
        .accounts({
          registryConfig,
          adapterEntry: pendingAdapterEntry,
          governanceAuthority: provider.wallet.publicKey,
        })
        .rpc(),
      "InvalidStatusTransition",
    );
  });

  it("pauses adapter", async () => {
    await registry.methods
      .pauseAdapter()
      .accounts({
        registryConfig,
        adapterEntry: primaryAdapterEntry,
        governanceAuthority: provider.wallet.publicKey,
      })
      .rpc();

    const entry = await registry.account.adapterEntry.fetch(primaryAdapterEntry);
    assert.isTrue(hasStatus(entry.status, "paused"));
  });

  it("unpauses adapter", async () => {
    await registry.methods
      .unpauseAdapter()
      .accounts({
        registryConfig,
        adapterEntry: primaryAdapterEntry,
        governanceAuthority: provider.wallet.publicKey,
      })
      .rpc();

    const entry = await registry.account.adapterEntry.fetch(primaryAdapterEntry);
    assert.isTrue(hasStatus(entry.status, "approved"));
  });

  it("deprecates adapter", async () => {
    await registry.methods
      .deprecateAdapter()
      .accounts({
        registryConfig,
        adapterEntry: primaryAdapterEntry,
        governanceAuthority: provider.wallet.publicKey,
      })
      .rpc();

    const entry = await registry.account.adapterEntry.fetch(primaryAdapterEntry);
    assert.isTrue(hasStatus(entry.status, "deprecated"));
  });

  it("updates metadata", async () => {
    await registry.methods
      .updateAdapterMetadata("https://example.com/adapters/pending-v2.json")
      .accounts({
        registryConfig,
        adapterEntry: pendingAdapterEntry,
        governanceAuthority: provider.wallet.publicKey,
      })
      .rpc();

    const entry = await registry.account.adapterEntry.fetch(pendingAdapterEntry);
    assert.strictEqual(
      entry.metadataUri,
      "https://example.com/adapters/pending-v2.json",
    );
  });

  it("transfers governance", async () => {
    await registry.methods
      .transferGovernance(newGovernance.publicKey)
      .accounts({
        registryConfig,
        governanceAuthority: provider.wallet.publicKey,
      })
      .rpc();

    const config = await registry.account.registryConfig.fetch(registryConfig);
    assert.strictEqual(
      config.governanceAuthority.toBase58(),
      newGovernance.publicKey.toBase58(),
    );
  });

  it("old governance loses permissions", async () => {
    await expectAnchorError(
      registry.methods
        .approveAdapter()
        .accounts({
          registryConfig,
          adapterEntry: pendingAdapterEntry,
          governanceAuthority: provider.wallet.publicKey,
        })
        .rpc(),
      "UnauthorizedGovernance",
    );
  });

  it("new governance gains permissions", async () => {
    await registry.methods
      .approveAdapter()
      .accounts({
        registryConfig,
        adapterEntry: pendingAdapterEntry,
        governanceAuthority: newGovernance.publicKey,
      })
      .signers([newGovernance])
      .rpc();

    const entry = await registry.account.adapterEntry.fetch(pendingAdapterEntry);
    assert.isTrue(hasStatus(entry.status, "approved"));

    await registry.methods
      .transferGovernance(provider.wallet.publicKey)
      .accounts({
        registryConfig,
        governanceAuthority: newGovernance.publicKey,
      })
      .signers([newGovernance])
      .rpc();
  });
});

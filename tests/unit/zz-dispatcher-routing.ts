import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { describeWithValidator } from "../support/validator-suite";

const REGISTRY_CONFIG_SEED = Buffer.from("registry_config");
const ADAPTER_ENTRY_SEED = Buffer.from("adapter_entry");
const ADAPTER_CONFIG_SEED = Buffer.from("adapter_config");
const USER_POSITION_SEED = Buffer.from("user_position");

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
  registryProgramId: PublicKey,
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
    registryProgramId,
  )[0];
}

function findAdapterConfigPda(
  adapterProgramId: PublicKey,
  supportedMint: PublicKey,
  adapterVersion: number,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      ADAPTER_CONFIG_SEED,
      supportedMint.toBuffer(),
      adapterVersionSeed(adapterVersion),
    ],
    adapterProgramId,
  )[0];
}

function findUserPositionPda(
  adapterProgramId: PublicKey,
  adapterConfig: PublicKey,
  owner: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [USER_POSITION_SEED, adapterConfig.toBuffer(), owner.toBuffer()],
    adapterProgramId,
  )[0];
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

function returnDataU64(simulation: any): number {
  const returnData =
    simulation.raw?.value?.returnData ??
    simulation.raw?.returnData ??
    simulation.returnData;
  if (returnData === undefined) {
    const rawLogs = Array.isArray(simulation.raw) ? simulation.raw : [];
    const returnLog = rawLogs
      .slice()
      .reverse()
      .find((log: string) => log.startsWith("Program return:"));
    assert.isDefined(returnLog, "expected simulated transaction return data");
    const encodedFromLog = returnLog.split(" ").at(-1);
    const bytesFromLog = Buffer.from(encodedFromLog ?? "", "base64");
    assert.isAtLeast(bytesFromLog.length, 8, "return data must contain a u64");
    return Number(bytesFromLog.readBigUInt64LE(0));
  }

  const data = returnData.data;
  const encoded = Array.isArray(data) ? data[0] : data;
  const bytes = Buffer.from(encoded, "base64");
  assert.isAtLeast(bytes.length, 8, "return data must contain a u64");
  return Number(bytes.readBigUInt64LE(0));
}

describeWithValidator("dispatcher routing", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const registry = anchor.workspace.Registry as WorkspaceProgram;
  const dispatcher = anchor.workspace.Dispatcher as WorkspaceProgram;
  const adapterTemplate = anchor.workspace.AdapterTemplate as WorkspaceProgram;

  const registryConfig = findRegistryConfigPda(registry.programId);

  const approvedMint = Keypair.generate();
  const pendingMint = Keypair.generate();
  const pausedMint = Keypair.generate();
  const deprecatedMint = Keypair.generate();
  const wrongMint = Keypair.generate();

  const approvedVersion = 101;
  const pendingVersion = 102;
  const pausedVersion = 103;
  const deprecatedVersion = 104;

  const approvedEntry = findAdapterEntryPda(
    registry.programId,
    adapterTemplate.programId,
    approvedMint.publicKey,
    approvedVersion,
  );
  const pendingEntry = findAdapterEntryPda(
    registry.programId,
    adapterTemplate.programId,
    pendingMint.publicKey,
    pendingVersion,
  );
  const pausedEntry = findAdapterEntryPda(
    registry.programId,
    adapterTemplate.programId,
    pausedMint.publicKey,
    pausedVersion,
  );
  const deprecatedEntry = findAdapterEntryPda(
    registry.programId,
    adapterTemplate.programId,
    deprecatedMint.publicKey,
    deprecatedVersion,
  );

  const approvedAdapterConfig = findAdapterConfigPda(
    adapterTemplate.programId,
    approvedMint.publicKey,
    approvedVersion,
  );
  const approvedPosition = findUserPositionPda(
    adapterTemplate.programId,
    approvedAdapterConfig,
    provider.wallet.publicKey,
  );

  async function ensureFunded(account: PublicKey): Promise<void> {
    const signature = await provider.connection.requestAirdrop(
      account,
      LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(signature, "confirmed");
  }

  async function initializeRegistryIfNeeded(): Promise<void> {
    const account = await provider.connection.getAccountInfo(registryConfig);
    if (account !== null) {
      return;
    }

    await registry.methods
      .initializeRegistry()
      .accounts({
        registryConfig,
        governanceAuthority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async function proposeAdapter(
    adapterEntry: PublicKey,
    supportedMint: PublicKey,
    adapterVersion: number,
    protocolName: string,
  ): Promise<void> {
    await registry.methods
      .proposeAdapter(
        adapterTemplate.programId,
        protocolName,
        adapterVersion,
        supportedMint,
        `https://example.com/adapters/${protocolName
          .toLowerCase()
          .replaceAll(" ", "-")}.json`,
      )
      .accounts({
        registryConfig,
        adapterEntry,
        governanceAuthority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  before(async () => {
    await initializeRegistryIfNeeded();

    for (const mint of [
      approvedMint,
      pendingMint,
      pausedMint,
      deprecatedMint,
      wrongMint,
    ]) {
      await ensureFunded(mint.publicKey);
    }

    await proposeAdapter(
      approvedEntry,
      approvedMint.publicKey,
      approvedVersion,
      "Mock Approved",
    );
    await adapterTemplate.methods
      .initializeAdapter(
        approvedMint.publicKey,
        Keypair.generate().publicKey,
        approvedVersion,
      )
      .accounts({
        adapterConfig: approvedAdapterConfig,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    await adapterTemplate.methods
      .initializePosition()
      .accounts({
        adapterConfig: approvedAdapterConfig,
        userPosition: approvedPosition,
        owner: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    await registry.methods
      .approveAdapter()
      .accounts({
        registryConfig,
        adapterEntry: approvedEntry,
        governanceAuthority: provider.wallet.publicKey,
      })
      .rpc();

    await proposeAdapter(
      pendingEntry,
      pendingMint.publicKey,
      pendingVersion,
      "Mock Pending",
    );

    await proposeAdapter(
      pausedEntry,
      pausedMint.publicKey,
      pausedVersion,
      "Mock Paused",
    );
    await registry.methods
      .approveAdapter()
      .accounts({
        registryConfig,
        adapterEntry: pausedEntry,
        governanceAuthority: provider.wallet.publicKey,
      })
      .rpc();
    await registry.methods
      .pauseAdapter()
      .accounts({
        registryConfig,
        adapterEntry: pausedEntry,
        governanceAuthority: provider.wallet.publicKey,
      })
      .rpc();

    await proposeAdapter(
      deprecatedEntry,
      deprecatedMint.publicKey,
      deprecatedVersion,
      "Mock Deprecated",
    );
    await registry.methods
      .approveAdapter()
      .accounts({
        registryConfig,
        adapterEntry: deprecatedEntry,
        governanceAuthority: provider.wallet.publicKey,
      })
      .rpc();
    await registry.methods
      .deprecateAdapter()
      .accounts({
        registryConfig,
        adapterEntry: deprecatedEntry,
        governanceAuthority: provider.wallet.publicKey,
      })
      .rpc();
  });

  it("approved adapter accepts deposit", async () => {
    await dispatcher.methods
      .deposit(new anchor.BN(100))
      .accounts({
        adapterEntry: approvedEntry,
        adapterProgram: adapterTemplate.programId,
        adapterConfig: approvedAdapterConfig,
        requestedMint: approvedMint.publicKey,
        adapterPosition: approvedPosition,
        user: provider.wallet.publicKey,
      })
      .rpc();

    const position =
      await adapterTemplate.account.userPosition.fetch(approvedPosition);
    assert.strictEqual(position.depositedAmount.toNumber(), 100);
    assert.strictEqual(position.shares.toNumber(), 100);
    assert.strictEqual(position.lastValue.toNumber(), 100);
    assert.strictEqual(
      position.owner.toBase58(),
      provider.wallet.publicKey.toBase58(),
    );
  });

  it("approved adapter accepts withdraw", async () => {
    await dispatcher.methods
      .withdraw(new anchor.BN(40))
      .accounts({
        adapterEntry: approvedEntry,
        adapterProgram: adapterTemplate.programId,
        adapterConfig: approvedAdapterConfig,
        requestedMint: approvedMint.publicKey,
        adapterPosition: approvedPosition,
        user: provider.wallet.publicKey,
      })
      .rpc();

    const position =
      await adapterTemplate.account.userPosition.fetch(approvedPosition);
    assert.strictEqual(position.depositedAmount.toNumber(), 60);
    assert.strictEqual(position.shares.toNumber(), 60);
    assert.strictEqual(position.lastValue.toNumber(), 60);
  });

  it("approved adapter returns current_value", async () => {
    const simulation = await dispatcher.methods
      .currentValue()
      .accounts({
        adapterEntry: approvedEntry,
        adapterProgram: adapterTemplate.programId,
        adapterConfig: approvedAdapterConfig,
        requestedMint: approvedMint.publicKey,
        adapterPosition: approvedPosition,
        user: provider.wallet.publicKey,
      })
      .simulate();

    assert.strictEqual(returnDataU64(simulation), 60);
  });

  it("rejects pending adapter", async () => {
    const adapterConfig = findAdapterConfigPda(
      adapterTemplate.programId,
      pendingMint.publicKey,
      pendingVersion,
    );
    const position = findUserPositionPda(
      adapterTemplate.programId,
      adapterConfig,
      provider.wallet.publicKey,
    );

    await expectAnchorError(
      dispatcher.methods
        .deposit(new anchor.BN(10))
        .accounts({
          adapterEntry: pendingEntry,
          adapterProgram: adapterTemplate.programId,
          adapterConfig,
          requestedMint: pendingMint.publicKey,
          adapterPosition: position,
          user: provider.wallet.publicKey,
        })
        .rpc(),
      "AdapterNotApproved",
    );
  });

  it("rejects paused adapter", async () => {
    const adapterConfig = findAdapterConfigPda(
      adapterTemplate.programId,
      pausedMint.publicKey,
      pausedVersion,
    );
    const position = findUserPositionPda(
      adapterTemplate.programId,
      adapterConfig,
      provider.wallet.publicKey,
    );

    await expectAnchorError(
      dispatcher.methods
        .deposit(new anchor.BN(10))
        .accounts({
          adapterEntry: pausedEntry,
          adapterProgram: adapterTemplate.programId,
          adapterConfig,
          requestedMint: pausedMint.publicKey,
          adapterPosition: position,
          user: provider.wallet.publicKey,
        })
        .rpc(),
      "AdapterPaused",
    );
  });

  it("rejects deprecated adapter", async () => {
    const adapterConfig = findAdapterConfigPda(
      adapterTemplate.programId,
      deprecatedMint.publicKey,
      deprecatedVersion,
    );
    const position = findUserPositionPda(
      adapterTemplate.programId,
      adapterConfig,
      provider.wallet.publicKey,
    );

    await expectAnchorError(
      dispatcher.methods
        .deposit(new anchor.BN(10))
        .accounts({
          adapterEntry: deprecatedEntry,
          adapterProgram: adapterTemplate.programId,
          adapterConfig,
          requestedMint: deprecatedMint.publicKey,
          adapterPosition: position,
          user: provider.wallet.publicKey,
        })
        .rpc(),
      "AdapterDeprecated",
    );
  });

  it("rejects wrong adapter program", async () => {
    await expectAnchorError(
      dispatcher.methods
        .deposit(new anchor.BN(10))
        .accounts({
          adapterEntry: approvedEntry,
          adapterProgram: registry.programId,
          adapterConfig: approvedAdapterConfig,
          requestedMint: approvedMint.publicKey,
          adapterPosition: approvedPosition,
          user: provider.wallet.publicKey,
        })
        .rpc(),
      "InvalidAdapterProgram",
    );
  });

  it("rejects wrong mint", async () => {
    await expectAnchorError(
      dispatcher.methods
        .deposit(new anchor.BN(10))
        .accounts({
          adapterEntry: approvedEntry,
          adapterProgram: adapterTemplate.programId,
          adapterConfig: approvedAdapterConfig,
          requestedMint: wrongMint.publicKey,
          adapterPosition: approvedPosition,
          user: provider.wallet.publicKey,
        })
        .rpc(),
      "InvalidMint",
    );
  });

  it("rejects zero deposit", async () => {
    await expectAnchorError(
      dispatcher.methods
        .deposit(new anchor.BN(0))
        .accounts({
          adapterEntry: approvedEntry,
          adapterProgram: adapterTemplate.programId,
          adapterConfig: approvedAdapterConfig,
          requestedMint: approvedMint.publicKey,
          adapterPosition: approvedPosition,
          user: provider.wallet.publicKey,
        })
        .rpc(),
      "InvalidAmount",
    );
  });

  it("rejects zero withdraw", async () => {
    await expectAnchorError(
      dispatcher.methods
        .withdraw(new anchor.BN(0))
        .accounts({
          adapterEntry: approvedEntry,
          adapterProgram: adapterTemplate.programId,
          adapterConfig: approvedAdapterConfig,
          requestedMint: approvedMint.publicKey,
          adapterPosition: approvedPosition,
          user: provider.wallet.publicKey,
        })
        .rpc(),
      "InvalidAmount",
    );
  });
});

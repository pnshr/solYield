import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

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

function simulationLogs(simulation: any): string[] {
  return (
    simulation.raw?.value?.logs ??
    simulation.raw?.logs ??
    simulation.logs ??
    (Array.isArray(simulation.raw) ? simulation.raw : [])
  );
}

function parsedEventsFromSimulation(program: Program, simulation: any): any[] {
  if (Array.isArray(simulation.events) && simulation.events.length > 0) {
    return simulation.events;
  }

  const logs = simulationLogs(simulation);
  const parser = new anchor.EventParser(program.programId, program.coder);
  return Array.from(parser.parseLogs(logs));
}

function eventMatches(candidate: { name: string }, expected: string): boolean {
  const lowerCamel = expected.charAt(0).toLowerCase() + expected.slice(1);
  return candidate.name === expected || candidate.name === lowerCamel;
}

function returnDataU64(simulation: any): number {
  const returnData =
    simulation.raw?.value?.returnData ??
    simulation.raw?.returnData ??
    simulation.returnData;
  if (returnData === undefined) {
    const returnLog = simulationLogs(simulation)
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

describe("adapter compliance", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const adapterTemplate = anchor.workspace.AdapterTemplate as WorkspaceProgram;

  const supportedMint = Keypair.generate();
  const wrongMint = Keypair.generate();
  const protocolProgramId = Keypair.generate().publicKey;
  const wrongOwner = Keypair.generate();
  const version = 401;

  const adapterConfig = findAdapterConfigPda(
    adapterTemplate.programId,
    supportedMint.publicKey,
    version,
  );
  const userPosition = findUserPositionPda(
    adapterTemplate.programId,
    adapterConfig,
    provider.wallet.publicKey,
  );

  before(async () => {
    for (const keypair of [supportedMint, wrongMint, wrongOwner]) {
      const signature = await provider.connection.requestAirdrop(
        keypair.publicKey,
        LAMPORTS_PER_SOL,
      );
      await provider.connection.confirmTransaction(signature, "confirmed");
    }
  });

  it("adapter can initialize config", async () => {
    await adapterTemplate.methods
      .initializeAdapter(supportedMint.publicKey, protocolProgramId, version)
      .accounts({
        adapterConfig,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await adapterTemplate.account.adapterConfig.fetch(
      adapterConfig,
    );
    assert.strictEqual(
      config.authority.toBase58(),
      provider.wallet.publicKey.toBase58(),
    );
    assert.strictEqual(
      config.supportedMint.toBase58(),
      supportedMint.publicKey.toBase58(),
    );
    assert.strictEqual(
      config.protocolProgramId.toBase58(),
      protocolProgramId.toBase58(),
    );
    assert.strictEqual(config.version, version);
  });

  it("adapter can initialize user position", async () => {
    await adapterTemplate.methods
      .initializePosition()
      .accounts({
        adapterConfig,
        userPosition,
        owner: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const position =
      await adapterTemplate.account.userPosition.fetch(userPosition);
    assert.strictEqual(
      position.owner.toBase58(),
      provider.wallet.publicKey.toBase58(),
    );
    assert.strictEqual(position.depositedAmount.toNumber(), 0);
    assert.strictEqual(position.shares.toNumber(), 0);
    assert.strictEqual(position.lastValue.toNumber(), 0);
  });

  it("adapter supports deposit", async () => {
    await adapterTemplate.methods
      .deposit(new anchor.BN(100))
      .accounts({
        adapterConfig,
        userPosition,
        owner: provider.wallet.publicKey,
        mint: supportedMint.publicKey,
      })
      .rpc();

    const position =
      await adapterTemplate.account.userPosition.fetch(userPosition);
    assert.strictEqual(position.depositedAmount.toNumber(), 100);
    assert.strictEqual(position.shares.toNumber(), 100);
    assert.strictEqual(position.lastValue.toNumber(), 100);
  });

  it("adapter supports withdraw", async () => {
    await adapterTemplate.methods
      .withdraw(new anchor.BN(40))
      .accounts({
        adapterConfig,
        userPosition,
        owner: provider.wallet.publicKey,
        mint: supportedMint.publicKey,
      })
      .rpc();

    const position =
      await adapterTemplate.account.userPosition.fetch(userPosition);
    assert.strictEqual(position.depositedAmount.toNumber(), 60);
    assert.strictEqual(position.shares.toNumber(), 60);
    assert.strictEqual(position.lastValue.toNumber(), 60);
  });

  it("adapter supports current_value", async () => {
    const simulation = await adapterTemplate.methods
      .currentValue()
      .accounts({
        adapterConfig,
        userPosition,
        owner: provider.wallet.publicKey,
        mint: supportedMint.publicKey,
      })
      .simulate();

    assert.strictEqual(returnDataU64(simulation), 60);
  });

  it("adapter rejects zero deposit", async () => {
    await expectAnchorError(
      adapterTemplate.methods
        .deposit(new anchor.BN(0))
        .accounts({
          adapterConfig,
          userPosition,
          owner: provider.wallet.publicKey,
          mint: supportedMint.publicKey,
        })
        .rpc(),
      "InvalidAmount",
    );
  });

  it("adapter rejects zero withdraw", async () => {
    await expectAnchorError(
      adapterTemplate.methods
        .withdraw(new anchor.BN(0))
        .accounts({
          adapterConfig,
          userPosition,
          owner: provider.wallet.publicKey,
          mint: supportedMint.publicKey,
        })
        .rpc(),
      "InvalidAmount",
    );
  });

  it("adapter rejects wrong mint", async () => {
    await expectAnchorError(
      adapterTemplate.methods
        .deposit(new anchor.BN(1))
        .accounts({
          adapterConfig,
          userPosition,
          owner: provider.wallet.publicKey,
          mint: wrongMint.publicKey,
        })
        .rpc(),
      "InvalidMint",
    );
  });

  it("adapter rejects wrong owner", async () => {
    await expectAnchorError(
      adapterTemplate.methods
        .deposit(new anchor.BN(1))
        .accounts({
          adapterConfig,
          userPosition,
          owner: wrongOwner.publicKey,
          mint: supportedMint.publicKey,
        })
        .signers([wrongOwner])
        .rpc(),
      "InvalidOwner",
    );
  });

  it("adapter emits expected events where possible", async () => {
    const depositSimulation = await adapterTemplate.methods
      .deposit(new anchor.BN(5))
      .accounts({
        adapterConfig,
        userPosition,
        owner: provider.wallet.publicKey,
        mint: supportedMint.publicKey,
      })
      .simulate();
    const withdrawSimulation = await adapterTemplate.methods
      .withdraw(new anchor.BN(5))
      .accounts({
        adapterConfig,
        userPosition,
        owner: provider.wallet.publicKey,
        mint: supportedMint.publicKey,
      })
      .simulate();
    const valueSimulation = await adapterTemplate.methods
      .currentValue()
      .accounts({
        adapterConfig,
        userPosition,
        owner: provider.wallet.publicKey,
        mint: supportedMint.publicKey,
      })
      .simulate();

    const depositEvents = parsedEventsFromSimulation(
      adapterTemplate,
      depositSimulation,
    );
    const withdrawEvents = parsedEventsFromSimulation(
      adapterTemplate,
      withdrawSimulation,
    );
    const valueEvents = parsedEventsFromSimulation(
      adapterTemplate,
      valueSimulation,
    );
    assert.isDefined(
      depositEvents.find(
        (candidate: { name: string }) => eventMatches(candidate, "AdapterDeposit"),
      ),
    );
    assert.isDefined(
      withdrawEvents.find(
        (candidate: { name: string }) => eventMatches(candidate, "AdapterWithdraw"),
      ),
    );
    assert.isDefined(
      valueEvents.find(
        (candidate: { name: string }) => eventMatches(candidate, "AdapterValue"),
      ),
    );
  });
});

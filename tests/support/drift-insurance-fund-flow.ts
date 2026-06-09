import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

const driftIdl = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      "node_modules",
      "@drift-labs",
      "sdk",
      "lib",
      "node",
      "idl",
      "drift.json",
    ),
    "utf8",
  ),
);

function toCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );
}

function camelizeIdlAccounts(accounts: any[] | undefined): void {
  for (const account of accounts ?? []) {
    if (typeof account.name === "string") {
      account.name = toCamelCase(account.name);
    }
    camelizeIdlAccounts(account.accounts);
  }
}

function camelizeDriftIdl(idl: unknown): anchor.Idl {
  const cloned = JSON.parse(JSON.stringify(idl));
  for (const instruction of cloned.instructions ?? []) {
    const originalName = instruction.name;
    instruction.name = toCamelCase(instruction.name);
    if (!instruction.discriminator || instruction.discriminator.length === 0) {
      instruction.discriminator = Array.from(
        createHash("sha256")
          .update(`global:${originalName}`)
          .digest()
          .subarray(0, 8),
      );
    }
    camelizeIdlAccounts(instruction.accounts);
    for (const arg of instruction.args ?? []) {
      arg.name = toCamelCase(arg.name);
    }
  }
  return cloned as anchor.Idl;
}

const REGISTRY_CONFIG_SEED = Buffer.from("registry_config");
const ADAPTER_ENTRY_SEED = Buffer.from("adapter_entry");
const DRIFT_CONFIG_SEED = Buffer.from("drift_if_config");
const DRIFT_POSITION_SEED = Buffer.from("drift_if_position");

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
export const DRIFT_PROGRAM_ID = new PublicKey(
  "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
);
export const DRIFT_STATE = new PublicKey(
  "5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN",
);
export const DRIFT_USDC_MARKET_INDEX = 0;
export const DRIFT_USDC_SPOT_MARKET = new PublicKey(
  "6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3",
);
export const DRIFT_USDC_SPOT_VAULT = new PublicKey(
  "GXWqPpjQpdz7KZw9p7f5PX2eGxHAhvpNXiviFkAB8zXg",
);
export const DRIFT_USDC_INSURANCE_FUND_VAULT = new PublicKey(
  "2CqkQvYxp9Mq4PqLvAQ1eryYxebUh4Liyn5YMDtXsYci",
);
export const DRIFT_SIGNER = new PublicKey(
  "JCNCMFXo5M5qwUPg2Utu1u6YWp3MbygxqBsBeXXJfrw",
);

type WorkspaceProgram = Program & {
  account: Record<string, { fetch: (address: PublicKey) => Promise<any> }>;
};

function u16Seed(value: number): Buffer {
  const seed = Buffer.alloc(2);
  seed.writeUInt16LE(value);
  return seed;
}

function findRegistryConfigPda(registryProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [REGISTRY_CONFIG_SEED],
    registryProgramId,
  )[0];
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
      u16Seed(adapterVersion),
    ],
    registryProgramId,
  )[0];
}

function findDriftAdapterConfigPda(
  adapterProgramId: PublicKey,
  adapterVersion: number,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [DRIFT_CONFIG_SEED, USDC_MINT.toBuffer(), u16Seed(adapterVersion)],
    adapterProgramId,
  )[0];
}

function findDriftAdapterPositionPda(
  adapterProgramId: PublicKey,
  adapterConfig: PublicKey,
  owner: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [DRIFT_POSITION_SEED, adapterConfig.toBuffer(), owner.toBuffer()],
    adapterProgramId,
  )[0];
}

function findUserStatsPda(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_stats"), owner.toBuffer()],
    DRIFT_PROGRAM_ID,
  )[0];
}

function findInsuranceFundStakePda(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("insurance_fund_stake"),
      owner.toBuffer(),
      u16Seed(DRIFT_USDC_MARKET_INDEX),
    ],
    DRIFT_PROGRAM_ID,
  )[0];
}

function getAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

async function tokenAmount(
  connection: anchor.web3.Connection,
  tokenAccount: PublicKey,
): Promise<bigint> {
  const balance = await connection.getTokenAccountBalance(tokenAccount);
  return BigInt(balance.value.amount);
}

async function initializeRegistryIfNeeded(
  registry: WorkspaceProgram,
  registryConfig: PublicKey,
  governanceAuthority: PublicKey,
): Promise<void> {
  const account = await registry.provider.connection.getAccountInfo(
    registryConfig,
  );
  if (account !== null) {
    return;
  }

  await registry.methods
    .initializeRegistry()
    .accounts({
      registryConfig,
      governanceAuthority,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

async function proposeAdapterIfNeeded(
  registry: WorkspaceProgram,
  registryConfig: PublicKey,
  adapterEntry: PublicKey,
  adapterProgramId: PublicKey,
  adapterVersion: number,
  governanceAuthority: PublicKey,
  protocolName: string,
): Promise<void> {
  const account = await registry.provider.connection.getAccountInfo(
    adapterEntry,
  );
  if (account !== null) {
    return;
  }

  await registry.methods
    .proposeAdapter(
      adapterProgramId,
      protocolName,
      adapterVersion,
      USDC_MINT,
      `https://example.com/adapters/${protocolName
        .toLowerCase()
        .replaceAll(" ", "-")}.json`,
    )
    .accounts({
      registryConfig,
      adapterEntry,
      governanceAuthority,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

async function initializeDriftUserStatsIfNeeded(
  drift: Program,
  provider: anchor.AnchorProvider,
  userStats: PublicKey,
): Promise<void> {
  const account = await provider.connection.getAccountInfo(userStats);
  if (account !== null) {
    return;
  }

  await drift.methods
    .initializeUserStats()
    .accounts({
      userStats,
      state: DRIFT_STATE,
      authority: provider.wallet.publicKey,
      payer: provider.wallet.publicKey,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

async function initializeInsuranceFundStakeIfNeeded(
  drift: Program,
  provider: anchor.AnchorProvider,
  insuranceFundStake: PublicKey,
  userStats: PublicKey,
): Promise<void> {
  const account = await provider.connection.getAccountInfo(insuranceFundStake);
  if (account !== null) {
    return;
  }

  await drift.methods
    .initializeInsuranceFundStake(DRIFT_USDC_MARKET_INDEX)
    .accounts({
      spotMarket: DRIFT_USDC_SPOT_MARKET,
      insuranceFundStake,
      userStats,
      state: DRIFT_STATE,
      authority: provider.wallet.publicKey,
      payer: provider.wallet.publicKey,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

async function initializeAdapterConfigIfNeeded(
  driftAdapter: WorkspaceProgram,
  adapterConfig: PublicKey,
  adapterVersion: number,
  authority: PublicKey,
): Promise<void> {
  const account = await driftAdapter.provider.connection.getAccountInfo(
    adapterConfig,
  );
  if (account !== null) {
    return;
  }

  await driftAdapter.methods
    .initializeConfig(USDC_MINT, DRIFT_PROGRAM_ID, adapterVersion)
    .accounts({
      config: adapterConfig,
      authority,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

async function initializeAdapterPositionIfNeeded(
  driftAdapter: WorkspaceProgram,
  adapterConfig: PublicKey,
  adapterPosition: PublicKey,
  owner: PublicKey,
  insuranceFundStake: PublicKey,
  userStats: PublicKey,
): Promise<void> {
  const account = await driftAdapter.provider.connection.getAccountInfo(
    adapterPosition,
  );
  if (account !== null) {
    return;
  }

  await driftAdapter.methods
    .initializePosition(
      DRIFT_USDC_MARKET_INDEX,
      insuranceFundStake,
      userStats,
    )
    .accounts({
      config: adapterConfig,
      position: adapterPosition,
      owner,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

function depositRemainingAccounts(owner: PublicKey) {
  return [
    { pubkey: DRIFT_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: DRIFT_STATE, isWritable: false, isSigner: false },
    { pubkey: DRIFT_USDC_SPOT_MARKET, isWritable: true, isSigner: false },
    { pubkey: findInsuranceFundStakePda(owner), isWritable: true, isSigner: false },
    { pubkey: findUserStatsPda(owner), isWritable: true, isSigner: false },
    { pubkey: DRIFT_USDC_SPOT_VAULT, isWritable: true, isSigner: false },
    { pubkey: DRIFT_USDC_INSURANCE_FUND_VAULT, isWritable: true, isSigner: false },
    { pubkey: DRIFT_SIGNER, isWritable: false, isSigner: false },
    {
      pubkey: getAssociatedTokenAddress(owner, USDC_MINT),
      isWritable: true,
      isSigner: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
  ];
}

function withdrawRemainingAccounts(owner: PublicKey) {
  return [
    { pubkey: DRIFT_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: DRIFT_USDC_SPOT_MARKET, isWritable: true, isSigner: false },
    { pubkey: findInsuranceFundStakePda(owner), isWritable: true, isSigner: false },
    { pubkey: findUserStatsPda(owner), isWritable: true, isSigner: false },
    { pubkey: DRIFT_USDC_INSURANCE_FUND_VAULT, isWritable: true, isSigner: false },
  ];
}

function valueRemainingAccounts(owner: PublicKey) {
  return [
    { pubkey: DRIFT_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: DRIFT_USDC_SPOT_MARKET, isWritable: false, isSigner: false },
    { pubkey: findInsuranceFundStakePda(owner), isWritable: false, isSigner: false },
    { pubkey: DRIFT_USDC_INSURANCE_FUND_VAULT, isWritable: false, isSigner: false },
  ];
}

export async function runDriftInsuranceFundDispatcherFlow(): Promise<void> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const registry = anchor.workspace.Registry as WorkspaceProgram;
  const dispatcher = anchor.workspace.Dispatcher as WorkspaceProgram;
  const driftAdapter =
    anchor.workspace.DriftInsuranceFund as WorkspaceProgram;
  const driftProgram = new anchor.Program(
    { ...camelizeDriftIdl(driftIdl), address: DRIFT_PROGRAM_ID.toBase58() },
    provider,
  );

  const registryConfig = findRegistryConfigPda(registry.programId);
  const approvedVersion = 701;
  const pendingVersion = 702;
  const pausedVersion = 703;
  const approvedEntry = findAdapterEntryPda(
    registry.programId,
    driftAdapter.programId,
    USDC_MINT,
    approvedVersion,
  );
  const pendingEntry = findAdapterEntryPda(
    registry.programId,
    driftAdapter.programId,
    USDC_MINT,
    pendingVersion,
  );
  const pausedEntry = findAdapterEntryPda(
    registry.programId,
    driftAdapter.programId,
    USDC_MINT,
    pausedVersion,
  );
  const adapterConfig = findDriftAdapterConfigPda(
    driftAdapter.programId,
    approvedVersion,
  );
  const adapterPosition = findDriftAdapterPositionPda(
    driftAdapter.programId,
    adapterConfig,
    provider.wallet.publicKey,
  );
  const userStats = findUserStatsPda(provider.wallet.publicKey);
  const insuranceFundStake = findInsuranceFundStakePda(
    provider.wallet.publicKey,
  );
  const userUsdcAccount = getAssociatedTokenAddress(
    provider.wallet.publicKey,
    USDC_MINT,
  );

  const startingBalance = await tokenAmount(
    provider.connection,
    userUsdcAccount,
  );
  assert.isAtLeast(
    Number(startingBalance),
    2_000_000,
    "Fork wallet needs at least 2 USDC in its preloaded USDC token account.",
  );

  await initializeRegistryIfNeeded(
    registry,
    registryConfig,
    provider.wallet.publicKey,
  );
  await proposeAdapterIfNeeded(
    registry,
    registryConfig,
    approvedEntry,
    driftAdapter.programId,
    approvedVersion,
    provider.wallet.publicKey,
    "Drift Insurance Fund",
  );
  await proposeAdapterIfNeeded(
    registry,
    registryConfig,
    pendingEntry,
    driftAdapter.programId,
    pendingVersion,
    provider.wallet.publicKey,
    "Drift Insurance Fund Pending",
  );
  await proposeAdapterIfNeeded(
    registry,
    registryConfig,
    pausedEntry,
    driftAdapter.programId,
    pausedVersion,
    provider.wallet.publicKey,
    "Drift Insurance Fund Paused",
  );

  await initializeDriftUserStatsIfNeeded(driftProgram, provider, userStats);
  await initializeInsuranceFundStakeIfNeeded(
    driftProgram,
    provider,
    insuranceFundStake,
    userStats,
  );

  await initializeAdapterConfigIfNeeded(
    driftAdapter,
    adapterConfig,
    approvedVersion,
    provider.wallet.publicKey,
  );
  await initializeAdapterPositionIfNeeded(
    driftAdapter,
    adapterConfig,
    adapterPosition,
    provider.wallet.publicKey,
    insuranceFundStake,
    userStats,
  );

  await registry.methods
    .approveAdapter()
    .accounts({
      registryConfig,
      adapterEntry: approvedEntry,
      governanceAuthority: provider.wallet.publicKey,
    })
    .rpc();
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

  await dispatcher.methods
    .deposit(new anchor.BN(1_000_000))
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: driftAdapter.programId,
      adapterConfig,
      requestedMint: USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .remainingAccounts(depositRemainingAccounts(provider.wallet.publicKey))
    .rpc();

  const afterDepositBalance = await tokenAmount(
    provider.connection,
    userUsdcAccount,
  );
  assert.strictEqual(
    startingBalance - afterDepositBalance,
    1_000_000n,
    "Deposit should debit exactly 1 USDC from the user token account.",
  );

  const valueSimulation = await dispatcher.methods
    .currentValue()
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: driftAdapter.programId,
      adapterConfig,
      requestedMint: USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .remainingAccounts(valueRemainingAccounts(provider.wallet.publicKey))
    .simulate();
  const valueEvent = valueSimulation.events?.find(
    (event: { name: string }) =>
      event.name === "CurrentValueQueried" ||
      event.name === "currentValueQueried",
  );
  assert.isDefined(valueEvent, "Dispatcher should emit CurrentValueQueried.");
  assert.isAbove(valueEvent!.data.value.toNumber(), 0);

  await dispatcher.methods
    .withdraw(new anchor.BN(400_000))
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: driftAdapter.programId,
      adapterConfig,
      requestedMint: USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .remainingAccounts(withdrawRemainingAccounts(provider.wallet.publicKey))
    .rpc();

  const position = await driftAdapter.account.driftInsuranceFundPosition.fetch(
    adapterPosition,
  );
  assert.strictEqual(
    position.pendingWithdrawAmount.toNumber(),
    400_000,
    "Withdraw maps to Drift's request-remove state.",
  );

  await dispatcher.methods
    .deposit(new anchor.BN(1))
    .accounts({
      adapterEntry: pendingEntry,
      adapterProgram: driftAdapter.programId,
      adapterConfig,
      requestedMint: USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .rpc()
    .then(
      () => assert.fail("Pending adapter should be rejected."),
      (error: unknown) => assert.include(String(error), "AdapterNotApproved"),
    );

  await dispatcher.methods
    .deposit(new anchor.BN(1))
    .accounts({
      adapterEntry: pausedEntry,
      adapterProgram: driftAdapter.programId,
      adapterConfig,
      requestedMint: USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .rpc()
    .then(
      () => assert.fail("Paused adapter should be rejected."),
      (error: unknown) => assert.include(String(error), "AdapterPaused"),
    );

  await dispatcher.methods
    .deposit(new anchor.BN(1))
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: driftAdapter.programId,
      adapterConfig,
      requestedMint: Keypair.generate().publicKey,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .rpc()
    .then(
      () => assert.fail("Wrong mint should be rejected."),
      (error: unknown) => assert.include(String(error), "InvalidMint"),
    );
}

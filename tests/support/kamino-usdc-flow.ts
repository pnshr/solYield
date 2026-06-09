import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const REGISTRY_CONFIG_SEED = Buffer.from("registry_config");
const ADAPTER_ENTRY_SEED = Buffer.from("adapter_entry");
const KAMINO_CONFIG_SEED = Buffer.from("kamino_usdc_config");
const KAMINO_POSITION_SEED = Buffer.from("kamino_usdc_position");

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
export const KAMINO_PROGRAM_ID = new PublicKey(
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
);
export const KAMINO_MAIN_MARKET = new PublicKey(
  "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
);
export const KAMINO_MAIN_MARKET_AUTHORITY = new PublicKey(
  "9DrvZvyWh1HuAoZxvYWMvkf2XCzryCpGgHqrMjyDWpmo",
);
export const KAMINO_USDC_RESERVE = new PublicKey(
  "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
);
export const KAMINO_USDC_LIQUIDITY_SUPPLY = new PublicKey(
  "Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6",
);
export const KAMINO_USDC_COLLATERAL_MINT = new PublicKey(
  "B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D",
);

type WorkspaceProgram = Program & {
  account: Record<string, { fetch: (address: PublicKey) => Promise<any> }>;
};

function u16Seed(value: number): Buffer {
  const seed = Buffer.alloc(2);
  seed.writeUInt16LE(value);
  return seed;
}

function hasStatus(status: Record<string, unknown>, expected: string): boolean {
  return Object.prototype.hasOwnProperty.call(status, expected);
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

function findKaminoAdapterConfigPda(
  adapterProgramId: PublicKey,
  adapterVersion: number,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [KAMINO_CONFIG_SEED, USDC_MINT.toBuffer(), u16Seed(adapterVersion)],
    adapterProgramId,
  )[0];
}

function findKaminoAdapterPositionPda(
  adapterProgramId: PublicKey,
  adapterConfig: PublicKey,
  owner: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [KAMINO_POSITION_SEED, adapterConfig.toBuffer(), owner.toBuffer()],
    adapterProgramId,
  )[0];
}

function getAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.alloc(0),
  });
}

async function createAtaIfNeeded(
  provider: anchor.AnchorProvider,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): Promise<void> {
  const account = await provider.connection.getAccountInfo(ata);
  if (account !== null) {
    return;
  }

  await provider.sendAndConfirm(
    new Transaction().add(
      createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey,
        ata,
        owner,
        mint,
      ),
    ),
    [],
  );
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

async function approveAdapterIfNeeded(
  registry: WorkspaceProgram,
  registryConfig: PublicKey,
  adapterEntry: PublicKey,
  governanceAuthority: PublicKey,
): Promise<void> {
  const entry = await registry.account.adapterEntry.fetch(adapterEntry);
  if (hasStatus(entry.status, "approved")) {
    return;
  }

  await registry.methods
    .approveAdapter()
    .accounts({
      registryConfig,
      adapterEntry,
      governanceAuthority,
    })
    .rpc();
}

async function pauseAdapterIfNeeded(
  registry: WorkspaceProgram,
  registryConfig: PublicKey,
  adapterEntry: PublicKey,
  governanceAuthority: PublicKey,
): Promise<void> {
  const entry = await registry.account.adapterEntry.fetch(adapterEntry);
  if (hasStatus(entry.status, "paused")) {
    return;
  }
  if (!hasStatus(entry.status, "approved")) {
    await approveAdapterIfNeeded(
      registry,
      registryConfig,
      adapterEntry,
      governanceAuthority,
    );
  }

  await registry.methods
    .pauseAdapter()
    .accounts({
      registryConfig,
      adapterEntry,
      governanceAuthority,
    })
    .rpc();
}

async function initializeAdapterConfigIfNeeded(
  kaminoAdapter: WorkspaceProgram,
  adapterConfig: PublicKey,
  adapterVersion: number,
  authority: PublicKey,
): Promise<void> {
  const account = await kaminoAdapter.provider.connection.getAccountInfo(
    adapterConfig,
  );
  if (account !== null) {
    return;
  }

  await kaminoAdapter.methods
    .initializeConfig(USDC_MINT, KAMINO_PROGRAM_ID, adapterVersion)
    .accounts({
      config: adapterConfig,
      authority,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

async function initializeAdapterPositionIfNeeded(
  kaminoAdapter: WorkspaceProgram,
  adapterConfig: PublicKey,
  adapterPosition: PublicKey,
  owner: PublicKey,
  userCollateralTokenAccount: PublicKey,
): Promise<void> {
  const account = await kaminoAdapter.provider.connection.getAccountInfo(
    adapterPosition,
  );
  if (account !== null) {
    return;
  }

  await kaminoAdapter.methods
    .initializePosition(KAMINO_USDC_RESERVE, userCollateralTokenAccount)
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
    { pubkey: KAMINO_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: KAMINO_USDC_RESERVE, isWritable: true, isSigner: false },
    { pubkey: KAMINO_MAIN_MARKET, isWritable: false, isSigner: false },
    { pubkey: KAMINO_MAIN_MARKET_AUTHORITY, isWritable: false, isSigner: false },
    { pubkey: USDC_MINT, isWritable: false, isSigner: false },
    { pubkey: KAMINO_USDC_LIQUIDITY_SUPPLY, isWritable: true, isSigner: false },
    { pubkey: KAMINO_USDC_COLLATERAL_MINT, isWritable: true, isSigner: false },
    {
      pubkey: getAssociatedTokenAddress(owner, USDC_MINT),
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: getAssociatedTokenAddress(owner, KAMINO_USDC_COLLATERAL_MINT),
      isWritable: true,
      isSigner: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isWritable: false, isSigner: false },
  ];
}

function withdrawRemainingAccounts(owner: PublicKey) {
  return [
    { pubkey: KAMINO_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: KAMINO_MAIN_MARKET, isWritable: false, isSigner: false },
    { pubkey: KAMINO_USDC_RESERVE, isWritable: true, isSigner: false },
    { pubkey: KAMINO_MAIN_MARKET_AUTHORITY, isWritable: false, isSigner: false },
    { pubkey: USDC_MINT, isWritable: false, isSigner: false },
    { pubkey: KAMINO_USDC_COLLATERAL_MINT, isWritable: true, isSigner: false },
    { pubkey: KAMINO_USDC_LIQUIDITY_SUPPLY, isWritable: true, isSigner: false },
    {
      pubkey: getAssociatedTokenAddress(owner, KAMINO_USDC_COLLATERAL_MINT),
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: getAssociatedTokenAddress(owner, USDC_MINT),
      isWritable: true,
      isSigner: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isWritable: false, isSigner: false },
  ];
}

function valueRemainingAccounts(owner: PublicKey) {
  return [
    { pubkey: KAMINO_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: KAMINO_USDC_RESERVE, isWritable: false, isSigner: false },
    {
      pubkey: getAssociatedTokenAddress(owner, KAMINO_USDC_COLLATERAL_MINT),
      isWritable: false,
      isSigner: false,
    },
  ];
}

export async function runKaminoUsdcDispatcherFlow(): Promise<void> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const registry = anchor.workspace.Registry as WorkspaceProgram;
  const dispatcher = anchor.workspace.Dispatcher as WorkspaceProgram;
  const kaminoAdapter = anchor.workspace.KaminoUsdc as WorkspaceProgram;

  const registryConfig = findRegistryConfigPda(registry.programId);
  const approvedVersion = 801;
  const pendingVersion = 802;
  const pausedVersion = 803;
  const approvedEntry = findAdapterEntryPda(
    registry.programId,
    kaminoAdapter.programId,
    USDC_MINT,
    approvedVersion,
  );
  const pendingEntry = findAdapterEntryPda(
    registry.programId,
    kaminoAdapter.programId,
    USDC_MINT,
    pendingVersion,
  );
  const pausedEntry = findAdapterEntryPda(
    registry.programId,
    kaminoAdapter.programId,
    USDC_MINT,
    pausedVersion,
  );
  const adapterConfig = findKaminoAdapterConfigPda(
    kaminoAdapter.programId,
    approvedVersion,
  );
  const adapterPosition = findKaminoAdapterPositionPda(
    kaminoAdapter.programId,
    adapterConfig,
    provider.wallet.publicKey,
  );
  const userUsdcAccount = getAssociatedTokenAddress(
    provider.wallet.publicKey,
    USDC_MINT,
  );
  const userCollateralTokenAccount = getAssociatedTokenAddress(
    provider.wallet.publicKey,
    KAMINO_USDC_COLLATERAL_MINT,
  );

  await createAtaIfNeeded(
    provider,
    userCollateralTokenAccount,
    provider.wallet.publicKey,
    KAMINO_USDC_COLLATERAL_MINT,
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
    kaminoAdapter.programId,
    approvedVersion,
    provider.wallet.publicKey,
    "Kamino USDC",
  );
  await proposeAdapterIfNeeded(
    registry,
    registryConfig,
    pendingEntry,
    kaminoAdapter.programId,
    pendingVersion,
    provider.wallet.publicKey,
    "Kamino USDC Pending",
  );
  await proposeAdapterIfNeeded(
    registry,
    registryConfig,
    pausedEntry,
    kaminoAdapter.programId,
    pausedVersion,
    provider.wallet.publicKey,
    "Kamino USDC Paused",
  );

  await initializeAdapterConfigIfNeeded(
    kaminoAdapter,
    adapterConfig,
    approvedVersion,
    provider.wallet.publicKey,
  );
  await initializeAdapterPositionIfNeeded(
    kaminoAdapter,
    adapterConfig,
    adapterPosition,
    provider.wallet.publicKey,
    userCollateralTokenAccount,
  );

  await approveAdapterIfNeeded(
    registry,
    registryConfig,
    approvedEntry,
    provider.wallet.publicKey,
  );
  await pauseAdapterIfNeeded(
    registry,
    registryConfig,
    pausedEntry,
    provider.wallet.publicKey,
  );

  await dispatcher.methods
    .deposit(new anchor.BN(1_000_000))
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: kaminoAdapter.programId,
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
  const debitedAmount = startingBalance - afterDepositBalance;
  assert.isAtLeast(
    Number(debitedAmount),
    999_999,
    "Deposit should debit the requested 1 USDC amount within Kamino rounding dust.",
  );
  assert.isAtMost(
    Number(debitedAmount),
    1_000_000,
    "Deposit should not debit more than the requested 1 USDC amount.",
  );
  const collateralAfterDeposit = await tokenAmount(
    provider.connection,
    userCollateralTokenAccount,
  );
  assert.isAbove(
    Number(collateralAfterDeposit),
    0,
    "Kamino deposit should mint reserve collateral tokens.",
  );

  const valueSimulation = await dispatcher.methods
    .currentValue()
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: kaminoAdapter.programId,
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
      adapterProgram: kaminoAdapter.programId,
      adapterConfig,
      requestedMint: USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .remainingAccounts(withdrawRemainingAccounts(provider.wallet.publicKey))
    .rpc();

  const afterWithdrawBalance = await tokenAmount(
    provider.connection,
    userUsdcAccount,
  );
  assert.isAbove(
    Number(afterWithdrawBalance - afterDepositBalance),
    0,
    "Withdraw should redeem collateral back into USDC when reserve liquidity is available.",
  );

  await dispatcher.methods
    .deposit(new anchor.BN(1))
    .accounts({
      adapterEntry: pendingEntry,
      adapterProgram: kaminoAdapter.programId,
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
      adapterProgram: kaminoAdapter.programId,
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
      adapterProgram: kaminoAdapter.programId,
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

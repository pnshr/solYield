import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const REGISTRY_CONFIG_SEED = Buffer.from("registry_config");
const ADAPTER_ENTRY_SEED = Buffer.from("adapter_entry");
const MAPLE_CONFIG_SEED = Buffer.from("maple_syrup_config");
const MAPLE_POSITION_SEED = Buffer.from("maple_syrup_position");

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

export const MAPLE_SYRUP_USDC_MINT = new PublicKey(
  "AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj",
);

export const MAPLE_SYRUP_USDC_ORACLE = new PublicKey(
  "CpNyiFt84q66665Kx64bobxZuMgZ2EecrhAJs1HikS2T",
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

function findMapleAdapterConfigPda(
  adapterProgramId: PublicKey,
  adapterVersion: number,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [MAPLE_CONFIG_SEED, MAPLE_SYRUP_USDC_MINT.toBuffer(), u16Seed(adapterVersion)],
    adapterProgramId,
  )[0];
}

function findMapleAdapterPositionPda(
  adapterProgramId: PublicKey,
  adapterConfig: PublicKey,
  owner: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [MAPLE_POSITION_SEED, adapterConfig.toBuffer(), owner.toBuffer()],
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
      MAPLE_SYRUP_USDC_MINT,
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
  mapleAdapter: WorkspaceProgram,
  adapterConfig: PublicKey,
  adapterVersion: number,
  authority: PublicKey,
): Promise<void> {
  const account = await mapleAdapter.provider.connection.getAccountInfo(
    adapterConfig,
  );
  if (account !== null) {
    return;
  }

  await mapleAdapter.methods
    .initializeConfig(MAPLE_SYRUP_USDC_MINT, TOKEN_PROGRAM_ID, adapterVersion)
    .accounts({
      config: adapterConfig,
      authority,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

async function initializeAdapterPositionIfNeeded(
  mapleAdapter: WorkspaceProgram,
  adapterConfig: PublicKey,
  adapterPosition: PublicKey,
  owner: PublicKey,
  vaultTokenAccount: PublicKey,
): Promise<void> {
  const account = await mapleAdapter.provider.connection.getAccountInfo(
    adapterPosition,
  );
  if (account !== null) {
    return;
  }

  await mapleAdapter.methods
    .initializePosition(vaultTokenAccount)
    .accounts({
      config: adapterConfig,
      position: adapterPosition,
      owner,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

function depositRemainingAccounts(owner: PublicKey, vaultTokenAccount: PublicKey) {
  return [
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    {
      pubkey: getAssociatedTokenAddress(owner, MAPLE_SYRUP_USDC_MINT),
      isWritable: true,
      isSigner: false,
    },
    { pubkey: vaultTokenAccount, isWritable: true, isSigner: false },
    { pubkey: MAPLE_SYRUP_USDC_ORACLE, isWritable: false, isSigner: false },
  ];
}

function withdrawRemainingAccounts(owner: PublicKey, vaultTokenAccount: PublicKey) {
  return [
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: vaultTokenAccount, isWritable: true, isSigner: false },
    {
      pubkey: getAssociatedTokenAddress(owner, MAPLE_SYRUP_USDC_MINT),
      isWritable: true,
      isSigner: false,
    },
    { pubkey: MAPLE_SYRUP_USDC_ORACLE, isWritable: false, isSigner: false },
  ];
}

function valueRemainingAccounts(vaultTokenAccount: PublicKey) {
  return [
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: vaultTokenAccount, isWritable: false, isSigner: false },
    { pubkey: MAPLE_SYRUP_USDC_ORACLE, isWritable: false, isSigner: false },
  ];
}

export async function runMapleSyrupDispatcherFlow(): Promise<void> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const registry = anchor.workspace.Registry as WorkspaceProgram;
  const dispatcher = anchor.workspace.Dispatcher as WorkspaceProgram;
  const mapleAdapter = anchor.workspace.MapleSyrup as WorkspaceProgram;

  const registryConfig = findRegistryConfigPda(registry.programId);
  const approvedVersion = 1001;
  const pendingVersion = 1002;
  const pausedVersion = 1003;
  const approvedEntry = findAdapterEntryPda(
    registry.programId,
    mapleAdapter.programId,
    MAPLE_SYRUP_USDC_MINT,
    approvedVersion,
  );
  const pendingEntry = findAdapterEntryPda(
    registry.programId,
    mapleAdapter.programId,
    MAPLE_SYRUP_USDC_MINT,
    pendingVersion,
  );
  const pausedEntry = findAdapterEntryPda(
    registry.programId,
    mapleAdapter.programId,
    MAPLE_SYRUP_USDC_MINT,
    pausedVersion,
  );
  const adapterConfig = findMapleAdapterConfigPda(
    mapleAdapter.programId,
    approvedVersion,
  );
  const adapterPosition = findMapleAdapterPositionPda(
    mapleAdapter.programId,
    adapterConfig,
    provider.wallet.publicKey,
  );
  const userSyrupAccount = getAssociatedTokenAddress(
    provider.wallet.publicKey,
    MAPLE_SYRUP_USDC_MINT,
  );
  const vaultTokenAccount = getAssociatedTokenAddress(
    adapterPosition,
    MAPLE_SYRUP_USDC_MINT,
  );

  await createAtaIfNeeded(
    provider,
    vaultTokenAccount,
    adapterPosition,
    MAPLE_SYRUP_USDC_MINT,
  );

  const startingBalance = await tokenAmount(
    provider.connection,
    userSyrupAccount,
  );
  const startingVaultBalance = await tokenAmount(
    provider.connection,
    vaultTokenAccount,
  );
  assert.isAtLeast(
    Number(startingBalance),
    2_000_000,
    "Fork wallet needs at least 2 syrupUSDC in its preloaded syrupUSDC token account.",
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
    mapleAdapter.programId,
    approvedVersion,
    provider.wallet.publicKey,
    "Maple syrupUSDC",
  );
  await proposeAdapterIfNeeded(
    registry,
    registryConfig,
    pendingEntry,
    mapleAdapter.programId,
    pendingVersion,
    provider.wallet.publicKey,
    "Maple syrupUSDC Pending",
  );
  await proposeAdapterIfNeeded(
    registry,
    registryConfig,
    pausedEntry,
    mapleAdapter.programId,
    pausedVersion,
    provider.wallet.publicKey,
    "Maple syrupUSDC Paused",
  );

  await initializeAdapterConfigIfNeeded(
    mapleAdapter,
    adapterConfig,
    approvedVersion,
    provider.wallet.publicKey,
  );
  await initializeAdapterPositionIfNeeded(
    mapleAdapter,
    adapterConfig,
    adapterPosition,
    provider.wallet.publicKey,
    vaultTokenAccount,
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
      adapterProgram: mapleAdapter.programId,
      adapterConfig,
      requestedMint: MAPLE_SYRUP_USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .remainingAccounts(depositRemainingAccounts(provider.wallet.publicKey, vaultTokenAccount))
    .rpc();

  const afterDepositBalance = await tokenAmount(
    provider.connection,
    userSyrupAccount,
  );
  assert.strictEqual(
    startingBalance - afterDepositBalance,
    1_000_000n,
    "Deposit should custody exactly 1 syrupUSDC.",
  );
  const vaultAfterDeposit = await tokenAmount(provider.connection, vaultTokenAccount);
  assert.strictEqual(vaultAfterDeposit - startingVaultBalance, 1_000_000n);

  const valueSimulation = await dispatcher.methods
    .currentValue()
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: mapleAdapter.programId,
      adapterConfig,
      requestedMint: MAPLE_SYRUP_USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .remainingAccounts(valueRemainingAccounts(vaultTokenAccount))
    .simulate();
  const valueEvent = valueSimulation.events?.find(
    (event: { name: string }) =>
      event.name === "CurrentValueQueried" ||
      event.name === "currentValueQueried",
  );
  assert.isDefined(valueEvent, "Dispatcher should emit CurrentValueQueried.");
  const vaultShares = Number(startingVaultBalance + 1_000_000n);
  const usdcValue = valueEvent!.data.value.toNumber();
  // value is USDC-denominated via the Chainlink SYRUPUSDC-USDC exchange-rate
  // feed; the live rate exceeds 1.0, so the USDC value must strictly exceed
  // the raw share count and stay within a sane band.
  assert.isAbove(
    usdcValue,
    vaultShares,
    "USDC value should exceed share count while the syrupUSDC rate > 1.",
  );
  assert.isBelow(
    usdcValue,
    vaultShares * 2,
    "USDC value should stay within a sane multiple of shares.",
  );

  await dispatcher.methods
    .withdraw(new anchor.BN(400_000))
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: mapleAdapter.programId,
      adapterConfig,
      requestedMint: MAPLE_SYRUP_USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .remainingAccounts(withdrawRemainingAccounts(provider.wallet.publicKey, vaultTokenAccount))
    .rpc();

  const afterWithdrawBalance = await tokenAmount(
    provider.connection,
    userSyrupAccount,
  );
  assert.strictEqual(
    afterWithdrawBalance - afterDepositBalance,
    400_000n,
    "Withdraw should return exactly 0.4 syrupUSDC.",
  );

  await dispatcher.methods
    .deposit(new anchor.BN(1))
    .accounts({
      adapterEntry: pendingEntry,
      adapterProgram: mapleAdapter.programId,
      adapterConfig,
      requestedMint: MAPLE_SYRUP_USDC_MINT,
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
      adapterProgram: mapleAdapter.programId,
      adapterConfig,
      requestedMint: MAPLE_SYRUP_USDC_MINT,
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
      adapterProgram: mapleAdapter.programId,
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

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  MARGINFI_IDL,
  instructions as marginfiInstructions,
} from "@mrgnlabs/marginfi-client-v2";

const REGISTRY_CONFIG_SEED = Buffer.from("registry_config");
const ADAPTER_ENTRY_SEED = Buffer.from("adapter_entry");
const MARGINFI_CONFIG_SEED = Buffer.from("marginfi_usdc_config");
const MARGINFI_POSITION_SEED = Buffer.from("marginfi_usdc_position");

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
export const MARGINFI_PROGRAM_ID = new PublicKey(
  "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA",
);
export const MARGINFI_GROUP = new PublicKey(
  "4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8",
);
export const MARGINFI_USDC_BANK = new PublicKey(
  "2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB",
);
export const MARGINFI_USDC_ORACLE = new PublicKey(
  "Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX",
);
export const MARGINFI_USDC_LIQUIDITY_VAULT = new PublicKey(
  "7jaiZR5Sk8hdYN9MxTpczTcwbWpb5WEoxSANuUwveuat",
);
export const MARGINFI_USDC_LIQUIDITY_VAULT_AUTHORITY = new PublicKey(
  "3uxNepDbmkDNq6JhRja5Z8QwbTrfmkKP8AKZV5chYDGG",
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

function findMarginfiAdapterConfigPda(
  adapterProgramId: PublicKey,
  adapterVersion: number,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [MARGINFI_CONFIG_SEED, USDC_MINT.toBuffer(), u16Seed(adapterVersion)],
    adapterProgramId,
  )[0];
}

function findMarginfiAdapterPositionPda(
  adapterProgramId: PublicKey,
  adapterConfig: PublicKey,
  owner: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [MARGINFI_POSITION_SEED, adapterConfig.toBuffer(), owner.toBuffer()],
    adapterProgramId,
  )[0];
}

function getAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
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

async function createMarginfiAccount(
  provider: anchor.AnchorProvider,
): Promise<Keypair> {
  const marginfiAccount = Keypair.generate();
  const marginfiProgram = new anchor.Program(
    { ...MARGINFI_IDL, address: MARGINFI_PROGRAM_ID.toBase58() } as anchor.Idl,
    provider,
  );
  const initializeIx =
    await marginfiInstructions.makeInitMarginfiAccountIx(
      marginfiProgram as any,
      {
        marginfiGroup: MARGINFI_GROUP,
        marginfiAccount: marginfiAccount.publicKey,
        authority: provider.wallet.publicKey,
        feePayer: provider.wallet.publicKey,
      },
    );

  const tx = new Transaction().add(initializeIx);
  await provider.sendAndConfirm(tx, [marginfiAccount]);

  return marginfiAccount;
}

function readI80F48Raw(data: Buffer, offset: number): bigint {
  const low = data.readBigUInt64LE(offset);
  const high = data.readBigInt64LE(offset + 8);
  return (high << 64n) + low;
}

async function readMarginfiAssetShares(
  connection: anchor.web3.Connection,
  marginfiAccount: PublicKey,
): Promise<bigint> {
  const account = await connection.getAccountInfo(marginfiAccount);
  assert.isNotNull(account, "MarginFi account must exist");
  const data = account!.data;

  for (let index = 0; index < 16; index += 1) {
    const offset = 72 + index * 104;
    const active = data[offset] !== 0;
    const bank = new PublicKey(data.subarray(offset + 1, offset + 33));
    if (active && bank.equals(MARGINFI_USDC_BANK)) {
      return readI80F48Raw(data, offset + 40);
    }
  }

  return 0n;
}

async function tokenAmount(
  connection: anchor.web3.Connection,
  tokenAccount: PublicKey,
): Promise<bigint> {
  const balance = await connection.getTokenAccountBalance(tokenAccount);
  return BigInt(balance.value.amount);
}

function depositRemainingAccounts(owner: PublicKey, marginfiAccount: PublicKey) {
  return [
    { pubkey: MARGINFI_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: MARGINFI_GROUP, isWritable: false, isSigner: false },
    { pubkey: marginfiAccount, isWritable: true, isSigner: false },
    { pubkey: MARGINFI_USDC_BANK, isWritable: true, isSigner: false },
    {
      pubkey: getAssociatedTokenAddress(owner, USDC_MINT),
      isWritable: true,
      isSigner: false,
    },
    { pubkey: MARGINFI_USDC_LIQUIDITY_VAULT, isWritable: true, isSigner: false },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
  ];
}

function withdrawRemainingAccounts(
  owner: PublicKey,
  marginfiAccount: PublicKey,
) {
  return [
    { pubkey: MARGINFI_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: MARGINFI_GROUP, isWritable: false, isSigner: false },
    { pubkey: marginfiAccount, isWritable: true, isSigner: false },
    { pubkey: MARGINFI_USDC_BANK, isWritable: true, isSigner: false },
    {
      pubkey: getAssociatedTokenAddress(owner, USDC_MINT),
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: MARGINFI_USDC_LIQUIDITY_VAULT_AUTHORITY,
      isWritable: false,
      isSigner: false,
    },
    { pubkey: MARGINFI_USDC_LIQUIDITY_VAULT, isWritable: true, isSigner: false },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: MARGINFI_USDC_BANK, isWritable: false, isSigner: false },
    { pubkey: MARGINFI_USDC_ORACLE, isWritable: false, isSigner: false },
  ];
}

function valueRemainingAccounts(marginfiAccount: PublicKey) {
  return [
    { pubkey: MARGINFI_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: MARGINFI_GROUP, isWritable: false, isSigner: false },
    { pubkey: marginfiAccount, isWritable: false, isSigner: false },
    { pubkey: MARGINFI_USDC_BANK, isWritable: false, isSigner: false },
  ];
}

export async function runMarginfiUsdcDispatcherFlow(): Promise<void> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const registry = anchor.workspace.Registry as WorkspaceProgram;
  const dispatcher = anchor.workspace.Dispatcher as WorkspaceProgram;
  const marginfiAdapter = anchor.workspace.MarginfiUsdc as WorkspaceProgram;

  const registryConfig = findRegistryConfigPda(registry.programId);
  const approvedVersion = 601;
  const pendingVersion = 602;
  const pausedVersion = 603;

  const approvedEntry = findAdapterEntryPda(
    registry.programId,
    marginfiAdapter.programId,
    USDC_MINT,
    approvedVersion,
  );
  const pendingEntry = findAdapterEntryPda(
    registry.programId,
    marginfiAdapter.programId,
    USDC_MINT,
    pendingVersion,
  );
  const pausedEntry = findAdapterEntryPda(
    registry.programId,
    marginfiAdapter.programId,
    USDC_MINT,
    pausedVersion,
  );

  const adapterConfig = findMarginfiAdapterConfigPda(
    marginfiAdapter.programId,
    approvedVersion,
  );
  const adapterPosition = findMarginfiAdapterPositionPda(
    marginfiAdapter.programId,
    adapterConfig,
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
    marginfiAdapter.programId,
    approvedVersion,
    provider.wallet.publicKey,
    "MarginFi USDC",
  );
  await proposeAdapterIfNeeded(
    registry,
    registryConfig,
    pendingEntry,
    marginfiAdapter.programId,
    pendingVersion,
    provider.wallet.publicKey,
    "MarginFi USDC Pending",
  );
  await proposeAdapterIfNeeded(
    registry,
    registryConfig,
    pausedEntry,
    marginfiAdapter.programId,
    pausedVersion,
    provider.wallet.publicKey,
    "MarginFi USDC Paused",
  );

  const marginfiAccount = await createMarginfiAccount(provider);

  await marginfiAdapter.methods
    .initializeConfig(USDC_MINT, MARGINFI_PROGRAM_ID, approvedVersion)
    .accounts({
      config: adapterConfig,
      authority: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  await marginfiAdapter.methods
    .initializePosition(marginfiAccount.publicKey, MARGINFI_USDC_BANK)
    .accounts({
      config: adapterConfig,
      position: adapterPosition,
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

  const depositAmount = new anchor.BN(1_000_000);
  await dispatcher.methods
    .deposit(depositAmount)
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: marginfiAdapter.programId,
      adapterConfig,
      requestedMint: USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .remainingAccounts(
      depositRemainingAccounts(provider.wallet.publicKey, marginfiAccount.publicKey),
    )
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

  const assetShares = await readMarginfiAssetShares(
    provider.connection,
    marginfiAccount.publicKey,
  );
  assert.isTrue(assetShares > 0n, "MarginFi position should hold USDC shares.");

  const valueSimulation = await dispatcher.methods
    .currentValue()
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: marginfiAdapter.programId,
      adapterConfig,
      requestedMint: USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .remainingAccounts(valueRemainingAccounts(marginfiAccount.publicKey))
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
      adapterProgram: marginfiAdapter.programId,
      adapterConfig,
      requestedMint: USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .remainingAccounts(
      withdrawRemainingAccounts(provider.wallet.publicKey, marginfiAccount.publicKey),
    )
    .rpc();

  const afterWithdrawBalance = await tokenAmount(
    provider.connection,
    userUsdcAccount,
  );
  assert.strictEqual(
    afterWithdrawBalance - afterDepositBalance,
    400_000n,
    "Withdraw should credit exactly 0.4 USDC back to the user token account.",
  );

  await expectAnchorError(
    dispatcher.methods
      .deposit(new anchor.BN(1))
      .accounts({
        adapterEntry: approvedEntry,
        adapterProgram: marginfiAdapter.programId,
        adapterConfig,
        requestedMint: Keypair.generate().publicKey,
        adapterPosition,
        user: provider.wallet.publicKey,
      })
      .rpc(),
    "InvalidMint",
  );

  await expectAnchorError(
    dispatcher.methods
      .deposit(new anchor.BN(1))
      .accounts({
        adapterEntry: pausedEntry,
        adapterProgram: marginfiAdapter.programId,
        adapterConfig,
        requestedMint: USDC_MINT,
        adapterPosition,
        user: provider.wallet.publicKey,
      })
      .rpc(),
    "AdapterPaused",
  );

  await expectAnchorError(
    dispatcher.methods
      .deposit(new anchor.BN(1))
      .accounts({
        adapterEntry: pendingEntry,
        adapterProgram: marginfiAdapter.programId,
        adapterConfig,
        requestedMint: USDC_MINT,
        adapterPosition,
        user: provider.wallet.publicKey,
      })
      .rpc(),
    "AdapterNotApproved",
  );
}

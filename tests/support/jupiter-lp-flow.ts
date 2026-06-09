import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { MessageCompiledInstruction } from "@solana/web3.js";

const REGISTRY_CONFIG_SEED = Buffer.from("registry_config");
const ADAPTER_ENTRY_SEED = Buffer.from("adapter_entry");
const JUPITER_CONFIG_SEED = Buffer.from("jupiter_lp_config");
const JUPITER_POSITION_SEED = Buffer.from("jupiter_lp_position");

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
export const JUPITER_PERPS_PROGRAM_ID = new PublicKey(
  "PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu",
);
const JUPITER_DOVES_PROGRAM_ID = new PublicKey(
  "DoVEsk76QybCEHQGzkvYPWLQu9gzNoZZZt3TPiL597e",
);
const ED25519_PROGRAM_ID = new PublicKey(
  "Ed25519SigVerify111111111111111111111111111",
);
export const JLP_POOL = new PublicKey(
  "5BUwFW4nRbftYTDMbgxykoFWqWHPzahFSNAaaaJtVKsq",
);
export const JLP_MINT = new PublicKey(
  "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4",
);
export const JLP_USDC_CUSTODY = new PublicKey(
  "G18jKKXQwBbrHeiK3C9MRXhkHsLHf7XgCSisykV46EZa",
);
export const JLP_USDC_CUSTODY_TOKEN_ACCOUNT = new PublicKey(
  "WzWUoCmtVv7eqAbU3BfKPU3fhLP6CXR8NCJH78UK9VS",
);
export const JLP_USDC_DOVES_PRICE_ACCOUNT = new PublicKey(
  "A28T5pKtscnhDo6C1Sz786Tup88aTjt8uyKewjVvPrGk",
);
export const JLP_USDC_PYTHNET_PRICE_ACCOUNT = new PublicKey(
  "Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX",
);
export const JLP_SOL_CUSTODY = new PublicKey(
  "7xS2gz2bTp3fwCC7knJvUWTEU9Tycczu6VhJYKgi1wdz",
);
export const JLP_SOL_DOVES_PRICE_ACCOUNT = new PublicKey(
  "39cWjvHrpHNz2SbXv6ME4NPhqBDBd4KsjUYv5JkHEAJU",
);
export const JLP_SOL_PYTHNET_PRICE_ACCOUNT = new PublicKey(
  "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE",
);
export const JLP_SOL_EDGE_PRICE_ACCOUNT = new PublicKey(
  "FYq2BWQ1V5P1WFBqr3qB2Kb5yHVvSv7upzKodgQE5zXh",
);
export const JLP_ETH_CUSTODY = new PublicKey(
  "AQCGyheWPLeo6Qp9WpYS9m3Qj479t7R636N9ey1rEjEn",
);
export const JLP_ETH_DOVES_PRICE_ACCOUNT = new PublicKey(
  "5URYohbPy32nxK1t3jAHVNfdWY2xTubHiFvLrE3VhXEp",
);
export const JLP_ETH_PYTHNET_PRICE_ACCOUNT = new PublicKey(
  "42amVS4KgzR9rA28tkVYqVXjq9Qa8dcZQMbH5EYFX6XC",
);
export const JLP_ETH_EDGE_PRICE_ACCOUNT = new PublicKey(
  "AFZnHPzy4mvVCffrVwhewHbFc93uTHvDSFrVH7GtfXF1",
);
export const JLP_WBTC_CUSTODY = new PublicKey(
  "5Pv3gM9JrFFH883SWAhvJC9RPYmo8UNxuFtv5bMMALkm",
);
export const JLP_WBTC_DOVES_PRICE_ACCOUNT = new PublicKey(
  "4HBbPx9QJdjJ7GUe6bsiJjGybvfpDhQMMPXP1UEa7VT5",
);
export const JLP_WBTC_PYTHNET_PRICE_ACCOUNT = new PublicKey(
  "4cSM2e6rvbGQUFiJbqytoVMi5GgghSMr8LwVrT9VPSPo",
);
export const JLP_WBTC_EDGE_PRICE_ACCOUNT = new PublicKey(
  "hUqAT1KQ7eW1i6Csp9CXYtpPfSAvi835V7wKi5fRfmC",
);
export const JLP_USDT_CUSTODY = new PublicKey(
  "4vkNeXiYEUizLdrpdPS1eC2mccyM4NUPRtERrk6ZETkk",
);
export const JLP_USDT_DOVES_PRICE_ACCOUNT = new PublicKey(
  "AGW7q2a3WxCzh5TB2Q6yNde1Nf41g3HLaaXdybz7cbBU",
);
export const JLP_USDT_PYTHNET_PRICE_ACCOUNT = new PublicKey(
  "HT2PLQBcG5EiCcNSaMHAjSgd9F98ecpATbk4Sk5oYuM",
);
export const JLP_USDC_EDGE_PRICE_ACCOUNT = new PublicKey(
  "6Jp2xZUTWdDD2ZyUPRzeMdc6AFQ5K3pFgZxk2EijfjnM",
);
export const JLP_USDC_DOVES_AG_PRICE_ACCOUNT = JLP_USDC_EDGE_PRICE_ACCOUNT;
export const JLP_USDT_EDGE_PRICE_ACCOUNT = new PublicKey(
  "Fgc93D641F8N2d1xLjQ4jmShuD3GE3BsCXA56KBQbF5u",
);
export const JLP_PERPETUALS = new PublicKey(
  "H4ND9aYttUVLFmNypZqLjZ52FYiGvdEB45GmwNoKEjTj",
);
export const JLP_TRANSFER_AUTHORITY = new PublicKey(
  "AVzP2GeRmqGphJsMxWoqjpUifPpCret7LqWhD8NWQK49",
);
export const JLP_EVENT_AUTHORITY = new PublicKey(
  "37hJBDnntwqhGbK7L6M1bLyvccj4u55CCUiLPdYkiqBN",
);

const DOVES_UPDATE_MANY_WITH_PYTH_LAZER_DISCRIMINATOR = Buffer.from([
  0xcb, 0x3b, 0x5f, 0xb0, 0xec, 0x15, 0x49, 0x99,
]);
const DOVES_UPDATE_AG_PRICE2_DISCRIMINATOR = Buffer.from([
  0x3d, 0x41, 0x3c, 0xe5, 0xeb, 0x8e, 0xfa, 0x75,
]);
const JUPITER_ORACLE_REFRESH_RPC =
  process.env.MAINNET_RPC_URL ?? "https://solana-rpc.publicnode.com";
const JUPITER_ORACLE_REFRESH_SIGNATURE_LIMIT = Number(
  process.env.JUPITER_ORACLE_REFRESH_SIGNATURE_LIMIT ?? "25",
);
const JUPITER_ORACLE_REFRESH_REQUIRED_EDGE_ACCOUNTS = [
  JLP_USDC_EDGE_PRICE_ACCOUNT,
  JLP_SOL_EDGE_PRICE_ACCOUNT,
  JLP_ETH_EDGE_PRICE_ACCOUNT,
  JLP_WBTC_EDGE_PRICE_ACCOUNT,
];

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

function findJupiterAdapterConfigPda(
  adapterProgramId: PublicKey,
  adapterVersion: number,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [JUPITER_CONFIG_SEED, USDC_MINT.toBuffer(), u16Seed(adapterVersion)],
    adapterProgramId,
  )[0];
}

function findJupiterAdapterPositionPda(
  adapterProgramId: PublicKey,
  adapterConfig: PublicKey,
  owner: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [JUPITER_POSITION_SEED, adapterConfig.toBuffer(), owner.toBuffer()],
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
  jupiterAdapter: WorkspaceProgram,
  adapterConfig: PublicKey,
  adapterVersion: number,
  authority: PublicKey,
): Promise<void> {
  const account = await jupiterAdapter.provider.connection.getAccountInfo(
    adapterConfig,
  );
  if (account !== null) {
    return;
  }

  await jupiterAdapter.methods
    .initializeConfig(USDC_MINT, JUPITER_PERPS_PROGRAM_ID, adapterVersion)
    .accounts({
      config: adapterConfig,
      authority,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

async function initializeAdapterPositionIfNeeded(
  jupiterAdapter: WorkspaceProgram,
  adapterConfig: PublicKey,
  adapterPosition: PublicKey,
  owner: PublicKey,
  userJlpTokenAccount: PublicKey,
): Promise<void> {
  const account = await jupiterAdapter.provider.connection.getAccountInfo(
    adapterPosition,
  );
  if (account !== null) {
    return;
  }

  await jupiterAdapter.methods
    .initializePosition(JLP_POOL, JLP_USDC_CUSTODY, userJlpTokenAccount)
    .accounts({
      config: adapterConfig,
      position: adapterPosition,
      owner,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

async function initializeApprovedRouteFast(
  registry: WorkspaceProgram,
  jupiterAdapter: WorkspaceProgram,
  registryConfig: PublicKey,
  adapterEntry: PublicKey,
  adapterConfig: PublicKey,
  adapterPosition: PublicKey,
  adapterVersion: number,
  authority: PublicKey,
  userJlpTokenAccount: PublicKey,
): Promise<void> {
  const instructions: TransactionInstruction[] = [];
  const registryConfigAccount =
    await registry.provider.connection.getAccountInfo(registryConfig);
  if (registryConfigAccount === null) {
    instructions.push(
      await registry.methods
        .initializeRegistry()
        .accounts({
          registryConfig,
          governanceAuthority: authority,
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
    );
  }

  const adapterEntryAccount =
    await registry.provider.connection.getAccountInfo(adapterEntry);
  let shouldApprove = adapterEntryAccount === null;
  if (adapterEntryAccount === null) {
    instructions.push(
      await registry.methods
        .proposeAdapter(
          jupiterAdapter.programId,
          "Jupiter JLP",
          adapterVersion,
          USDC_MINT,
          "https://example.com/adapters/jupiter-jlp.json",
        )
        .accounts({
          registryConfig,
          adapterEntry,
          governanceAuthority: authority,
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
    );
  } else {
    const entry = await registry.account.adapterEntry.fetch(adapterEntry);
    shouldApprove = !hasStatus(entry.status, "approved");
  }

  const adapterConfigAccount =
    await jupiterAdapter.provider.connection.getAccountInfo(adapterConfig);
  if (adapterConfigAccount === null) {
    instructions.push(
      await jupiterAdapter.methods
        .initializeConfig(USDC_MINT, JUPITER_PERPS_PROGRAM_ID, adapterVersion)
        .accounts({
          config: adapterConfig,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
    );
  }

  const adapterPositionAccount =
    await jupiterAdapter.provider.connection.getAccountInfo(adapterPosition);
  if (adapterPositionAccount === null) {
    instructions.push(
      await jupiterAdapter.methods
        .initializePosition(JLP_POOL, JLP_USDC_CUSTODY, userJlpTokenAccount)
        .accounts({
          config: adapterConfig,
          position: adapterPosition,
          owner: authority,
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
    );
  }

  if (shouldApprove) {
    instructions.push(
      await registry.methods
        .approveAdapter()
        .accounts({
          registryConfig,
          adapterEntry,
          governanceAuthority: authority,
        })
        .instruction(),
    );
  }

  if (instructions.length > 0) {
    await (registry.provider as anchor.AnchorProvider).sendAndConfirm(
      new Transaction().add(...instructions),
      [],
    );
  }
}

function depositRemainingAccounts(owner: PublicKey) {
  return [
    { pubkey: JUPITER_PERPS_PROGRAM_ID, isWritable: false, isSigner: false },
    {
      pubkey: getAssociatedTokenAddress(owner, USDC_MINT),
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: getAssociatedTokenAddress(owner, JLP_MINT),
      isWritable: true,
      isSigner: false,
    },
    { pubkey: JLP_TRANSFER_AUTHORITY, isWritable: false, isSigner: false },
    { pubkey: JLP_PERPETUALS, isWritable: false, isSigner: false },
    { pubkey: JLP_POOL, isWritable: true, isSigner: false },
    { pubkey: JLP_USDC_CUSTODY, isWritable: true, isSigner: false },
    { pubkey: JLP_USDC_DOVES_AG_PRICE_ACCOUNT, isWritable: false, isSigner: false },
    { pubkey: JLP_USDC_PYTHNET_PRICE_ACCOUNT, isWritable: false, isSigner: false },
    { pubkey: JLP_USDC_CUSTODY_TOKEN_ACCOUNT, isWritable: true, isSigner: false },
    { pubkey: JLP_MINT, isWritable: true, isSigner: false },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: JLP_EVENT_AUTHORITY, isWritable: false, isSigner: false },
    ...jlpAumRemainingAccounts(),
  ];
}

function withdrawRemainingAccounts(owner: PublicKey) {
  return [
    { pubkey: JUPITER_PERPS_PROGRAM_ID, isWritable: false, isSigner: false },
    {
      pubkey: getAssociatedTokenAddress(owner, USDC_MINT),
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: getAssociatedTokenAddress(owner, JLP_MINT),
      isWritable: true,
      isSigner: false,
    },
    { pubkey: JLP_TRANSFER_AUTHORITY, isWritable: false, isSigner: false },
    { pubkey: JLP_PERPETUALS, isWritable: false, isSigner: false },
    { pubkey: JLP_POOL, isWritable: true, isSigner: false },
    { pubkey: JLP_USDC_CUSTODY, isWritable: true, isSigner: false },
    { pubkey: JLP_USDC_DOVES_AG_PRICE_ACCOUNT, isWritable: false, isSigner: false },
    { pubkey: JLP_USDC_PYTHNET_PRICE_ACCOUNT, isWritable: false, isSigner: false },
    { pubkey: JLP_USDC_CUSTODY_TOKEN_ACCOUNT, isWritable: true, isSigner: false },
    { pubkey: JLP_MINT, isWritable: true, isSigner: false },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: JLP_EVENT_AUTHORITY, isWritable: false, isSigner: false },
    ...jlpAumRemainingAccounts(),
  ];
}

function valueRemainingAccounts(owner: PublicKey) {
  return [
    { pubkey: JLP_POOL, isWritable: false, isSigner: false },
    { pubkey: JLP_USDC_CUSTODY, isWritable: false, isSigner: false },
    {
      pubkey: getAssociatedTokenAddress(owner, JLP_MINT),
      isWritable: false,
      isSigner: false,
    },
    { pubkey: JLP_MINT, isWritable: false, isSigner: false },
  ];
}

function jlpAumRemainingAccounts() {
  return [
    { pubkey: JLP_SOL_CUSTODY, isWritable: false, isSigner: false },
    { pubkey: JLP_ETH_CUSTODY, isWritable: false, isSigner: false },
    { pubkey: JLP_WBTC_CUSTODY, isWritable: false, isSigner: false },
    { pubkey: JLP_USDC_CUSTODY, isWritable: false, isSigner: false },
    { pubkey: JLP_USDT_CUSTODY, isWritable: false, isSigner: false },
    { pubkey: JLP_SOL_EDGE_PRICE_ACCOUNT, isWritable: false, isSigner: false },
    { pubkey: JLP_ETH_EDGE_PRICE_ACCOUNT, isWritable: false, isSigner: false },
    { pubkey: JLP_WBTC_EDGE_PRICE_ACCOUNT, isWritable: false, isSigner: false },
    { pubkey: JLP_USDC_EDGE_PRICE_ACCOUNT, isWritable: false, isSigner: false },
    { pubkey: JLP_USDT_EDGE_PRICE_ACCOUNT, isWritable: false, isSigner: false },
  ];
}

function hasDiscriminator(data: Uint8Array, discriminator: Buffer): boolean {
  const bytes = Buffer.from(data);
  return (
    bytes.length >= discriminator.length &&
    bytes.subarray(0, discriminator.length).equals(discriminator)
  );
}

function accountKeyAt(
  transaction: anchor.web3.VersionedTransactionResponse,
  index: number,
): PublicKey {
  const accountKeys = transaction.transaction.message.getAccountKeys({
    accountKeysFromLookups: transaction.meta?.loadedAddresses,
  });
  const key = accountKeys.get(index);
  if (key === undefined) {
    throw new Error(`Missing account key at message index ${index}.`);
  }
  return key;
}

function compiledInstructionProgramId(
  transaction: anchor.web3.VersionedTransactionResponse,
  instruction: MessageCompiledInstruction,
): PublicKey {
  return accountKeyAt(transaction, instruction.programIdIndex);
}

function compiledInstructionAccounts(
  transaction: anchor.web3.VersionedTransactionResponse,
  instruction: MessageCompiledInstruction,
  localSigner: PublicKey,
) {
  const message = transaction.transaction.message;

  return instruction.accountKeyIndexes.map((index: number) => {
    const isSigner = message.isAccountSigner(index);
    return {
      pubkey: isSigner ? localSigner : accountKeyAt(transaction, index),
      isSigner,
      isWritable: message.isAccountWritable(index),
    };
  });
}

function rebuildCompiledInstruction(
  transaction: anchor.web3.VersionedTransactionResponse,
  instruction: MessageCompiledInstruction,
  localSigner: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: compiledInstructionProgramId(transaction, instruction),
    keys: compiledInstructionAccounts(transaction, instruction, localSigner),
    data: Buffer.from(instruction.data),
  });
}

function edgeAccountsTouchedByInstruction(
  transaction: anchor.web3.VersionedTransactionResponse,
  instruction: MessageCompiledInstruction,
): Set<string> {
  const touched = new Set<string>();

  for (const index of instruction.accountKeyIndexes) {
    const key = accountKeyAt(transaction, index).toBase58();
    if (
      JUPITER_ORACLE_REFRESH_REQUIRED_EDGE_ACCOUNTS.some(
        (required) => required.toBase58() === key,
      )
    ) {
      touched.add(key);
    }
  }

  return touched;
}

async function findRecentDovesRefreshTransaction(
  connection: Connection,
): Promise<{
  transaction: anchor.web3.VersionedTransactionResponse;
  startIndex: number;
  endIndex: number;
}> {
  const signatures = await connection.getSignaturesForAddress(
    JLP_USDC_EDGE_PRICE_ACCOUNT,
    { limit: JUPITER_ORACLE_REFRESH_SIGNATURE_LIMIT },
    "confirmed",
  );

  for (const signatureInfo of signatures) {
    if (signatureInfo.err !== null) {
      continue;
    }

    const transaction = await connection.getTransaction(signatureInfo.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (transaction === null) {
      continue;
    }

    const instructions = transaction.transaction.message.compiledInstructions;
    const updateManyIndex = instructions.findIndex((instruction) => {
      const programId = compiledInstructionProgramId(transaction, instruction);
      return (
        programId.equals(JUPITER_DOVES_PROGRAM_ID) &&
        hasDiscriminator(
          instruction.data,
          DOVES_UPDATE_MANY_WITH_PYTH_LAZER_DISCRIMINATOR,
        )
      );
    });
    if (updateManyIndex <= 0) {
      continue;
    }

    const ed25519Index = updateManyIndex - 1;
    const ed25519Program = compiledInstructionProgramId(
      transaction,
      instructions[ed25519Index],
    );
    if (!ed25519Program.equals(ED25519_PROGRAM_ID)) {
      continue;
    }

    let endIndex = updateManyIndex + 1;
    const touchedEdgeAccounts = new Set<string>();
    while (endIndex < instructions.length) {
      const instruction = instructions[endIndex];
      const programId = compiledInstructionProgramId(transaction, instruction);
      if (
        !programId.equals(JUPITER_DOVES_PROGRAM_ID) ||
        !hasDiscriminator(
          instruction.data,
          DOVES_UPDATE_AG_PRICE2_DISCRIMINATOR,
        )
      ) {
        break;
      }

      for (const edgeAccount of edgeAccountsTouchedByInstruction(
        transaction,
        instruction,
      )) {
        touchedEdgeAccounts.add(edgeAccount);
      }
      endIndex += 1;
    }

    const requiredEdges = JUPITER_ORACLE_REFRESH_REQUIRED_EDGE_ACCOUNTS.map(
      (key) => key.toBase58(),
    );
    if (requiredEdges.every((required) => touchedEdgeAccounts.has(required))) {
      return { transaction, startIndex: ed25519Index, endIndex };
    }
  }

  throw new Error(
    `Unable to find a recent Jupiter Doves oracle refresh transaction touching ${JUPITER_ORACLE_REFRESH_REQUIRED_EDGE_ACCOUNTS.map((key) => key.toBase58()).join(", ")}. Increase JUPITER_ORACLE_REFRESH_SIGNATURE_LIMIT or use a fresher MAINNET_RPC_URL.`,
  );
}

async function refreshJupiterDovesOracles(
  provider: anchor.AnchorProvider,
): Promise<void> {
  // TODO_INTEGRATION: Mainnet Doves replay is diagnostic-only for now. The
  // Doves program verifies the signed Pyth Lazer payload against the original
  // keeper signer, so replacing that signer with the local fork wallet fails
  // with Doves InvalidSigner(6006). Leave this opt-in until an official public
  // Jupiter/Doves oracle-refresh path is available.
  if (
    process.env.SKIP_JUPITER_ORACLE_REFRESH === "1" ||
    process.env.JUPITER_ORACLE_REFRESH_MODE !== "doves-replay"
  ) {
    return;
  }

  const mainnetConnection = new Connection(
    JUPITER_ORACLE_REFRESH_RPC,
    "confirmed",
  );
  const { transaction, startIndex, endIndex } =
    await findRecentDovesRefreshTransaction(mainnetConnection);
  const sourceInstructions = transaction.transaction.message.compiledInstructions;
  const pythLazerRefreshInstructions: TransactionInstruction[] = [];
  for (let index = 0; index < startIndex; index += 1) {
    const programId = compiledInstructionProgramId(
      transaction,
      sourceInstructions[index],
    );
    if (!programId.equals(ComputeBudgetProgram.programId)) {
      throw new Error(
        `Unexpected Jupiter oracle-refresh prefix instruction ${programId.toBase58()} before Ed25519 verifier.`,
      );
    }
    pythLazerRefreshInstructions.push(
      rebuildCompiledInstruction(
        transaction,
        sourceInstructions[index],
        provider.wallet.publicKey,
      ),
    );
  }
  pythLazerRefreshInstructions.push(
    rebuildCompiledInstruction(
      transaction,
      sourceInstructions[startIndex],
      provider.wallet.publicKey,
    ),
    rebuildCompiledInstruction(
      transaction,
      sourceInstructions[startIndex + 1],
      provider.wallet.publicKey,
    ),
  );

  await provider.sendAndConfirm(
    new Transaction().add(...pythLazerRefreshInstructions),
    [],
  );

  for (let index = startIndex + 2; index < endIndex; index += 1) {
    await provider.sendAndConfirm(
      new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        rebuildCompiledInstruction(
          transaction,
          sourceInstructions[index],
          provider.wallet.publicKey,
        ),
      ),
      [],
    );
  }
}

export async function runJupiterLpDispatcherFlow(): Promise<void> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const registry = anchor.workspace.Registry as WorkspaceProgram;
  const dispatcher = anchor.workspace.Dispatcher as WorkspaceProgram;
  const jupiterAdapter = anchor.workspace.JupiterLp as WorkspaceProgram;

  const registryConfig = findRegistryConfigPda(registry.programId);
  const approvedVersion = 901;
  const pendingVersion = 902;
  const pausedVersion = 903;
  const approvedEntry = findAdapterEntryPda(
    registry.programId,
    jupiterAdapter.programId,
    USDC_MINT,
    approvedVersion,
  );
  const pendingEntry = findAdapterEntryPda(
    registry.programId,
    jupiterAdapter.programId,
    USDC_MINT,
    pendingVersion,
  );
  const pausedEntry = findAdapterEntryPda(
    registry.programId,
    jupiterAdapter.programId,
    USDC_MINT,
    pausedVersion,
  );
  const adapterConfig = findJupiterAdapterConfigPda(
    jupiterAdapter.programId,
    approvedVersion,
  );
  const adapterPosition = findJupiterAdapterPositionPda(
    jupiterAdapter.programId,
    adapterConfig,
    provider.wallet.publicKey,
  );
  const userUsdcAccount = getAssociatedTokenAddress(
    provider.wallet.publicKey,
    USDC_MINT,
  );
  const userJlpAccount = getAssociatedTokenAddress(
    provider.wallet.publicKey,
    JLP_MINT,
  );

  await createAtaIfNeeded(
    provider,
    userJlpAccount,
    provider.wallet.publicKey,
    JLP_MINT,
  );

  const startingUsdc = await tokenAmount(provider.connection, userUsdcAccount);
  assert.isAtLeast(
    Number(startingUsdc),
    2_000_000,
    "Fork wallet needs at least 2 USDC in its preloaded USDC token account.",
  );
  const startingJlp = await tokenAmount(provider.connection, userJlpAccount);

  await initializeApprovedRouteFast(
    registry,
    jupiterAdapter,
    registryConfig,
    approvedEntry,
    adapterConfig,
    adapterPosition,
    approvedVersion,
    provider.wallet.publicKey,
    userJlpAccount,
  );

  await refreshJupiterDovesOracles(provider);

  await dispatcher.methods
    .deposit(new anchor.BN(1_000_000))
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: jupiterAdapter.programId,
      adapterConfig,
      requestedMint: USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .remainingAccounts(depositRemainingAccounts(provider.wallet.publicKey))
    .rpc();

  const afterDepositUsdc = await tokenAmount(provider.connection, userUsdcAccount);
  assert.strictEqual(
    startingUsdc - afterDepositUsdc,
    1_000_000n,
    "Jupiter JLP deposit should debit exactly 1 USDC.",
  );
  const afterDepositJlp = await tokenAmount(provider.connection, userJlpAccount);
  assert.isAbove(
    Number(afterDepositJlp - startingJlp),
    0,
    "Jupiter JLP deposit should mint JLP shares.",
  );

  const valueSimulation = await dispatcher.methods
    .currentValue()
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: jupiterAdapter.programId,
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

  await refreshJupiterDovesOracles(provider);

  await dispatcher.methods
    .withdraw(new anchor.BN(400_000))
    .accounts({
      adapterEntry: approvedEntry,
      adapterProgram: jupiterAdapter.programId,
      adapterConfig,
      requestedMint: USDC_MINT,
      adapterPosition,
      user: provider.wallet.publicKey,
    })
    .remainingAccounts(withdrawRemainingAccounts(provider.wallet.publicKey))
    .rpc();

  const afterWithdrawUsdc = await tokenAmount(provider.connection, userUsdcAccount);
  assert.isAtLeast(
    Number(afterWithdrawUsdc - afterDepositUsdc),
    400_000,
    "Jupiter JLP withdraw should return at least the requested USDC amount.",
  );

  await proposeAdapterIfNeeded(
    registry,
    registryConfig,
    pendingEntry,
    jupiterAdapter.programId,
    pendingVersion,
    provider.wallet.publicKey,
    "Jupiter JLP Pending",
  );
  await proposeAdapterIfNeeded(
    registry,
    registryConfig,
    pausedEntry,
    jupiterAdapter.programId,
    pausedVersion,
    provider.wallet.publicKey,
    "Jupiter JLP Paused",
  );
  await pauseAdapterIfNeeded(
    registry,
    registryConfig,
    pausedEntry,
    provider.wallet.publicKey,
  );

  await dispatcher.methods
    .deposit(new anchor.BN(1))
    .accounts({
      adapterEntry: pendingEntry,
      adapterProgram: jupiterAdapter.programId,
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
      adapterProgram: jupiterAdapter.programId,
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
      adapterProgram: jupiterAdapter.programId,
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

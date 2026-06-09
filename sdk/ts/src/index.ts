import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  AccountMeta,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

export const REGISTRY_CONFIG_SEED = Buffer.from("registry_config");
export const ADAPTER_ENTRY_SEED = Buffer.from("adapter_entry");

export type AnchorMethodBuilder = {
  accounts(accounts: Record<string, PublicKey>): AnchorMethodBuilder;
  remainingAccounts(accounts: AccountMeta[]): AnchorMethodBuilder;
  rpc(): Promise<string>;
  simulate(): Promise<AnchorSimulationResult>;
};

export type AnchorProgram = Program<anchor.Idl> & {
  methods: Record<string, (...args: any[]) => AnchorMethodBuilder>;
};

export type AnchorSimulationResult = {
  events?: ReadonlyArray<{
    name: string;
    data: Record<string, unknown>;
  }>;
  raw?: unknown;
};

export type AdapterRegistrationParams = {
  registryProgram: AnchorProgram;
  adapterProgramId: PublicKey;
  protocolName: string;
  adapterVersion: number;
  supportedMint: PublicKey;
  metadataUri: string;
  governanceAuthority?: PublicKey;
};

export type RegistryActionParams = {
  registryProgram: AnchorProgram;
  adapterEntry: PublicKey;
  governanceAuthority?: PublicKey;
};

export type UpdateAdapterMetadataParams = RegistryActionParams & {
  metadataUri: string;
};

export type TransferGovernanceParams = {
  registryProgram: AnchorProgram;
  newGovernanceAuthority: PublicKey;
  governanceAuthority?: PublicKey;
};

export type DispatcherRouteParams = {
  dispatcherProgram: AnchorProgram;
  adapterEntry: PublicKey;
  adapterProgram: PublicKey;
  adapterConfig: PublicKey;
  requestedMint: PublicKey;
  adapterPosition: PublicKey;
  user?: PublicKey;
  remainingAccounts?: AccountMeta[];
};

export type DispatcherAmountRouteParams = DispatcherRouteParams & {
  amount: BN | bigint | number | string;
};

export type RegistryInstructionResult = {
  signature: string;
  registryConfig: PublicKey;
};

export type AdapterEntryInstructionResult = RegistryInstructionResult & {
  adapterEntry: PublicKey;
};

export type DispatcherInstructionResult = {
  signature: string;
};

export type DispatcherCurrentValueResult = {
  value: bigint;
  simulation: AnchorSimulationResult;
};

export function deriveRegistryConfigPda(
  registryProgramId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [REGISTRY_CONFIG_SEED],
    registryProgramId,
  );
}

export function deriveAdapterEntryPda(
  registryProgramId: PublicKey,
  adapterProgramId: PublicKey,
  supportedMint: PublicKey,
  adapterVersion: number,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      ADAPTER_ENTRY_SEED,
      adapterProgramId.toBuffer(),
      supportedMint.toBuffer(),
      u16LeBytes(adapterVersion),
    ],
    registryProgramId,
  );
}

export async function initializeRegistry(
  registryProgram: AnchorProgram,
  governanceAuthority = providerWallet(registryProgram).publicKey,
): Promise<RegistryInstructionResult> {
  const [registryConfig] = deriveRegistryConfigPda(registryProgram.programId);
  const signature = await registryProgram.methods
    .initializeRegistry()
    .accounts({
      registryConfig,
      governanceAuthority,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { signature, registryConfig };
}

export async function proposeAdapter({
  registryProgram,
  adapterProgramId,
  protocolName,
  adapterVersion,
  supportedMint,
  metadataUri,
  governanceAuthority = providerWallet(registryProgram).publicKey,
}: AdapterRegistrationParams): Promise<AdapterEntryInstructionResult> {
  const [registryConfig] = deriveRegistryConfigPda(registryProgram.programId);
  const [adapterEntry] = deriveAdapterEntryPda(
    registryProgram.programId,
    adapterProgramId,
    supportedMint,
    adapterVersion,
  );
  const signature = await registryProgram.methods
    .proposeAdapter(
      adapterProgramId,
      protocolName,
      adapterVersion,
      supportedMint,
      metadataUri,
    )
    .accounts({
      registryConfig,
      adapterEntry,
      governanceAuthority,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { signature, registryConfig, adapterEntry };
}

export async function approveAdapter(
  params: RegistryActionParams,
): Promise<AdapterEntryInstructionResult> {
  return governAdapter("approveAdapter", params);
}

export async function pauseAdapter(
  params: RegistryActionParams,
): Promise<AdapterEntryInstructionResult> {
  return governAdapter("pauseAdapter", params);
}

export async function unpauseAdapter(
  params: RegistryActionParams,
): Promise<AdapterEntryInstructionResult> {
  return governAdapter("unpauseAdapter", params);
}

export async function deprecateAdapter(
  params: RegistryActionParams,
): Promise<AdapterEntryInstructionResult> {
  return governAdapter("deprecateAdapter", params);
}

export async function updateAdapterMetadata({
  registryProgram,
  adapterEntry,
  metadataUri,
  governanceAuthority = providerWallet(registryProgram).publicKey,
}: UpdateAdapterMetadataParams): Promise<AdapterEntryInstructionResult> {
  const [registryConfig] = deriveRegistryConfigPda(registryProgram.programId);
  const signature = await registryProgram.methods
    .updateAdapterMetadata(metadataUri)
    .accounts({
      registryConfig,
      adapterEntry,
      governanceAuthority,
    })
    .rpc();

  return { signature, registryConfig, adapterEntry };
}

export async function transferGovernance({
  registryProgram,
  newGovernanceAuthority,
  governanceAuthority = providerWallet(registryProgram).publicKey,
}: TransferGovernanceParams): Promise<RegistryInstructionResult> {
  const [registryConfig] = deriveRegistryConfigPda(registryProgram.programId);
  const signature = await registryProgram.methods
    .transferGovernance(newGovernanceAuthority)
    .accounts({
      registryConfig,
      governanceAuthority,
    })
    .rpc();

  return { signature, registryConfig };
}

export async function dispatcherDeposit(
  params: DispatcherAmountRouteParams,
): Promise<DispatcherInstructionResult> {
  return dispatcherAmountRoute("deposit", params);
}

export async function dispatcherWithdraw(
  params: DispatcherAmountRouteParams,
): Promise<DispatcherInstructionResult> {
  return dispatcherAmountRoute("withdraw", params);
}

export async function dispatcherCurrentValue(
  params: DispatcherRouteParams,
): Promise<DispatcherCurrentValueResult> {
  const simulation = await routeBuilder(params.dispatcherProgram, "currentValue", params)
    .simulate();
  const value = currentValueFromSimulation(simulation);

  return { value, simulation };
}

function u16LeBytes(value: number): Buffer {
  if (!Number.isInteger(value) || value < 0 || value > 65_535) {
    throw new Error(`adapterVersion must be a u16, received ${value}.`);
  }
  const seed = Buffer.alloc(2);
  seed.writeUInt16LE(value);
  return seed;
}

function providerWallet(program: AnchorProgram): anchor.Wallet {
  const provider = program.provider as anchor.AnchorProvider;
  if (provider.wallet === undefined) {
    throw new Error("Program provider does not expose an Anchor wallet.");
  }
  return provider.wallet as anchor.Wallet;
}

async function governAdapter(
  methodName: "approveAdapter" | "pauseAdapter" | "unpauseAdapter" | "deprecateAdapter",
  {
    registryProgram,
    adapterEntry,
    governanceAuthority = providerWallet(registryProgram).publicKey,
  }: RegistryActionParams,
): Promise<AdapterEntryInstructionResult> {
  const [registryConfig] = deriveRegistryConfigPda(registryProgram.programId);
  const signature = await registryProgram.methods[methodName]()
    .accounts({
      registryConfig,
      adapterEntry,
      governanceAuthority,
    })
    .rpc();

  return { signature, registryConfig, adapterEntry };
}

async function dispatcherAmountRoute(
  methodName: "deposit" | "withdraw",
  params: DispatcherAmountRouteParams,
): Promise<DispatcherInstructionResult> {
  const signature = await routeBuilder(
    params.dispatcherProgram,
    methodName,
    params,
    toBn(params.amount),
  ).rpc();

  return { signature };
}

function routeBuilder(
  dispatcherProgram: AnchorProgram,
  methodName: "deposit" | "withdraw" | "currentValue",
  {
    adapterEntry,
    adapterProgram,
    adapterConfig,
    requestedMint,
    adapterPosition,
    user = providerWallet(dispatcherProgram).publicKey,
    remainingAccounts = [],
  }: DispatcherRouteParams,
  amount?: BN,
): AnchorMethodBuilder {
  const method =
    amount === undefined
      ? dispatcherProgram.methods[methodName]()
      : dispatcherProgram.methods[methodName](amount);

  return method
    .accounts({
      adapterEntry,
      adapterProgram,
      adapterConfig,
      requestedMint,
      adapterPosition,
      user,
    })
    .remainingAccounts(remainingAccounts) as AnchorMethodBuilder;
}

function toBn(value: BN | bigint | number | string): BN {
  if (BN.isBN(value)) {
    return value;
  }
  return new BN(value.toString());
}

function currentValueFromSimulation(simulation: AnchorSimulationResult): bigint {
  const event = simulation.events?.find(
    (candidate) => candidate.name === "CurrentValueQueried",
  );
  const value = event?.data.value;
  if (value === undefined || value === null) {
    throw new Error("CurrentValueQueried event was not found in simulation.");
  }
  if (BN.isBN(value)) {
    return BigInt(value.toString());
  }
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" || typeof value === "string") {
    return BigInt(value);
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    return BigInt(value.toString());
  }

  throw new Error("CurrentValueQueried event value has an unsupported type.");
}

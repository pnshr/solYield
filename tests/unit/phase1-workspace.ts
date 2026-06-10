import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { describeWithValidator } from "../support/validator-suite";

const ADAPTER_CONFIG_SEED = Buffer.from("adapter_config");

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

describeWithValidator("phase 1 workspace", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  it("calls dispatcher initialize", async () => {
    const dispatcher = anchor.workspace.Dispatcher as anchor.Program;

    const signature = await dispatcher.methods
      .initialize()
      .accounts({
        authority: provider.wallet.publicKey,
      })
      .rpc();

    assert.isString(signature);
  });

  it("calls adapter template initialize_adapter", async () => {
    const adapterTemplate = anchor.workspace.AdapterTemplate as anchor.Program;
    const supportedMint = Keypair.generate().publicKey;
    const protocolProgramId = Keypair.generate().publicKey;
    const version = 1;
    const adapterConfig = findAdapterConfigPda(
      adapterTemplate.programId,
      supportedMint,
      version,
    );

    const signature = await adapterTemplate.methods
      .initializeAdapter(supportedMint, protocolProgramId, version)
      .accounts({
        adapterConfig,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    assert.isString(signature);
  });
});

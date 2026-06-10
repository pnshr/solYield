// Reproducible evidence for the Jupiter fork blocker (see
// docs/MAINNET_FORK_TEST_RESULTS.md, "Jupiter: current blocker").
//
// Probes whether Doves UpdateAgPrice2 is permissionless on a running fork:
//   RPC=http://127.0.0.1:8899 WALLET=<keypair.json> node scripts/probe-jupiter-keeper-gate.js
// Expected output on an unmodified fork: InvalidSigner (6006) thrown at
// doves/src/contexts/update_ag_price2.rs:32 for both feeds, proving the
// oracle refresh path is keeper-gated.
// Sends the 8-byte instruction with the fork wallet as the only signer,
// mirroring the account pattern observed in real mainnet keeper txs:
//   [signer, edge/ag price account (w), doves-lazer account, redstone-doves account, redstone feed]
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const { readFileSync } = require("fs");

const DOVES = new PublicKey("DoVEsk76QybCEHQGzkvYPWLQu9gzNoZZZt3TPiL597e");
const DISC_UPDATE_AG_PRICE2 = Buffer.from([61, 65, 60, 229, 235, 142, 250, 117]);

const SETS = {
  usdc: {
    edge: "6Jp2xZUTWdDD2ZyUPRzeMdc6AFQ5K3pFgZxk2EijfjnM",
    lazer: "G4kGyw5c4mMv8PuPotHnBuqP82s2d54Hd8sfKfW4jpjA",
    redstoneDoves: "3Z4gQ5ujXZSYeVyPhkakVcrmyMxhAk6VT2NYSVV3RGGU",
    redstoneFeed: "6sX9HsaAPhAT1MCskQFTjreuNCqFgkJWKJ4hfdvTbJET",
  },
  sol: {
    edge: "FYq2BWQ1V5P1WFBqr3qB2Kb5yHVvSv7upzKodgQE5zXh",
    lazer: "A5d4aY4K4BYEtXdAY7WNBHTKxRMeyAA6RYHWVYEW22Fe",
    redstoneDoves: "FWLXDDgW2Qm2VuX8MdV99VYpo6X1HLEykUjfAsjz2G78",
    redstoneFeed: "9FboGHATJTgJA7fzG3fKeV1VuLqDsV5HtCGUR2PqZor3",
  },
};

async function main() {
  const conn = new Connection(process.env.RPC ?? "http://127.0.0.1:8899", "confirmed");
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(process.env.WALLET, "utf8"))),
  );
  for (const [name, s] of Object.entries(SETS)) {
    const ix = new TransactionInstruction({
      programId: DOVES,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: new PublicKey(s.edge), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(s.lazer), isSigner: false, isWritable: false },
        { pubkey: new PublicKey(s.redstoneDoves), isSigner: false, isWritable: false },
        { pubkey: new PublicKey(s.redstoneFeed), isSigner: false, isWritable: false },
      ],
      data: DISC_UPDATE_AG_PRICE2,
    });
    try {
      const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [wallet], {
        commitment: "confirmed",
      });
      console.log(name, "UpdateAgPrice2 OK:", sig.slice(0, 20));
    } catch (e) {
      const logs = e.transactionLogs ?? e.logs ?? [];
      console.log(name, "FAILED:", String(e.transactionMessage ?? e.message).slice(0, 140));
      for (const l of logs.slice(0, 6)) console.log("   ", l);
    }
  }
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});

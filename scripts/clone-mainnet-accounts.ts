import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
const MARGINFI_PROGRAM_ID = new PublicKey(
  "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA",
);
const MARGINFI_GROUP = new PublicKey(
  "4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8",
);
const MARGINFI_USDC_BANK = new PublicKey(
  "2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB",
);
const MARGINFI_USDC_ORACLE = new PublicKey(
  "Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX",
);
const MARGINFI_USDC_LIQUIDITY_VAULT = new PublicKey(
  "7jaiZR5Sk8hdYN9MxTpczTcwbWpb5WEoxSANuUwveuat",
);

const KAMINO_KLEND_PROGRAM_ID = new PublicKey(
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
);
const KAMINO_MAIN_MARKET = new PublicKey(
  "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
);
const KAMINO_MAIN_USDC_RESERVE = new PublicKey(
  "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
);
const KAMINO_USDC_LIQUIDITY_SUPPLY = new PublicKey(
  "Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6",
);
const KAMINO_USDC_COLLATERAL_MINT = new PublicKey(
  "B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D",
);

const JUPITER_JLP_MINT = new PublicKey(
  "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4",
);
const JUPITER_PERPS_PROGRAM_ID = new PublicKey(
  "PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu",
);
const JUPITER_DOVES_PROGRAM_ID = new PublicKey(
  "DoVEsk76QybCEHQGzkvYPWLQu9gzNoZZZt3TPiL597e",
);
const PYTH_LAZER_PROGRAM_ID = new PublicKey(
  "pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt",
);
const PYTH_LAZER_FEED_ACCOUNT = new PublicKey(
  "3rdJbqfnagQ4yx9HXJViD4zc4xpiSqmFsKpPuSCQVyQL",
);
const PYTH_LAZER_TREASURY_ACCOUNT = new PublicKey(
  "Gx4MBPb1vqZLJajZmsKLg8fGw9ErhoKsR8LeKcCKFyak",
);
const JUPITER_JLP_POOL = new PublicKey(
  "5BUwFW4nRbftYTDMbgxykoFWqWHPzahFSNAaaaJtVKsq",
);
const JUPITER_JLP_USDC_CUSTODY = new PublicKey(
  "G18jKKXQwBbrHeiK3C9MRXhkHsLHf7XgCSisykV46EZa",
);
const JUPITER_JLP_USDC_CUSTODY_TOKEN_ACCOUNT = new PublicKey(
  "WzWUoCmtVv7eqAbU3BfKPU3fhLP6CXR8NCJH78UK9VS",
);
const JUPITER_JLP_USDC_DOVES_PRICE_ACCOUNT = new PublicKey(
  "A28T5pKtscnhDo6C1Sz786Tup88aTjt8uyKewjVvPrGk",
);
const JUPITER_JLP_USDC_PYTHNET_PRICE_ACCOUNT = new PublicKey(
  "Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX",
);
const JUPITER_JLP_SOL_CUSTODY = new PublicKey(
  "7xS2gz2bTp3fwCC7knJvUWTEU9Tycczu6VhJYKgi1wdz",
);
const JUPITER_JLP_SOL_DOVES_PRICE_ACCOUNT = new PublicKey(
  "39cWjvHrpHNz2SbXv6ME4NPhqBDBd4KsjUYv5JkHEAJU",
);
const JUPITER_JLP_SOL_PYTHNET_PRICE_ACCOUNT = new PublicKey(
  "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE",
);
const JUPITER_JLP_SOL_EDGE_PRICE_ACCOUNT = new PublicKey(
  "FYq2BWQ1V5P1WFBqr3qB2Kb5yHVvSv7upzKodgQE5zXh",
);
const JUPITER_JLP_ETH_CUSTODY = new PublicKey(
  "AQCGyheWPLeo6Qp9WpYS9m3Qj479t7R636N9ey1rEjEn",
);
const JUPITER_JLP_ETH_DOVES_PRICE_ACCOUNT = new PublicKey(
  "5URYohbPy32nxK1t3jAHVNfdWY2xTubHiFvLrE3VhXEp",
);
const JUPITER_JLP_ETH_PYTHNET_PRICE_ACCOUNT = new PublicKey(
  "42amVS4KgzR9rA28tkVYqVXjq9Qa8dcZQMbH5EYFX6XC",
);
const JUPITER_JLP_ETH_EDGE_PRICE_ACCOUNT = new PublicKey(
  "AFZnHPzy4mvVCffrVwhewHbFc93uTHvDSFrVH7GtfXF1",
);
const JUPITER_JLP_WBTC_CUSTODY = new PublicKey(
  "5Pv3gM9JrFFH883SWAhvJC9RPYmo8UNxuFtv5bMMALkm",
);
const JUPITER_JLP_WBTC_DOVES_PRICE_ACCOUNT = new PublicKey(
  "4HBbPx9QJdjJ7GUe6bsiJjGybvfpDhQMMPXP1UEa7VT5",
);
const JUPITER_JLP_WBTC_PYTHNET_PRICE_ACCOUNT = new PublicKey(
  "4cSM2e6rvbGQUFiJbqytoVMi5GgghSMr8LwVrT9VPSPo",
);
const JUPITER_JLP_WBTC_EDGE_PRICE_ACCOUNT = new PublicKey(
  "hUqAT1KQ7eW1i6Csp9CXYtpPfSAvi835V7wKi5fRfmC",
);
const JUPITER_JLP_USDT_CUSTODY = new PublicKey(
  "4vkNeXiYEUizLdrpdPS1eC2mccyM4NUPRtERrk6ZETkk",
);
const JUPITER_JLP_USDT_DOVES_PRICE_ACCOUNT = new PublicKey(
  "AGW7q2a3WxCzh5TB2Q6yNde1Nf41g3HLaaXdybz7cbBU",
);
const JUPITER_JLP_USDT_PYTHNET_PRICE_ACCOUNT = new PublicKey(
  "HT2PLQBcG5EiCcNSaMHAjSgd9F98ecpATbk4Sk5oYuM",
);
const JUPITER_JLP_USDC_EDGE_PRICE_ACCOUNT = new PublicKey(
  "6Jp2xZUTWdDD2ZyUPRzeMdc6AFQ5K3pFgZxk2EijfjnM",
);
const JUPITER_JLP_USDC_AG_DOVES_PRICE_ACCOUNT = JUPITER_JLP_USDC_EDGE_PRICE_ACCOUNT;
const JUPITER_JLP_USDT_EDGE_PRICE_ACCOUNT = new PublicKey(
  "Fgc93D641F8N2d1xLjQ4jmShuD3GE3BsCXA56KBQbF5u",
);
const JUPITER_DOVES_WBTC_PYTH_LAZER_PRICE_ACCOUNT = new PublicKey(
  "FxSvTMvZS9S1jjjixHPh7QEn99WuVWaEHqvw8NqfWmB8",
);
const JUPITER_DOVES_ETH_PYTH_LAZER_PRICE_ACCOUNT = new PublicKey(
  "9QEL8K51uZrqoqTp6Zfjmr65gYqvivVrd2Yg5bo6joGV",
);
const JUPITER_DOVES_SOL_PYTH_LAZER_PRICE_ACCOUNT = new PublicKey(
  "A5d4aY4K4BYEtXdAY7WNBHTKxRMeyAA6RYHWVYEW22Fe",
);
const JUPITER_DOVES_USDC_PYTH_LAZER_PRICE_ACCOUNT = new PublicKey(
  "G4kGyw5c4mMv8PuPotHnBuqP82s2d54Hd8sfKfW4jpjA",
);
const JUPITER_DOVES_WBTC_REDSTONE_PRICE_ACCOUNT = new PublicKey(
  "A6F8mvoM8Qc9wTaKjrD1B5Fgpp6NhPQyJLWXeafWrbsV",
);
const JUPITER_REDSTONE_WBTC_FEED_ACCOUNT = new PublicKey(
  "74o5fhuMC33HgfUqvv2TdpYiKvEWfcRTS1E8zxK6ESjN",
);
const JUPITER_DOVES_ETH_REDSTONE_PRICE_ACCOUNT = new PublicKey(
  "BNQzYvnidN8vVVn78xh6wgLo5ozmV8Dx8AE8rndqeLEe",
);
const JUPITER_REDSTONE_ETH_FEED_ACCOUNT = new PublicKey(
  "HPmPoq3eUTPePsDB5U4G6msu5RpeZHhMemc5VnqxQ9Lx",
);
const JUPITER_DOVES_SOL_REDSTONE_PRICE_ACCOUNT = new PublicKey(
  "FWLXDDgW2Qm2VuX8MdV99VYpo6X1HLEykUjfAsjz2G78",
);
const JUPITER_REDSTONE_SOL_FEED_ACCOUNT = new PublicKey(
  "9FboGHATJTgJA7fzG3fKeV1VuLqDsV5HtCGUR2PqZor3",
);
const JUPITER_DOVES_USDC_REDSTONE_PRICE_ACCOUNT = new PublicKey(
  "3Z4gQ5ujXZSYeVyPhkakVcrmyMxhAk6VT2NYSVV3RGGU",
);
const JUPITER_REDSTONE_USDC_FEED_ACCOUNT = new PublicKey(
  "6sX9HsaAPhAT1MCskQFTjreuNCqFgkJWKJ4hfdvTbJET",
);
const JUPITER_JLP_PERPETUALS = new PublicKey(
  "H4ND9aYttUVLFmNypZqLjZ52FYiGvdEB45GmwNoKEjTj",
);
const JUPITER_JLP_TRANSFER_AUTHORITY = new PublicKey(
  "AVzP2GeRmqGphJsMxWoqjpUifPpCret7LqWhD8NWQK49",
);

const MAPLE_SYRUP_USDC_MINT = new PublicKey(
  "AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj",
);
const MAPLE_SYRUP_CCIP_ROUTER = new PublicKey(
  "Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C",
);
const MAPLE_SYRUP_CCIP_POOL = new PublicKey(
  "HrTBpF3LqSxXnjnYdR4htnBLyMHNZ6eNaDZGPundvHbm",
);
const MAPLE_SYRUP_USDC_ORACLE = new PublicKey(
  "CpNyiFt84q66665Kx64bobxZuMgZ2EecrhAJs1HikS2T",
);

const DRIFT_PROGRAM_ID = new PublicKey(
  "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
);
const DRIFT_STATE = new PublicKey(
  "5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN",
);
const DRIFT_USDC_SPOT_MARKET = new PublicKey(
  "6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3",
);
const DRIFT_USDC_SPOT_VAULT = new PublicKey(
  "GXWqPpjQpdz7KZw9p7f5PX2eGxHAhvpNXiviFkAB8zXg",
);
const DRIFT_USDC_INSURANCE_FUND_VAULT = new PublicKey(
  "2CqkQvYxp9Mq4PqLvAQ1eryYxebUh4Liyn5YMDtXsYci",
);
const DRIFT_USDC_ORACLE = new PublicKey(
  "9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV",
);

const DISPATCHER_PROGRAM_ID = new PublicKey(
  "FEKsMuAAp5Z6oxzsRkQLvHbMpvxJzVcV5JmGFD9KSC2A",
);
const REGISTRY_PROGRAM_ID = new PublicKey(
  "HiLF1P7LguVyBbzMSN3hK4ErGxfxaS6TMPbR6R73Dtdn",
);
const KAMINO_ADAPTER_PROGRAM_ID = new PublicKey(
  "G4g2RMwZs2dH2sVe3ChQ4VpM2DNZu8EESdRyHTc3P9T4",
);
const MARGINFI_ADAPTER_PROGRAM_ID = new PublicKey(
  "ZZcKiv9h3ACNoXubmys1zWY9yFTjif6x6tb3Us4voyr",
);
const JUPITER_ADAPTER_PROGRAM_ID = new PublicKey(
  "daJFQSrSNB3zApEGUjZuWEXnVhM2vmjpDptc1cG9s6D",
);
const MAPLE_ADAPTER_PROGRAM_ID = new PublicKey(
  "CnAVx7eyK1MZdkQVAWZMVE9B9aXFcxKmv8bS8dEpgvsC",
);
const DRIFT_ADAPTER_PROGRAM_ID = new PublicKey(
  "mWDRjDXGpQupue6j74cdWJD7BJ1XygdaxU7vc52BLve",
);

const DEFAULT_FIXTURE_SOL_LAMPORTS = 100_000_000_000n;
const DEFAULT_FIXTURE_USDC_AMOUNT = 1_000_000_000n;
const DEFAULT_FIXTURE_SYRUP_AMOUNT = 1_000_000_000n;
const DEFAULT_FORK_WARP_SLOT = "500000000";
const TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280n;
const FIXTURE_DIR = ".mainnet-fork-fixtures";

type AdapterId = "kamino" | "marginfi" | "jupiter" | "maple" | "drift";
type AdapterTarget = AdapterId | "all";
type CloneKind = "account" | "upgradeable-program";

type CloneAccount = {
  label: string;
  address: PublicKey;
  kind: CloneKind;
  reason: string;
};

type PrefetchedAccountFixture = {
  account: CloneAccount;
  fixturePath: string;
};

type LocalProgram = {
  label: string;
  programId: PublicKey;
  soPath: string;
};

type AdapterClonePlan = {
  displayName: string;
  status: "runnable" | "blocked";
  cloneAccounts: CloneAccount[];
  requiresFundedSol: boolean;
  requiresFundedUsdc: boolean;
  requiresFundedSyrup: boolean;
  notes: string;
};

const sharedLocalPrograms: LocalProgram[] = [
  {
    label: "dispatcher",
    programId: DISPATCHER_PROGRAM_ID,
    soPath: "target/deploy/dispatcher.so",
  },
  {
    label: "registry",
    programId: REGISTRY_PROGRAM_ID,
    soPath: "target/deploy/registry.so",
  },
];

const adapterLocalPrograms: Record<AdapterId, LocalProgram> = {
  kamino: {
    label: "kamino-usdc adapter",
    programId: KAMINO_ADAPTER_PROGRAM_ID,
    soPath: "target/deploy/kamino_usdc.so",
  },
  marginfi: {
    label: "marginfi-usdc adapter",
    programId: MARGINFI_ADAPTER_PROGRAM_ID,
    soPath: "target/deploy/marginfi_usdc.so",
  },
  jupiter: {
    label: "jupiter-lp adapter",
    programId: JUPITER_ADAPTER_PROGRAM_ID,
    soPath: "target/deploy/jupiter_lp.so",
  },
  maple: {
    label: "maple-syrup adapter",
    programId: MAPLE_ADAPTER_PROGRAM_ID,
    soPath: "target/deploy/maple_syrup.so",
  },
  drift: {
    label: "drift-insurance-fund adapter",
    programId: DRIFT_ADAPTER_PROGRAM_ID,
    soPath: "target/deploy/drift_insurance_fund.so",
  },
};

const adapterIds: AdapterId[] = [
  "kamino",
  "marginfi",
  "jupiter",
  "maple",
  "drift",
];

const sharedUsdcMintAccount: CloneAccount = {
  label: "USDC mint",
  address: USDC_MINT,
  kind: "account",
  reason: "Supported mint for registry, dispatcher, token accounts, and USDC adapters.",
};

const adapterPlans: Record<AdapterId, AdapterClonePlan> = {
  marginfi: {
    displayName: "MarginFi USDC",
    status: "runnable",
    requiresFundedSol: true,
    requiresFundedUsdc: true,
    requiresFundedSyrup: false,
    notes:
      "End-to-end fork path is implemented through dispatcher, registry, and MarginFi adapter CPI.",
    cloneAccounts: [
      {
        label: "MarginFi v2 program",
        address: MARGINFI_PROGRAM_ID,
        kind: "upgradeable-program",
        reason: "Executable target for adapter CPI.",
      },
      {
        label: "MarginFi production group",
        address: MARGINFI_GROUP,
        kind: "account",
        reason: "Group relation for the production USDC bank.",
      },
      {
        label: "MarginFi USDC bank",
        address: MARGINFI_USDC_BANK,
        kind: "account",
        reason: "Bank state, share value, liquidity vault, and oracle config.",
      },
      {
        label: "MarginFi USDC liquidity vault",
        address: MARGINFI_USDC_LIQUIDITY_VAULT,
        kind: "account",
        reason: "Vault debited and credited by MarginFi deposit and withdraw CPI.",
      },
      {
        label: "MarginFi USDC oracle",
        address: MARGINFI_USDC_ORACLE,
        kind: "account",
        reason: "Health-check oracle passed as withdraw remaining account.",
      },
      sharedUsdcMintAccount,
    ],
  },
  kamino: {
    displayName: "Kamino USDC",
    status: "runnable",
    requiresFundedSol: true,
    requiresFundedUsdc: true,
    requiresFundedSyrup: false,
    notes:
      "Direct reserve collateral mint/redeem path is implemented. It does not cover refreshReserve or queued-withdrawal extensions.",
    cloneAccounts: [
      {
        label: "Kamino Lend program",
        address: KAMINO_KLEND_PROGRAM_ID,
        kind: "upgradeable-program",
        reason: "Executable target for Kamino USDC reserve CPI.",
      },
      {
        label: "Kamino main lending market",
        address: KAMINO_MAIN_MARKET,
        kind: "account",
        reason: "Market used by Kamino main-market USDC reserve examples.",
      },
      {
        label: "Kamino main-market USDC reserve",
        address: KAMINO_MAIN_USDC_RESERVE,
        kind: "account",
        reason: "Reserve state used for CPI validation and collateral exchange-rate value math.",
      },
      {
        label: "Kamino USDC reserve liquidity supply",
        address: KAMINO_USDC_LIQUIDITY_SUPPLY,
        kind: "account",
        reason: "USDC liquidity supply vault credited and debited by reserve CPI.",
      },
      {
        label: "Kamino USDC reserve collateral mint",
        address: KAMINO_USDC_COLLATERAL_MINT,
        kind: "account",
        reason: "Collateral mint for user reserve shares and collateral ATA creation.",
      },
      sharedUsdcMintAccount,
    ],
  },
  jupiter: {
    displayName: "Jupiter LP",
    status: "blocked",
    requiresFundedSol: true,
    requiresFundedUsdc: true,
    requiresFundedSyrup: false,
    notes:
      "Jupiter Perps JLP v2 USDC add/remove liquidity CPI is wired through the dispatcher, but the fork test is blocked by Doves/Edge oracle freshness. Replaying mainnet Doves updates fails Doves InvalidSigner(6006) because the keeper signer cannot be substituted.",
    cloneAccounts: [
      {
        label: "Jupiter Perps program",
        address: JUPITER_PERPS_PROGRAM_ID,
        kind: "upgradeable-program",
        reason: "External program invoked by Jupiter JLP deposit and withdraw CPI.",
      },
      {
        label: "Jupiter Doves oracle program",
        address: JUPITER_DOVES_PROGRAM_ID,
        kind: "upgradeable-program",
        reason: "Oracle update program used to refresh Edge/Doves prices before JLP CPI.",
      },
      {
        label: "Pyth Lazer verifier program",
        address: PYTH_LAZER_PROGRAM_ID,
        kind: "upgradeable-program",
        reason: "Executable account passed to Jupiter Doves UpdateManyWithPythLazer.",
      },
      {
        label: "Pyth Lazer feed account",
        address: PYTH_LAZER_FEED_ACCOUNT,
        kind: "account",
        reason: "Feed account passed to Jupiter Doves UpdateManyWithPythLazer.",
      },
      {
        label: "Pyth Lazer treasury/account",
        address: PYTH_LAZER_TREASURY_ACCOUNT,
        kind: "account",
        reason: "System account passed to Jupiter Doves UpdateManyWithPythLazer.",
      },
      {
        label: "Jupiter JLP pool",
        address: JUPITER_JLP_POOL,
        kind: "account",
        reason: "Pool account stores custody list and AUM used for valuation and share conversion.",
      },
      {
        label: "Jupiter perpetuals state",
        address: JUPITER_JLP_PERPETUALS,
        kind: "account",
        reason: "Perpetuals account references the active JLP pool and validates CPI context.",
      },
      {
        label: "Jupiter JLP transfer authority",
        address: JUPITER_JLP_TRANSFER_AUTHORITY,
        kind: "account",
        reason: "Program PDA used by Jupiter Perps token transfer and mint/burn flows.",
      },
      {
        label: "Jupiter JLP mint",
        address: JUPITER_JLP_MINT,
        kind: "account",
        reason: "LP share mint credited on deposit and burned on withdrawal.",
      },
      {
        label: "Jupiter JLP USDC custody",
        address: JUPITER_JLP_USDC_CUSTODY,
        kind: "account",
        reason: "USDC custody account for JLP add/remove liquidity.",
      },
      {
        label: "Jupiter JLP USDC custody token account",
        address: JUPITER_JLP_USDC_CUSTODY_TOKEN_ACCOUNT,
        kind: "account",
        reason: "USDC vault account credited/debited by Jupiter Perps CPI.",
      },
      {
        label: "Jupiter JLP legacy USDC Doves price account",
        address: JUPITER_JLP_USDC_DOVES_PRICE_ACCOUNT,
        kind: "account",
        reason: "Legacy custody.doves_oracle retained for layout validation; current CPI uses custody.doves_ag_oracle.",
      },
      {
        label: "Jupiter JLP USDC Doves AG/Edge price account",
        address: JUPITER_JLP_USDC_AG_DOVES_PRICE_ACCOUNT,
        kind: "account",
        reason: "Current custody.doves_ag_oracle account required by v2 liquidity instructions.",
      },
      {
        label: "Jupiter JLP USDC Pythnet price account",
        address: JUPITER_JLP_USDC_PYTHNET_PRICE_ACCOUNT,
        kind: "account",
        reason: "Pythnet price account required by v2 liquidity instructions.",
      },
      {
        label: "Jupiter JLP SOL custody",
        address: JUPITER_JLP_SOL_CUSTODY,
        kind: "account",
        reason: "Additional pool custody required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP SOL Doves price account",
        address: JUPITER_JLP_SOL_DOVES_PRICE_ACCOUNT,
        kind: "account",
        reason: "Additional Doves oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP SOL Pythnet price account",
        address: JUPITER_JLP_SOL_PYTHNET_PRICE_ACCOUNT,
        kind: "account",
        reason: "Additional Pythnet oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP SOL Edge price account",
        address: JUPITER_JLP_SOL_EDGE_PRICE_ACCOUNT,
        kind: "account",
        reason: "Primary Edge oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP ETH custody",
        address: JUPITER_JLP_ETH_CUSTODY,
        kind: "account",
        reason: "Additional pool custody required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP ETH Doves price account",
        address: JUPITER_JLP_ETH_DOVES_PRICE_ACCOUNT,
        kind: "account",
        reason: "Additional Doves oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP ETH Pythnet price account",
        address: JUPITER_JLP_ETH_PYTHNET_PRICE_ACCOUNT,
        kind: "account",
        reason: "Additional Pythnet oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP ETH Edge price account",
        address: JUPITER_JLP_ETH_EDGE_PRICE_ACCOUNT,
        kind: "account",
        reason: "Primary Edge oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP WBTC custody",
        address: JUPITER_JLP_WBTC_CUSTODY,
        kind: "account",
        reason: "Additional pool custody required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP WBTC Doves price account",
        address: JUPITER_JLP_WBTC_DOVES_PRICE_ACCOUNT,
        kind: "account",
        reason: "Additional Doves oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP WBTC Pythnet price account",
        address: JUPITER_JLP_WBTC_PYTHNET_PRICE_ACCOUNT,
        kind: "account",
        reason: "Additional Pythnet oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP WBTC Edge price account",
        address: JUPITER_JLP_WBTC_EDGE_PRICE_ACCOUNT,
        kind: "account",
        reason: "Primary Edge oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP USDC Edge price account",
        address: JUPITER_JLP_USDC_EDGE_PRICE_ACCOUNT,
        kind: "account",
        reason: "Primary Edge oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP USDT custody",
        address: JUPITER_JLP_USDT_CUSTODY,
        kind: "account",
        reason: "Additional pool custody required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP USDT Doves price account",
        address: JUPITER_JLP_USDT_DOVES_PRICE_ACCOUNT,
        kind: "account",
        reason: "Additional Doves oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP USDT Pythnet price account",
        address: JUPITER_JLP_USDT_PYTHNET_PRICE_ACCOUNT,
        kind: "account",
        reason: "Additional Pythnet oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter JLP USDT Edge price account",
        address: JUPITER_JLP_USDT_EDGE_PRICE_ACCOUNT,
        kind: "account",
        reason: "Primary Edge oracle required by Jupiter Perps AUM calculation.",
      },
      {
        label: "Jupiter Doves WBTC Pyth Lazer price account",
        address: JUPITER_DOVES_WBTC_PYTH_LAZER_PRICE_ACCOUNT,
        kind: "account",
        reason: "Intermediate Doves account updated from signed Pyth Lazer payload.",
      },
      {
        label: "Jupiter Doves ETH Pyth Lazer price account",
        address: JUPITER_DOVES_ETH_PYTH_LAZER_PRICE_ACCOUNT,
        kind: "account",
        reason: "Intermediate Doves account updated from signed Pyth Lazer payload.",
      },
      {
        label: "Jupiter Doves SOL Pyth Lazer price account",
        address: JUPITER_DOVES_SOL_PYTH_LAZER_PRICE_ACCOUNT,
        kind: "account",
        reason: "Intermediate Doves account updated from signed Pyth Lazer payload.",
      },
      {
        label: "Jupiter Doves USDC Pyth Lazer price account",
        address: JUPITER_DOVES_USDC_PYTH_LAZER_PRICE_ACCOUNT,
        kind: "account",
        reason: "Intermediate Doves account updated from signed Pyth Lazer payload.",
      },
      {
        label: "Jupiter Doves WBTC RedStone price account",
        address: JUPITER_DOVES_WBTC_REDSTONE_PRICE_ACCOUNT,
        kind: "account",
        reason: "RedStone-backed Doves account used by UpdateAgPrice2 for WBTC Edge.",
      },
      {
        label: "Jupiter RedStone WBTC feed account",
        address: JUPITER_REDSTONE_WBTC_FEED_ACCOUNT,
        kind: "account",
        reason: "Read-only RedStone feed account used by Doves UpdateAgPrice2.",
      },
      {
        label: "Jupiter Doves ETH RedStone price account",
        address: JUPITER_DOVES_ETH_REDSTONE_PRICE_ACCOUNT,
        kind: "account",
        reason: "RedStone-backed Doves account used by UpdateAgPrice2 for ETH Edge.",
      },
      {
        label: "Jupiter RedStone ETH feed account",
        address: JUPITER_REDSTONE_ETH_FEED_ACCOUNT,
        kind: "account",
        reason: "Read-only RedStone feed account used by Doves UpdateAgPrice2.",
      },
      {
        label: "Jupiter Doves SOL RedStone price account",
        address: JUPITER_DOVES_SOL_REDSTONE_PRICE_ACCOUNT,
        kind: "account",
        reason: "RedStone-backed Doves account used by UpdateAgPrice2 for SOL Edge.",
      },
      {
        label: "Jupiter RedStone SOL feed account",
        address: JUPITER_REDSTONE_SOL_FEED_ACCOUNT,
        kind: "account",
        reason: "Read-only RedStone feed account used by Doves UpdateAgPrice2.",
      },
      {
        label: "Jupiter Doves USDC RedStone price account",
        address: JUPITER_DOVES_USDC_REDSTONE_PRICE_ACCOUNT,
        kind: "account",
        reason: "RedStone-backed Doves account used by UpdateAgPrice2 for USDC Edge.",
      },
      {
        label: "Jupiter RedStone USDC feed account",
        address: JUPITER_REDSTONE_USDC_FEED_ACCOUNT,
        kind: "account",
        reason: "Read-only RedStone feed account used by Doves UpdateAgPrice2.",
      },
      sharedUsdcMintAccount,
    ],
  },
  maple: {
    displayName: "Maple syrupUSDC",
    status: "runnable",
    requiresFundedSol: true,
    requiresFundedUsdc: false,
    requiresFundedSyrup: true,
    notes:
      "Runs a syrupUSDC asset-position adapter. It does not pretend to perform CCIP native mint/redeem; the fork wallet is preloaded with syrupUSDC and the adapter custodies that yield-bearing SPL token.",
    cloneAccounts: [
      {
        label: "Maple syrupUSDC mint",
        address: MAPLE_SYRUP_USDC_MINT,
        kind: "account",
        reason: "Verified Solana syrupUSDC token address.",
      },
      {
        label: "Maple syrupUSDC CCIP router",
        address: MAPLE_SYRUP_CCIP_ROUTER,
        kind: "upgradeable-program",
        reason: "CCIP router documented for Solana syrupUSDC movement.",
      },
      {
        label: "Maple syrupUSDC CCIP token pool",
        address: MAPLE_SYRUP_CCIP_POOL,
        kind: "account",
        reason: "Token pool documented for Solana syrupUSDC CCIP movement.",
      },
      {
        label: "Maple syrupUSDC/USDC oracle",
        address: MAPLE_SYRUP_USDC_ORACLE,
        kind: "account",
        reason: "Chainlink oracle documented for syrupUSDC/USDC value checks.",
      },
      sharedUsdcMintAccount,
    ],
  },
  drift: {
    displayName: "Drift Insurance Fund",
    status: "runnable",
    requiresFundedSol: true,
    requiresFundedUsdc: true,
    requiresFundedSyrup: false,
    notes:
      "Dispatcher fork path uses Drift add_insurance_fund_stake and request_remove_insurance_fund_stake. Final settlement remains delayed by Drift's unstaking period.",
    cloneAccounts: [
      {
        label: "Drift program",
        address: DRIFT_PROGRAM_ID,
        kind: "upgradeable-program",
        reason: "Executable target for Drift insurance fund CPI.",
      },
      {
        label: "Drift state",
        address: DRIFT_STATE,
        kind: "account",
        reason: "Drift singleton state PDA.",
      },
      {
        label: "Drift USDC spot market",
        address: DRIFT_USDC_SPOT_MARKET,
        kind: "account",
        reason: "Spot market index 0 state for USDC insurance fund staking.",
      },
      {
        label: "Drift USDC spot market vault",
        address: DRIFT_USDC_SPOT_VAULT,
        kind: "account",
        reason: "USDC spot vault referenced by Drift insurance fund stake CPI.",
      },
      {
        label: "Drift USDC insurance fund vault",
        address: DRIFT_USDC_INSURANCE_FUND_VAULT,
        kind: "account",
        reason: "Vault used to value and settle USDC insurance fund stake shares.",
      },
      {
        label: "Drift USDC oracle",
        address: DRIFT_USDC_ORACLE,
        kind: "account",
        reason: "USDC oracle listed in Drift mainnet spot-market config.",
      },
      sharedUsdcMintAccount,
    ],
  },
};

const adapterAliases: Record<string, AdapterTarget> = {
  all: "all",
  kamino: "kamino",
  "kamino-usdc": "kamino",
  marginfi: "marginfi",
  "marginfi-usdc": "marginfi",
  jupiter: "jupiter",
  "jupiter-lp": "jupiter",
  maple: "maple",
  "maple-syrup": "maple",
  "maple-syrup-usdc": "maple",
  drift: "drift",
  "drift-insurance-fund": "drift",
};

function normalizeAdapterTarget(value: string | undefined): AdapterTarget {
  const raw = (value ?? process.env.FORK_ADAPTER ?? "all")
    .trim()
    .toLowerCase();
  const target = adapterAliases[raw];
  if (target === undefined) {
    throw new Error(
      `Unknown fork adapter "${raw}". Use one of: ${Object.keys(adapterAliases).join(", ")}.`,
    );
  }
  return target;
}

function selectedAdapterIds(target: AdapterTarget): AdapterId[] {
  return target === "all" ? adapterIds : [target];
}

function getAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function writeU64(buffer: Buffer, offset: number, value: bigint): void {
  buffer.writeBigUInt64LE(value, offset);
}

function toSafeJsonNumber(value: bigint, field: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${field} exceeds JavaScript's safe JSON integer range.`);
  }
  return Number(value);
}

function splTokenAccountData(
  mint: PublicKey,
  owner: PublicKey,
  amount: bigint,
): Buffer {
  const data = Buffer.alloc(165);
  mint.toBuffer().copy(data, 0);
  owner.toBuffer().copy(data, 32);
  writeU64(data, 64, amount);
  data.writeUInt32LE(0, 72); // delegate: COption::None
  data.writeUInt8(1, 108); // AccountState::Initialized
  data.writeUInt32LE(0, 109); // is_native: COption::None
  writeU64(data, 121, 0n); // delegated_amount
  data.writeUInt32LE(0, 129); // close_authority: COption::None
  return data;
}

function writeFundedSolFixture(owner: PublicKey): {
  fixturePath: string;
  lamports: bigint;
} {
  const lamports = BigInt(
    process.env.FORK_USER_SOL_LAMPORTS ??
      DEFAULT_FIXTURE_SOL_LAMPORTS.toString(),
  );
  const fixtureDir = join(process.cwd(), FIXTURE_DIR);
  mkdirSync(fixtureDir, { recursive: true });

  const fixturePath = `${FIXTURE_DIR}/funded-user-sol-account.json`;
  const account = {
    pubkey: owner.toBase58(),
    account: {
      lamports: toSafeJsonNumber(lamports, "FORK_USER_SOL_LAMPORTS"),
      data: ["", "base64"],
      owner: SystemProgram.programId.toBase58(),
      executable: false,
      rentEpoch: 0,
      space: 0,
    },
  };
  writeFileSync(
    join(process.cwd(), fixturePath),
    `${JSON.stringify(account, null, 2)}\n`,
  );

  return { fixturePath, lamports };
}

function writeFundedUsdcFixture(owner: PublicKey): {
  tokenAccount: PublicKey;
  fixturePath: string;
  amount: bigint;
} {
  const amount = BigInt(
    process.env.FORK_USER_USDC_AMOUNT ?? DEFAULT_FIXTURE_USDC_AMOUNT.toString(),
  );
  const tokenAccount = getAssociatedTokenAddress(owner, USDC_MINT);
  const fixtureDir = join(process.cwd(), FIXTURE_DIR);
  mkdirSync(fixtureDir, { recursive: true });

  const fixturePath = `${FIXTURE_DIR}/funded-usdc-token-account.json`;
  const account = {
    pubkey: tokenAccount.toBase58(),
    account: {
      lamports: toSafeJsonNumber(
        TOKEN_ACCOUNT_RENT_LAMPORTS,
        "TOKEN_ACCOUNT_RENT_LAMPORTS",
      ),
      data: [
        splTokenAccountData(USDC_MINT, owner, amount).toString("base64"),
        "base64",
      ],
      owner: TOKEN_PROGRAM_ID.toBase58(),
      executable: false,
      rentEpoch: 0,
      space: 165,
    },
  };
  writeFileSync(
    join(process.cwd(), fixturePath),
    `${JSON.stringify(account, null, 2)}\n`,
  );

  return { tokenAccount, fixturePath, amount };
}

function writeFundedSyrupFixture(owner: PublicKey): {
  tokenAccount: PublicKey;
  fixturePath: string;
  amount: bigint;
} {
  const amount = BigInt(
    process.env.FORK_USER_SYRUP_AMOUNT ??
      DEFAULT_FIXTURE_SYRUP_AMOUNT.toString(),
  );
  const tokenAccount = getAssociatedTokenAddress(owner, MAPLE_SYRUP_USDC_MINT);
  const fixtureDir = join(process.cwd(), FIXTURE_DIR);
  mkdirSync(fixtureDir, { recursive: true });

  const fixturePath = `${FIXTURE_DIR}/funded-syrupusdc-token-account.json`;
  const account = {
    pubkey: tokenAccount.toBase58(),
    account: {
      lamports: toSafeJsonNumber(
        TOKEN_ACCOUNT_RENT_LAMPORTS,
        "TOKEN_ACCOUNT_RENT_LAMPORTS",
      ),
      data: [
        splTokenAccountData(MAPLE_SYRUP_USDC_MINT, owner, amount).toString("base64"),
        "base64",
      ],
      owner: TOKEN_PROGRAM_ID.toBase58(),
      executable: false,
      rentEpoch: 0,
      space: 165,
    },
  };
  writeFileSync(
    join(process.cwd(), fixturePath),
    `${JSON.stringify(account, null, 2)}\n`,
  );

  return { tokenAccount, fixturePath, amount };
}

function dedupeCloneAccounts(accounts: CloneAccount[]): CloneAccount[] {
  const byAddress = new Map<string, CloneAccount>();

  for (const account of accounts) {
    const address = account.address.toBase58();
    const existing = byAddress.get(address);
    if (existing === undefined) {
      byAddress.set(address, { ...account });
      continue;
    }

    if (existing.kind !== account.kind) {
      throw new Error(
        `Conflicting clone kind for ${address}: ${existing.kind} vs ${account.kind}.`,
      );
    }
    const labels = existing.label.split("; ");
    if (!labels.includes(account.label)) {
      existing.label = `${existing.label}; ${account.label}`;
    }
    if (!existing.reason.includes(account.reason)) {
      existing.reason = `${existing.reason} ${account.reason}`;
    }
  }

  return [...byAddress.values()];
}

function cloneArgs(account: CloneAccount): string[] {
  if (account.kind === "upgradeable-program") {
    return ["--clone-upgradeable-program", account.address.toBase58()];
  }
  return ["--clone", account.address.toBase58()];
}

function fixtureFileName(label: string, address: PublicKey): string {
  const normalizedLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${normalizedLabel}-${address.toBase58()}.json`;
}

async function writeClonedAccountFixtures(
  accounts: CloneAccount[],
  rpcUrl: string,
): Promise<PrefetchedAccountFixture[]> {
  const fixtureDir = join(process.cwd(), FIXTURE_DIR, "mainnet-accounts");
  mkdirSync(fixtureDir, { recursive: true });

  const connection = new Connection(rpcUrl, "confirmed");
  const fixtures: PrefetchedAccountFixture[] = [];

  for (const account of accounts) {
    if (account.kind !== "account") {
      continue;
    }

    const accountInfo = await connection.getAccountInfo(account.address, {
      commitment: "confirmed",
    });
    if (accountInfo === null) {
      throw new Error(`Mainnet account ${account.address.toBase58()} was not found.`);
    }

    const fixturePath = `${FIXTURE_DIR}/mainnet-accounts/${fixtureFileName(
      account.label,
      account.address,
    )}`;
    const fixture = {
      pubkey: account.address.toBase58(),
      account: {
        lamports: accountInfo.lamports,
        data: [accountInfo.data.toString("base64"), "base64"],
        owner: accountInfo.owner.toBase58(),
        executable: accountInfo.executable,
        rentEpoch: 0,
        space: accountInfo.data.length,
      },
    };

    writeFileSync(
      join(process.cwd(), fixturePath),
      `${JSON.stringify(fixture, null, 2)}\n`,
    );
    fixtures.push({ account, fixturePath });
  }

  return fixtures;
}

function accountFixtureArgs(fixture: PrefetchedAccountFixture): string[] {
  return [
    "--account",
    fixture.account.address.toBase58(),
    fixture.fixturePath,
  ];
}

function localProgramsFor(selectedIds: AdapterId[]): LocalProgram[] {
  return [
    ...sharedLocalPrograms,
    ...selectedIds.map((id) => adapterLocalPrograms[id]),
  ];
}

// The current mainnet Drift deployment (last deploy slot 410633860) removed
// every user-facing instruction (deposit/withdraw/initialize_user/all
// insurance-fund staking return InstructionFallbackNotFound on live mainnet),
// so insurance-fund staking can no longer be exercised against the deployed
// binary. Set DRIFT_LOCAL_SO to a drift.so built from the official
// protocol-v2 v2.161.0 sources (see scripts/build-drift-v2161.sh) to load the
// last released binary that still contains the insurance-fund instruction
// set; cloned account state remains real current mainnet state.
function driftLocalSoOverride(): string | null {
  const path = process.env.DRIFT_LOCAL_SO ?? "";
  return path.trim() === "" ? null : path.trim();
}

function localProgramArgs(program: LocalProgram): string[] {
  return ["--bpf-program", program.programId.toBase58(), program.soPath];
}

function quoteArg(arg: string): string {
  if (!/[\s"]/.test(arg)) {
    return arg;
  }
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function commandLine(command: string, args: string[]): string {
  return [command, ...args].map(quoteArg).join(" ");
}

function testCommand(target: AdapterTarget): string {
  if (target === "all") {
    return "npm run test:fork";
  }
  return `npm run test:fork:${target}`;
}

async function defaultWarpSlot(
  rpcUrl: string,
  prefetchAccounts: boolean,
): Promise<string> {
  if (!prefetchAccounts) {
    return DEFAULT_FORK_WARP_SLOT;
  }

  const connection = new Connection(rpcUrl, "confirmed");
  return (await connection.getSlot("confirmed")).toString();
}

async function main(): Promise<void> {
  const target = normalizeAdapterTarget(process.argv[2]);
  const selectedIds = selectedAdapterIds(target);
  const selectedPlans = selectedIds.map((id) => adapterPlans[id]);
  const rpcUrl =
    process.env.MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  const ledgerPath = process.env.FORK_LEDGER_PATH ?? ".mainnet-fork-ledger";
  const prefetchAccounts =
    process.env.FORK_PREFETCH_ACCOUNTS === "1" ||
    process.env.FORK_ACCOUNT_SOURCE === "fixture";
  const warpSlot =
    process.env.FORK_WARP_SLOT ?? (await defaultWarpSlot(rpcUrl, prefetchAccounts));
  let accounts = dedupeCloneAccounts(
    selectedPlans.flatMap((plan) => plan.cloneAccounts),
  );
  const localPrograms = localProgramsFor(selectedIds);
  const driftLocalSo = selectedIds.includes("drift")
    ? driftLocalSoOverride()
    : null;
  if (driftLocalSo !== null) {
    accounts = accounts.filter(
      (account) => !account.address.equals(DRIFT_PROGRAM_ID),
    );
    localPrograms.push({
      label:
        "drift program (official protocol-v2 v2.161.0 built from source; see scripts/build-drift-v2161.sh)",
      programId: DRIFT_PROGRAM_ID,
      soPath: driftLocalSo,
    });
  }
  const prefetchedAccountFixtures = prefetchAccounts
    ? await writeClonedAccountFixtures(accounts, rpcUrl)
    : [];
  const prefetchedByAddress = new Map(
    prefetchedAccountFixtures.map((fixture) => [
      fixture.account.address.toBase58(),
      fixture,
    ]),
  );

  const validatorArgs = [
    "--reset",
    "--ledger",
    ledgerPath,
    "--url",
    rpcUrl,
    "--warp-slot",
    warpSlot,
    ...localPrograms.flatMap(localProgramArgs),
    ...accounts.flatMap((account) => {
      const fixture = prefetchedByAddress.get(account.address.toBase58());
      return fixture === undefined ? cloneArgs(account) : accountFixtureArgs(fixture);
    }),
  ];

  const needsFundedSol = selectedPlans.some((plan) => plan.requiresFundedSol);
  const needsFundedUsdc = selectedPlans.some((plan) => plan.requiresFundedUsdc);
  const needsFundedSyrup = selectedPlans.some((plan) => plan.requiresFundedSyrup);
  const fixtureOwner = process.env.FORK_USER_PUBKEY
    ? new PublicKey(process.env.FORK_USER_PUBKEY)
    : null;
  const solFixture =
    fixtureOwner && needsFundedSol ? writeFundedSolFixture(fixtureOwner) : null;
  const usdcFixture =
    fixtureOwner && needsFundedUsdc ? writeFundedUsdcFixture(fixtureOwner) : null;
  const syrupFixture =
    fixtureOwner && needsFundedSyrup
      ? writeFundedSyrupFixture(fixtureOwner)
      : null;

  if (fixtureOwner && solFixture) {
    validatorArgs.push("--account", fixtureOwner.toBase58(), solFixture.fixturePath);
  }
  if (usdcFixture) {
    validatorArgs.push(
      "--account",
      usdcFixture.tokenAccount.toBase58(),
      usdcFixture.fixturePath,
    );
  }
  if (syrupFixture) {
    validatorArgs.push(
      "--account",
      syrupFixture.tokenAccount.toBase58(),
      syrupFixture.fixturePath,
    );
  }

  const payload = {
    phase: "phase-8-mainnet-fork",
    adapter: target,
    selectedAdapters: selectedIds.map((id) => ({
      id,
      displayName: adapterPlans[id].displayName,
      status: adapterPlans[id].status,
      testCommand: testCommand(id),
      notes: adapterPlans[id].notes,
    })),
    rpcUrl,
    ledgerPath,
    warpSlot,
    cloneAccounts: accounts.map((account) => ({
      label: account.label,
      address: account.address.toBase58(),
      kind: account.kind,
      reason: account.reason,
    })),
    localPrograms: localPrograms.map((program) => ({
      label: program.label,
      programId: program.programId.toBase58(),
      soPath: program.soPath,
    })),
    accountSource: prefetchAccounts
      ? {
          mode: "fixture",
          message:
            "Regular accounts were fetched by this script and loaded into solana-test-validator through --account fixtures.",
          fixtures: prefetchedAccountFixtures.map((fixture) => ({
            label: fixture.account.label,
            address: fixture.account.address.toBase58(),
            fixturePath: fixture.fixturePath,
          })),
        }
      : {
          mode: "validator-clone",
          message:
            "Regular accounts will be fetched by solana-test-validator through --clone. Set FORK_PREFETCH_ACCOUNTS=1 to write local fixtures first.",
        },
    fundedUser:
      fixtureOwner === null
        ? {
            requiredForSelectedAdapters:
              needsFundedSol || needsFundedUsdc || needsFundedSyrup,
            message:
              "Set FORK_USER_PUBKEY to the ANCHOR_WALLET public key to generate deterministic SOL/USDC/syrupUSDC fixtures.",
          }
        : {
            owner: fixtureOwner.toBase58(),
            sol: solFixture
              ? {
                  lamports: solFixture.lamports.toString(),
                  fixturePath: solFixture.fixturePath,
                }
              : "Not required for selected adapter target.",
            usdc: usdcFixture
              ? {
                  tokenAccount: usdcFixture.tokenAccount.toBase58(),
                  amount: usdcFixture.amount.toString(),
                  fixturePath: usdcFixture.fixturePath,
                }
              : "Not required for selected adapter target.",
            syrupUsdc: syrupFixture
              ? {
                  tokenAccount: syrupFixture.tokenAccount.toBase58(),
                  amount: syrupFixture.amount.toString(),
                  fixturePath: syrupFixture.fixturePath,
                }
              : "Not required for selected adapter target.",
          },
    commands: {
      clone: `npm run clone:mainnet -- ${target}`,
      validator: commandLine("solana-test-validator", validatorArgs),
      test: testCommand(target),
    },
    rpcRequirements: [
      "The RPC must serve current mainnet account data for --clone.",
      "The RPC must allow executable program cloning; upgradeable programs use --clone-upgradeable-program.",
      "Paid or dedicated RPC is recommended because public endpoints may rate-limit large clone sets.",
    ],
    expectedRuntime:
      target === "all"
        ? "About 8-15 minutes after validator startup on a warm machine."
        : target === "marginfi" || target === "kamino" || target === "drift" || target === "jupiter" || target === "maple"
          ? "About 2-5 minutes after validator startup on a warm machine."
          : "About 2-5 minutes after validator startup on a warm machine.",
    knownFlakyAreas: [
      "RPC rate limits or stale mainnet data during validator startup.",
      "Protocol account layout changes between clone time and SDK expectations.",
      "Local validator ledger reuse; keep --reset in the generated command.",
      "Wallet mismatch: FORK_USER_PUBKEY must match ANCHOR_WALLET.",
      "Jupiter Perps JLP requires Doves/Edge oracle freshness within a strict window; static fixtures and unauthenticated Doves replay are not sufficient.",
    ],
  };

  console.log(JSON.stringify(payload, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

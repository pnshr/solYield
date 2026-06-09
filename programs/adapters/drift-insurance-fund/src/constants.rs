pub const TARGET_PROTOCOL: &str = "Drift";
pub const TARGET_ASSET: &str = "Drift USDC Insurance Fund stake/deposit position";

// Verified from @drift-labs/sdk mainnet-beta config and PDA derivations.
pub const DRIFT_PROGRAM_ID: Option<&str> = Some("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
pub const DRIFT_STATE: Option<&str> = Some("5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN");
pub const DRIFT_SPOT_MARKET: Option<&str> = Some("6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3");
pub const DRIFT_SPOT_MARKET_VAULT: &str = "GXWqPpjQpdz7KZw9p7f5PX2eGxHAhvpNXiviFkAB8zXg";
pub const DRIFT_INSURANCE_FUND_VAULT: Option<&str> =
    Some("2CqkQvYxp9Mq4PqLvAQ1eryYxebUh4Liyn5YMDtXsYci");
pub const DRIFT_SIGNER: &str = "JCNCMFXo5M5qwUPg2Utu1u6YWp3MbygxqBsBeXXJfrw";

// User-specific PDA: seeds [b"insurance_fund_stake", authority, market_index].
pub const DRIFT_INSURANCE_FUND_STAKE_ACCOUNT: Option<&str> = None;
pub const DRIFT_QUOTE_OR_UNDERLYING_MINT: Option<&str> =
    Some("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
pub const DRIFT_USDC_MARKET_INDEX: u16 = 0;
pub const DRIFT_USDC_ORACLE: &str = "9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV";

// Standard withdraw maps to Drift's request-remove instruction. Final token
// settlement is delayed by Drift's unstaking period and should be completed by a
// future extension instruction, not faked by this adapter.

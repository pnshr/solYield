pub const TARGET_PROTOCOL: &str = "Kamino";
pub const TARGET_ASSET: &str = "USDC";
pub const USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Verified from Kamino's current klend SDK/codegen seed helpers and kamino.com
// API docs.
pub const KAMINO_PROGRAM_ID: Option<&str> = Some("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
pub const KAMINO_MAIN_MARKET: &str = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
pub const KAMINO_MAIN_MARKET_AUTHORITY: &str = "9DrvZvyWh1HuAoZxvYWMvkf2XCzryCpGgHqrMjyDWpmo";

// Kamino docs identify this as the USDC reserve used in the main market deposit
// examples. This adapter uses direct reserve collateral mint/redeem, not an
// obligation-backed borrow account.
pub const KAMINO_USDC_POSITION_MODEL: Option<&str> = Some("Kamino Lend reserve collateral deposit");
pub const KAMINO_USDC_VAULT_OR_RESERVE: Option<&str> =
    Some("D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59");
pub const KAMINO_USDC_LIQUIDITY_SUPPLY: &str = "Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6";
pub const KAMINO_USDC_SHARE_MINT: Option<&str> =
    Some("B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D");

// The direct reserve adapter does not refresh oracle prices in current_value.
// A production extension should add refreshReserve CPI and oracle-account
// forwarding before value reads.
pub const KAMINO_USDC_ORACLE: Option<&str> = None;

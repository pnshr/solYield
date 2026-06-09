use anchor_lang::prelude::*;

pub const TARGET_PROTOCOL: &str = "Jupiter";
pub const TARGET_ASSET: &str = "Jupiter Perps JLP via USDC liquidity";

pub const JUPITER_PERPS_PROGRAM_ID: Pubkey =
    pubkey!("PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu");
pub const JLP_POOL: Pubkey = pubkey!("5BUwFW4nRbftYTDMbgxykoFWqWHPzahFSNAaaaJtVKsq");
pub const JLP_MINT: Pubkey = pubkey!("27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4");
pub const USDC_MINT: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
pub const TOKEN_PROGRAM_ID: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

pub const JLP_USDC_CUSTODY: Pubkey = pubkey!("G18jKKXQwBbrHeiK3C9MRXhkHsLHf7XgCSisykV46EZa");
pub const JLP_USDC_CUSTODY_TOKEN_ACCOUNT: Pubkey =
    pubkey!("WzWUoCmtVv7eqAbU3BfKPU3fhLP6CXR8NCJH78UK9VS");
pub const JLP_USDC_DOVES_PRICE_ACCOUNT: Pubkey =
    pubkey!("A28T5pKtscnhDo6C1Sz786Tup88aTjt8uyKewjVvPrGk");
pub const JLP_USDC_DOVES_AG_PRICE_ACCOUNT: Pubkey =
    pubkey!("6Jp2xZUTWdDD2ZyUPRzeMdc6AFQ5K3pFgZxk2EijfjnM");
pub const JLP_USDC_PYTHNET_PRICE_ACCOUNT: Pubkey =
    pubkey!("Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX");

pub const JLP_PERPETUALS: Pubkey = pubkey!("H4ND9aYttUVLFmNypZqLjZ52FYiGvdEB45GmwNoKEjTj");
pub const JLP_TRANSFER_AUTHORITY: Pubkey =
    pubkey!("AVzP2GeRmqGphJsMxWoqjpUifPpCret7LqWhD8NWQK49");
pub const JLP_EVENT_AUTHORITY: Pubkey =
    pubkey!("37hJBDnntwqhGbK7L6M1bLyvccj4u55CCUiLPdYkiqBN");

// The adapter supports USDC in/out and holds JLP shares in the user's JLP token
// account. Pool AUM is stored in native USD/USDC units with 6 decimals.

use anchor_lang::prelude::*;

pub const TARGET_PROTOCOL: &str = "Maple/Syrup";
pub const TARGET_ASSET: &str = "syrupUSDC yield-bearing SPL token position";

pub const MAPLE_SYRUP_USDC_MINT: Pubkey =
    pubkey!("AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj");
pub const MAPLE_SYRUP_UNDERLYING_MINT: Pubkey =
    pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
pub const MAPLE_SYRUP_CCIP_ROUTER: Pubkey =
    pubkey!("Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C");
pub const MAPLE_SYRUP_CCIP_POOL: Pubkey =
    pubkey!("HrTBpF3LqSxXnjnYdR4htnBLyMHNZ6eNaDZGPundvHbm");
pub const MAPLE_SYRUP_USDC_ORACLE: Pubkey =
    pubkey!("CpNyiFt84q66665Kx64bobxZuMgZ2EecrhAJs1HikS2T");
pub const TOKEN_PROGRAM_ID: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// This adapter intentionally does not pretend to perform CCIP native
// mint/redeem. It wraps the live Solana syrupUSDC token as the yield-bearing
// position asset. Direct CCIP mint/redeem remains a future extension.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{invoke, set_return_data},
};

pub mod constants;

declare_id!("mWDRjDXGpQupue6j74cdWJD7BJ1XygdaxU7vc52BLve");

pub const CONFIG_SEED: &[u8] = b"drift_if_config";
pub const POSITION_SEED: &[u8] = b"drift_if_position";

const DRIFT_SPOT_MARKET_SEED: &[u8] = b"spot_market";
const DRIFT_INSURANCE_FUND_STAKE_SEED: &[u8] = b"insurance_fund_stake";
const DRIFT_INSURANCE_FUND_VAULT_SEED: &[u8] = b"insurance_fund_vault";
const DRIFT_SPOT_MARKET_VAULT_SEED: &[u8] = b"spot_market_vault";
const DRIFT_SIGNER_SEED: &[u8] = b"drift_signer";
const DRIFT_USER_STATS_SEED: &[u8] = b"user_stats";

const ADD_INSURANCE_FUND_STAKE_IX_DISCRIMINATOR: [u8; 8] =
    [251, 144, 115, 11, 222, 47, 62, 236];
const REQUEST_REMOVE_INSURANCE_FUND_STAKE_IX_DISCRIMINATOR: [u8; 8] =
    [142, 70, 204, 92, 73, 106, 180, 52];

const TOKEN_ACCOUNT_MINT_OFFSET: usize = 0;
const TOKEN_ACCOUNT_OWNER_OFFSET: usize = 32;
const TOKEN_ACCOUNT_AMOUNT_OFFSET: usize = 64;

const IF_STAKE_AUTHORITY_OFFSET: usize = 8;
const IF_STAKE_IF_SHARES_OFFSET: usize = 8 + 32;
const IF_STAKE_LAST_WITHDRAW_REQUEST_SHARES_OFFSET: usize = 8 + 48;
const IF_STAKE_LAST_WITHDRAW_REQUEST_VALUE_OFFSET: usize = 8 + 88;
const IF_STAKE_MARKET_INDEX_OFFSET: usize = 8 + 112;

const SPOT_MARKET_PUBKEY_OFFSET: usize = 8;
const SPOT_MARKET_MINT_OFFSET: usize = 8 + 64;
const SPOT_MARKET_VAULT_OFFSET: usize = 8 + 96;
const SPOT_MARKET_IF_VAULT_OFFSET: usize = 8 + 296;
const SPOT_MARKET_IF_TOTAL_SHARES_OFFSET: usize = 8 + 328;

#[program]
pub mod drift_insurance_fund {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        supported_mint: Pubkey,
        protocol_program_id: Pubkey,
        version: u16,
    ) -> Result<()> {
        require_keys_neq!(
            supported_mint,
            Pubkey::default(),
            DriftInsuranceFundError::InvalidMint
        );
        require_keys_neq!(
            protocol_program_id,
            Pubkey::default(),
            DriftInsuranceFundError::InvalidProtocolProgram
        );

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.supported_mint = supported_mint;
        config.protocol_program_id = protocol_program_id;
        config.version = version;
        config.bump = ctx.bumps.config;

        emit!(DriftInsuranceFundConfigInitialized {
            authority: config.authority,
            supported_mint,
            protocol_program_id,
            version,
        });

        Ok(())
    }

    pub fn initialize_position(
        ctx: Context<InitializePosition>,
        market_index: u16,
        insurance_fund_stake: Pubkey,
        user_stats: Pubkey,
    ) -> Result<()> {
        let expected_stake = derive_insurance_fund_stake(
            ctx.accounts.config.protocol_program_id,
            ctx.accounts.owner.key(),
            market_index,
        );
        let expected_user_stats =
            derive_user_stats(ctx.accounts.config.protocol_program_id, ctx.accounts.owner.key());

        require_keys_eq!(
            insurance_fund_stake,
            expected_stake,
            DriftInsuranceFundError::InvalidInsuranceFundStake
        );
        require_keys_eq!(
            user_stats,
            expected_user_stats,
            DriftInsuranceFundError::InvalidUserStats
        );

        let position = &mut ctx.accounts.position;
        position.owner = ctx.accounts.owner.key();
        position.insurance_fund_stake = insurance_fund_stake;
        position.user_stats = user_stats;
        position.market_index = market_index;
        position.deposited_amount = 0;
        position.shares = 0;
        position.last_value = 0;
        position.pending_withdraw_amount = 0;
        position.bump = ctx.bumps.position;

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        validate_common(
            &ctx.accounts.config,
            &ctx.accounts.position,
            ctx.accounts.owner.key(),
            ctx.accounts.mint.key(),
            amount,
        )?;
        validate_deposit_accounts(&ctx)?;

        let instruction = Instruction {
            program_id: ctx.accounts.drift_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.state.key(), false),
                AccountMeta::new(ctx.accounts.spot_market.key(), false),
                AccountMeta::new(ctx.accounts.insurance_fund_stake.key(), false),
                AccountMeta::new(ctx.accounts.user_stats.key(), false),
                AccountMeta::new_readonly(ctx.accounts.owner.key(), true),
                AccountMeta::new(ctx.accounts.spot_market_vault.key(), false),
                AccountMeta::new(ctx.accounts.insurance_fund_vault.key(), false),
                AccountMeta::new_readonly(ctx.accounts.drift_signer.key(), false),
                AccountMeta::new(ctx.accounts.user_token_account.key(), false),
                AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
            ],
            data: amount_ix_data(
                ADD_INSURANCE_FUND_STAKE_IX_DISCRIMINATOR,
                ctx.accounts.position.market_index,
                amount,
            ),
        };

        invoke(
            &instruction,
            &[
                ctx.accounts.state.to_account_info(),
                ctx.accounts.spot_market.to_account_info(),
                ctx.accounts.insurance_fund_stake.to_account_info(),
                ctx.accounts.user_stats.to_account_info(),
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.spot_market_vault.to_account_info(),
                ctx.accounts.insurance_fund_vault.to_account_info(),
                ctx.accounts.drift_signer.to_account_info(),
                ctx.accounts.user_token_account.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.drift_program.to_account_info(),
            ],
        )
        .map_err(|_| error!(DriftInsuranceFundError::ProtocolCpiFailed))?;

        let (shares, value) = read_drift_if_value(
            &ctx.accounts.insurance_fund_stake,
            &ctx.accounts.spot_market,
            &ctx.accounts.insurance_fund_vault,
        )?;

        let position = &mut ctx.accounts.position;
        position.deposited_amount = position
            .deposited_amount
            .checked_add(amount)
            .ok_or(DriftInsuranceFundError::MathOverflow)?;
        position.shares = u128_to_u64(shares)?;
        position.last_value = value;
        position.pending_withdraw_amount = 0;

        emit!(DriftInsuranceFundDeposit {
            owner: position.owner,
            mint: ctx.accounts.config.supported_mint,
            amount,
            shares: position.shares,
            value,
        });

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        validate_common(
            &ctx.accounts.config,
            &ctx.accounts.position,
            ctx.accounts.owner.key(),
            ctx.accounts.mint.key(),
            amount,
        )?;
        validate_withdraw_accounts(&ctx)?;

        let instruction = Instruction {
            program_id: ctx.accounts.drift_program.key(),
            accounts: vec![
                AccountMeta::new(ctx.accounts.spot_market.key(), false),
                AccountMeta::new(ctx.accounts.insurance_fund_stake.key(), false),
                AccountMeta::new(ctx.accounts.user_stats.key(), false),
                AccountMeta::new_readonly(ctx.accounts.owner.key(), true),
                AccountMeta::new(ctx.accounts.insurance_fund_vault.key(), false),
            ],
            data: amount_ix_data(
                REQUEST_REMOVE_INSURANCE_FUND_STAKE_IX_DISCRIMINATOR,
                ctx.accounts.position.market_index,
                amount,
            ),
        };

        invoke(
            &instruction,
            &[
                ctx.accounts.spot_market.to_account_info(),
                ctx.accounts.insurance_fund_stake.to_account_info(),
                ctx.accounts.user_stats.to_account_info(),
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.insurance_fund_vault.to_account_info(),
                ctx.accounts.drift_program.to_account_info(),
            ],
        )
        .map_err(|_| error!(DriftInsuranceFundError::ProtocolCpiFailed))?;

        let (shares, value) = read_drift_if_value(
            &ctx.accounts.insurance_fund_stake,
            &ctx.accounts.spot_market,
            &ctx.accounts.insurance_fund_vault,
        )?;

        let position = &mut ctx.accounts.position;
        position.shares = u128_to_u64(shares)?;
        position.last_value = value;
        position.pending_withdraw_amount = amount;

        emit!(DriftInsuranceFundWithdraw {
            owner: position.owner,
            mint: ctx.accounts.config.supported_mint,
            amount,
            shares: position.shares,
            value,
        });

        Ok(())
    }

    pub fn current_value(ctx: Context<CurrentValue>) -> Result<()> {
        validate_owner_and_mint(
            &ctx.accounts.config,
            &ctx.accounts.position,
            ctx.accounts.owner.key(),
            ctx.accounts.mint.key(),
        )?;
        validate_value_accounts(&ctx)?;

        let (shares, value) = read_drift_if_value(
            &ctx.accounts.insurance_fund_stake,
            &ctx.accounts.spot_market,
            &ctx.accounts.insurance_fund_vault,
        )?;
        set_return_data(&value.to_le_bytes());

        emit!(DriftInsuranceFundValue {
            owner: ctx.accounts.position.owner,
            mint: ctx.accounts.config.supported_mint,
            shares: u128_to_u64(shares)?,
            value,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(supported_mint: Pubkey, protocol_program_id: Pubkey, version: u16)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = DriftInsuranceFundConfig::LEN,
        seeds = [CONFIG_SEED, supported_mint.as_ref(), &version.to_le_bytes()],
        bump
    )]
    pub config: Account<'info, DriftInsuranceFundConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_index: u16, insurance_fund_stake: Pubkey, user_stats: Pubkey)]
pub struct InitializePosition<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, DriftInsuranceFundConfig>,
    #[account(
        init,
        payer = owner,
        space = DriftInsuranceFundPosition::LEN,
        seeds = [POSITION_SEED, config.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, DriftInsuranceFundPosition>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, DriftInsuranceFundConfig>,
    #[account(
        mut,
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, DriftInsuranceFundPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Validated against config.protocol_program_id.
    pub drift_program: UncheckedAccount<'info>,
    /// CHECK: Validated as a Drift-owned account.
    pub state: UncheckedAccount<'info>,
    /// CHECK: Validated as the configured Drift spot market PDA.
    #[account(mut)]
    pub spot_market: UncheckedAccount<'info>,
    /// CHECK: Validated as the configured IF stake PDA.
    #[account(mut)]
    pub insurance_fund_stake: UncheckedAccount<'info>,
    /// CHECK: Validated as the owner user stats PDA.
    #[account(mut)]
    pub user_stats: UncheckedAccount<'info>,
    /// CHECK: Validated as the configured spot market vault.
    #[account(mut)]
    pub spot_market_vault: UncheckedAccount<'info>,
    /// CHECK: Validated as the configured insurance fund vault.
    #[account(mut)]
    pub insurance_fund_vault: UncheckedAccount<'info>,
    /// CHECK: Validated as Drift signer PDA.
    pub drift_signer: UncheckedAccount<'info>,
    /// CHECK: Validated as owner's supported-mint token account.
    #[account(mut)]
    pub user_token_account: UncheckedAccount<'info>,
    /// CHECK: Validated as owner of user_token_account and IF vault token accounts.
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, DriftInsuranceFundConfig>,
    #[account(
        mut,
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, DriftInsuranceFundPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Validated against config.protocol_program_id.
    pub drift_program: UncheckedAccount<'info>,
    /// CHECK: Validated as the configured Drift spot market PDA.
    #[account(mut)]
    pub spot_market: UncheckedAccount<'info>,
    /// CHECK: Validated as the configured IF stake PDA.
    #[account(mut)]
    pub insurance_fund_stake: UncheckedAccount<'info>,
    /// CHECK: Validated as the owner user stats PDA.
    #[account(mut)]
    pub user_stats: UncheckedAccount<'info>,
    /// CHECK: Validated as the configured insurance fund vault.
    #[account(mut)]
    pub insurance_fund_vault: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CurrentValue<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, DriftInsuranceFundConfig>,
    #[account(
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, DriftInsuranceFundPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Validated against config.protocol_program_id.
    pub drift_program: UncheckedAccount<'info>,
    /// CHECK: Validated as the configured Drift spot market PDA.
    pub spot_market: UncheckedAccount<'info>,
    /// CHECK: Validated as the configured IF stake PDA.
    pub insurance_fund_stake: UncheckedAccount<'info>,
    /// CHECK: Validated as the configured insurance fund vault.
    pub insurance_fund_vault: UncheckedAccount<'info>,
}

#[account]
pub struct DriftInsuranceFundConfig {
    pub authority: Pubkey,
    pub supported_mint: Pubkey,
    pub protocol_program_id: Pubkey,
    pub version: u16,
    pub bump: u8,
}

impl DriftInsuranceFundConfig {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 1;
}

#[account]
pub struct DriftInsuranceFundPosition {
    pub owner: Pubkey,
    pub insurance_fund_stake: Pubkey,
    pub user_stats: Pubkey,
    pub market_index: u16,
    pub deposited_amount: u64,
    pub shares: u64,
    pub last_value: u64,
    pub pending_withdraw_amount: u64,
    pub bump: u8,
}

impl DriftInsuranceFundPosition {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 8 + 8 + 8 + 8 + 1;
}

#[event]
pub struct DriftInsuranceFundConfigInitialized {
    pub authority: Pubkey,
    pub supported_mint: Pubkey,
    pub protocol_program_id: Pubkey,
    pub version: u16,
}

#[event]
pub struct DriftInsuranceFundDeposit {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub value: u64,
}

#[event]
pub struct DriftInsuranceFundWithdraw {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub value: u64,
}

#[event]
pub struct DriftInsuranceFundValue {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub shares: u64,
    pub value: u64,
}

#[error_code]
pub enum DriftInsuranceFundError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Requested mint does not match this adapter config.")]
    InvalidMint,
    #[msg("Signer does not own this adapter position.")]
    InvalidOwner,
    #[msg("Passed Drift program does not match this adapter config.")]
    InvalidProtocolProgram,
    #[msg("Passed Drift account is not owned by the Drift program.")]
    InvalidProtocolAccount,
    #[msg("Passed Drift spot market is not the configured market PDA.")]
    InvalidSpotMarket,
    #[msg("Passed Drift insurance fund stake is not the configured stake PDA.")]
    InvalidInsuranceFundStake,
    #[msg("Passed Drift user stats account is not the owner stats PDA.")]
    InvalidUserStats,
    #[msg("Passed Drift vault does not match the spot market state.")]
    InvalidVault,
    #[msg("Passed token account is not an owner token account for the supported mint.")]
    InvalidTokenAccount,
    #[msg("Drift Insurance Fund CPI failed.")]
    ProtocolCpiFailed,
    #[msg("Math overflow or underflow occurred.")]
    MathOverflow,
}

fn validate_common(
    config: &DriftInsuranceFundConfig,
    position: &DriftInsuranceFundPosition,
    owner: Pubkey,
    mint: Pubkey,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, DriftInsuranceFundError::InvalidAmount);
    validate_owner_and_mint(config, position, owner, mint)
}

fn validate_owner_and_mint(
    config: &DriftInsuranceFundConfig,
    position: &DriftInsuranceFundPosition,
    owner: Pubkey,
    mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(mint, config.supported_mint, DriftInsuranceFundError::InvalidMint);
    require_keys_eq!(owner, position.owner, DriftInsuranceFundError::InvalidOwner);
    Ok(())
}

fn validate_deposit_accounts(ctx: &Context<Deposit>) -> Result<()> {
    validate_protocol_program(&ctx.accounts.config, ctx.accounts.drift_program.key())?;
    validate_drift_owned(&ctx.accounts.state, ctx.accounts.drift_program.key())?;
    validate_common_drift_accounts(
        &ctx.accounts.config,
        &ctx.accounts.position,
        &ctx.accounts.drift_program,
        &ctx.accounts.spot_market,
        &ctx.accounts.insurance_fund_stake,
        Some(&ctx.accounts.user_stats),
        &ctx.accounts.insurance_fund_vault,
    )?;
    validate_spot_market_vault(
        &ctx.accounts.spot_market,
        ctx.accounts.spot_market_vault.key(),
    )?;
    validate_drift_signer(
        ctx.accounts.config.protocol_program_id,
        ctx.accounts.drift_signer.key(),
    )?;
    validate_token_account(
        &ctx.accounts.user_token_account,
        &ctx.accounts.token_program,
        ctx.accounts.config.supported_mint,
        ctx.accounts.owner.key(),
    )?;
    validate_if_vault_token_account(
        &ctx.accounts.insurance_fund_vault,
        &ctx.accounts.token_program,
        ctx.accounts.config.supported_mint,
    )
}

fn validate_withdraw_accounts(ctx: &Context<Withdraw>) -> Result<()> {
    validate_protocol_program(&ctx.accounts.config, ctx.accounts.drift_program.key())?;
    validate_common_drift_accounts(
        &ctx.accounts.config,
        &ctx.accounts.position,
        &ctx.accounts.drift_program,
        &ctx.accounts.spot_market,
        &ctx.accounts.insurance_fund_stake,
        Some(&ctx.accounts.user_stats),
        &ctx.accounts.insurance_fund_vault,
    )
}

fn validate_value_accounts(ctx: &Context<CurrentValue>) -> Result<()> {
    validate_protocol_program(&ctx.accounts.config, ctx.accounts.drift_program.key())?;
    validate_common_drift_accounts(
        &ctx.accounts.config,
        &ctx.accounts.position,
        &ctx.accounts.drift_program,
        &ctx.accounts.spot_market,
        &ctx.accounts.insurance_fund_stake,
        None,
        &ctx.accounts.insurance_fund_vault,
    )
}

fn validate_protocol_program(config: &DriftInsuranceFundConfig, drift_program: Pubkey) -> Result<()> {
    require_keys_eq!(
        drift_program,
        config.protocol_program_id,
        DriftInsuranceFundError::InvalidProtocolProgram
    );
    Ok(())
}

fn validate_common_drift_accounts<'info>(
    config: &DriftInsuranceFundConfig,
    position: &DriftInsuranceFundPosition,
    drift_program: &UncheckedAccount<'info>,
    spot_market: &UncheckedAccount<'info>,
    insurance_fund_stake: &UncheckedAccount<'info>,
    user_stats: Option<&UncheckedAccount<'info>>,
    insurance_fund_vault: &UncheckedAccount<'info>,
) -> Result<()> {
    validate_drift_owned(spot_market, drift_program.key())?;
    validate_drift_owned(insurance_fund_stake, drift_program.key())?;
    if let Some(user_stats) = user_stats {
        validate_drift_owned(user_stats, drift_program.key())?;
        require_keys_eq!(
            user_stats.key(),
            position.user_stats,
            DriftInsuranceFundError::InvalidUserStats
        );
    }

    let expected_spot_market = derive_spot_market(config.protocol_program_id, position.market_index);
    require_keys_eq!(
        spot_market.key(),
        expected_spot_market,
        DriftInsuranceFundError::InvalidSpotMarket
    );

    let expected_if_stake = derive_insurance_fund_stake(
        config.protocol_program_id,
        position.owner,
        position.market_index,
    );
    require_keys_eq!(
        insurance_fund_stake.key(),
        position.insurance_fund_stake,
        DriftInsuranceFundError::InvalidInsuranceFundStake
    );
    require_keys_eq!(
        insurance_fund_stake.key(),
        expected_if_stake,
        DriftInsuranceFundError::InvalidInsuranceFundStake
    );

    let stake_data = insurance_fund_stake.try_borrow_data()?;
    require_keys_eq!(
        read_pubkey(&stake_data, IF_STAKE_AUTHORITY_OFFSET)?,
        position.owner,
        DriftInsuranceFundError::InvalidOwner
    );
    require!(
        read_u16(&stake_data, IF_STAKE_MARKET_INDEX_OFFSET)? == position.market_index,
        DriftInsuranceFundError::InvalidInsuranceFundStake
    );
    drop(stake_data);

    let spot_data = spot_market.try_borrow_data()?;
    require_keys_eq!(
        read_pubkey(&spot_data, SPOT_MARKET_PUBKEY_OFFSET)?,
        spot_market.key(),
        DriftInsuranceFundError::InvalidSpotMarket
    );
    require_keys_eq!(
        read_pubkey(&spot_data, SPOT_MARKET_MINT_OFFSET)?,
        config.supported_mint,
        DriftInsuranceFundError::InvalidMint
    );
    require_keys_eq!(
        read_pubkey(&spot_data, SPOT_MARKET_IF_VAULT_OFFSET)?,
        insurance_fund_vault.key(),
        DriftInsuranceFundError::InvalidVault
    );
    drop(spot_data);

    let expected_if_vault = derive_insurance_fund_vault(config.protocol_program_id, position.market_index);
    require_keys_eq!(
        insurance_fund_vault.key(),
        expected_if_vault,
        DriftInsuranceFundError::InvalidVault
    );

    Ok(())
}

fn validate_drift_owned<'info>(
    account: &UncheckedAccount<'info>,
    drift_program: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        *account.owner,
        drift_program,
        DriftInsuranceFundError::InvalidProtocolAccount
    );
    Ok(())
}

fn validate_spot_market_vault<'info>(
    spot_market: &UncheckedAccount<'info>,
    spot_market_vault: Pubkey,
) -> Result<()> {
    let spot_data = spot_market.try_borrow_data()?;
    require_keys_eq!(
        read_pubkey(&spot_data, SPOT_MARKET_VAULT_OFFSET)?,
        spot_market_vault,
        DriftInsuranceFundError::InvalidVault
    );
    Ok(())
}

fn validate_drift_signer(drift_program: Pubkey, drift_signer: Pubkey) -> Result<()> {
    let (expected, _bump) = Pubkey::find_program_address(&[DRIFT_SIGNER_SEED], &drift_program);
    require_keys_eq!(drift_signer, expected, DriftInsuranceFundError::InvalidVault);
    Ok(())
}

fn validate_token_account<'info>(
    token_account: &UncheckedAccount<'info>,
    token_program: &UncheckedAccount<'info>,
    expected_mint: Pubkey,
    expected_owner: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        *token_account.owner,
        token_program.key(),
        DriftInsuranceFundError::InvalidTokenAccount
    );
    let token_data = token_account.try_borrow_data()?;
    require_keys_eq!(
        read_pubkey(&token_data, TOKEN_ACCOUNT_MINT_OFFSET)?,
        expected_mint,
        DriftInsuranceFundError::InvalidTokenAccount
    );
    require_keys_eq!(
        read_pubkey(&token_data, TOKEN_ACCOUNT_OWNER_OFFSET)?,
        expected_owner,
        DriftInsuranceFundError::InvalidTokenAccount
    );
    Ok(())
}

fn validate_if_vault_token_account<'info>(
    token_account: &UncheckedAccount<'info>,
    token_program: &UncheckedAccount<'info>,
    expected_mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        *token_account.owner,
        token_program.key(),
        DriftInsuranceFundError::InvalidTokenAccount
    );
    let token_data = token_account.try_borrow_data()?;
    require_keys_eq!(
        read_pubkey(&token_data, TOKEN_ACCOUNT_MINT_OFFSET)?,
        expected_mint,
        DriftInsuranceFundError::InvalidTokenAccount
    );
    Ok(())
}

fn read_drift_if_value<'info>(
    insurance_fund_stake: &UncheckedAccount<'info>,
    spot_market: &UncheckedAccount<'info>,
    insurance_fund_vault: &UncheckedAccount<'info>,
) -> Result<(u128, u64)> {
    let stake_data = insurance_fund_stake.try_borrow_data()?;
    let spot_data = spot_market.try_borrow_data()?;
    let vault_data = insurance_fund_vault.try_borrow_data()?;

    let shares = read_u128(&stake_data, IF_STAKE_IF_SHARES_OFFSET)?;
    let withdraw_request_shares =
        read_u128(&stake_data, IF_STAKE_LAST_WITHDRAW_REQUEST_SHARES_OFFSET)?;
    let withdraw_request_value =
        read_u64(&stake_data, IF_STAKE_LAST_WITHDRAW_REQUEST_VALUE_OFFSET)?;
    let total_shares = read_u128(&spot_data, SPOT_MARKET_IF_TOTAL_SHARES_OFFSET)?;
    let vault_amount = read_u64(&vault_data, TOKEN_ACCOUNT_AMOUNT_OFFSET)?;

    let active_shares = shares
        .checked_sub(withdraw_request_shares)
        .ok_or(DriftInsuranceFundError::MathOverflow)?;
    let active_value = shares_to_amount(active_shares, total_shares, vault_amount)?;
    let pending_value = shares_to_amount(withdraw_request_shares, total_shares, vault_amount)?
        .min(withdraw_request_value);
    let value = active_value
        .checked_add(pending_value)
        .ok_or(DriftInsuranceFundError::MathOverflow)?;

    Ok((shares, value))
}

fn shares_to_amount(shares: u128, total_shares: u128, vault_amount: u64) -> Result<u64> {
    if total_shares == 0 {
        return Ok(0);
    }
    let value = shares
        .checked_mul(vault_amount as u128)
        .ok_or(DriftInsuranceFundError::MathOverflow)?
        .checked_div(total_shares)
        .ok_or(DriftInsuranceFundError::MathOverflow)?;
    u128_to_u64(value)
}

fn amount_ix_data(discriminator: [u8; 8], market_index: u16, amount: u64) -> Vec<u8> {
    let mut data = Vec::with_capacity(18);
    data.extend_from_slice(&discriminator);
    data.extend_from_slice(&market_index.to_le_bytes());
    data.extend_from_slice(&amount.to_le_bytes());
    data
}

fn derive_spot_market(drift_program: Pubkey, market_index: u16) -> Pubkey {
    let market_index_bytes = market_index.to_le_bytes();
    Pubkey::find_program_address(&[DRIFT_SPOT_MARKET_SEED, &market_index_bytes], &drift_program).0
}

fn derive_insurance_fund_vault(drift_program: Pubkey, market_index: u16) -> Pubkey {
    let market_index_bytes = market_index.to_le_bytes();
    Pubkey::find_program_address(
        &[DRIFT_INSURANCE_FUND_VAULT_SEED, &market_index_bytes],
        &drift_program,
    )
    .0
}

fn derive_insurance_fund_stake(
    drift_program: Pubkey,
    owner: Pubkey,
    market_index: u16,
) -> Pubkey {
    let market_index_bytes = market_index.to_le_bytes();
    Pubkey::find_program_address(
        &[
            DRIFT_INSURANCE_FUND_STAKE_SEED,
            owner.as_ref(),
            &market_index_bytes,
        ],
        &drift_program,
    )
    .0
}

fn derive_user_stats(drift_program: Pubkey, owner: Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[DRIFT_USER_STATS_SEED, owner.as_ref()], &drift_program).0
}

fn read_pubkey(data: &[u8], offset: usize) -> Result<Pubkey> {
    require!(
        data.len() >= offset + 32,
        DriftInsuranceFundError::InvalidProtocolAccount
    );
    let mut bytes = [0_u8; 32];
    bytes.copy_from_slice(&data[offset..offset + 32]);
    Ok(Pubkey::new_from_array(bytes))
}

fn read_u16(data: &[u8], offset: usize) -> Result<u16> {
    require!(
        data.len() >= offset + 2,
        DriftInsuranceFundError::InvalidProtocolAccount
    );
    let mut bytes = [0_u8; 2];
    bytes.copy_from_slice(&data[offset..offset + 2]);
    Ok(u16::from_le_bytes(bytes))
}

fn read_u64(data: &[u8], offset: usize) -> Result<u64> {
    require!(
        data.len() >= offset + 8,
        DriftInsuranceFundError::InvalidProtocolAccount
    );
    let mut bytes = [0_u8; 8];
    bytes.copy_from_slice(&data[offset..offset + 8]);
    Ok(u64::from_le_bytes(bytes))
}

fn read_u128(data: &[u8], offset: usize) -> Result<u128> {
    require!(
        data.len() >= offset + 16,
        DriftInsuranceFundError::InvalidProtocolAccount
    );
    let mut bytes = [0_u8; 16];
    bytes.copy_from_slice(&data[offset..offset + 16]);
    Ok(u128::from_le_bytes(bytes))
}

fn u128_to_u64(value: u128) -> Result<u64> {
    u64::try_from(value).map_err(|_| error!(DriftInsuranceFundError::MathOverflow))
}

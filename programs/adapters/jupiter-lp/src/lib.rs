use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{invoke, set_return_data},
};

pub mod constants;

use constants::{
    JLP_MINT, JLP_POOL, JLP_USDC_CUSTODY, JLP_USDC_DOVES_AG_PRICE_ACCOUNT,
    JUPITER_PERPS_PROGRAM_ID, TOKEN_PROGRAM_ID,
};

declare_id!("daJFQSrSNB3zApEGUjZuWEXnVhM2vmjpDptc1cG9s6D");

pub const CONFIG_SEED: &[u8] = b"jupiter_lp_config";
pub const POSITION_SEED: &[u8] = b"jupiter_lp_position";

const PERPETUALS_SEED: &[u8] = b"perpetuals";
const TRANSFER_AUTHORITY_SEED: &[u8] = b"transfer_authority";
const EVENT_AUTHORITY_SEED: &[u8] = b"__event_authority";
const LP_TOKEN_MINT_SEED: &[u8] = b"lp_token_mint";

const ADD_LIQUIDITY2_IX_DISCRIMINATOR: [u8; 8] = [228, 162, 78, 28, 70, 219, 116, 115];
const REMOVE_LIQUIDITY2_IX_DISCRIMINATOR: [u8; 8] = [230, 215, 82, 127, 241, 101, 227, 146];

const POOL_DISCRIMINATOR: [u8; 8] = [241, 154, 109, 4, 17, 177, 109, 188];
const CUSTODY_DISCRIMINATOR: [u8; 8] = [1, 184, 48, 81, 93, 131, 63, 145];

const TOKEN_ACCOUNT_MINT_OFFSET: usize = 0;
const TOKEN_ACCOUNT_OWNER_OFFSET: usize = 32;
const TOKEN_ACCOUNT_AMOUNT_OFFSET: usize = 64;
const MINT_SUPPLY_OFFSET: usize = 36;
const MINT_DECIMALS_OFFSET: usize = 44;

const CUSTODY_POOL_OFFSET: usize = 8;
const CUSTODY_MINT_OFFSET: usize = 40;
const CUSTODY_TOKEN_ACCOUNT_OFFSET: usize = 72;
const CUSTODY_PYTHNET_PRICE_ACCOUNT_OFFSET: usize = 106;
const CUSTODY_DOVES_AG_PRICE_ACCOUNT_OFFSET: usize = 384;

const POOL_NAME_OFFSET: usize = 8;
const BPS_DENOMINATOR: u128 = 10_000;
const DEPOSIT_MIN_OUT_BPS: u128 = 9_500;
const WITHDRAW_BURN_BUFFER_BPS: u128 = 10_100;

#[program]
pub mod jupiter_lp {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        supported_mint: Pubkey,
        protocol_program_id: Pubkey,
        version: u16,
    ) -> Result<()> {
        require_keys_neq!(supported_mint, Pubkey::default(), JupiterLpError::InvalidMint);
        require_keys_neq!(
            protocol_program_id,
            Pubkey::default(),
            JupiterLpError::InvalidProtocolProgram
        );

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.supported_mint = supported_mint;
        config.protocol_program_id = protocol_program_id;
        config.version = version;
        config.bump = ctx.bumps.config;

        emit!(JupiterLpConfigInitialized {
            authority: config.authority,
            supported_mint,
            protocol_program_id,
            version,
        });

        Ok(())
    }

    pub fn initialize_position(
        ctx: Context<InitializePosition>,
        pool: Pubkey,
        custody: Pubkey,
        lp_token_account: Pubkey,
    ) -> Result<()> {
        require_keys_neq!(pool, Pubkey::default(), JupiterLpError::InvalidPool);
        require_keys_neq!(custody, Pubkey::default(), JupiterLpError::InvalidCustody);
        require_keys_neq!(
            lp_token_account,
            Pubkey::default(),
            JupiterLpError::InvalidTokenAccount
        );

        let position = &mut ctx.accounts.position;
        position.owner = ctx.accounts.owner.key();
        position.pool = pool;
        position.custody = custody;
        position.lp_token_account = lp_token_account;
        position.deposited_amount = 0;
        position.shares = 0;
        position.last_value = 0;
        position.bump = ctx.bumps.position;

        Ok(())
    }

    pub fn deposit<'info>(
        ctx: Context<'_, '_, '_, 'info, Deposit<'info>>,
        amount: u64,
    ) -> Result<()> {
        validate_common(
            &ctx.accounts.config,
            &ctx.accounts.position,
            ctx.accounts.owner.key(),
            ctx.accounts.mint.key(),
            amount,
        )?;
        let pool_aum = validate_deposit_accounts(&ctx)?;
        let lp_supply = read_mint_supply(&ctx.accounts.lp_token_mint)?;
        let quoted_lp = usdc_to_lp_floor(amount, pool_aum, lp_supply)?;
        let min_lp_amount_out = apply_bps_floor(quoted_lp, DEPOSIT_MIN_OUT_BPS)?;

        let before_shares = read_token_amount(&ctx.accounts.lp_token_account)?;
        let mut instruction = Instruction {
            program_id: ctx.accounts.jupiter_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.owner.key(), true),
                AccountMeta::new(ctx.accounts.funding_account.key(), false),
                AccountMeta::new(ctx.accounts.lp_token_account.key(), false),
                AccountMeta::new_readonly(ctx.accounts.transfer_authority.key(), false),
                AccountMeta::new_readonly(ctx.accounts.perpetuals.key(), false),
                AccountMeta::new(ctx.accounts.pool.key(), false),
                AccountMeta::new(ctx.accounts.custody.key(), false),
                AccountMeta::new_readonly(ctx.accounts.custody_doves_price_account.key(), false),
                AccountMeta::new_readonly(ctx.accounts.custody_pythnet_price_account.key(), false),
                AccountMeta::new(ctx.accounts.custody_token_account.key(), false),
                AccountMeta::new(ctx.accounts.lp_token_mint.key(), false),
                AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.event_authority.key(), false),
                AccountMeta::new_readonly(ctx.accounts.jupiter_program.key(), false),
            ],
            data: add_liquidity2_ix_data(amount, min_lp_amount_out),
        };

        let mut account_infos = jupiter_liquidity_account_infos(
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.funding_account.to_account_info(),
            ctx.accounts.lp_token_account.to_account_info(),
            ctx.accounts.transfer_authority.to_account_info(),
            ctx.accounts.perpetuals.to_account_info(),
            ctx.accounts.pool.to_account_info(),
            ctx.accounts.custody.to_account_info(),
            ctx.accounts.custody_doves_price_account.to_account_info(),
            ctx.accounts.custody_pythnet_price_account.to_account_info(),
            ctx.accounts.custody_token_account.to_account_info(),
            ctx.accounts.lp_token_mint.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.event_authority.to_account_info(),
            ctx.accounts.jupiter_program.to_account_info(),
        );
        append_cpi_remaining_accounts(
            &mut instruction,
            &mut account_infos,
            ctx.remaining_accounts,
        );

        invoke(&instruction, &account_infos)
        .map_err(|_| error!(JupiterLpError::ProtocolCpiFailed))?;

        let shares = read_token_amount(&ctx.accounts.lp_token_account)?;
        require!(shares >= before_shares, JupiterLpError::MathOverflow);
        let value = lp_to_usdc_floor(shares, read_pool_aum(&ctx.accounts.pool)?, read_mint_supply(&ctx.accounts.lp_token_mint)?)?;
        let minted_shares = shares
            .checked_sub(before_shares)
            .ok_or(JupiterLpError::MathOverflow)?;
        let position = &mut ctx.accounts.position;
        position.deposited_amount = position
            .deposited_amount
            .checked_add(amount)
            .ok_or(JupiterLpError::MathOverflow)?;
        position.shares = shares;
        position.last_value = value;

        emit!(JupiterLpDeposit {
            owner: position.owner,
            mint: ctx.accounts.config.supported_mint,
            amount,
            shares,
            minted_shares,
            value,
        });

        Ok(())
    }

    pub fn withdraw<'info>(
        ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
        amount: u64,
    ) -> Result<()> {
        validate_common(
            &ctx.accounts.config,
            &ctx.accounts.position,
            ctx.accounts.owner.key(),
            ctx.accounts.mint.key(),
            amount,
        )?;
        let pool_aum = validate_withdraw_accounts(&ctx)?;
        let lp_supply = read_mint_supply(&ctx.accounts.lp_token_mint)?;
        let base_lp_amount = usdc_to_lp_ceil(amount, pool_aum, lp_supply)?;
        let lp_amount_in = apply_bps_ceil(base_lp_amount, WITHDRAW_BURN_BUFFER_BPS)?;
        let before_shares = read_token_amount(&ctx.accounts.lp_token_account)?;
        require!(before_shares >= lp_amount_in, JupiterLpError::InvalidAmount);

        let mut instruction = Instruction {
            program_id: ctx.accounts.jupiter_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.owner.key(), true),
                AccountMeta::new(ctx.accounts.receiving_account.key(), false),
                AccountMeta::new(ctx.accounts.lp_token_account.key(), false),
                AccountMeta::new_readonly(ctx.accounts.transfer_authority.key(), false),
                AccountMeta::new_readonly(ctx.accounts.perpetuals.key(), false),
                AccountMeta::new(ctx.accounts.pool.key(), false),
                AccountMeta::new(ctx.accounts.custody.key(), false),
                AccountMeta::new_readonly(ctx.accounts.custody_doves_price_account.key(), false),
                AccountMeta::new_readonly(ctx.accounts.custody_pythnet_price_account.key(), false),
                AccountMeta::new(ctx.accounts.custody_token_account.key(), false),
                AccountMeta::new(ctx.accounts.lp_token_mint.key(), false),
                AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.event_authority.key(), false),
                AccountMeta::new_readonly(ctx.accounts.jupiter_program.key(), false),
            ],
            data: remove_liquidity2_ix_data(lp_amount_in, amount),
        };

        let mut account_infos = jupiter_liquidity_account_infos(
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.receiving_account.to_account_info(),
            ctx.accounts.lp_token_account.to_account_info(),
            ctx.accounts.transfer_authority.to_account_info(),
            ctx.accounts.perpetuals.to_account_info(),
            ctx.accounts.pool.to_account_info(),
            ctx.accounts.custody.to_account_info(),
            ctx.accounts.custody_doves_price_account.to_account_info(),
            ctx.accounts.custody_pythnet_price_account.to_account_info(),
            ctx.accounts.custody_token_account.to_account_info(),
            ctx.accounts.lp_token_mint.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.event_authority.to_account_info(),
            ctx.accounts.jupiter_program.to_account_info(),
        );
        append_cpi_remaining_accounts(
            &mut instruction,
            &mut account_infos,
            ctx.remaining_accounts,
        );

        invoke(&instruction, &account_infos)
        .map_err(|_| error!(JupiterLpError::ProtocolCpiFailed))?;

        let shares = read_token_amount(&ctx.accounts.lp_token_account)?;
        require!(shares <= before_shares, JupiterLpError::MathOverflow);
        let value = lp_to_usdc_floor(shares, read_pool_aum(&ctx.accounts.pool)?, read_mint_supply(&ctx.accounts.lp_token_mint)?)?;
        let burned_shares = before_shares
            .checked_sub(shares)
            .ok_or(JupiterLpError::MathOverflow)?;
        let position = &mut ctx.accounts.position;
        position.deposited_amount = position.deposited_amount.saturating_sub(amount);
        position.shares = shares;
        position.last_value = value;

        emit!(JupiterLpWithdraw {
            owner: position.owner,
            mint: ctx.accounts.config.supported_mint,
            amount,
            shares,
            burned_shares,
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
        let pool_aum = validate_value_accounts(&ctx)?;
        let shares = read_token_amount(&ctx.accounts.lp_token_account)?;
        let lp_supply = read_mint_supply(&ctx.accounts.lp_token_mint)?;
        let value = lp_to_usdc_floor(shares, pool_aum, lp_supply)?;
        set_return_data(&value.to_le_bytes());

        emit!(JupiterLpValue {
            owner: ctx.accounts.position.owner,
            mint: ctx.accounts.config.supported_mint,
            shares,
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
        space = JupiterLpConfig::LEN,
        seeds = [CONFIG_SEED, supported_mint.as_ref(), &version.to_le_bytes()],
        bump
    )]
    pub config: Account<'info, JupiterLpConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePosition<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, JupiterLpConfig>,
    #[account(
        init,
        payer = owner,
        space = JupiterLpPosition::LEN,
        seeds = [POSITION_SEED, config.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, JupiterLpPosition>,
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
    pub config: Account<'info, JupiterLpConfig>,
    #[account(
        mut,
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, JupiterLpPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Validated against config.protocol_program_id and known Jupiter program id.
    pub jupiter_program: UncheckedAccount<'info>,
    /// CHECK: SPL token account validated by mint and owner.
    #[account(mut)]
    pub funding_account: UncheckedAccount<'info>,
    /// CHECK: SPL JLP token account validated by mint and owner.
    #[account(mut)]
    pub lp_token_account: UncheckedAccount<'info>,
    /// CHECK: Derived from Jupiter program.
    pub transfer_authority: UncheckedAccount<'info>,
    /// CHECK: Derived from Jupiter program and data-checked.
    pub perpetuals: UncheckedAccount<'info>,
    /// CHECK: Jupiter pool state checked by discriminator and custody membership.
    #[account(mut)]
    pub pool: UncheckedAccount<'info>,
    /// CHECK: Jupiter custody state checked by discriminator, pool, mint, vault, and oracle accounts.
    #[account(mut)]
    pub custody: UncheckedAccount<'info>,
    /// CHECK: Checked against custody.doves_ag_oracle.
    pub custody_doves_price_account: UncheckedAccount<'info>,
    /// CHECK: Checked against custody.oracle.oracle_account.
    pub custody_pythnet_price_account: UncheckedAccount<'info>,
    /// CHECK: Checked against custody.token_account.
    #[account(mut)]
    pub custody_token_account: UncheckedAccount<'info>,
    /// CHECK: Checked as JLP mint PDA and SPL mint.
    #[account(mut)]
    pub lp_token_mint: UncheckedAccount<'info>,
    /// CHECK: Checked against SPL token program id.
    pub token_program: UncheckedAccount<'info>,
    /// CHECK: Derived Anchor event authority PDA for Jupiter program.
    pub event_authority: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, JupiterLpConfig>,
    #[account(
        mut,
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, JupiterLpPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Validated against config.protocol_program_id and known Jupiter program id.
    pub jupiter_program: UncheckedAccount<'info>,
    /// CHECK: SPL token account validated by mint and owner.
    #[account(mut)]
    pub receiving_account: UncheckedAccount<'info>,
    /// CHECK: SPL JLP token account validated by mint and owner.
    #[account(mut)]
    pub lp_token_account: UncheckedAccount<'info>,
    /// CHECK: Derived from Jupiter program.
    pub transfer_authority: UncheckedAccount<'info>,
    /// CHECK: Derived from Jupiter program and data-checked.
    pub perpetuals: UncheckedAccount<'info>,
    /// CHECK: Jupiter pool state checked by discriminator and custody membership.
    #[account(mut)]
    pub pool: UncheckedAccount<'info>,
    /// CHECK: Jupiter custody state checked by discriminator, pool, mint, vault, and oracle accounts.
    #[account(mut)]
    pub custody: UncheckedAccount<'info>,
    /// CHECK: Checked against custody.doves_ag_oracle.
    pub custody_doves_price_account: UncheckedAccount<'info>,
    /// CHECK: Checked against custody.oracle.oracle_account.
    pub custody_pythnet_price_account: UncheckedAccount<'info>,
    /// CHECK: Checked against custody.token_account.
    #[account(mut)]
    pub custody_token_account: UncheckedAccount<'info>,
    /// CHECK: Checked as JLP mint PDA and SPL mint.
    #[account(mut)]
    pub lp_token_mint: UncheckedAccount<'info>,
    /// CHECK: Checked against SPL token program id.
    pub token_program: UncheckedAccount<'info>,
    /// CHECK: Derived Anchor event authority PDA for Jupiter program.
    pub event_authority: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CurrentValue<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, JupiterLpConfig>,
    #[account(
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, JupiterLpPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Jupiter pool state checked by discriminator and custody membership.
    pub pool: UncheckedAccount<'info>,
    /// CHECK: Jupiter custody state checked by discriminator and pool/mint.
    pub custody: UncheckedAccount<'info>,
    /// CHECK: SPL JLP token account validated by mint and owner.
    pub lp_token_account: UncheckedAccount<'info>,
    /// CHECK: Checked as JLP mint PDA and SPL mint.
    pub lp_token_mint: UncheckedAccount<'info>,
}

#[account]
pub struct JupiterLpConfig {
    pub authority: Pubkey,
    pub supported_mint: Pubkey,
    pub protocol_program_id: Pubkey,
    pub version: u16,
    pub bump: u8,
}

impl JupiterLpConfig {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 1;
}

#[account]
pub struct JupiterLpPosition {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub custody: Pubkey,
    pub lp_token_account: Pubkey,
    pub deposited_amount: u64,
    pub shares: u64,
    pub last_value: u64,
    pub bump: u8,
}

impl JupiterLpPosition {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1;
}

#[event]
pub struct JupiterLpConfigInitialized {
    pub authority: Pubkey,
    pub supported_mint: Pubkey,
    pub protocol_program_id: Pubkey,
    pub version: u16,
}

#[event]
pub struct JupiterLpDeposit {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub minted_shares: u64,
    pub value: u64,
}

#[event]
pub struct JupiterLpWithdraw {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub burned_shares: u64,
    pub value: u64,
}

#[event]
pub struct JupiterLpValue {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub shares: u64,
    pub value: u64,
}

#[error_code]
pub enum JupiterLpError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Requested mint does not match this adapter config.")]
    InvalidMint,
    #[msg("Signer does not own this adapter position.")]
    InvalidOwner,
    #[msg("Jupiter LP CPI failed.")]
    ProtocolCpiFailed,
    #[msg("Math overflow or underflow occurred.")]
    MathOverflow,
    #[msg("Protocol program id is invalid.")]
    InvalidProtocolProgram,
    #[msg("Jupiter pool account is invalid.")]
    InvalidPool,
    #[msg("Jupiter custody account is invalid.")]
    InvalidCustody,
    #[msg("Jupiter perpetuals account is invalid.")]
    InvalidPerpetuals,
    #[msg("Jupiter transfer authority is invalid.")]
    InvalidTransferAuthority,
    #[msg("Jupiter event authority is invalid.")]
    InvalidEventAuthority,
    #[msg("SPL token account or mint is invalid.")]
    InvalidTokenAccount,
}

fn validate_common(
    config: &JupiterLpConfig,
    position: &JupiterLpPosition,
    owner: Pubkey,
    mint: Pubkey,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, JupiterLpError::InvalidAmount);
    validate_owner_and_mint(config, position, owner, mint)
}

fn validate_owner_and_mint(
    config: &JupiterLpConfig,
    position: &JupiterLpPosition,
    owner: Pubkey,
    mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(mint, config.supported_mint, JupiterLpError::InvalidMint);
    require_keys_eq!(owner, position.owner, JupiterLpError::InvalidOwner);
    Ok(())
}

fn validate_deposit_accounts(ctx: &Context<Deposit>) -> Result<u128> {
    validate_protocol_program(ctx.accounts.config.protocol_program_id, ctx.accounts.jupiter_program.key())?;
    validate_jupiter_pdas(
        ctx.accounts.jupiter_program.key(),
        ctx.accounts.transfer_authority.key(),
        ctx.accounts.perpetuals.key(),
        ctx.accounts.event_authority.key(),
    )?;
    validate_token_program(ctx.accounts.token_program.key())?;
    validate_static_position_accounts(
        &ctx.accounts.position,
        ctx.accounts.pool.key(),
        ctx.accounts.custody.key(),
        ctx.accounts.lp_token_account.key(),
    )?;
    validate_token_account(
        &ctx.accounts.funding_account,
        &ctx.accounts.token_program,
        ctx.accounts.config.supported_mint,
        ctx.accounts.owner.key(),
    )?;
    validate_token_account(
        &ctx.accounts.lp_token_account,
        &ctx.accounts.token_program,
        JLP_MINT,
        ctx.accounts.owner.key(),
    )?;
    validate_jlp_mint(
        &ctx.accounts.lp_token_mint,
        &ctx.accounts.token_program,
        ctx.accounts.jupiter_program.key(),
        ctx.accounts.pool.key(),
    )?;
    validate_custody_accounts(
        &ctx.accounts.custody,
        ctx.accounts.pool.key(),
        ctx.accounts.config.supported_mint,
        ctx.accounts.custody_token_account.key(),
        ctx.accounts.custody_doves_price_account.key(),
        ctx.accounts.custody_pythnet_price_account.key(),
    )?;
    validate_perpetuals(&ctx.accounts.perpetuals, ctx.accounts.pool.key())?;
    read_pool_aum_with_custody(&ctx.accounts.pool, ctx.accounts.custody.key())
}

fn validate_withdraw_accounts(ctx: &Context<Withdraw>) -> Result<u128> {
    validate_protocol_program(ctx.accounts.config.protocol_program_id, ctx.accounts.jupiter_program.key())?;
    validate_jupiter_pdas(
        ctx.accounts.jupiter_program.key(),
        ctx.accounts.transfer_authority.key(),
        ctx.accounts.perpetuals.key(),
        ctx.accounts.event_authority.key(),
    )?;
    validate_token_program(ctx.accounts.token_program.key())?;
    validate_static_position_accounts(
        &ctx.accounts.position,
        ctx.accounts.pool.key(),
        ctx.accounts.custody.key(),
        ctx.accounts.lp_token_account.key(),
    )?;
    validate_token_account(
        &ctx.accounts.receiving_account,
        &ctx.accounts.token_program,
        ctx.accounts.config.supported_mint,
        ctx.accounts.owner.key(),
    )?;
    validate_token_account(
        &ctx.accounts.lp_token_account,
        &ctx.accounts.token_program,
        JLP_MINT,
        ctx.accounts.owner.key(),
    )?;
    validate_jlp_mint(
        &ctx.accounts.lp_token_mint,
        &ctx.accounts.token_program,
        ctx.accounts.jupiter_program.key(),
        ctx.accounts.pool.key(),
    )?;
    validate_custody_accounts(
        &ctx.accounts.custody,
        ctx.accounts.pool.key(),
        ctx.accounts.config.supported_mint,
        ctx.accounts.custody_token_account.key(),
        ctx.accounts.custody_doves_price_account.key(),
        ctx.accounts.custody_pythnet_price_account.key(),
    )?;
    validate_perpetuals(&ctx.accounts.perpetuals, ctx.accounts.pool.key())?;
    read_pool_aum_with_custody(&ctx.accounts.pool, ctx.accounts.custody.key())
}

fn validate_value_accounts(ctx: &Context<CurrentValue>) -> Result<u128> {
    validate_static_position_accounts(
        &ctx.accounts.position,
        ctx.accounts.pool.key(),
        ctx.accounts.custody.key(),
        ctx.accounts.lp_token_account.key(),
    )?;
    validate_token_account_with_owner_only(
        &ctx.accounts.lp_token_account,
        JLP_MINT,
        ctx.accounts.owner.key(),
    )?;
    validate_mint_with_owner_only(&ctx.accounts.lp_token_mint, JLP_MINT)?;
    validate_custody_basic(
        &ctx.accounts.custody,
        ctx.accounts.pool.key(),
        ctx.accounts.config.supported_mint,
    )?;
    read_pool_aum_with_custody(&ctx.accounts.pool, ctx.accounts.custody.key())
}

fn validate_protocol_program(config_program: Pubkey, passed_program: Pubkey) -> Result<()> {
    require_keys_eq!(
        config_program,
        passed_program,
        JupiterLpError::InvalidProtocolProgram
    );
    require_keys_eq!(
        passed_program,
        JUPITER_PERPS_PROGRAM_ID,
        JupiterLpError::InvalidProtocolProgram
    );
    Ok(())
}

fn validate_token_program(token_program: Pubkey) -> Result<()> {
    require_keys_eq!(token_program, TOKEN_PROGRAM_ID, JupiterLpError::InvalidTokenAccount);
    Ok(())
}

fn validate_static_position_accounts(
    position: &JupiterLpPosition,
    pool: Pubkey,
    custody: Pubkey,
    lp_token_account: Pubkey,
) -> Result<()> {
    require_keys_eq!(pool, position.pool, JupiterLpError::InvalidPool);
    require_keys_eq!(pool, JLP_POOL, JupiterLpError::InvalidPool);
    require_keys_eq!(custody, position.custody, JupiterLpError::InvalidCustody);
    require_keys_eq!(custody, JLP_USDC_CUSTODY, JupiterLpError::InvalidCustody);
    require_keys_eq!(
        lp_token_account,
        position.lp_token_account,
        JupiterLpError::InvalidTokenAccount
    );
    Ok(())
}

fn validate_jupiter_pdas(
    jupiter_program: Pubkey,
    transfer_authority: Pubkey,
    perpetuals: Pubkey,
    event_authority: Pubkey,
) -> Result<()> {
    let (expected_perpetuals, _) =
        Pubkey::find_program_address(&[PERPETUALS_SEED], &jupiter_program);
    let (expected_transfer_authority, _) =
        Pubkey::find_program_address(&[TRANSFER_AUTHORITY_SEED], &jupiter_program);
    let (expected_event_authority, _) =
        Pubkey::find_program_address(&[EVENT_AUTHORITY_SEED], &jupiter_program);

    require_keys_eq!(
        perpetuals,
        expected_perpetuals,
        JupiterLpError::InvalidPerpetuals
    );
    require_keys_eq!(
        transfer_authority,
        expected_transfer_authority,
        JupiterLpError::InvalidTransferAuthority
    );
    require_keys_eq!(
        event_authority,
        expected_event_authority,
        JupiterLpError::InvalidEventAuthority
    );
    Ok(())
}

fn validate_perpetuals<'info>(
    perpetuals: &UncheckedAccount<'info>,
    expected_pool: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        *perpetuals.owner,
        JUPITER_PERPS_PROGRAM_ID,
        JupiterLpError::InvalidPerpetuals
    );
    let data = perpetuals.try_borrow_data()?;
    require!(data.len() >= 8 + 7 + 4 + 32, JupiterLpError::InvalidPerpetuals);
    require!(
        &data[0..8] == [28, 167, 98, 191, 104, 82, 108, 196].as_ref(),
        JupiterLpError::InvalidPerpetuals
    );
    let pool_count_offset = 8 + 7;
    let pool_count = read_u32(&data, pool_count_offset)? as usize;
    let mut offset = pool_count_offset + 4;
    let mut found = false;
    for _ in 0..pool_count {
        if read_pubkey(&data, offset)? == expected_pool {
            found = true;
        }
        offset = offset
            .checked_add(32)
            .ok_or(JupiterLpError::MathOverflow)?;
    }
    require!(found, JupiterLpError::InvalidPerpetuals);
    Ok(())
}

fn validate_custody_accounts<'info>(
    custody: &UncheckedAccount<'info>,
    expected_pool: Pubkey,
    expected_mint: Pubkey,
    custody_token_account: Pubkey,
    custody_doves_price_account: Pubkey,
    custody_pythnet_price_account: Pubkey,
) -> Result<()> {
    validate_custody_basic(custody, expected_pool, expected_mint)?;
    let data = custody.try_borrow_data()?;
    require_keys_eq!(
        read_pubkey(&data, CUSTODY_TOKEN_ACCOUNT_OFFSET)?,
        custody_token_account,
        JupiterLpError::InvalidCustody
    );
    require_keys_eq!(
        read_pubkey(&data, CUSTODY_DOVES_AG_PRICE_ACCOUNT_OFFSET)?,
        custody_doves_price_account,
        JupiterLpError::InvalidCustody
    );
    require_keys_eq!(
        custody_doves_price_account,
        JLP_USDC_DOVES_AG_PRICE_ACCOUNT,
        JupiterLpError::InvalidCustody
    );
    require_keys_eq!(
        read_pubkey(&data, CUSTODY_PYTHNET_PRICE_ACCOUNT_OFFSET)?,
        custody_pythnet_price_account,
        JupiterLpError::InvalidCustody
    );
    Ok(())
}

fn validate_custody_basic<'info>(
    custody: &UncheckedAccount<'info>,
    expected_pool: Pubkey,
    expected_mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        *custody.owner,
        JUPITER_PERPS_PROGRAM_ID,
        JupiterLpError::InvalidCustody
    );
    let data = custody.try_borrow_data()?;
    require!(
        data.len() >= CUSTODY_DOVES_AG_PRICE_ACCOUNT_OFFSET + 32,
        JupiterLpError::InvalidCustody
    );
    require!(
        &data[0..8] == CUSTODY_DISCRIMINATOR.as_ref(),
        JupiterLpError::InvalidCustody
    );
    require_keys_eq!(
        read_pubkey(&data, CUSTODY_POOL_OFFSET)?,
        expected_pool,
        JupiterLpError::InvalidCustody
    );
    require_keys_eq!(
        read_pubkey(&data, CUSTODY_MINT_OFFSET)?,
        expected_mint,
        JupiterLpError::InvalidMint
    );
    Ok(())
}

fn validate_jlp_mint<'info>(
    lp_token_mint: &UncheckedAccount<'info>,
    token_program: &UncheckedAccount<'info>,
    jupiter_program: Pubkey,
    pool: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        lp_token_mint.key(),
        derive_lp_token_mint(jupiter_program, pool),
        JupiterLpError::InvalidTokenAccount
    );
    require_keys_eq!(lp_token_mint.key(), JLP_MINT, JupiterLpError::InvalidTokenAccount);
    require_keys_eq!(
        *lp_token_mint.owner,
        token_program.key(),
        JupiterLpError::InvalidTokenAccount
    );
    validate_mint_with_owner_only(lp_token_mint, JLP_MINT)
}

fn validate_mint_with_owner_only<'info>(
    mint: &UncheckedAccount<'info>,
    expected_mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(mint.key(), expected_mint, JupiterLpError::InvalidTokenAccount);
    let data = mint.try_borrow_data()?;
    require!(data.len() > MINT_DECIMALS_OFFSET, JupiterLpError::InvalidTokenAccount);
    require!(data[MINT_DECIMALS_OFFSET] == 6, JupiterLpError::InvalidTokenAccount);
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
        JupiterLpError::InvalidTokenAccount
    );
    validate_token_account_with_owner_only(token_account, expected_mint, expected_owner)
}

fn validate_token_account_with_owner_only<'info>(
    token_account: &UncheckedAccount<'info>,
    expected_mint: Pubkey,
    expected_owner: Pubkey,
) -> Result<()> {
    let token_data = token_account.try_borrow_data()?;
    require_keys_eq!(
        read_pubkey(&token_data, TOKEN_ACCOUNT_MINT_OFFSET)?,
        expected_mint,
        JupiterLpError::InvalidTokenAccount
    );
    require_keys_eq!(
        read_pubkey(&token_data, TOKEN_ACCOUNT_OWNER_OFFSET)?,
        expected_owner,
        JupiterLpError::InvalidTokenAccount
    );
    Ok(())
}

fn read_pool_aum<'info>(pool: &UncheckedAccount<'info>) -> Result<u128> {
    read_pool_aum_with_custody(pool, JLP_USDC_CUSTODY)
}

fn read_pool_aum_with_custody<'info>(
    pool: &UncheckedAccount<'info>,
    expected_custody: Pubkey,
) -> Result<u128> {
    require_keys_eq!(
        *pool.owner,
        JUPITER_PERPS_PROGRAM_ID,
        JupiterLpError::InvalidPool
    );
    let data = pool.try_borrow_data()?;
    require!(
        data.len() >= POOL_NAME_OFFSET + 4,
        JupiterLpError::InvalidPool
    );
    require!(
        &data[0..8] == POOL_DISCRIMINATOR.as_ref(),
        JupiterLpError::InvalidPool
    );
    let name_len = read_u32(&data, POOL_NAME_OFFSET)? as usize;
    let after_name = POOL_NAME_OFFSET
        .checked_add(4)
        .and_then(|offset| offset.checked_add(name_len))
        .ok_or(JupiterLpError::MathOverflow)?;
    let custody_count = read_u32(&data, after_name)? as usize;
    let mut offset = after_name
        .checked_add(4)
        .ok_or(JupiterLpError::MathOverflow)?;
    let mut found = false;
    for _ in 0..custody_count {
        if read_pubkey(&data, offset)? == expected_custody {
            found = true;
        }
        offset = offset
            .checked_add(32)
            .ok_or(JupiterLpError::MathOverflow)?;
    }
    require!(found, JupiterLpError::InvalidPool);
    read_u128(&data, offset)
}

fn read_token_amount<'info>(token_account: &UncheckedAccount<'info>) -> Result<u64> {
    let data = token_account.try_borrow_data()?;
    read_u64(&data, TOKEN_ACCOUNT_AMOUNT_OFFSET)
}

fn read_mint_supply<'info>(mint: &UncheckedAccount<'info>) -> Result<u64> {
    let data = mint.try_borrow_data()?;
    read_u64(&data, MINT_SUPPLY_OFFSET)
}

fn lp_to_usdc_floor(lp_amount: u64, pool_aum_usd: u128, lp_supply: u64) -> Result<u64> {
    if lp_amount == 0 || lp_supply == 0 || pool_aum_usd == 0 {
        return Ok(0);
    }
    let value = (lp_amount as u128)
        .checked_mul(pool_aum_usd)
        .ok_or(JupiterLpError::MathOverflow)?
        .checked_div(lp_supply as u128)
        .ok_or(JupiterLpError::MathOverflow)?;
    u128_to_u64(value)
}

fn usdc_to_lp_floor(amount: u64, pool_aum_usd: u128, lp_supply: u64) -> Result<u64> {
    if amount == 0 || lp_supply == 0 || pool_aum_usd == 0 {
        return Ok(amount);
    }
    let value = (amount as u128)
        .checked_mul(lp_supply as u128)
        .ok_or(JupiterLpError::MathOverflow)?
        .checked_div(pool_aum_usd)
        .ok_or(JupiterLpError::MathOverflow)?;
    u128_to_u64(value)
}

fn usdc_to_lp_ceil(amount: u64, pool_aum_usd: u128, lp_supply: u64) -> Result<u64> {
    if amount == 0 || lp_supply == 0 || pool_aum_usd == 0 {
        return Ok(amount);
    }
    let numerator = (amount as u128)
        .checked_mul(lp_supply as u128)
        .ok_or(JupiterLpError::MathOverflow)?;
    let value = numerator
        .checked_add(pool_aum_usd - 1)
        .ok_or(JupiterLpError::MathOverflow)?
        .checked_div(pool_aum_usd)
        .ok_or(JupiterLpError::MathOverflow)?;
    u128_to_u64(value)
}

fn apply_bps_floor(value: u64, bps: u128) -> Result<u64> {
    let adjusted = (value as u128)
        .checked_mul(bps)
        .ok_or(JupiterLpError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(JupiterLpError::MathOverflow)?;
    u128_to_u64(adjusted)
}

fn apply_bps_ceil(value: u64, bps: u128) -> Result<u64> {
    let numerator = (value as u128)
        .checked_mul(bps)
        .ok_or(JupiterLpError::MathOverflow)?;
    let adjusted = numerator
        .checked_add(BPS_DENOMINATOR - 1)
        .ok_or(JupiterLpError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(JupiterLpError::MathOverflow)?;
    u128_to_u64(adjusted)
}

fn add_liquidity2_ix_data(token_amount_in: u64, min_lp_amount_out: u64) -> Vec<u8> {
    let mut data = Vec::with_capacity(25);
    data.extend_from_slice(&ADD_LIQUIDITY2_IX_DISCRIMINATOR);
    data.extend_from_slice(&token_amount_in.to_le_bytes());
    data.extend_from_slice(&min_lp_amount_out.to_le_bytes());
    data.push(0);
    data
}

fn remove_liquidity2_ix_data(lp_amount_in: u64, min_amount_out: u64) -> Vec<u8> {
    let mut data = Vec::with_capacity(24);
    data.extend_from_slice(&REMOVE_LIQUIDITY2_IX_DISCRIMINATOR);
    data.extend_from_slice(&lp_amount_in.to_le_bytes());
    data.extend_from_slice(&min_amount_out.to_le_bytes());
    data
}

#[allow(clippy::too_many_arguments)]
fn jupiter_liquidity_account_infos<'info>(
    owner: AccountInfo<'info>,
    token_account: AccountInfo<'info>,
    lp_token_account: AccountInfo<'info>,
    transfer_authority: AccountInfo<'info>,
    perpetuals: AccountInfo<'info>,
    pool: AccountInfo<'info>,
    custody: AccountInfo<'info>,
    custody_doves_price_account: AccountInfo<'info>,
    custody_pythnet_price_account: AccountInfo<'info>,
    custody_token_account: AccountInfo<'info>,
    lp_token_mint: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    event_authority: AccountInfo<'info>,
    jupiter_program: AccountInfo<'info>,
) -> Vec<AccountInfo<'info>> {
    vec![
        owner,
        token_account,
        lp_token_account,
        transfer_authority,
        perpetuals,
        pool,
        custody,
        custody_doves_price_account,
        custody_pythnet_price_account,
        custody_token_account,
        lp_token_mint,
        token_program,
        event_authority,
        jupiter_program,
    ]
}

fn append_cpi_remaining_accounts<'info>(
    instruction: &mut Instruction,
    account_infos: &mut Vec<AccountInfo<'info>>,
    remaining_accounts: &[AccountInfo<'info>],
) {
    for account in remaining_accounts {
        let meta = if account.is_writable {
            AccountMeta::new(account.key(), account.is_signer)
        } else {
            AccountMeta::new_readonly(account.key(), account.is_signer)
        };
        instruction.accounts.push(meta);
        account_infos.push(account.clone());
    }
}

fn derive_lp_token_mint(jupiter_program: Pubkey, pool: Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[LP_TOKEN_MINT_SEED, pool.as_ref()], &jupiter_program).0
}

fn read_pubkey(data: &[u8], offset: usize) -> Result<Pubkey> {
    require!(
        data.len() >= offset + 32,
        JupiterLpError::InvalidTokenAccount
    );
    let mut bytes = [0_u8; 32];
    bytes.copy_from_slice(&data[offset..offset + 32]);
    Ok(Pubkey::new_from_array(bytes))
}

fn read_u32(data: &[u8], offset: usize) -> Result<u32> {
    require!(data.len() >= offset + 4, JupiterLpError::InvalidPool);
    let mut bytes = [0_u8; 4];
    bytes.copy_from_slice(&data[offset..offset + 4]);
    Ok(u32::from_le_bytes(bytes))
}

fn read_u64(data: &[u8], offset: usize) -> Result<u64> {
    require!(
        data.len() >= offset + 8,
        JupiterLpError::InvalidTokenAccount
    );
    let mut bytes = [0_u8; 8];
    bytes.copy_from_slice(&data[offset..offset + 8]);
    Ok(u64::from_le_bytes(bytes))
}

fn read_u128(data: &[u8], offset: usize) -> Result<u128> {
    require!(data.len() >= offset + 16, JupiterLpError::InvalidPool);
    let mut bytes = [0_u8; 16];
    bytes.copy_from_slice(&data[offset..offset + 16]);
    Ok(u128::from_le_bytes(bytes))
}

fn u128_to_u64(value: u128) -> Result<u64> {
    require!(value <= u64::MAX as u128, JupiterLpError::MathOverflow);
    Ok(value as u64)
}

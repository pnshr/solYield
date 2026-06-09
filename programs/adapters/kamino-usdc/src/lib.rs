use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{invoke, set_return_data},
    sysvar::instructions::ID as INSTRUCTIONS_SYSVAR_ID,
};

pub mod constants;

declare_id!("G4g2RMwZs2dH2sVe3ChQ4VpM2DNZu8EESdRyHTc3P9T4");

pub const CONFIG_SEED: &[u8] = b"kamino_usdc_config";
pub const POSITION_SEED: &[u8] = b"kamino_usdc_position";

const LENDING_MARKET_AUTH_SEED: &[u8] = b"lma";
const RESERVE_LIQ_SUPPLY_SEED: &[u8] = b"reserve_liq_supply";
const RESERVE_COLL_MINT_SEED: &[u8] = b"reserve_coll_mint";

const DEPOSIT_RESERVE_LIQUIDITY_IX_DISCRIMINATOR: [u8; 8] =
    [169, 201, 30, 126, 6, 205, 102, 68];
const REDEEM_RESERVE_COLLATERAL_IX_DISCRIMINATOR: [u8; 8] =
    [234, 117, 181, 125, 185, 142, 220, 29];

const RESERVE_DISCRIMINATOR: [u8; 8] = [43, 242, 204, 202, 26, 247, 59, 127];
const FRACTIONAL_BITS: u32 = 60;

const TOKEN_ACCOUNT_MINT_OFFSET: usize = 0;
const TOKEN_ACCOUNT_OWNER_OFFSET: usize = 32;
const TOKEN_ACCOUNT_AMOUNT_OFFSET: usize = 64;

const RESERVE_LENDING_MARKET_OFFSET: usize = 32;
const RESERVE_LIQUIDITY_MINT_OFFSET: usize = 128;
const RESERVE_LIQUIDITY_SUPPLY_OFFSET: usize = 160;
const RESERVE_LIQUIDITY_TOTAL_AVAILABLE_OFFSET: usize = 224;
const RESERVE_LIQUIDITY_BORROWED_AMOUNT_SF_OFFSET: usize = 232;
const RESERVE_LIQUIDITY_ACCUMULATED_PROTOCOL_FEES_SF_OFFSET: usize = 344;
const RESERVE_LIQUIDITY_ACCUMULATED_REFERRER_FEES_SF_OFFSET: usize = 360;
const RESERVE_LIQUIDITY_PENDING_REFERRER_FEES_SF_OFFSET: usize = 376;
const RESERVE_LIQUIDITY_TOKEN_PROGRAM_OFFSET: usize = 408;
const RESERVE_COLLATERAL_MINT_OFFSET: usize = 2560;
const RESERVE_COLLATERAL_MINT_TOTAL_SUPPLY_OFFSET: usize = 2592;

#[program]
pub mod kamino_usdc {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        supported_mint: Pubkey,
        protocol_program_id: Pubkey,
        version: u16,
    ) -> Result<()> {
        require_keys_neq!(supported_mint, Pubkey::default(), KaminoUsdcError::InvalidMint);
        require_keys_neq!(
            protocol_program_id,
            Pubkey::default(),
            KaminoUsdcError::InvalidProtocolProgram
        );

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.supported_mint = supported_mint;
        config.protocol_program_id = protocol_program_id;
        config.version = version;
        config.bump = ctx.bumps.config;

        emit!(KaminoUsdcConfigInitialized {
            authority: config.authority,
            supported_mint,
            protocol_program_id,
            version,
        });

        Ok(())
    }

    pub fn initialize_position(
        ctx: Context<InitializePosition>,
        reserve: Pubkey,
        collateral_token_account: Pubkey,
    ) -> Result<()> {
        require_keys_neq!(reserve, Pubkey::default(), KaminoUsdcError::InvalidReserve);
        require_keys_neq!(
            collateral_token_account,
            Pubkey::default(),
            KaminoUsdcError::InvalidTokenAccount
        );

        let position = &mut ctx.accounts.position;
        position.owner = ctx.accounts.owner.key();
        position.reserve = reserve;
        position.collateral_token_account = collateral_token_account;
        position.deposited_amount = 0;
        position.shares = 0;
        position.last_value = 0;
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
            program_id: ctx.accounts.kamino_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.owner.key(), true),
                AccountMeta::new(ctx.accounts.reserve.key(), false),
                AccountMeta::new_readonly(ctx.accounts.lending_market.key(), false),
                AccountMeta::new_readonly(ctx.accounts.lending_market_authority.key(), false),
                AccountMeta::new_readonly(ctx.accounts.reserve_liquidity_mint.key(), false),
                AccountMeta::new(ctx.accounts.reserve_liquidity_supply.key(), false),
                AccountMeta::new(ctx.accounts.reserve_collateral_mint.key(), false),
                AccountMeta::new(ctx.accounts.user_source_liquidity.key(), false),
                AccountMeta::new(ctx.accounts.user_destination_collateral.key(), false),
                AccountMeta::new_readonly(ctx.accounts.collateral_token_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.liquidity_token_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.instruction_sysvar_account.key(), false),
            ],
            data: amount_ix_data(DEPOSIT_RESERVE_LIQUIDITY_IX_DISCRIMINATOR, amount),
        };

        invoke(
            &instruction,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.reserve.to_account_info(),
                ctx.accounts.lending_market.to_account_info(),
                ctx.accounts.lending_market_authority.to_account_info(),
                ctx.accounts.reserve_liquidity_mint.to_account_info(),
                ctx.accounts.reserve_liquidity_supply.to_account_info(),
                ctx.accounts.reserve_collateral_mint.to_account_info(),
                ctx.accounts.user_source_liquidity.to_account_info(),
                ctx.accounts.user_destination_collateral.to_account_info(),
                ctx.accounts.collateral_token_program.to_account_info(),
                ctx.accounts.liquidity_token_program.to_account_info(),
                ctx.accounts.instruction_sysvar_account.to_account_info(),
                ctx.accounts.kamino_program.to_account_info(),
            ],
        )
        .map_err(|_| error!(KaminoUsdcError::ProtocolCpiFailed))?;

        let updated_reserve_fields = read_reserve_fields(&ctx.accounts.reserve)?;
        let shares = read_token_amount(&ctx.accounts.user_destination_collateral)?;
        let value = collateral_to_liquidity(shares, &updated_reserve_fields)?;
        let position = &mut ctx.accounts.position;
        position.deposited_amount = position
            .deposited_amount
            .checked_add(amount)
            .ok_or(KaminoUsdcError::MathOverflow)?;
        position.shares = shares;
        position.last_value = value;

        emit!(KaminoUsdcDeposit {
            owner: position.owner,
            mint: ctx.accounts.config.supported_mint,
            amount,
            shares,
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
        let reserve_fields = validate_withdraw_accounts(&ctx)?;
        let collateral_amount = liquidity_to_collateral_ceil(amount, &reserve_fields)?;

        let instruction = Instruction {
            program_id: ctx.accounts.kamino_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.owner.key(), true),
                AccountMeta::new_readonly(ctx.accounts.lending_market.key(), false),
                AccountMeta::new(ctx.accounts.reserve.key(), false),
                AccountMeta::new_readonly(ctx.accounts.lending_market_authority.key(), false),
                AccountMeta::new_readonly(ctx.accounts.reserve_liquidity_mint.key(), false),
                AccountMeta::new(ctx.accounts.reserve_collateral_mint.key(), false),
                AccountMeta::new(ctx.accounts.reserve_liquidity_supply.key(), false),
                AccountMeta::new(ctx.accounts.user_source_collateral.key(), false),
                AccountMeta::new(ctx.accounts.user_destination_liquidity.key(), false),
                AccountMeta::new_readonly(ctx.accounts.collateral_token_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.liquidity_token_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.instruction_sysvar_account.key(), false),
            ],
            data: amount_ix_data(
                REDEEM_RESERVE_COLLATERAL_IX_DISCRIMINATOR,
                collateral_amount,
            ),
        };

        invoke(
            &instruction,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.lending_market.to_account_info(),
                ctx.accounts.reserve.to_account_info(),
                ctx.accounts.lending_market_authority.to_account_info(),
                ctx.accounts.reserve_liquidity_mint.to_account_info(),
                ctx.accounts.reserve_collateral_mint.to_account_info(),
                ctx.accounts.reserve_liquidity_supply.to_account_info(),
                ctx.accounts.user_source_collateral.to_account_info(),
                ctx.accounts.user_destination_liquidity.to_account_info(),
                ctx.accounts.collateral_token_program.to_account_info(),
                ctx.accounts.liquidity_token_program.to_account_info(),
                ctx.accounts.instruction_sysvar_account.to_account_info(),
                ctx.accounts.kamino_program.to_account_info(),
            ],
        )
        .map_err(|_| error!(KaminoUsdcError::ProtocolCpiFailed))?;

        let updated_reserve_fields = read_reserve_fields(&ctx.accounts.reserve)?;
        let shares = read_token_amount(&ctx.accounts.user_source_collateral)?;
        let value = collateral_to_liquidity(shares, &updated_reserve_fields)?;
        let position = &mut ctx.accounts.position;
        position.deposited_amount = position.deposited_amount.saturating_sub(amount);
        position.shares = shares;
        position.last_value = value;

        emit!(KaminoUsdcWithdraw {
            owner: position.owner,
            mint: ctx.accounts.config.supported_mint,
            amount,
            shares,
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
        let reserve_fields = validate_value_accounts(&ctx)?;
        let shares = read_token_amount(&ctx.accounts.user_collateral_token_account)?;
        let value = collateral_to_liquidity(shares, &reserve_fields)?;
        set_return_data(&value.to_le_bytes());

        emit!(KaminoUsdcValue {
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
        space = KaminoUsdcConfig::LEN,
        seeds = [CONFIG_SEED, supported_mint.as_ref(), &version.to_le_bytes()],
        bump
    )]
    pub config: Account<'info, KaminoUsdcConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(reserve: Pubkey, collateral_token_account: Pubkey)]
pub struct InitializePosition<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, KaminoUsdcConfig>,
    #[account(
        init,
        payer = owner,
        space = KaminoUsdcPosition::LEN,
        seeds = [POSITION_SEED, config.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, KaminoUsdcPosition>,
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
    pub config: Account<'info, KaminoUsdcConfig>,
    #[account(
        mut,
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, KaminoUsdcPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Validated against config.protocol_program_id.
    pub kamino_program: UncheckedAccount<'info>,
    /// CHECK: Validated as a Kamino-owned reserve.
    #[account(mut)]
    pub reserve: UncheckedAccount<'info>,
    /// CHECK: Validated against the reserve state.
    pub lending_market: UncheckedAccount<'info>,
    /// CHECK: Validated as the Kamino lending market authority PDA.
    pub lending_market_authority: UncheckedAccount<'info>,
    /// CHECK: Validated against reserve liquidity mint.
    pub reserve_liquidity_mint: UncheckedAccount<'info>,
    /// CHECK: Validated against reserve liquidity supply vault.
    #[account(mut)]
    pub reserve_liquidity_supply: UncheckedAccount<'info>,
    /// CHECK: Validated against reserve collateral mint PDA.
    #[account(mut)]
    pub reserve_collateral_mint: UncheckedAccount<'info>,
    /// CHECK: Validated as owner's supported-mint token account.
    #[account(mut)]
    pub user_source_liquidity: UncheckedAccount<'info>,
    /// CHECK: Validated as owner's collateral token account.
    #[account(mut)]
    pub user_destination_collateral: UncheckedAccount<'info>,
    /// CHECK: Validated as owner of collateral token accounts.
    pub collateral_token_program: UncheckedAccount<'info>,
    /// CHECK: Validated against reserve liquidity token program.
    pub liquidity_token_program: UncheckedAccount<'info>,
    /// CHECK: Validated against the instructions sysvar.
    pub instruction_sysvar_account: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, KaminoUsdcConfig>,
    #[account(
        mut,
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, KaminoUsdcPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Validated against config.protocol_program_id.
    pub kamino_program: UncheckedAccount<'info>,
    /// CHECK: Validated against the reserve state.
    pub lending_market: UncheckedAccount<'info>,
    /// CHECK: Validated as a Kamino-owned reserve.
    #[account(mut)]
    pub reserve: UncheckedAccount<'info>,
    /// CHECK: Validated as the Kamino lending market authority PDA.
    pub lending_market_authority: UncheckedAccount<'info>,
    /// CHECK: Validated against reserve liquidity mint.
    pub reserve_liquidity_mint: UncheckedAccount<'info>,
    /// CHECK: Validated against reserve collateral mint PDA.
    #[account(mut)]
    pub reserve_collateral_mint: UncheckedAccount<'info>,
    /// CHECK: Validated against reserve liquidity supply vault.
    #[account(mut)]
    pub reserve_liquidity_supply: UncheckedAccount<'info>,
    /// CHECK: Validated as owner's collateral token account.
    #[account(mut)]
    pub user_source_collateral: UncheckedAccount<'info>,
    /// CHECK: Validated as owner's supported-mint token account.
    #[account(mut)]
    pub user_destination_liquidity: UncheckedAccount<'info>,
    /// CHECK: Validated as owner of collateral token accounts.
    pub collateral_token_program: UncheckedAccount<'info>,
    /// CHECK: Validated against reserve liquidity token program.
    pub liquidity_token_program: UncheckedAccount<'info>,
    /// CHECK: Validated against the instructions sysvar.
    pub instruction_sysvar_account: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CurrentValue<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, KaminoUsdcConfig>,
    #[account(
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, KaminoUsdcPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Validated against config.protocol_program_id.
    pub kamino_program: UncheckedAccount<'info>,
    /// CHECK: Validated as a Kamino-owned reserve.
    pub reserve: UncheckedAccount<'info>,
    /// CHECK: Validated as owner's collateral token account.
    pub user_collateral_token_account: UncheckedAccount<'info>,
}

#[account]
pub struct KaminoUsdcConfig {
    pub authority: Pubkey,
    pub supported_mint: Pubkey,
    pub protocol_program_id: Pubkey,
    pub version: u16,
    pub bump: u8,
}

impl KaminoUsdcConfig {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 1;
}

#[account]
pub struct KaminoUsdcPosition {
    pub owner: Pubkey,
    pub reserve: Pubkey,
    pub collateral_token_account: Pubkey,
    pub deposited_amount: u64,
    pub shares: u64,
    pub last_value: u64,
    pub bump: u8,
}

impl KaminoUsdcPosition {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1;
}

#[event]
pub struct KaminoUsdcConfigInitialized {
    pub authority: Pubkey,
    pub supported_mint: Pubkey,
    pub protocol_program_id: Pubkey,
    pub version: u16,
}

#[event]
pub struct KaminoUsdcDeposit {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub value: u64,
}

#[event]
pub struct KaminoUsdcWithdraw {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub value: u64,
}

#[event]
pub struct KaminoUsdcValue {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub shares: u64,
    pub value: u64,
}

#[error_code]
pub enum KaminoUsdcError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Requested mint does not match this adapter config.")]
    InvalidMint,
    #[msg("Signer does not own this adapter position.")]
    InvalidOwner,
    #[msg("Passed Kamino program does not match this adapter config.")]
    InvalidProtocolProgram,
    #[msg("Passed Kamino account is not owned by the Kamino program.")]
    InvalidProtocolAccount,
    #[msg("Passed reserve is not the configured Kamino reserve.")]
    InvalidReserve,
    #[msg("Passed lending market does not match the reserve.")]
    InvalidLendingMarket,
    #[msg("Passed vault or mint does not match the reserve state.")]
    InvalidVault,
    #[msg("Passed token account is not valid for this Kamino position.")]
    InvalidTokenAccount,
    #[msg("Passed instructions sysvar is invalid.")]
    InvalidInstructionSysvar,
    #[msg("Kamino CPI failed.")]
    ProtocolCpiFailed,
    #[msg("Math overflow or underflow occurred.")]
    MathOverflow,
}

#[derive(Clone, Copy)]
struct KaminoReserveFields {
    lending_market: Pubkey,
    liquidity_mint: Pubkey,
    liquidity_supply: Pubkey,
    liquidity_token_program: Pubkey,
    total_available_amount: u64,
    borrowed_amount_sf: u128,
    accumulated_protocol_fees_sf: u128,
    accumulated_referrer_fees_sf: u128,
    pending_referrer_fees_sf: u128,
    collateral_mint: Pubkey,
    collateral_mint_total_supply: u64,
}

fn validate_common(
    config: &KaminoUsdcConfig,
    position: &KaminoUsdcPosition,
    owner: Pubkey,
    mint: Pubkey,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, KaminoUsdcError::InvalidAmount);
    validate_owner_and_mint(config, position, owner, mint)
}

fn validate_owner_and_mint(
    config: &KaminoUsdcConfig,
    position: &KaminoUsdcPosition,
    owner: Pubkey,
    mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(mint, config.supported_mint, KaminoUsdcError::InvalidMint);
    require_keys_eq!(owner, position.owner, KaminoUsdcError::InvalidOwner);
    Ok(())
}

fn validate_deposit_accounts(ctx: &Context<Deposit>) -> Result<KaminoReserveFields> {
    validate_protocol_program(&ctx.accounts.config, ctx.accounts.kamino_program.key())?;
    let fields = validate_reserve_common(
        &ctx.accounts.config,
        &ctx.accounts.position,
        &ctx.accounts.kamino_program,
        &ctx.accounts.reserve,
    )?;
    validate_market_accounts(
        ctx.accounts.kamino_program.key(),
        &fields,
        ctx.accounts.lending_market.key(),
        ctx.accounts.lending_market_authority.key(),
    )?;
    validate_reserve_vault_accounts(
        ctx.accounts.kamino_program.key(),
        ctx.accounts.reserve.key(),
        &fields,
        ctx.accounts.reserve_liquidity_mint.key(),
        ctx.accounts.reserve_liquidity_supply.key(),
        ctx.accounts.reserve_collateral_mint.key(),
        ctx.accounts.liquidity_token_program.key(),
    )?;
    validate_token_account(
        &ctx.accounts.user_source_liquidity,
        &ctx.accounts.liquidity_token_program,
        ctx.accounts.config.supported_mint,
        ctx.accounts.owner.key(),
    )?;
    validate_token_account(
        &ctx.accounts.user_destination_collateral,
        &ctx.accounts.collateral_token_program,
        fields.collateral_mint,
        ctx.accounts.owner.key(),
    )?;
    require_keys_eq!(
        ctx.accounts.user_destination_collateral.key(),
        ctx.accounts.position.collateral_token_account,
        KaminoUsdcError::InvalidTokenAccount
    );
    validate_instruction_sysvar(ctx.accounts.instruction_sysvar_account.key())?;
    Ok(fields)
}

fn validate_withdraw_accounts(ctx: &Context<Withdraw>) -> Result<KaminoReserveFields> {
    validate_protocol_program(&ctx.accounts.config, ctx.accounts.kamino_program.key())?;
    let fields = validate_reserve_common(
        &ctx.accounts.config,
        &ctx.accounts.position,
        &ctx.accounts.kamino_program,
        &ctx.accounts.reserve,
    )?;
    validate_market_accounts(
        ctx.accounts.kamino_program.key(),
        &fields,
        ctx.accounts.lending_market.key(),
        ctx.accounts.lending_market_authority.key(),
    )?;
    validate_reserve_vault_accounts(
        ctx.accounts.kamino_program.key(),
        ctx.accounts.reserve.key(),
        &fields,
        ctx.accounts.reserve_liquidity_mint.key(),
        ctx.accounts.reserve_liquidity_supply.key(),
        ctx.accounts.reserve_collateral_mint.key(),
        ctx.accounts.liquidity_token_program.key(),
    )?;
    validate_token_account(
        &ctx.accounts.user_source_collateral,
        &ctx.accounts.collateral_token_program,
        fields.collateral_mint,
        ctx.accounts.owner.key(),
    )?;
    require_keys_eq!(
        ctx.accounts.user_source_collateral.key(),
        ctx.accounts.position.collateral_token_account,
        KaminoUsdcError::InvalidTokenAccount
    );
    validate_token_account(
        &ctx.accounts.user_destination_liquidity,
        &ctx.accounts.liquidity_token_program,
        ctx.accounts.config.supported_mint,
        ctx.accounts.owner.key(),
    )?;
    validate_instruction_sysvar(ctx.accounts.instruction_sysvar_account.key())?;
    Ok(fields)
}

fn validate_value_accounts(ctx: &Context<CurrentValue>) -> Result<KaminoReserveFields> {
    validate_protocol_program(&ctx.accounts.config, ctx.accounts.kamino_program.key())?;
    let fields = validate_reserve_common(
        &ctx.accounts.config,
        &ctx.accounts.position,
        &ctx.accounts.kamino_program,
        &ctx.accounts.reserve,
    )?;
    validate_token_account_with_owner_only(
        &ctx.accounts.user_collateral_token_account,
        fields.collateral_mint,
        ctx.accounts.owner.key(),
    )?;
    require_keys_eq!(
        ctx.accounts.user_collateral_token_account.key(),
        ctx.accounts.position.collateral_token_account,
        KaminoUsdcError::InvalidTokenAccount
    );
    Ok(fields)
}

fn validate_protocol_program(config: &KaminoUsdcConfig, kamino_program: Pubkey) -> Result<()> {
    require_keys_eq!(
        kamino_program,
        config.protocol_program_id,
        KaminoUsdcError::InvalidProtocolProgram
    );
    Ok(())
}

fn validate_reserve_common<'info>(
    config: &KaminoUsdcConfig,
    position: &KaminoUsdcPosition,
    kamino_program: &UncheckedAccount<'info>,
    reserve: &UncheckedAccount<'info>,
) -> Result<KaminoReserveFields> {
    require_keys_eq!(
        reserve.key(),
        position.reserve,
        KaminoUsdcError::InvalidReserve
    );
    require_keys_eq!(
        *reserve.owner,
        kamino_program.key(),
        KaminoUsdcError::InvalidProtocolAccount
    );

    let fields = read_reserve_fields(reserve)?;
    require_keys_eq!(
        fields.liquidity_mint,
        config.supported_mint,
        KaminoUsdcError::InvalidMint
    );

    Ok(fields)
}

fn validate_market_accounts(
    kamino_program: Pubkey,
    fields: &KaminoReserveFields,
    lending_market: Pubkey,
    lending_market_authority: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        lending_market,
        fields.lending_market,
        KaminoUsdcError::InvalidLendingMarket
    );
    let expected_authority =
        Pubkey::find_program_address(&[LENDING_MARKET_AUTH_SEED, lending_market.as_ref()], &kamino_program).0;
    require_keys_eq!(
        lending_market_authority,
        expected_authority,
        KaminoUsdcError::InvalidLendingMarket
    );
    Ok(())
}

fn validate_reserve_vault_accounts(
    kamino_program: Pubkey,
    reserve: Pubkey,
    fields: &KaminoReserveFields,
    reserve_liquidity_mint: Pubkey,
    reserve_liquidity_supply: Pubkey,
    reserve_collateral_mint: Pubkey,
    liquidity_token_program: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        reserve_liquidity_mint,
        fields.liquidity_mint,
        KaminoUsdcError::InvalidMint
    );
    require_keys_eq!(
        reserve_liquidity_supply,
        fields.liquidity_supply,
        KaminoUsdcError::InvalidVault
    );
    require_keys_eq!(
        reserve_collateral_mint,
        fields.collateral_mint,
        KaminoUsdcError::InvalidVault
    );
    require_keys_eq!(
        liquidity_token_program,
        fields.liquidity_token_program,
        KaminoUsdcError::InvalidTokenAccount
    );
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
        KaminoUsdcError::InvalidTokenAccount
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
        KaminoUsdcError::InvalidTokenAccount
    );
    require_keys_eq!(
        read_pubkey(&token_data, TOKEN_ACCOUNT_OWNER_OFFSET)?,
        expected_owner,
        KaminoUsdcError::InvalidTokenAccount
    );
    Ok(())
}

fn validate_instruction_sysvar(instruction_sysvar: Pubkey) -> Result<()> {
    require_keys_eq!(
        instruction_sysvar,
        INSTRUCTIONS_SYSVAR_ID,
        KaminoUsdcError::InvalidInstructionSysvar
    );
    Ok(())
}

fn read_reserve_fields<'info>(reserve: &UncheckedAccount<'info>) -> Result<KaminoReserveFields> {
    let data = reserve.try_borrow_data()?;
    require!(
        data.len() >= RESERVE_COLLATERAL_MINT_TOTAL_SUPPLY_OFFSET + 8,
        KaminoUsdcError::InvalidProtocolAccount
    );
    require!(
        &data[0..8] == RESERVE_DISCRIMINATOR.as_ref(),
        KaminoUsdcError::InvalidReserve
    );

    Ok(KaminoReserveFields {
        lending_market: read_pubkey(&data, RESERVE_LENDING_MARKET_OFFSET)?,
        liquidity_mint: read_pubkey(&data, RESERVE_LIQUIDITY_MINT_OFFSET)?,
        liquidity_supply: read_pubkey(&data, RESERVE_LIQUIDITY_SUPPLY_OFFSET)?,
        liquidity_token_program: read_pubkey(&data, RESERVE_LIQUIDITY_TOKEN_PROGRAM_OFFSET)?,
        total_available_amount: read_u64(&data, RESERVE_LIQUIDITY_TOTAL_AVAILABLE_OFFSET)?,
        borrowed_amount_sf: read_u128(&data, RESERVE_LIQUIDITY_BORROWED_AMOUNT_SF_OFFSET)?,
        accumulated_protocol_fees_sf: read_u128(
            &data,
            RESERVE_LIQUIDITY_ACCUMULATED_PROTOCOL_FEES_SF_OFFSET,
        )?,
        accumulated_referrer_fees_sf: read_u128(
            &data,
            RESERVE_LIQUIDITY_ACCUMULATED_REFERRER_FEES_SF_OFFSET,
        )?,
        pending_referrer_fees_sf: read_u128(
            &data,
            RESERVE_LIQUIDITY_PENDING_REFERRER_FEES_SF_OFFSET,
        )?,
        collateral_mint: read_pubkey(&data, RESERVE_COLLATERAL_MINT_OFFSET)?,
        collateral_mint_total_supply: read_u64(&data, RESERVE_COLLATERAL_MINT_TOTAL_SUPPLY_OFFSET)?,
    })
}

fn total_supply(fields: &KaminoReserveFields) -> Result<u128> {
    let borrowed = scaled_fraction_floor(fields.borrowed_amount_sf);
    let protocol_fees = scaled_fraction_floor(fields.accumulated_protocol_fees_sf);
    let referrer_fees = scaled_fraction_floor(fields.accumulated_referrer_fees_sf);
    let pending_referrer_fees = scaled_fraction_floor(fields.pending_referrer_fees_sf);

    let total = (fields.total_available_amount as u128)
        .checked_add(borrowed)
        .ok_or(KaminoUsdcError::MathOverflow)?;
    let total = total
        .checked_sub(protocol_fees)
        .ok_or(KaminoUsdcError::MathOverflow)?;
    let total = total
        .checked_sub(referrer_fees)
        .ok_or(KaminoUsdcError::MathOverflow)?;
    total
        .checked_sub(pending_referrer_fees)
        .ok_or(error!(KaminoUsdcError::MathOverflow))
}

fn collateral_to_liquidity(collateral_amount: u64, fields: &KaminoReserveFields) -> Result<u64> {
    let total_supply = total_supply(fields)?;
    let mint_total_supply = fields.collateral_mint_total_supply as u128;
    if mint_total_supply == 0 || total_supply == 0 {
        return Ok(collateral_amount);
    }

    let value = (collateral_amount as u128)
        .checked_mul(total_supply)
        .ok_or(KaminoUsdcError::MathOverflow)?
        .checked_div(mint_total_supply)
        .ok_or(KaminoUsdcError::MathOverflow)?;
    u128_to_u64(value)
}

fn liquidity_to_collateral_ceil(amount: u64, fields: &KaminoReserveFields) -> Result<u64> {
    let total_supply = total_supply(fields)?;
    let mint_total_supply = fields.collateral_mint_total_supply as u128;
    if mint_total_supply == 0 || total_supply == 0 {
        return Ok(amount);
    }

    let numerator = (amount as u128)
        .checked_mul(mint_total_supply)
        .ok_or(KaminoUsdcError::MathOverflow)?;
    let rounded = numerator
        .checked_add(total_supply - 1)
        .ok_or(KaminoUsdcError::MathOverflow)?
        .checked_div(total_supply)
        .ok_or(KaminoUsdcError::MathOverflow)?;
    u128_to_u64(rounded)
}

fn scaled_fraction_floor(value: u128) -> u128 {
    value >> FRACTIONAL_BITS
}

fn amount_ix_data(discriminator: [u8; 8], amount: u64) -> Vec<u8> {
    let mut data = Vec::with_capacity(16);
    data.extend_from_slice(&discriminator);
    data.extend_from_slice(&amount.to_le_bytes());
    data
}

fn derive_reserve_liquidity_supply(kamino_program: Pubkey, reserve: Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[RESERVE_LIQ_SUPPLY_SEED, reserve.as_ref()], &kamino_program).0
}

fn derive_reserve_collateral_mint(kamino_program: Pubkey, reserve: Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[RESERVE_COLL_MINT_SEED, reserve.as_ref()], &kamino_program).0
}

fn read_token_amount<'info>(token_account: &UncheckedAccount<'info>) -> Result<u64> {
    let data = token_account.try_borrow_data()?;
    read_u64(&data, TOKEN_ACCOUNT_AMOUNT_OFFSET)
}

fn read_pubkey(data: &[u8], offset: usize) -> Result<Pubkey> {
    require!(
        data.len() >= offset + 32,
        KaminoUsdcError::InvalidProtocolAccount
    );
    let mut bytes = [0_u8; 32];
    bytes.copy_from_slice(&data[offset..offset + 32]);
    Ok(Pubkey::new_from_array(bytes))
}

fn read_u64(data: &[u8], offset: usize) -> Result<u64> {
    require!(
        data.len() >= offset + 8,
        KaminoUsdcError::InvalidProtocolAccount
    );
    let mut bytes = [0_u8; 8];
    bytes.copy_from_slice(&data[offset..offset + 8]);
    Ok(u64::from_le_bytes(bytes))
}

fn read_u128(data: &[u8], offset: usize) -> Result<u128> {
    require!(
        data.len() >= offset + 16,
        KaminoUsdcError::InvalidProtocolAccount
    );
    let mut bytes = [0_u8; 16];
    bytes.copy_from_slice(&data[offset..offset + 16]);
    Ok(u128::from_le_bytes(bytes))
}

fn u128_to_u64(value: u128) -> Result<u64> {
    u64::try_from(value).map_err(|_| error!(KaminoUsdcError::MathOverflow))
}

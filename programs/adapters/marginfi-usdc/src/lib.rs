use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{invoke, set_return_data},
};

pub mod constants;

declare_id!("ZZcKiv9h3ACNoXubmys1zWY9yFTjif6x6tb3Us4voyr");

pub const CONFIG_SEED: &[u8] = b"marginfi_usdc_config";
pub const POSITION_SEED: &[u8] = b"marginfi_usdc_position";

const MARGINFI_DEPOSIT_IX_DISCRIMINATOR: [u8; 8] = [171, 94, 235, 103, 82, 64, 212, 140];
const MARGINFI_WITHDRAW_IX_DISCRIMINATOR: [u8; 8] = [36, 72, 74, 19, 210, 210, 192, 192];

const LIQUIDITY_VAULT_AUTHORITY_SEED: &[u8] = b"liquidity_vault_auth";

const BANK_MINT_OFFSET: usize = 8;
const BANK_MINT_DECIMALS_OFFSET: usize = 40;
const BANK_GROUP_OFFSET: usize = 41;
const BANK_ASSET_SHARE_VALUE_OFFSET: usize = 80;
const BANK_LIQUIDITY_VAULT_OFFSET: usize = 112;
const BANK_OPERATIONAL_STATE_OFFSET: usize = 608;
const BANK_ORACLE_SETUP_OFFSET: usize = 609;
const BANK_ORACLE_KEYS_OFFSET: usize = 610;

const MARGINFI_ACCOUNT_GROUP_OFFSET: usize = 8;
const MARGINFI_ACCOUNT_AUTHORITY_OFFSET: usize = 40;
const MARGINFI_ACCOUNT_BALANCES_OFFSET: usize = 72;
const MARGINFI_BALANCE_SIZE: usize = 104;
const MARGINFI_BALANCE_ACTIVE_OFFSET: usize = 0;
const MARGINFI_BALANCE_BANK_OFFSET: usize = 1;
const MARGINFI_BALANCE_ASSET_SHARES_OFFSET: usize = 40;
const MARGINFI_BALANCE_COUNT: usize = 16;

const TOKEN_ACCOUNT_MINT_OFFSET: usize = 0;
const TOKEN_ACCOUNT_OWNER_OFFSET: usize = 32;

const I80F48_FRACTIONAL_BITS: u32 = 48;
const I80F48_ONE: u128 = 1_u128 << I80F48_FRACTIONAL_BITS;

#[program]
pub mod marginfi_usdc {
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
            MarginfiUsdcError::InvalidMint
        );
        require_keys_neq!(
            protocol_program_id,
            Pubkey::default(),
            MarginfiUsdcError::InvalidProtocolProgram
        );

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.supported_mint = supported_mint;
        config.protocol_program_id = protocol_program_id;
        config.version = version;
        config.bump = ctx.bumps.config;

        emit!(MarginfiUsdcConfigInitialized {
            authority: config.authority,
            supported_mint,
            protocol_program_id,
            version,
        });

        Ok(())
    }

    pub fn initialize_position(
        ctx: Context<InitializePosition>,
        marginfi_account: Pubkey,
        marginfi_bank: Pubkey,
    ) -> Result<()> {
        require_keys_neq!(
            marginfi_account,
            Pubkey::default(),
            MarginfiUsdcError::InvalidMarginfiAccount
        );
        require_keys_neq!(
            marginfi_bank,
            Pubkey::default(),
            MarginfiUsdcError::InvalidBank
        );

        let position = &mut ctx.accounts.position;
        position.owner = ctx.accounts.owner.key();
        position.marginfi_account = marginfi_account;
        position.marginfi_bank = marginfi_bank;
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
            program_id: ctx.accounts.marginfi_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.marginfi_group.key(), false),
                AccountMeta::new(ctx.accounts.marginfi_account.key(), false),
                AccountMeta::new_readonly(ctx.accounts.owner.key(), true),
                AccountMeta::new(ctx.accounts.marginfi_bank.key(), false),
                AccountMeta::new(ctx.accounts.owner_token_account.key(), false),
                AccountMeta::new(ctx.accounts.liquidity_vault.key(), false),
                AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
            ],
            data: marginfi_deposit_ix_data(amount),
        };

        invoke(
            &instruction,
            &[
                ctx.accounts.marginfi_group.to_account_info(),
                ctx.accounts.marginfi_account.to_account_info(),
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.marginfi_bank.to_account_info(),
                ctx.accounts.owner_token_account.to_account_info(),
                ctx.accounts.liquidity_vault.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.marginfi_program.to_account_info(),
            ],
        )
        .map_err(|_| error!(MarginfiUsdcError::ProtocolCpiFailed))?;

        let (shares, value) = read_marginfi_position(&ctx.accounts.marginfi_account, &ctx.accounts.marginfi_bank)?;

        let position = &mut ctx.accounts.position;
        position.deposited_amount = position
            .deposited_amount
            .checked_add(amount)
            .ok_or(MarginfiUsdcError::MathOverflow)?;
        position.shares = shares;
        position.last_value = value;

        emit!(MarginfiUsdcDeposit {
            owner: position.owner,
            mint: ctx.accounts.config.supported_mint,
            amount,
            shares,
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
        validate_withdraw_accounts(&ctx)?;

        let mut instruction = Instruction {
            program_id: ctx.accounts.marginfi_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.marginfi_group.key(), false),
                AccountMeta::new(ctx.accounts.marginfi_account.key(), false),
                AccountMeta::new_readonly(ctx.accounts.owner.key(), true),
                AccountMeta::new(ctx.accounts.marginfi_bank.key(), false),
                AccountMeta::new(ctx.accounts.owner_token_account.key(), false),
                AccountMeta::new_readonly(ctx.accounts.bank_liquidity_vault_authority.key(), false),
                AccountMeta::new(ctx.accounts.liquidity_vault.key(), false),
                AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
            ],
            data: marginfi_withdraw_ix_data(amount),
        };
        let mut account_infos = vec![
            ctx.accounts.marginfi_group.to_account_info(),
            ctx.accounts.marginfi_account.to_account_info(),
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.marginfi_bank.to_account_info(),
            ctx.accounts.owner_token_account.to_account_info(),
            ctx.accounts.bank_liquidity_vault_authority.to_account_info(),
            ctx.accounts.liquidity_vault.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ];
        append_remaining_accounts(&mut instruction, &mut account_infos, ctx.remaining_accounts);
        account_infos.push(ctx.accounts.marginfi_program.to_account_info());

        invoke(&instruction, &account_infos)
            .map_err(|_| error!(MarginfiUsdcError::ProtocolCpiFailed))?;

        let (shares, value) = read_marginfi_position(&ctx.accounts.marginfi_account, &ctx.accounts.marginfi_bank)?;

        let position = &mut ctx.accounts.position;
        position.deposited_amount = position.deposited_amount.saturating_sub(amount);
        position.shares = shares;
        position.last_value = value;

        emit!(MarginfiUsdcWithdraw {
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
        validate_value_accounts(&ctx)?;

        let (_shares, value) =
            read_marginfi_position(&ctx.accounts.marginfi_account, &ctx.accounts.marginfi_bank)?;
        set_return_data(&value.to_le_bytes());

        emit!(MarginfiUsdcValue {
            owner: ctx.accounts.position.owner,
            mint: ctx.accounts.config.supported_mint,
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
        space = MarginfiUsdcConfig::LEN,
        seeds = [CONFIG_SEED, supported_mint.as_ref(), &version.to_le_bytes()],
        bump
    )]
    pub config: Account<'info, MarginfiUsdcConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(marginfi_account: Pubkey, marginfi_bank: Pubkey)]
pub struct InitializePosition<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, MarginfiUsdcConfig>,
    #[account(
        init,
        payer = owner,
        space = MarginfiUsdcPosition::LEN,
        seeds = [POSITION_SEED, config.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, MarginfiUsdcPosition>,
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
    pub config: Account<'info, MarginfiUsdcConfig>,
    #[account(
        mut,
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, MarginfiUsdcPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Validated against config.protocol_program_id.
    pub marginfi_program: UncheckedAccount<'info>,
    /// CHECK: Validated against the MarginFi Bank and MarginfiAccount data.
    pub marginfi_group: UncheckedAccount<'info>,
    /// CHECK: Validated against the stored position and parsed account authority.
    #[account(mut)]
    pub marginfi_account: UncheckedAccount<'info>,
    /// CHECK: Validated as the stored MarginFi USDC bank.
    #[account(mut)]
    pub marginfi_bank: UncheckedAccount<'info>,
    /// CHECK: Validated as the owner's token account for config.supported_mint.
    #[account(mut)]
    pub owner_token_account: UncheckedAccount<'info>,
    /// CHECK: Validated against the MarginFi Bank liquidity vault field.
    #[account(mut)]
    pub liquidity_vault: UncheckedAccount<'info>,
    /// CHECK: Validated as the owner of owner_token_account.
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, MarginfiUsdcConfig>,
    #[account(
        mut,
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, MarginfiUsdcPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Validated against config.protocol_program_id.
    pub marginfi_program: UncheckedAccount<'info>,
    /// CHECK: Validated against the MarginFi Bank and MarginfiAccount data.
    pub marginfi_group: UncheckedAccount<'info>,
    /// CHECK: Validated against the stored position and parsed account authority.
    #[account(mut)]
    pub marginfi_account: UncheckedAccount<'info>,
    /// CHECK: Validated as the stored MarginFi USDC bank.
    #[account(mut)]
    pub marginfi_bank: UncheckedAccount<'info>,
    /// CHECK: Validated as the owner's token account for config.supported_mint.
    #[account(mut)]
    pub owner_token_account: UncheckedAccount<'info>,
    /// CHECK: Validated as MarginFi's liquidity vault authority PDA for the bank.
    pub bank_liquidity_vault_authority: UncheckedAccount<'info>,
    /// CHECK: Validated against the MarginFi Bank liquidity vault field.
    #[account(mut)]
    pub liquidity_vault: UncheckedAccount<'info>,
    /// CHECK: Validated as the owner of owner_token_account.
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CurrentValue<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, MarginfiUsdcConfig>,
    #[account(
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, MarginfiUsdcPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Validated against config.protocol_program_id.
    pub marginfi_program: UncheckedAccount<'info>,
    /// CHECK: Validated against the MarginFi Bank and MarginfiAccount data.
    pub marginfi_group: UncheckedAccount<'info>,
    /// CHECK: Validated against the stored position and parsed account authority.
    pub marginfi_account: UncheckedAccount<'info>,
    /// CHECK: Validated as the stored MarginFi USDC bank.
    pub marginfi_bank: UncheckedAccount<'info>,
}

#[account]
pub struct MarginfiUsdcConfig {
    pub authority: Pubkey,
    pub supported_mint: Pubkey,
    pub protocol_program_id: Pubkey,
    pub version: u16,
    pub bump: u8,
}

impl MarginfiUsdcConfig {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 1;
}

#[account]
pub struct MarginfiUsdcPosition {
    pub owner: Pubkey,
    pub marginfi_account: Pubkey,
    pub marginfi_bank: Pubkey,
    pub deposited_amount: u64,
    pub shares: u64,
    pub last_value: u64,
    pub bump: u8,
}

impl MarginfiUsdcPosition {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1;
}

#[event]
pub struct MarginfiUsdcConfigInitialized {
    pub authority: Pubkey,
    pub supported_mint: Pubkey,
    pub protocol_program_id: Pubkey,
    pub version: u16,
}

#[event]
pub struct MarginfiUsdcDeposit {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub value: u64,
}

#[event]
pub struct MarginfiUsdcWithdraw {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub value: u64,
}

#[event]
pub struct MarginfiUsdcValue {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub value: u64,
}

#[error_code]
pub enum MarginfiUsdcError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Requested mint does not match this adapter config.")]
    InvalidMint,
    #[msg("Signer does not own this adapter position.")]
    InvalidOwner,
    #[msg("Passed MarginFi program does not match this adapter config.")]
    InvalidProtocolProgram,
    #[msg("Passed MarginFi account is not the configured user MarginFi account.")]
    InvalidMarginfiAccount,
    #[msg("Passed MarginFi bank is not the configured USDC bank.")]
    InvalidBank,
    #[msg("Passed MarginFi group does not match protocol account data.")]
    InvalidGroup,
    #[msg("Passed liquidity vault does not match the MarginFi bank.")]
    InvalidVault,
    #[msg("Passed token account is not an owner USDC token account.")]
    InvalidTokenAccount,
    #[msg("MarginFi CPI failed.")]
    ProtocolCpiFailed,
    #[msg("Math overflow or underflow occurred.")]
    MathOverflow,
    #[msg("MarginFi fixed-point value was negative or too large.")]
    InvalidFixedPointValue,
    #[msg("MarginFi account or bank data is shorter than expected.")]
    InvalidProtocolAccount,
    #[msg("MarginFi withdraw requires bank and oracle health-check accounts.")]
    MissingHealthAccounts,
}

fn validate_common(
    config: &MarginfiUsdcConfig,
    position: &MarginfiUsdcPosition,
    owner: Pubkey,
    mint: Pubkey,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, MarginfiUsdcError::InvalidAmount);
    validate_owner_and_mint(config, position, owner, mint)
}

fn validate_owner_and_mint(
    config: &MarginfiUsdcConfig,
    position: &MarginfiUsdcPosition,
    owner: Pubkey,
    mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(mint, config.supported_mint, MarginfiUsdcError::InvalidMint);
    require_keys_eq!(owner, position.owner, MarginfiUsdcError::InvalidOwner);
    Ok(())
}

fn validate_deposit_accounts(ctx: &Context<Deposit>) -> Result<()> {
    validate_protocol_program(
        &ctx.accounts.config,
        ctx.accounts.marginfi_program.key(),
    )?;
    validate_protocol_state(
        &ctx.accounts.config,
        &ctx.accounts.position,
        &ctx.accounts.marginfi_program,
        &ctx.accounts.marginfi_group,
        &ctx.accounts.marginfi_account,
        &ctx.accounts.marginfi_bank,
        Some(&ctx.accounts.liquidity_vault),
        None,
    )?;
    validate_token_account(
        &ctx.accounts.owner_token_account,
        &ctx.accounts.token_program,
        ctx.accounts.config.supported_mint,
        ctx.accounts.owner.key(),
    )
}

fn validate_withdraw_accounts(ctx: &Context<Withdraw>) -> Result<()> {
    validate_protocol_program(
        &ctx.accounts.config,
        ctx.accounts.marginfi_program.key(),
    )?;
    validate_protocol_state(
        &ctx.accounts.config,
        &ctx.accounts.position,
        &ctx.accounts.marginfi_program,
        &ctx.accounts.marginfi_group,
        &ctx.accounts.marginfi_account,
        &ctx.accounts.marginfi_bank,
        Some(&ctx.accounts.liquidity_vault),
        Some(&ctx.accounts.bank_liquidity_vault_authority),
    )?;
    validate_token_account(
        &ctx.accounts.owner_token_account,
        &ctx.accounts.token_program,
        ctx.accounts.config.supported_mint,
        ctx.accounts.owner.key(),
    )?;
    validate_withdraw_health_accounts(ctx)
}

fn validate_value_accounts(ctx: &Context<CurrentValue>) -> Result<()> {
    validate_protocol_program(
        &ctx.accounts.config,
        ctx.accounts.marginfi_program.key(),
    )?;
    validate_protocol_state(
        &ctx.accounts.config,
        &ctx.accounts.position,
        &ctx.accounts.marginfi_program,
        &ctx.accounts.marginfi_group,
        &ctx.accounts.marginfi_account,
        &ctx.accounts.marginfi_bank,
        None,
        None,
    )
}

fn validate_protocol_program(config: &MarginfiUsdcConfig, marginfi_program: Pubkey) -> Result<()> {
    require_keys_eq!(
        marginfi_program,
        config.protocol_program_id,
        MarginfiUsdcError::InvalidProtocolProgram
    );
    Ok(())
}

fn validate_protocol_state<'info>(
    config: &MarginfiUsdcConfig,
    position: &MarginfiUsdcPosition,
    marginfi_program: &UncheckedAccount<'info>,
    marginfi_group: &UncheckedAccount<'info>,
    marginfi_account: &UncheckedAccount<'info>,
    marginfi_bank: &UncheckedAccount<'info>,
    liquidity_vault: Option<&UncheckedAccount<'info>>,
    bank_liquidity_vault_authority: Option<&UncheckedAccount<'info>>,
) -> Result<()> {
    require_keys_eq!(
        marginfi_account.key(),
        position.marginfi_account,
        MarginfiUsdcError::InvalidMarginfiAccount
    );
    require_keys_eq!(
        marginfi_bank.key(),
        position.marginfi_bank,
        MarginfiUsdcError::InvalidBank
    );
    require_keys_eq!(
        *marginfi_account.owner,
        marginfi_program.key(),
        MarginfiUsdcError::InvalidMarginfiAccount
    );
    require_keys_eq!(
        *marginfi_bank.owner,
        marginfi_program.key(),
        MarginfiUsdcError::InvalidBank
    );

    let bank_data = marginfi_bank.try_borrow_data()?;
    require!(
        bank_data.len() >= BANK_ORACLE_KEYS_OFFSET + 32,
        MarginfiUsdcError::InvalidProtocolAccount
    );
    let bank_mint = read_pubkey(&bank_data, BANK_MINT_OFFSET)?;
    let bank_group = read_pubkey(&bank_data, BANK_GROUP_OFFSET)?;
    let bank_liquidity_vault = read_pubkey(&bank_data, BANK_LIQUIDITY_VAULT_OFFSET)?;

    require_keys_eq!(bank_mint, config.supported_mint, MarginfiUsdcError::InvalidMint);
    require!(
        bank_data[BANK_MINT_DECIMALS_OFFSET] == 6,
        MarginfiUsdcError::InvalidMint
    );
    require_keys_eq!(
        bank_group,
        marginfi_group.key(),
        MarginfiUsdcError::InvalidGroup
    );
    require!(
        bank_data[BANK_OPERATIONAL_STATE_OFFSET] == 1,
        MarginfiUsdcError::InvalidBank
    );
    require!(
        bank_data[BANK_ORACLE_SETUP_OFFSET] != 0,
        MarginfiUsdcError::InvalidBank
    );
    let primary_oracle = read_pubkey(&bank_data, BANK_ORACLE_KEYS_OFFSET)?;
    require_keys_neq!(
        primary_oracle,
        Pubkey::default(),
        MarginfiUsdcError::InvalidBank
    );

    if let Some(vault) = liquidity_vault {
        require_keys_eq!(
            vault.key(),
            bank_liquidity_vault,
            MarginfiUsdcError::InvalidVault
        );
    }

    if let Some(vault_authority) = bank_liquidity_vault_authority {
        let (expected_vault_authority, _bump) = Pubkey::find_program_address(
            &[LIQUIDITY_VAULT_AUTHORITY_SEED, marginfi_bank.key().as_ref()],
            &marginfi_program.key(),
        );
        require_keys_eq!(
            vault_authority.key(),
            expected_vault_authority,
            MarginfiUsdcError::InvalidVault
        );
    }
    drop(bank_data);

    let account_data = marginfi_account.try_borrow_data()?;
    let account_group = read_pubkey(&account_data, MARGINFI_ACCOUNT_GROUP_OFFSET)?;
    let account_authority = read_pubkey(&account_data, MARGINFI_ACCOUNT_AUTHORITY_OFFSET)?;
    require_keys_eq!(
        account_group,
        marginfi_group.key(),
        MarginfiUsdcError::InvalidGroup
    );
    require_keys_eq!(
        account_authority,
        position.owner,
        MarginfiUsdcError::InvalidOwner
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
        MarginfiUsdcError::InvalidTokenAccount
    );

    let token_data = token_account.try_borrow_data()?;
    let token_mint = read_pubkey(&token_data, TOKEN_ACCOUNT_MINT_OFFSET)?;
    let token_owner = read_pubkey(&token_data, TOKEN_ACCOUNT_OWNER_OFFSET)?;

    require_keys_eq!(
        token_mint,
        expected_mint,
        MarginfiUsdcError::InvalidTokenAccount
    );
    require_keys_eq!(
        token_owner,
        expected_owner,
        MarginfiUsdcError::InvalidTokenAccount
    );

    Ok(())
}

fn validate_withdraw_health_accounts(ctx: &Context<Withdraw>) -> Result<()> {
    require!(
        ctx.remaining_accounts.len() >= 2,
        MarginfiUsdcError::MissingHealthAccounts
    );

    let bank_data = ctx.accounts.marginfi_bank.try_borrow_data()?;
    let primary_oracle = read_pubkey(&bank_data, BANK_ORACLE_KEYS_OFFSET)?;

    require_keys_eq!(
        ctx.remaining_accounts[0].key(),
        ctx.accounts.marginfi_bank.key(),
        MarginfiUsdcError::MissingHealthAccounts
    );
    require_keys_eq!(
        ctx.remaining_accounts[1].key(),
        primary_oracle,
        MarginfiUsdcError::MissingHealthAccounts
    );

    Ok(())
}

fn marginfi_deposit_ix_data(amount: u64) -> Vec<u8> {
    let mut data = Vec::with_capacity(17);
    data.extend_from_slice(&MARGINFI_DEPOSIT_IX_DISCRIMINATOR);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(0); // deposit_up_to_limit: Option<bool>::None
    data
}

fn marginfi_withdraw_ix_data(amount: u64) -> Vec<u8> {
    let mut data = Vec::with_capacity(18);
    data.extend_from_slice(&MARGINFI_WITHDRAW_IX_DISCRIMINATOR);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(1); // withdraw_all: Option<bool>::Some(false)
    data.push(0);
    data
}

fn append_remaining_accounts<'info>(
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

fn read_marginfi_position<'info>(
    marginfi_account: &UncheckedAccount<'info>,
    marginfi_bank: &UncheckedAccount<'info>,
) -> Result<(u64, u64)> {
    let account_data = marginfi_account.try_borrow_data()?;
    let bank_data = marginfi_bank.try_borrow_data()?;
    let bank = marginfi_bank.key();

    let asset_shares_raw = read_asset_shares_for_bank(&account_data, bank)?;
    let asset_share_value_raw = read_i80f48_raw(&bank_data, BANK_ASSET_SHARE_VALUE_OFFSET)?;

    let shares = fixed_floor_to_u64(asset_shares_raw)?;
    let value = fixed_mul_floor_to_u64(asset_shares_raw, asset_share_value_raw)?;

    Ok((shares, value))
}

fn read_asset_shares_for_bank(account_data: &[u8], bank: Pubkey) -> Result<u128> {
    for index in 0..MARGINFI_BALANCE_COUNT {
        let offset = MARGINFI_ACCOUNT_BALANCES_OFFSET + index * MARGINFI_BALANCE_SIZE;
        require!(
            account_data.len() >= offset + MARGINFI_BALANCE_SIZE,
            MarginfiUsdcError::InvalidProtocolAccount
        );
        let active = account_data[offset + MARGINFI_BALANCE_ACTIVE_OFFSET] != 0;
        let balance_bank = read_pubkey(account_data, offset + MARGINFI_BALANCE_BANK_OFFSET)?;
        if active && balance_bank == bank {
            return read_i80f48_raw(account_data, offset + MARGINFI_BALANCE_ASSET_SHARES_OFFSET);
        }
    }

    Ok(0)
}

fn read_pubkey(data: &[u8], offset: usize) -> Result<Pubkey> {
    require!(
        data.len() >= offset + 32,
        MarginfiUsdcError::InvalidProtocolAccount
    );
    let mut bytes = [0_u8; 32];
    bytes.copy_from_slice(&data[offset..offset + 32]);
    Ok(Pubkey::new_from_array(bytes))
}

fn read_i80f48_raw(data: &[u8], offset: usize) -> Result<u128> {
    require!(
        data.len() >= offset + 16,
        MarginfiUsdcError::InvalidProtocolAccount
    );
    let mut bytes = [0_u8; 16];
    bytes.copy_from_slice(&data[offset..offset + 16]);
    let value = i128::from_le_bytes(bytes);
    require!(value >= 0, MarginfiUsdcError::InvalidFixedPointValue);
    Ok(value as u128)
}

fn fixed_floor_to_u64(raw: u128) -> Result<u64> {
    let value = raw / I80F48_ONE;
    u64::try_from(value).map_err(|_| error!(MarginfiUsdcError::InvalidFixedPointValue))
}

fn fixed_mul_floor_to_u64(left_raw: u128, right_raw: u128) -> Result<u64> {
    let left_whole = left_raw / I80F48_ONE;
    let left_frac = left_raw % I80F48_ONE;
    let right_whole = right_raw / I80F48_ONE;
    let right_frac = right_raw % I80F48_ONE;

    let whole = left_whole
        .checked_mul(right_whole)
        .ok_or(MarginfiUsdcError::MathOverflow)?;
    let cross = left_whole
        .checked_mul(right_frac)
        .and_then(|value| value.checked_add(right_whole.checked_mul(left_frac)?))
        .ok_or(MarginfiUsdcError::MathOverflow)?;
    let frac = left_frac
        .checked_mul(right_frac)
        .ok_or(MarginfiUsdcError::MathOverflow)?;
    let value = whole
        .checked_add(cross / I80F48_ONE)
        .and_then(|sum| sum.checked_add(frac / I80F48_ONE / I80F48_ONE))
        .ok_or(MarginfiUsdcError::MathOverflow)?;

    u64::try_from(value).map_err(|_| error!(MarginfiUsdcError::InvalidFixedPointValue))
}

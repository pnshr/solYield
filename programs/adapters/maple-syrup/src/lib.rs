use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{invoke, invoke_signed, set_return_data},
};

pub mod constants;

use constants::{MAPLE_SYRUP_USDC_MINT, TOKEN_PROGRAM_ID};

declare_id!("CnAVx7eyK1MZdkQVAWZMVE9B9aXFcxKmv8bS8dEpgvsC");

pub const CONFIG_SEED: &[u8] = b"maple_syrup_config";
pub const POSITION_SEED: &[u8] = b"maple_syrup_position";

const SPL_TOKEN_TRANSFER_IX: u8 = 3;

const TOKEN_ACCOUNT_MINT_OFFSET: usize = 0;
const TOKEN_ACCOUNT_OWNER_OFFSET: usize = 32;
const TOKEN_ACCOUNT_AMOUNT_OFFSET: usize = 64;

#[program]
pub mod maple_syrup {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        supported_mint: Pubkey,
        protocol_program_id: Pubkey,
        version: u16,
    ) -> Result<()> {
        require_keys_eq!(
            supported_mint,
            MAPLE_SYRUP_USDC_MINT,
            MapleSyrupError::InvalidMint
        );
        require_keys_eq!(
            protocol_program_id,
            TOKEN_PROGRAM_ID,
            MapleSyrupError::InvalidProtocolProgram
        );

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.supported_mint = supported_mint;
        config.protocol_program_id = protocol_program_id;
        config.version = version;
        config.bump = ctx.bumps.config;

        emit!(MapleSyrupConfigInitialized {
            authority: config.authority,
            supported_mint,
            protocol_program_id,
            version,
        });

        Ok(())
    }

    pub fn initialize_position(
        ctx: Context<InitializePosition>,
        vault_token_account: Pubkey,
    ) -> Result<()> {
        require_keys_neq!(
            vault_token_account,
            Pubkey::default(),
            MapleSyrupError::InvalidTokenAccount
        );

        let position = &mut ctx.accounts.position;
        position.owner = ctx.accounts.owner.key();
        position.vault_token_account = vault_token_account;
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

        let instruction = token_transfer_instruction(
            ctx.accounts.token_program.key(),
            ctx.accounts.user_source_token_account.key(),
            ctx.accounts.vault_token_account.key(),
            ctx.accounts.owner.key(),
            amount,
        );

        invoke(
            &instruction,
            &[
                ctx.accounts.user_source_token_account.to_account_info(),
                ctx.accounts.vault_token_account.to_account_info(),
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
        )
        .map_err(|_| error!(MapleSyrupError::ProtocolCpiFailed))?;

        let shares = read_token_amount(&ctx.accounts.vault_token_account)?;
        let position = &mut ctx.accounts.position;
        position.deposited_amount = position
            .deposited_amount
            .checked_add(amount)
            .ok_or(MapleSyrupError::MathOverflow)?;
        position.shares = shares;
        position.last_value = shares;

        emit!(MapleSyrupDeposit {
            owner: position.owner,
            mint: ctx.accounts.config.supported_mint,
            amount,
            shares,
            value: shares,
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
        let vault_amount = read_token_amount(&ctx.accounts.vault_token_account)?;
        require!(vault_amount >= amount, MapleSyrupError::InvalidAmount);

        let instruction = token_transfer_instruction(
            ctx.accounts.token_program.key(),
            ctx.accounts.vault_token_account.key(),
            ctx.accounts.user_destination_token_account.key(),
            ctx.accounts.position.key(),
            amount,
        );

        let config_key = ctx.accounts.config.key();
        let owner_key = ctx.accounts.position.owner;
        let bump = [ctx.accounts.position.bump];
        let signer_seeds: &[&[u8]] = &[
            POSITION_SEED,
            config_key.as_ref(),
            owner_key.as_ref(),
            bump.as_ref(),
        ];

        invoke_signed(
            &instruction,
            &[
                ctx.accounts.vault_token_account.to_account_info(),
                ctx.accounts.user_destination_token_account.to_account_info(),
                ctx.accounts.position.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
            &[signer_seeds],
        )
        .map_err(|_| error!(MapleSyrupError::ProtocolCpiFailed))?;

        let shares = read_token_amount(&ctx.accounts.vault_token_account)?;
        let position = &mut ctx.accounts.position;
        position.deposited_amount = position.deposited_amount.saturating_sub(amount);
        position.shares = shares;
        position.last_value = shares;

        emit!(MapleSyrupWithdraw {
            owner: position.owner,
            mint: ctx.accounts.config.supported_mint,
            amount,
            shares,
            value: shares,
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

        let shares = read_token_amount(&ctx.accounts.vault_token_account)?;
        set_return_data(&shares.to_le_bytes());

        emit!(MapleSyrupValue {
            owner: ctx.accounts.position.owner,
            mint: ctx.accounts.config.supported_mint,
            shares,
            value: shares,
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
        space = MapleSyrupConfig::LEN,
        seeds = [CONFIG_SEED, supported_mint.as_ref(), &version.to_le_bytes()],
        bump
    )]
    pub config: Account<'info, MapleSyrupConfig>,
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
    pub config: Account<'info, MapleSyrupConfig>,
    #[account(
        init,
        payer = owner,
        space = MapleSyrupPosition::LEN,
        seeds = [POSITION_SEED, config.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, MapleSyrupPosition>,
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
    pub config: Account<'info, MapleSyrupConfig>,
    #[account(
        mut,
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, MapleSyrupPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Checked against SPL Token program id and config.protocol_program_id.
    pub token_program: UncheckedAccount<'info>,
    /// CHECK: SPL token account validated by mint and owner.
    #[account(mut)]
    pub user_source_token_account: UncheckedAccount<'info>,
    /// CHECK: SPL token account validated by mint and position PDA owner.
    #[account(mut)]
    pub vault_token_account: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, MapleSyrupConfig>,
    #[account(
        mut,
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, MapleSyrupPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Checked against SPL Token program id and config.protocol_program_id.
    pub token_program: UncheckedAccount<'info>,
    /// CHECK: SPL token account validated by mint and position PDA owner.
    #[account(mut)]
    pub vault_token_account: UncheckedAccount<'info>,
    /// CHECK: SPL token account validated by mint and owner.
    #[account(mut)]
    pub user_destination_token_account: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CurrentValue<'info> {
    #[account(
        seeds = [CONFIG_SEED, config.supported_mint.as_ref(), &config.version.to_le_bytes()],
        bump = config.bump
    )]
    pub config: Account<'info, MapleSyrupConfig>,
    #[account(
        seeds = [POSITION_SEED, config.key().as_ref(), position.owner.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, MapleSyrupPosition>,
    pub owner: Signer<'info>,
    /// CHECK: Validated against config.supported_mint.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Checked against SPL Token program id and config.protocol_program_id.
    pub token_program: UncheckedAccount<'info>,
    /// CHECK: SPL token account validated by mint and position PDA owner.
    pub vault_token_account: UncheckedAccount<'info>,
}

#[account]
pub struct MapleSyrupConfig {
    pub authority: Pubkey,
    pub supported_mint: Pubkey,
    pub protocol_program_id: Pubkey,
    pub version: u16,
    pub bump: u8,
}

impl MapleSyrupConfig {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 1;
}

#[account]
pub struct MapleSyrupPosition {
    pub owner: Pubkey,
    pub vault_token_account: Pubkey,
    pub deposited_amount: u64,
    pub shares: u64,
    pub last_value: u64,
    pub bump: u8,
}

impl MapleSyrupPosition {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1;
}

#[event]
pub struct MapleSyrupConfigInitialized {
    pub authority: Pubkey,
    pub supported_mint: Pubkey,
    pub protocol_program_id: Pubkey,
    pub version: u16,
}

#[event]
pub struct MapleSyrupDeposit {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub value: u64,
}

#[event]
pub struct MapleSyrupWithdraw {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub value: u64,
}

#[event]
pub struct MapleSyrupValue {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub shares: u64,
    pub value: u64,
}

#[error_code]
pub enum MapleSyrupError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Requested mint does not match this adapter config.")]
    InvalidMint,
    #[msg("Signer does not own this adapter position.")]
    InvalidOwner,
    #[msg("Maple/Syrup token transfer failed.")]
    ProtocolCpiFailed,
    #[msg("Math overflow or underflow occurred.")]
    MathOverflow,
    #[msg("Protocol program id is invalid.")]
    InvalidProtocolProgram,
    #[msg("SPL token account is invalid.")]
    InvalidTokenAccount,
}

fn validate_common(
    config: &MapleSyrupConfig,
    position: &MapleSyrupPosition,
    owner: Pubkey,
    mint: Pubkey,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, MapleSyrupError::InvalidAmount);
    validate_owner_and_mint(config, position, owner, mint)
}

fn validate_owner_and_mint(
    config: &MapleSyrupConfig,
    position: &MapleSyrupPosition,
    owner: Pubkey,
    mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(mint, config.supported_mint, MapleSyrupError::InvalidMint);
    require_keys_eq!(mint, MAPLE_SYRUP_USDC_MINT, MapleSyrupError::InvalidMint);
    require_keys_eq!(owner, position.owner, MapleSyrupError::InvalidOwner);
    Ok(())
}

fn validate_deposit_accounts(ctx: &Context<Deposit>) -> Result<()> {
    validate_token_program(ctx.accounts.config.protocol_program_id, ctx.accounts.token_program.key())?;
    validate_position_vault(&ctx.accounts.position, ctx.accounts.vault_token_account.key())?;
    validate_token_account(
        &ctx.accounts.user_source_token_account,
        &ctx.accounts.token_program,
        ctx.accounts.config.supported_mint,
        ctx.accounts.owner.key(),
    )?;
    validate_token_account(
        &ctx.accounts.vault_token_account,
        &ctx.accounts.token_program,
        ctx.accounts.config.supported_mint,
        ctx.accounts.position.key(),
    )
}

fn validate_withdraw_accounts(ctx: &Context<Withdraw>) -> Result<()> {
    validate_token_program(ctx.accounts.config.protocol_program_id, ctx.accounts.token_program.key())?;
    validate_position_vault(&ctx.accounts.position, ctx.accounts.vault_token_account.key())?;
    validate_token_account(
        &ctx.accounts.vault_token_account,
        &ctx.accounts.token_program,
        ctx.accounts.config.supported_mint,
        ctx.accounts.position.key(),
    )?;
    validate_token_account(
        &ctx.accounts.user_destination_token_account,
        &ctx.accounts.token_program,
        ctx.accounts.config.supported_mint,
        ctx.accounts.owner.key(),
    )
}

fn validate_value_accounts(ctx: &Context<CurrentValue>) -> Result<()> {
    validate_token_program(ctx.accounts.config.protocol_program_id, ctx.accounts.token_program.key())?;
    validate_position_vault(&ctx.accounts.position, ctx.accounts.vault_token_account.key())?;
    validate_token_account(
        &ctx.accounts.vault_token_account,
        &ctx.accounts.token_program,
        ctx.accounts.config.supported_mint,
        ctx.accounts.position.key(),
    )
}

fn validate_token_program(config_program: Pubkey, passed_program: Pubkey) -> Result<()> {
    require_keys_eq!(
        config_program,
        passed_program,
        MapleSyrupError::InvalidProtocolProgram
    );
    require_keys_eq!(
        passed_program,
        TOKEN_PROGRAM_ID,
        MapleSyrupError::InvalidProtocolProgram
    );
    Ok(())
}

fn validate_position_vault(position: &MapleSyrupPosition, vault: Pubkey) -> Result<()> {
    require_keys_eq!(
        vault,
        position.vault_token_account,
        MapleSyrupError::InvalidTokenAccount
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
        MapleSyrupError::InvalidTokenAccount
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
        MapleSyrupError::InvalidTokenAccount
    );
    require_keys_eq!(
        read_pubkey(&token_data, TOKEN_ACCOUNT_OWNER_OFFSET)?,
        expected_owner,
        MapleSyrupError::InvalidTokenAccount
    );
    Ok(())
}

fn token_transfer_instruction(
    token_program: Pubkey,
    source: Pubkey,
    destination: Pubkey,
    authority: Pubkey,
    amount: u64,
) -> Instruction {
    let mut data = Vec::with_capacity(9);
    data.push(SPL_TOKEN_TRANSFER_IX);
    data.extend_from_slice(&amount.to_le_bytes());

    Instruction {
        program_id: token_program,
        accounts: vec![
            AccountMeta::new(source, false),
            AccountMeta::new(destination, false),
            AccountMeta::new_readonly(authority, true),
        ],
        data,
    }
}

fn read_token_amount<'info>(token_account: &UncheckedAccount<'info>) -> Result<u64> {
    let data = token_account.try_borrow_data()?;
    read_u64(&data, TOKEN_ACCOUNT_AMOUNT_OFFSET)
}

fn read_pubkey(data: &[u8], offset: usize) -> Result<Pubkey> {
    require!(
        data.len() >= offset + 32,
        MapleSyrupError::InvalidTokenAccount
    );
    let mut bytes = [0_u8; 32];
    bytes.copy_from_slice(&data[offset..offset + 32]);
    Ok(Pubkey::new_from_array(bytes))
}

fn read_u64(data: &[u8], offset: usize) -> Result<u64> {
    require!(
        data.len() >= offset + 8,
        MapleSyrupError::InvalidTokenAccount
    );
    let mut bytes = [0_u8; 8];
    bytes.copy_from_slice(&data[offset..offset + 8]);
    Ok(u64::from_le_bytes(bytes))
}

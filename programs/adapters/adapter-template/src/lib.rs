use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::set_return_data;

declare_id!("HQ43j9nP1vEaLGVbo2M19ijmGf5aG6UA5FTBspkNZ5GR");

pub const ADAPTER_CONFIG_SEED: &[u8] = b"adapter_config";
pub const USER_POSITION_SEED: &[u8] = b"user_position";

#[program]
pub mod adapter_template {
    use super::*;

    pub fn initialize_adapter(
        ctx: Context<InitializeAdapter>,
        supported_mint: Pubkey,
        protocol_program_id: Pubkey,
        version: u16,
    ) -> Result<()> {
        require_keys_neq!(
            supported_mint,
            Pubkey::default(),
            AdapterTemplateError::InvalidMint
        );

        let adapter_config = &mut ctx.accounts.adapter_config;
        adapter_config.authority = ctx.accounts.authority.key();
        adapter_config.supported_mint = supported_mint;
        adapter_config.protocol_program_id = protocol_program_id;
        adapter_config.version = version;
        adapter_config.bump = ctx.bumps.adapter_config;

        Ok(())
    }

    pub fn initialize_position(ctx: Context<InitializePosition>) -> Result<()> {
        let user_position = &mut ctx.accounts.user_position;
        user_position.owner = ctx.accounts.owner.key();
        user_position.deposited_amount = 0;
        user_position.shares = 0;
        user_position.last_value = 0;
        user_position.bump = ctx.bumps.user_position;

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, AdapterTemplateError::InvalidAmount);
        validate_mint(&ctx.accounts.adapter_config, ctx.accounts.mint.key())?;
        validate_owner(&ctx.accounts.user_position, ctx.accounts.owner.key())?;

        let user_position = &mut ctx.accounts.user_position;
        user_position.deposited_amount = user_position
            .deposited_amount
            .checked_add(amount)
            .ok_or(AdapterTemplateError::MathOverflow)?;
        user_position.shares = user_position
            .shares
            .checked_add(amount)
            .ok_or(AdapterTemplateError::MathOverflow)?;
        user_position.last_value = user_position.deposited_amount;

        emit!(AdapterDeposit {
            owner: user_position.owner,
            mint: ctx.accounts.adapter_config.supported_mint,
            amount,
            shares: user_position.shares,
            value: user_position.last_value,
        });

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, AdapterTemplateError::InvalidAmount);
        validate_mint(&ctx.accounts.adapter_config, ctx.accounts.mint.key())?;
        validate_owner(&ctx.accounts.user_position, ctx.accounts.owner.key())?;

        let user_position = &mut ctx.accounts.user_position;
        user_position.deposited_amount = user_position
            .deposited_amount
            .checked_sub(amount)
            .ok_or(AdapterTemplateError::MathOverflow)?;
        user_position.shares = user_position
            .shares
            .checked_sub(amount)
            .ok_or(AdapterTemplateError::MathOverflow)?;
        user_position.last_value = user_position.deposited_amount;

        emit!(AdapterWithdraw {
            owner: user_position.owner,
            mint: ctx.accounts.adapter_config.supported_mint,
            amount,
            shares: user_position.shares,
            value: user_position.last_value,
        });

        Ok(())
    }

    pub fn current_value(ctx: Context<CurrentValue>) -> Result<()> {
        validate_mint(&ctx.accounts.adapter_config, ctx.accounts.mint.key())?;
        validate_owner(&ctx.accounts.user_position, ctx.accounts.owner.key())?;

        let value = ctx.accounts.user_position.last_value;
        set_return_data(&value.to_le_bytes());

        emit!(AdapterValue {
            owner: ctx.accounts.user_position.owner,
            mint: ctx.accounts.adapter_config.supported_mint,
            value,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(supported_mint: Pubkey, protocol_program_id: Pubkey, version: u16)]
pub struct InitializeAdapter<'info> {
    #[account(
        init,
        payer = authority,
        space = AdapterConfig::LEN,
        seeds = [
            ADAPTER_CONFIG_SEED,
            supported_mint.as_ref(),
            &version.to_le_bytes()
        ],
        bump
    )]
    pub adapter_config: Account<'info, AdapterConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePosition<'info> {
    #[account(
        seeds = [
            ADAPTER_CONFIG_SEED,
            adapter_config.supported_mint.as_ref(),
            &adapter_config.version.to_le_bytes()
        ],
        bump = adapter_config.bump
    )]
    pub adapter_config: Account<'info, AdapterConfig>,
    #[account(
        init,
        payer = owner,
        space = UserPosition::LEN,
        seeds = [
            USER_POSITION_SEED,
            adapter_config.key().as_ref(),
            owner.key().as_ref()
        ],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [
            ADAPTER_CONFIG_SEED,
            adapter_config.supported_mint.as_ref(),
            &adapter_config.version.to_le_bytes()
        ],
        bump = adapter_config.bump
    )]
    pub adapter_config: Account<'info, AdapterConfig>,
    #[account(
        mut,
        seeds = [
            USER_POSITION_SEED,
            adapter_config.key().as_ref(),
            user_position.owner.as_ref()
        ],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,
    pub owner: Signer<'info>,
    /// CHECK: The template validates this key against AdapterConfig.supported_mint.
    pub mint: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [
            ADAPTER_CONFIG_SEED,
            adapter_config.supported_mint.as_ref(),
            &adapter_config.version.to_le_bytes()
        ],
        bump = adapter_config.bump
    )]
    pub adapter_config: Account<'info, AdapterConfig>,
    #[account(
        mut,
        seeds = [
            USER_POSITION_SEED,
            adapter_config.key().as_ref(),
            user_position.owner.as_ref()
        ],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,
    pub owner: Signer<'info>,
    /// CHECK: The template validates this key against AdapterConfig.supported_mint.
    pub mint: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CurrentValue<'info> {
    #[account(
        seeds = [
            ADAPTER_CONFIG_SEED,
            adapter_config.supported_mint.as_ref(),
            &adapter_config.version.to_le_bytes()
        ],
        bump = adapter_config.bump
    )]
    pub adapter_config: Account<'info, AdapterConfig>,
    #[account(
        seeds = [
            USER_POSITION_SEED,
            adapter_config.key().as_ref(),
            user_position.owner.as_ref()
        ],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,
    pub owner: Signer<'info>,
    /// CHECK: The template validates this key against AdapterConfig.supported_mint.
    pub mint: UncheckedAccount<'info>,
}

#[account]
pub struct AdapterConfig {
    pub authority: Pubkey,
    pub supported_mint: Pubkey,
    pub protocol_program_id: Pubkey,
    pub version: u16,
    pub bump: u8,
}

impl AdapterConfig {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 1;
}

#[account]
pub struct UserPosition {
    pub owner: Pubkey,
    pub deposited_amount: u64,
    pub shares: u64,
    pub last_value: u64,
    pub bump: u8,
}

impl UserPosition {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 1;
}

#[event]
pub struct AdapterDeposit {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub value: u64,
}

#[event]
pub struct AdapterWithdraw {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub value: u64,
}

#[event]
pub struct AdapterValue {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub value: u64,
}

#[error_code]
pub enum AdapterTemplateError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Requested mint does not match the adapter config.")]
    InvalidMint,
    #[msg("Signer does not own the user position.")]
    InvalidOwner,
    #[msg("Protocol CPI failed.")]
    ProtocolCpiFailed,
    #[msg("Math overflow or underflow occurred.")]
    MathOverflow,
    #[msg("This adapter operation is not supported.")]
    UnsupportedOperation,
}

fn validate_mint(adapter_config: &AdapterConfig, mint: Pubkey) -> Result<()> {
    require_keys_eq!(
        mint,
        adapter_config.supported_mint,
        AdapterTemplateError::InvalidMint
    );

    Ok(())
}

fn validate_owner(user_position: &UserPosition, owner: Pubkey) -> Result<()> {
    require_keys_eq!(
        owner,
        user_position.owner,
        AdapterTemplateError::InvalidOwner
    );

    Ok(())
}

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{get_return_data, invoke},
};

declare_id!("FEKsMuAAp5Z6oxzsRkQLvHbMpvxJzVcV5JmGFD9KSC2A");

const DEPOSIT_IX_DISCRIMINATOR: [u8; 8] = [242, 35, 198, 137, 82, 225, 242, 182];
const WITHDRAW_IX_DISCRIMINATOR: [u8; 8] = [183, 18, 70, 156, 148, 109, 161, 34];
const CURRENT_VALUE_IX_DISCRIMINATOR: [u8; 8] = [232, 199, 167, 206, 247, 56, 234, 20];

#[program]
pub mod dispatcher {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        emit!(DispatcherInitialized {
            authority: ctx.accounts.authority.key(),
            version: 1,
        });

        Ok(())
    }

    pub fn deposit<'info>(
        ctx: Context<'_, '_, '_, 'info, RouteDeposit<'info>>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, DispatcherError::InvalidAmount);
        validate_adapter_entry(
            ctx.accounts.adapter_entry.key(),
            &ctx.accounts.adapter_entry,
            ctx.accounts.adapter_program.key(),
            ctx.accounts.requested_mint.key(),
        )?;

        let data = amount_ix_data(DEPOSIT_IX_DISCRIMINATOR, amount);
        let mut instruction = Instruction {
            program_id: ctx.accounts.adapter_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.adapter_config.key(), false),
                AccountMeta::new(ctx.accounts.adapter_position.key(), false),
                AccountMeta::new_readonly(ctx.accounts.user.key(), true),
                AccountMeta::new_readonly(ctx.accounts.requested_mint.key(), false),
            ],
            data,
        };
        let mut account_infos = adapter_account_infos(
            ctx.accounts.adapter_config.to_account_info(),
            ctx.accounts.adapter_position.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.requested_mint.to_account_info(),
        );
        append_remaining_accounts(
            &mut instruction,
            &mut account_infos,
            ctx.remaining_accounts,
        );
        account_infos.push(ctx.accounts.adapter_program.to_account_info());

        invoke(&instruction, &account_infos).map_err(|_| error!(DispatcherError::CpiFailed))?;

        emit!(DepositRouted {
            user: ctx.accounts.user.key(),
            adapter_entry: ctx.accounts.adapter_entry.key(),
            adapter_program_id: ctx.accounts.adapter_program.key(),
            mint: ctx.accounts.requested_mint.key(),
            amount,
        });

        Ok(())
    }

    pub fn withdraw<'info>(
        ctx: Context<'_, '_, '_, 'info, RouteWithdraw<'info>>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, DispatcherError::InvalidAmount);
        validate_adapter_entry(
            ctx.accounts.adapter_entry.key(),
            &ctx.accounts.adapter_entry,
            ctx.accounts.adapter_program.key(),
            ctx.accounts.requested_mint.key(),
        )?;

        let data = amount_ix_data(WITHDRAW_IX_DISCRIMINATOR, amount);
        let mut instruction = Instruction {
            program_id: ctx.accounts.adapter_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.adapter_config.key(), false),
                AccountMeta::new(ctx.accounts.adapter_position.key(), false),
                AccountMeta::new_readonly(ctx.accounts.user.key(), true),
                AccountMeta::new_readonly(ctx.accounts.requested_mint.key(), false),
            ],
            data,
        };
        let mut account_infos = adapter_account_infos(
            ctx.accounts.adapter_config.to_account_info(),
            ctx.accounts.adapter_position.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.requested_mint.to_account_info(),
        );
        append_remaining_accounts(
            &mut instruction,
            &mut account_infos,
            ctx.remaining_accounts,
        );
        account_infos.push(ctx.accounts.adapter_program.to_account_info());

        invoke(&instruction, &account_infos).map_err(|_| error!(DispatcherError::CpiFailed))?;

        emit!(WithdrawRouted {
            user: ctx.accounts.user.key(),
            adapter_entry: ctx.accounts.adapter_entry.key(),
            adapter_program_id: ctx.accounts.adapter_program.key(),
            mint: ctx.accounts.requested_mint.key(),
            amount,
        });

        Ok(())
    }

    pub fn current_value<'info>(
        ctx: Context<'_, '_, '_, 'info, RouteCurrentValue<'info>>,
    ) -> Result<()> {
        validate_adapter_entry(
            ctx.accounts.adapter_entry.key(),
            &ctx.accounts.adapter_entry,
            ctx.accounts.adapter_program.key(),
            ctx.accounts.requested_mint.key(),
        )?;

        let mut instruction = Instruction {
            program_id: ctx.accounts.adapter_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.adapter_config.key(), false),
                AccountMeta::new_readonly(ctx.accounts.adapter_position.key(), false),
                AccountMeta::new_readonly(ctx.accounts.user.key(), true),
                AccountMeta::new_readonly(ctx.accounts.requested_mint.key(), false),
            ],
            data: CURRENT_VALUE_IX_DISCRIMINATOR.to_vec(),
        };
        let mut account_infos = adapter_account_infos(
            ctx.accounts.adapter_config.to_account_info(),
            ctx.accounts.adapter_position.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.requested_mint.to_account_info(),
        );
        append_remaining_accounts(
            &mut instruction,
            &mut account_infos,
            ctx.remaining_accounts,
        );
        account_infos.push(ctx.accounts.adapter_program.to_account_info());

        invoke(&instruction, &account_infos).map_err(|_| error!(DispatcherError::CpiFailed))?;

        let value = read_current_value_return(ctx.accounts.adapter_program.key())?;

        emit!(CurrentValueQueried {
            user: ctx.accounts.user.key(),
            adapter_entry: ctx.accounts.adapter_entry.key(),
            adapter_program_id: ctx.accounts.adapter_program.key(),
            mint: ctx.accounts.requested_mint.key(),
            value,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RouteDeposit<'info> {
    pub adapter_entry: Account<'info, registry::AdapterEntry>,
    /// CHECK: Validated against the registry entry before CPI.
    pub adapter_program: UncheckedAccount<'info>,
    /// CHECK: Adapter-owned config account passed through to the adapter CPI.
    pub adapter_config: UncheckedAccount<'info>,
    /// CHECK: Validated against the registry entry before CPI.
    pub requested_mint: UncheckedAccount<'info>,
    /// CHECK: Adapter-owned user position account passed through to the adapter CPI.
    #[account(mut)]
    pub adapter_position: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct RouteWithdraw<'info> {
    pub adapter_entry: Account<'info, registry::AdapterEntry>,
    /// CHECK: Validated against the registry entry before CPI.
    pub adapter_program: UncheckedAccount<'info>,
    /// CHECK: Adapter-owned config account passed through to the adapter CPI.
    pub adapter_config: UncheckedAccount<'info>,
    /// CHECK: Validated against the registry entry before CPI.
    pub requested_mint: UncheckedAccount<'info>,
    /// CHECK: Adapter-owned user position account passed through to the adapter CPI.
    #[account(mut)]
    pub adapter_position: UncheckedAccount<'info>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct RouteCurrentValue<'info> {
    pub adapter_entry: Account<'info, registry::AdapterEntry>,
    /// CHECK: Validated against the registry entry before CPI.
    pub adapter_program: UncheckedAccount<'info>,
    /// CHECK: Adapter-owned config account passed through to the adapter CPI.
    pub adapter_config: UncheckedAccount<'info>,
    /// CHECK: Validated against the registry entry before CPI.
    pub requested_mint: UncheckedAccount<'info>,
    /// CHECK: Adapter-owned user position account passed through to the adapter CPI.
    pub adapter_position: UncheckedAccount<'info>,
    pub user: Signer<'info>,
}

#[event]
pub struct DispatcherInitialized {
    pub authority: Pubkey,
    pub version: u8,
}

#[event]
pub struct DepositRouted {
    pub user: Pubkey,
    pub adapter_entry: Pubkey,
    pub adapter_program_id: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

#[event]
pub struct WithdrawRouted {
    pub user: Pubkey,
    pub adapter_entry: Pubkey,
    pub adapter_program_id: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

#[event]
pub struct CurrentValueQueried {
    pub user: Pubkey,
    pub adapter_entry: Pubkey,
    pub adapter_program_id: Pubkey,
    pub mint: Pubkey,
    pub value: u64,
}

#[error_code]
pub enum DispatcherError {
    #[msg("Adapter registry entry is not approved.")]
    AdapterNotApproved,
    #[msg("Adapter registry entry is paused.")]
    AdapterPaused,
    #[msg("Adapter registry entry is deprecated.")]
    AdapterDeprecated,
    #[msg("Passed adapter program does not match the registry entry.")]
    InvalidAdapterProgram,
    #[msg("Requested mint does not match the registry entry.")]
    InvalidMint,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Registry entry does not match the canonical adapter entry PDA.")]
    InvalidRegistryEntry,
    #[msg("Adapter CPI failed.")]
    CpiFailed,
}

fn validate_adapter_entry(
    adapter_entry_key: Pubkey,
    adapter_entry: &registry::AdapterEntry,
    adapter_program_id: Pubkey,
    requested_mint: Pubkey,
) -> Result<()> {
    let adapter_version_seed = adapter_entry.adapter_version.to_le_bytes();
    let (expected_entry, expected_bump) = Pubkey::find_program_address(
        &[
            registry::ADAPTER_ENTRY_SEED,
            adapter_entry.adapter_program_id.as_ref(),
            adapter_entry.supported_mint.as_ref(),
            &adapter_version_seed,
        ],
        &registry::ID,
    );

    require_keys_eq!(
        adapter_entry_key,
        expected_entry,
        DispatcherError::InvalidRegistryEntry
    );
    require_eq!(
        adapter_entry.bump,
        expected_bump,
        DispatcherError::InvalidRegistryEntry
    );

    match adapter_entry.status {
        registry::AdapterStatus::Approved => {}
        registry::AdapterStatus::Pending => {
            return err!(DispatcherError::AdapterNotApproved);
        }
        registry::AdapterStatus::Paused => {
            return err!(DispatcherError::AdapterPaused);
        }
        registry::AdapterStatus::Deprecated => {
            return err!(DispatcherError::AdapterDeprecated);
        }
    }

    require_keys_eq!(
        adapter_program_id,
        adapter_entry.adapter_program_id,
        DispatcherError::InvalidAdapterProgram
    );
    require_keys_eq!(
        requested_mint,
        adapter_entry.supported_mint,
        DispatcherError::InvalidMint
    );

    Ok(())
}

fn amount_ix_data(discriminator: [u8; 8], amount: u64) -> Vec<u8> {
    let mut data = Vec::with_capacity(16);
    data.extend_from_slice(&discriminator);
    data.extend_from_slice(&amount.to_le_bytes());
    data
}

fn adapter_account_infos<'info>(
    adapter_config: AccountInfo<'info>,
    adapter_position: AccountInfo<'info>,
    user: AccountInfo<'info>,
    requested_mint: AccountInfo<'info>,
) -> Vec<AccountInfo<'info>> {
    vec![adapter_config, adapter_position, user, requested_mint]
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

fn read_current_value_return(adapter_program_id: Pubkey) -> Result<u64> {
    let (return_program_id, data) =
        get_return_data().ok_or_else(|| error!(DispatcherError::CpiFailed))?;
    require_keys_eq!(
        return_program_id,
        adapter_program_id,
        DispatcherError::CpiFailed
    );
    require!(data.len() == 8, DispatcherError::CpiFailed);

    let mut value_bytes = [0_u8; 8];
    value_bytes.copy_from_slice(&data);
    Ok(u64::from_le_bytes(value_bytes))
}

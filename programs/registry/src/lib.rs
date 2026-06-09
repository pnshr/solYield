use anchor_lang::prelude::*;

declare_id!("HiLF1P7LguVyBbzMSN3hK4ErGxfxaS6TMPbR6R73Dtdn");

pub const REGISTRY_CONFIG_SEED: &[u8] = b"registry_config";
pub const ADAPTER_ENTRY_SEED: &[u8] = b"adapter_entry";
pub const MAX_PROTOCOL_NAME_LEN: usize = 64;
pub const MAX_METADATA_URI_LEN: usize = 256;

#[program]
pub mod registry {
    use super::*;

    pub fn initialize_registry(ctx: Context<InitializeRegistry>) -> Result<()> {
        let registry_config = &mut ctx.accounts.registry_config;
        registry_config.governance_authority = ctx.accounts.governance_authority.key();
        registry_config.adapter_count = 0;
        registry_config.bump = ctx.bumps.registry_config;

        emit!(RegistryInitialized {
            governance_authority: registry_config.governance_authority,
            registry_config: registry_config.key(),
            bump: registry_config.bump,
        });

        Ok(())
    }

    pub fn propose_adapter(
        ctx: Context<ProposeAdapter>,
        adapter_program_id: Pubkey,
        protocol_name: String,
        adapter_version: u16,
        supported_mint: Pubkey,
        metadata_uri: String,
    ) -> Result<()> {
        validate_adapter_inputs(&adapter_program_id, &protocol_name, &supported_mint, &metadata_uri)?;

        let slot = Clock::get()?.slot;
        let registry_config = &mut ctx.accounts.registry_config;
        let adapter_entry = &mut ctx.accounts.adapter_entry;

        adapter_entry.adapter_program_id = adapter_program_id;
        adapter_entry.protocol_name = protocol_name.clone();
        adapter_entry.adapter_version = adapter_version;
        adapter_entry.supported_mint = supported_mint;
        adapter_entry.status = AdapterStatus::Pending;
        adapter_entry.metadata_uri = metadata_uri.clone();
        adapter_entry.created_slot = slot;
        adapter_entry.updated_slot = slot;
        adapter_entry.bump = ctx.bumps.adapter_entry;

        registry_config.adapter_count = registry_config
            .adapter_count
            .checked_add(1)
            .ok_or(RegistryError::AdapterCountOverflow)?;

        emit!(AdapterProposed {
            governance_authority: ctx.accounts.governance_authority.key(),
            adapter_entry: adapter_entry.key(),
            adapter_program_id,
            protocol_name,
            adapter_version,
            supported_mint,
            metadata_uri,
            slot,
        });

        Ok(())
    }

    pub fn approve_adapter(ctx: Context<GovernAdapter>) -> Result<()> {
        let adapter_entry = &mut ctx.accounts.adapter_entry;
        require!(
            adapter_entry.status == AdapterStatus::Pending,
            RegistryError::InvalidStatusTransition
        );

        let slot = Clock::get()?.slot;
        adapter_entry.status = AdapterStatus::Approved;
        adapter_entry.updated_slot = slot;

        emit!(AdapterApproved {
            governance_authority: ctx.accounts.governance_authority.key(),
            adapter_entry: adapter_entry.key(),
            adapter_program_id: adapter_entry.adapter_program_id,
            adapter_version: adapter_entry.adapter_version,
            supported_mint: adapter_entry.supported_mint,
            slot,
        });

        Ok(())
    }

    pub fn pause_adapter(ctx: Context<GovernAdapter>) -> Result<()> {
        let adapter_entry = &mut ctx.accounts.adapter_entry;
        require!(
            adapter_entry.status == AdapterStatus::Approved,
            RegistryError::InvalidStatusTransition
        );

        let slot = Clock::get()?.slot;
        adapter_entry.status = AdapterStatus::Paused;
        adapter_entry.updated_slot = slot;

        emit!(AdapterPaused {
            governance_authority: ctx.accounts.governance_authority.key(),
            adapter_entry: adapter_entry.key(),
            adapter_program_id: adapter_entry.adapter_program_id,
            adapter_version: adapter_entry.adapter_version,
            supported_mint: adapter_entry.supported_mint,
            slot,
        });

        Ok(())
    }

    pub fn unpause_adapter(ctx: Context<GovernAdapter>) -> Result<()> {
        let adapter_entry = &mut ctx.accounts.adapter_entry;
        require!(
            adapter_entry.status == AdapterStatus::Paused,
            RegistryError::InvalidStatusTransition
        );

        let slot = Clock::get()?.slot;
        adapter_entry.status = AdapterStatus::Approved;
        adapter_entry.updated_slot = slot;

        emit!(AdapterUnpaused {
            governance_authority: ctx.accounts.governance_authority.key(),
            adapter_entry: adapter_entry.key(),
            adapter_program_id: adapter_entry.adapter_program_id,
            adapter_version: adapter_entry.adapter_version,
            supported_mint: adapter_entry.supported_mint,
            slot,
        });

        Ok(())
    }

    pub fn deprecate_adapter(ctx: Context<GovernAdapter>) -> Result<()> {
        let adapter_entry = &mut ctx.accounts.adapter_entry;
        require!(
            adapter_entry.status != AdapterStatus::Deprecated,
            RegistryError::InvalidStatusTransition
        );

        let slot = Clock::get()?.slot;
        adapter_entry.status = AdapterStatus::Deprecated;
        adapter_entry.updated_slot = slot;

        emit!(AdapterDeprecated {
            governance_authority: ctx.accounts.governance_authority.key(),
            adapter_entry: adapter_entry.key(),
            adapter_program_id: adapter_entry.adapter_program_id,
            adapter_version: adapter_entry.adapter_version,
            supported_mint: adapter_entry.supported_mint,
            slot,
        });

        Ok(())
    }

    pub fn update_adapter_metadata(
        ctx: Context<GovernAdapter>,
        metadata_uri: String,
    ) -> Result<()> {
        validate_metadata_uri(&metadata_uri)?;

        let slot = Clock::get()?.slot;
        let adapter_entry = &mut ctx.accounts.adapter_entry;
        let previous_metadata_uri = adapter_entry.metadata_uri.clone();
        adapter_entry.metadata_uri = metadata_uri.clone();
        adapter_entry.updated_slot = slot;

        emit!(AdapterMetadataUpdated {
            governance_authority: ctx.accounts.governance_authority.key(),
            adapter_entry: adapter_entry.key(),
            adapter_program_id: adapter_entry.adapter_program_id,
            adapter_version: adapter_entry.adapter_version,
            supported_mint: adapter_entry.supported_mint,
            previous_metadata_uri,
            metadata_uri,
            slot,
        });

        Ok(())
    }

    pub fn transfer_governance(
        ctx: Context<TransferGovernance>,
        new_governance_authority: Pubkey,
    ) -> Result<()> {
        require_keys_neq!(
            new_governance_authority,
            Pubkey::default(),
            RegistryError::InvalidGovernanceAuthority
        );

        let registry_config = &mut ctx.accounts.registry_config;
        let previous_governance_authority = registry_config.governance_authority;
        registry_config.governance_authority = new_governance_authority;

        emit!(GovernanceTransferred {
            previous_governance_authority,
            new_governance_authority,
            registry_config: registry_config.key(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(
        init,
        payer = governance_authority,
        space = RegistryConfig::LEN,
        seeds = [REGISTRY_CONFIG_SEED],
        bump
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(
    adapter_program_id: Pubkey,
    protocol_name: String,
    adapter_version: u16,
    supported_mint: Pubkey,
    metadata_uri: String
)]
pub struct ProposeAdapter<'info> {
    #[account(
        mut,
        seeds = [REGISTRY_CONFIG_SEED],
        bump = registry_config.bump,
        has_one = governance_authority @ RegistryError::UnauthorizedGovernance
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    #[account(
        init,
        payer = governance_authority,
        space = AdapterEntry::LEN,
        seeds = [
            ADAPTER_ENTRY_SEED,
            adapter_program_id.as_ref(),
            supported_mint.as_ref(),
            &adapter_version.to_le_bytes()
        ],
        bump
    )]
    pub adapter_entry: Account<'info, AdapterEntry>,
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GovernAdapter<'info> {
    #[account(
        seeds = [REGISTRY_CONFIG_SEED],
        bump = registry_config.bump,
        has_one = governance_authority @ RegistryError::UnauthorizedGovernance
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    #[account(
        mut,
        seeds = [
            ADAPTER_ENTRY_SEED,
            adapter_entry.adapter_program_id.as_ref(),
            adapter_entry.supported_mint.as_ref(),
            &adapter_entry.adapter_version.to_le_bytes()
        ],
        bump = adapter_entry.bump
    )]
    pub adapter_entry: Account<'info, AdapterEntry>,
    pub governance_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct TransferGovernance<'info> {
    #[account(
        mut,
        seeds = [REGISTRY_CONFIG_SEED],
        bump = registry_config.bump,
        has_one = governance_authority @ RegistryError::UnauthorizedGovernance
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    pub governance_authority: Signer<'info>,
}

#[account]
pub struct RegistryConfig {
    pub governance_authority: Pubkey,
    pub adapter_count: u64,
    pub bump: u8,
}

impl RegistryConfig {
    pub const LEN: usize = 8 + 32 + 8 + 1;
}

#[account]
pub struct AdapterEntry {
    pub adapter_program_id: Pubkey,
    pub protocol_name: String,
    pub adapter_version: u16,
    pub supported_mint: Pubkey,
    pub status: AdapterStatus,
    pub metadata_uri: String,
    pub created_slot: u64,
    pub updated_slot: u64,
    pub bump: u8,
}

impl AdapterEntry {
    pub const LEN: usize = 8
        + 32
        + 4
        + MAX_PROTOCOL_NAME_LEN
        + 2
        + 32
        + 1
        + 4
        + MAX_METADATA_URI_LEN
        + 8
        + 8
        + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum AdapterStatus {
    Pending,
    Approved,
    Paused,
    Deprecated,
}

#[event]
pub struct RegistryInitialized {
    pub governance_authority: Pubkey,
    pub registry_config: Pubkey,
    pub bump: u8,
}

#[event]
pub struct AdapterProposed {
    pub governance_authority: Pubkey,
    pub adapter_entry: Pubkey,
    pub adapter_program_id: Pubkey,
    pub protocol_name: String,
    pub adapter_version: u16,
    pub supported_mint: Pubkey,
    pub metadata_uri: String,
    pub slot: u64,
}

#[event]
pub struct AdapterApproved {
    pub governance_authority: Pubkey,
    pub adapter_entry: Pubkey,
    pub adapter_program_id: Pubkey,
    pub adapter_version: u16,
    pub supported_mint: Pubkey,
    pub slot: u64,
}

#[event]
pub struct AdapterPaused {
    pub governance_authority: Pubkey,
    pub adapter_entry: Pubkey,
    pub adapter_program_id: Pubkey,
    pub adapter_version: u16,
    pub supported_mint: Pubkey,
    pub slot: u64,
}

#[event]
pub struct AdapterUnpaused {
    pub governance_authority: Pubkey,
    pub adapter_entry: Pubkey,
    pub adapter_program_id: Pubkey,
    pub adapter_version: u16,
    pub supported_mint: Pubkey,
    pub slot: u64,
}

#[event]
pub struct AdapterDeprecated {
    pub governance_authority: Pubkey,
    pub adapter_entry: Pubkey,
    pub adapter_program_id: Pubkey,
    pub adapter_version: u16,
    pub supported_mint: Pubkey,
    pub slot: u64,
}

#[event]
pub struct AdapterMetadataUpdated {
    pub governance_authority: Pubkey,
    pub adapter_entry: Pubkey,
    pub adapter_program_id: Pubkey,
    pub adapter_version: u16,
    pub supported_mint: Pubkey,
    pub previous_metadata_uri: String,
    pub metadata_uri: String,
    pub slot: u64,
}

#[event]
pub struct GovernanceTransferred {
    pub previous_governance_authority: Pubkey,
    pub new_governance_authority: Pubkey,
    pub registry_config: Pubkey,
}

#[error_code]
pub enum RegistryError {
    #[msg("Only the current governance authority may perform this action.")]
    UnauthorizedGovernance,
    #[msg("Protocol name must not be empty.")]
    EmptyProtocolName,
    #[msg("Metadata URI must not be empty.")]
    EmptyMetadataUri,
    #[msg("Adapter program id must not be the default public key.")]
    InvalidAdapterProgramId,
    #[msg("Supported mint must not be the default public key.")]
    InvalidSupportedMint,
    #[msg("New governance authority must not be the default public key.")]
    InvalidGovernanceAuthority,
    #[msg("Protocol name exceeds the maximum supported length.")]
    ProtocolNameTooLong,
    #[msg("Metadata URI exceeds the maximum supported length.")]
    MetadataUriTooLong,
    #[msg("Adapter status transition is not allowed.")]
    InvalidStatusTransition,
    #[msg("Adapter count overflowed.")]
    AdapterCountOverflow,
}

fn validate_adapter_inputs(
    adapter_program_id: &Pubkey,
    protocol_name: &str,
    supported_mint: &Pubkey,
    metadata_uri: &str,
) -> Result<()> {
    require_keys_neq!(
        *adapter_program_id,
        Pubkey::default(),
        RegistryError::InvalidAdapterProgramId
    );
    validate_protocol_name(protocol_name)?;
    require_keys_neq!(
        *supported_mint,
        Pubkey::default(),
        RegistryError::InvalidSupportedMint
    );
    validate_metadata_uri(metadata_uri)?;

    Ok(())
}

fn validate_protocol_name(protocol_name: &str) -> Result<()> {
    require!(
        !protocol_name.trim().is_empty(),
        RegistryError::EmptyProtocolName
    );
    require!(
        protocol_name.as_bytes().len() <= MAX_PROTOCOL_NAME_LEN,
        RegistryError::ProtocolNameTooLong
    );

    Ok(())
}

fn validate_metadata_uri(metadata_uri: &str) -> Result<()> {
    require!(!metadata_uri.trim().is_empty(), RegistryError::EmptyMetadataUri);
    require!(
        metadata_uri.as_bytes().len() <= MAX_METADATA_URI_LEN,
        RegistryError::MetadataUriTooLong
    );

    Ok(())
}

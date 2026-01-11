#![no_std]

extern crate alloc;

pub mod data;
pub mod error;

use alloc::boxed::Box;
use alloc::string::{String, ToString};
use alloc::vec::Vec;
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    Key, U256, URef,
};
use data::{Application, Escrow, EscrowStatus, Milestone, MilestoneStatus};
use error::OrbitWorkError;

// Storage constants
const KEY_ADMIN: &str = "admin";
const KEY_NEXT_ESCROW_ID: &str = "next_escrow_id";
const DICT_ESCROWS: &str = "escrows";
const DICT_APPLICATIONS: &str = "applications";
const DICT_TOKEN_WHITELIST: &str = "token_whitelist";

#[no_mangle]
pub extern "C" fn init() {
    let admin: Key = runtime::get_caller().into();
    runtime::put_key(KEY_ADMIN, admin);
    
    let next_id_uref = storage::new_uref(1u32);
    runtime::put_key(KEY_NEXT_ESCROW_ID, next_id_uref.into());

    let escrows = storage::new_dictionary(DICT_ESCROWS).unwrap_or_revert();
    runtime::put_key(DICT_ESCROWS, escrows.into());

    let applications = storage::new_dictionary(DICT_APPLICATIONS).unwrap_or_revert();
    runtime::put_key(DICT_APPLICATIONS, applications.into());

    let token_whitelist = storage::new_dictionary(DICT_TOKEN_WHITELIST).unwrap_or_revert();
    runtime::put_key(DICT_TOKEN_WHITELIST, token_whitelist.into());
}

#[no_mangle]
pub extern "C" fn whitelist_token() {
    let admin_key = runtime::get_key(KEY_ADMIN).unwrap_or_revert();
    
    if Key::from(runtime::get_caller()) != admin_key {
        runtime::revert(OrbitWorkError::NotAuthorized);
    }

    let token: Key = runtime::get_named_arg("token");
    
    let whitelist_dict = runtime::get_key(DICT_TOKEN_WHITELIST)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
        
    storage::dictionary_put(whitelist_dict, &token.to_string(), true);
}

#[no_mangle]
pub extern "C" fn create_escrow() {
    let depositor: Key = runtime::get_caller().into(); // Simplification
    let title: String = runtime::get_named_arg("project_title");
    let description: String = runtime::get_named_arg("project_description");
    let total_amount: U256 = runtime::get_named_arg("total_amount");
    let duration: u64 = runtime::get_named_arg("duration");
    let milestones_amounts: Vec<U256> = runtime::get_named_arg("milestone_amounts");
    let milestones_descs: Vec<String> = runtime::get_named_arg("milestone_descriptions");
    let token: Option<Key> = runtime::get_named_arg("token");

    if let Some(token_key) = token {
        let whitelist_dict = match runtime::get_key(DICT_TOKEN_WHITELIST) {
            Some(key) => key.into_uref().unwrap_or_revert(),
            None => {
                let dict = storage::new_dictionary(DICT_TOKEN_WHITELIST).unwrap_or_revert();
                runtime::put_key(DICT_TOKEN_WHITELIST, dict.into());
                dict
            }
        };
        
        let is_whitelisted: bool = storage::dictionary_get(whitelist_dict, &token_key.to_string())
            .unwrap_or_revert()
            .unwrap_or(false);
            
        if !is_whitelisted {
            runtime::revert(OrbitWorkError::TokenNotWhitelisted);
        }
    }

    // Basic validation
    if milestones_amounts.len() != milestones_descs.len() {
        runtime::revert(OrbitWorkError::MilestoneCountMismatch);
    }

    // Create milestones
    let mut milestones: Vec<Milestone> = Vec::new();
    for i in 0..milestones_amounts.len() {
        milestones.push(Milestone {
            description: milestones_descs[i].clone(),
            amount: milestones_amounts[i],
            status: MilestoneStatus::NotStarted,
            approved_at: None,
        });
    }

    // Get next ID
    let id_uref: URef = runtime::get_key(KEY_NEXT_ESCROW_ID)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let id: u32 = storage::read(id_uref).unwrap_or_revert().unwrap_or_revert();
    
    // Increment ID
    storage::write(id_uref, id + 1);

    // Create Escrow struct
    let escrow = Escrow {
        id,
        depositor,
        beneficiary: None, // Open job
        arbiters: Vec::new(), // To be added
        required_confirmations: 1,
        milestones,
        token,
        total_amount,
        platform_fee: U256::zero(),
        status: EscrowStatus::Pending,
        created_at: runtime::get_blocktime().into(),
        deadline: u64::from(runtime::get_blocktime()) + duration,
        project_title: title,
        project_description: description,
        is_open_job: true,
        dispute_resolver: None,
    };

    // Save to dictionary
    let escrows_dict = match runtime::get_key(DICT_ESCROWS) {
        Some(key) => key.into_uref().unwrap_or_revert(),
        None => {
            let dict = storage::new_dictionary(DICT_ESCROWS).unwrap_or_revert();
            runtime::put_key(DICT_ESCROWS, dict.into());
            dict
        }
    };
    storage::dictionary_put(escrows_dict, &id.to_string(), escrow);
}

#[no_mangle]
pub extern "C" fn apply_to_job() {
    let freelancer: Key = runtime::get_caller().into();
    let escrow_id: u32 = runtime::get_named_arg("escrow_id");
    let cover_letter: String = runtime::get_named_arg("cover_letter");
    let proposed_timeline: u32 = runtime::get_named_arg("proposed_timeline");

    // Load Escrow
    let escrows_dict = match runtime::get_key(DICT_ESCROWS) {
        Some(key) => key.into_uref().unwrap_or_revert(),
        None => {
            let dict = storage::new_dictionary(DICT_ESCROWS).unwrap_or_revert();
            runtime::put_key(DICT_ESCROWS, dict.into());
            dict
        }
    };
    let escrow: Escrow = storage::dictionary_get(escrows_dict, &escrow_id.to_string())
        .unwrap_or_revert()
        .unwrap_or_revert_with(OrbitWorkError::EscrowNotFound);

    if !escrow.is_open_job {
        runtime::revert(OrbitWorkError::NotOpenJob);
    }

    // Save Application
    let app = Application {
        freelancer,
        cover_letter,
        proposed_timeline,
        applied_at: runtime::get_blocktime().into(),
    };

    let apps_dict = match runtime::get_key(DICT_APPLICATIONS) {
        Some(key) => key.into_uref().unwrap_or_revert(),
        None => {
            let dict = storage::new_dictionary(DICT_APPLICATIONS).unwrap_or_revert();
            runtime::put_key(DICT_APPLICATIONS, dict.into());
            dict
        }
    };
    // Key: "escrow_id:freelancer_key_hex" - simplistic unique key
    let key = alloc::format!("{}:{:?}", escrow_id, freelancer);
    storage::dictionary_put(apps_dict, &key, app);
}

#[no_mangle]
pub extern "C" fn pause_job_creation() {
    let admin_key = runtime::get_key(KEY_ADMIN).unwrap_or_revert();
    
    if Key::from(runtime::get_caller()) != admin_key {
        runtime::revert(OrbitWorkError::NotAuthorized);
    }

    // Set a flag to pause job creation
    runtime::put_key("paused", storage::new_uref(true).into());
}

#[no_mangle]
pub extern "C" fn unpause_job_creation() {
    let admin_key = runtime::get_key(KEY_ADMIN).unwrap_or_revert();
    
    if Key::from(runtime::get_caller()) != admin_key {
        runtime::revert(OrbitWorkError::NotAuthorized);
    }

    // Remove the pause flag
    runtime::put_key("paused", storage::new_uref(false).into());
}

#[no_mangle]
pub extern "C" fn call() {
    use casper_types::addressable_entity::{EntryPoints, EntityEntryPoint, EntryPointAccess, EntryPointType, EntryPointPayment};
    use casper_types::{CLType, Parameter};

    let mut entry_points = EntryPoints::new();

    // Register init
    entry_points.add_entry_point(EntityEntryPoint::new(
        "init",
        alloc::vec![],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));

    // Register whitelist_token
    entry_points.add_entry_point(EntityEntryPoint::new(
        "whitelist_token",
        alloc::vec![Parameter::new("token", CLType::Key)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));

    // Register create_escrow
    entry_points.add_entry_point(EntityEntryPoint::new(
        "create_escrow",
        alloc::vec![
            Parameter::new("project_title", CLType::String),
            Parameter::new("project_description", CLType::String),
            Parameter::new("total_amount", CLType::U256),
            Parameter::new("duration", CLType::U64),
            Parameter::new("milestone_amounts", CLType::List(Box::new(CLType::U256))),
            Parameter::new("milestone_descriptions", CLType::List(Box::new(CLType::String))),
            Parameter::new("token", CLType::Option(Box::new(CLType::Key))),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));

    // Register apply_to_job
    entry_points.add_entry_point(EntityEntryPoint::new(
        "apply_to_job",
        alloc::vec![
            Parameter::new("escrow_id", CLType::U32),
            Parameter::new("cover_letter", CLType::String),
            Parameter::new("proposed_timeline", CLType::U32),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));

    // Register pause_job_creation
    entry_points.add_entry_point(EntityEntryPoint::new(
        "pause_job_creation",
        alloc::vec![],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));

    // Register unpause_job_creation
    entry_points.add_entry_point(EntityEntryPoint::new(
        "unpause_job_creation",
        alloc::vec![],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));

    let (contract_hash, _contract_package_hash) = storage::new_contract(
        entry_points,
        None,
        Some("orbitwork_contract_package".to_string()),
        Some("orbitwork_access_token".to_string()),
        None,
    );

    runtime::put_key("orbitwork_contract", contract_hash.into());
    
    // Auto-initialize the contract with the deployer as admin
    // This is called automatically when the contract is deployed
    init();
}

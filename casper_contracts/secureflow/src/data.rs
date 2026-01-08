use casper_types::{account::AccountHash, bytesrepr, Key, U256};
use alloc::string::String;
use alloc::vec::Vec;

#[derive(Clone, Debug, PartialEq, Eq, CLTyped, ToBytes, FromBytes)]
pub enum EscrowStatus {
    Pending,
    InProgress,
    Released,
    Refunded,
    Disputed,
    Expired,
}

#[derive(Clone, Debug, PartialEq, Eq, CLTyped, ToBytes, FromBytes)]
pub enum MilestoneStatus {
    NotStarted,
    Submitted,
    Approved,
    Disputed,
    Resolved,
    Rejected,
}

#[derive(Clone, Debug, PartialEq, Eq, CLTyped, ToBytes, FromBytes)]
pub struct Milestone {
    pub description: String,
    pub amount: U256,
    pub status: MilestoneStatus,
    pub approved_at: Option<u64>, // Timestamp
}

#[derive(Clone, Debug, PartialEq, Eq, CLTyped, ToBytes, FromBytes)]
pub struct Escrow {
    pub id: u32,
    pub depositor: Key,
    pub beneficiary: Option<Key>,
    pub arbiters: Vec<Key>,
    pub required_confirmations: u32,
    pub milestones: Vec<Milestone>,
    pub token: Option<Key>, // None for CSPR, Some(Key) for CEP-18
    pub total_amount: U256,
    pub platform_fee: U256,
    pub status: EscrowStatus,
    pub created_at: u64,
    pub deadline: u64,
    pub project_title: String,
    pub project_description: String,
    pub is_open_job: bool,
    pub dispute_resolver: Option<Key>,
}

#[derive(Clone, Debug, PartialEq, Eq, CLTyped, ToBytes, FromBytes)]
pub struct Application {
    pub freelancer: Key,
    pub cover_letter: String,
    pub proposed_timeline: u32, // Duration in seconds
    pub applied_at: u64,
}

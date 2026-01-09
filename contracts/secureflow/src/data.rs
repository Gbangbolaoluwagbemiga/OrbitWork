use casper_types::{bytesrepr::{FromBytes, ToBytes, Error}, CLTyped, Key, U256, CLType};
use alloc::string::String;
use alloc::vec::Vec;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum EscrowStatus {
    Pending = 0,
    InProgress = 1,
    Released = 2,
    Refunded = 3,
    Disputed = 4,
    Expired = 5,
}

impl CLTyped for EscrowStatus {
    fn cl_type() -> CLType {
        CLType::U8
    }
}

impl ToBytes for EscrowStatus {
    fn to_bytes(&self) -> Result<Vec<u8>, Error> {
        (*self as u8).to_bytes()
    }
    fn serialized_length(&self) -> usize {
        (*self as u8).serialized_length()
    }
}

impl FromBytes for EscrowStatus {
    fn from_bytes(bytes: &[u8]) -> Result<(Self, &[u8]), Error> {
        let (tag, remainder) = u8::from_bytes(bytes)?;
        let status = match tag {
            0 => EscrowStatus::Pending,
            1 => EscrowStatus::InProgress,
            2 => EscrowStatus::Released,
            3 => EscrowStatus::Refunded,
            4 => EscrowStatus::Disputed,
            5 => EscrowStatus::Expired,
            _ => return Err(Error::Formatting),
        };
        Ok((status, remainder))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum MilestoneStatus {
    NotStarted = 0,
    Submitted = 1,
    Approved = 2,
    Disputed = 3,
    Resolved = 4,
    Rejected = 5,
}

impl CLTyped for MilestoneStatus {
    fn cl_type() -> CLType {
        CLType::U8
    }
}

impl ToBytes for MilestoneStatus {
    fn to_bytes(&self) -> Result<Vec<u8>, Error> {
        (*self as u8).to_bytes()
    }
    fn serialized_length(&self) -> usize {
        (*self as u8).serialized_length()
    }
}

impl FromBytes for MilestoneStatus {
    fn from_bytes(bytes: &[u8]) -> Result<(Self, &[u8]), Error> {
        let (tag, remainder) = u8::from_bytes(bytes)?;
        let status = match tag {
            0 => MilestoneStatus::NotStarted,
            1 => MilestoneStatus::Submitted,
            2 => MilestoneStatus::Approved,
            3 => MilestoneStatus::Disputed,
            4 => MilestoneStatus::Resolved,
            5 => MilestoneStatus::Rejected,
            _ => return Err(Error::Formatting),
        };
        Ok((status, remainder))
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Milestone {
    pub description: String,
    pub amount: U256,
    pub status: MilestoneStatus,
    pub approved_at: Option<u64>,
}

impl CLTyped for Milestone {
    fn cl_type() -> CLType {
        CLType::Any
    }
}

impl ToBytes for Milestone {
    fn to_bytes(&self) -> Result<Vec<u8>, Error> {
        let mut buffer = Vec::new();
        buffer.extend(self.description.to_bytes()?);
        buffer.extend(self.amount.to_bytes()?);
        buffer.extend(self.status.to_bytes()?);
        buffer.extend(self.approved_at.to_bytes()?);
        Ok(buffer)
    }
    fn serialized_length(&self) -> usize {
        self.description.serialized_length() +
        self.amount.serialized_length() +
        self.status.serialized_length() +
        self.approved_at.serialized_length()
    }
}

impl FromBytes for Milestone {
    fn from_bytes(bytes: &[u8]) -> Result<(Self, &[u8]), Error> {
        let (description, remainder) = String::from_bytes(bytes)?;
        let (amount, remainder) = U256::from_bytes(remainder)?;
        let (status, remainder) = MilestoneStatus::from_bytes(remainder)?;
        let (approved_at, remainder) = Option::<u64>::from_bytes(remainder)?;
        Ok((Milestone { description, amount, status, approved_at }, remainder))
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
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

impl CLTyped for Escrow {
    fn cl_type() -> CLType {
        CLType::Any
    }
}

impl ToBytes for Escrow {
    fn to_bytes(&self) -> Result<Vec<u8>, Error> {
        let mut buffer = Vec::new();
        buffer.extend(self.id.to_bytes()?);
        buffer.extend(self.depositor.to_bytes()?);
        buffer.extend(self.beneficiary.to_bytes()?);
        buffer.extend(self.arbiters.to_bytes()?);
        buffer.extend(self.required_confirmations.to_bytes()?);
        buffer.extend(self.milestones.to_bytes()?);
        buffer.extend(self.token.to_bytes()?);
        buffer.extend(self.total_amount.to_bytes()?);
        buffer.extend(self.platform_fee.to_bytes()?);
        buffer.extend(self.status.to_bytes()?);
        buffer.extend(self.created_at.to_bytes()?);
        buffer.extend(self.deadline.to_bytes()?);
        buffer.extend(self.project_title.to_bytes()?);
        buffer.extend(self.project_description.to_bytes()?);
        buffer.extend(self.is_open_job.to_bytes()?);
        buffer.extend(self.dispute_resolver.to_bytes()?);
        Ok(buffer)
    }
    fn serialized_length(&self) -> usize {
        self.id.serialized_length() +
        self.depositor.serialized_length() +
        self.beneficiary.serialized_length() +
        self.arbiters.serialized_length() +
        self.required_confirmations.serialized_length() +
        self.milestones.serialized_length() +
        self.token.serialized_length() +
        self.total_amount.serialized_length() +
        self.platform_fee.serialized_length() +
        self.status.serialized_length() +
        self.created_at.serialized_length() +
        self.deadline.serialized_length() +
        self.project_title.serialized_length() +
        self.project_description.serialized_length() +
        self.is_open_job.serialized_length() +
        self.dispute_resolver.serialized_length()
    }
}

impl FromBytes for Escrow {
    fn from_bytes(bytes: &[u8]) -> Result<(Self, &[u8]), Error> {
        let (id, remainder) = u32::from_bytes(bytes)?;
        let (depositor, remainder) = Key::from_bytes(remainder)?;
        let (beneficiary, remainder) = Option::<Key>::from_bytes(remainder)?;
        let (arbiters, remainder) = Vec::<Key>::from_bytes(remainder)?;
        let (required_confirmations, remainder) = u32::from_bytes(remainder)?;
        let (milestones, remainder) = Vec::<Milestone>::from_bytes(remainder)?;
        let (token, remainder) = Option::<Key>::from_bytes(remainder)?;
        let (total_amount, remainder) = U256::from_bytes(remainder)?;
        let (platform_fee, remainder) = U256::from_bytes(remainder)?;
        let (status, remainder) = EscrowStatus::from_bytes(remainder)?;
        let (created_at, remainder) = u64::from_bytes(remainder)?;
        let (deadline, remainder) = u64::from_bytes(remainder)?;
        let (project_title, remainder) = String::from_bytes(remainder)?;
        let (project_description, remainder) = String::from_bytes(remainder)?;
        let (is_open_job, remainder) = bool::from_bytes(remainder)?;
        let (dispute_resolver, remainder) = Option::<Key>::from_bytes(remainder)?;
        
        let escrow = Escrow {
            id, depositor, beneficiary, arbiters, required_confirmations,
            milestones, token, total_amount, platform_fee, status,
            created_at, deadline, project_title, project_description,
            is_open_job, dispute_resolver
        };
        Ok((escrow, remainder))
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Application {
    pub freelancer: Key,
    pub cover_letter: String,
    pub proposed_timeline: u32, // Duration in seconds
    pub applied_at: u64,
}

impl CLTyped for Application {
    fn cl_type() -> CLType {
        CLType::Any
    }
}

impl ToBytes for Application {
    fn to_bytes(&self) -> Result<Vec<u8>, Error> {
        let mut buffer = Vec::new();
        buffer.extend(self.freelancer.to_bytes()?);
        buffer.extend(self.cover_letter.to_bytes()?);
        buffer.extend(self.proposed_timeline.to_bytes()?);
        buffer.extend(self.applied_at.to_bytes()?);
        Ok(buffer)
    }
    fn serialized_length(&self) -> usize {
        self.freelancer.serialized_length() +
        self.cover_letter.serialized_length() +
        self.proposed_timeline.serialized_length() +
        self.applied_at.serialized_length()
    }
}

impl FromBytes for Application {
    fn from_bytes(bytes: &[u8]) -> Result<(Self, &[u8]), Error> {
        let (freelancer, remainder) = Key::from_bytes(bytes)?;
        let (cover_letter, remainder) = String::from_bytes(remainder)?;
        let (proposed_timeline, remainder) = u32::from_bytes(remainder)?;
        let (applied_at, remainder) = u64::from_bytes(remainder)?;
        
        let app = Application {
            freelancer, cover_letter, proposed_timeline, applied_at
        };
        Ok((app, remainder))
    }
}

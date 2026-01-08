use casper_types::ApiError;

#[repr(u16)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OrbitWorkError {
    EscrowNotFound = 0,
    NotAuthorized = 1,
    InvalidState = 2,
    MilestoneCountMismatch = 3,
    NotOpenJob = 4,
}

impl From<OrbitWorkError> for ApiError {
    fn from(error: OrbitWorkError) -> Self {
        ApiError::User(error as u16)
    }
}

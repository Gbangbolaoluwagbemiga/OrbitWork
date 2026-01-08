use casper_types::ApiError;

#[repr(u16)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SecureFlowError {
    // Admin errors
    AlreadyInitialized = 0,
    FeeTooHigh = 1,
    NotOwner = 2,
    NotInitialized = 3,
    
    // Escrow errors
    EscrowNotFound = 4,
    EscrowNotActive = 5,
    InvalidEscrowStatus = 6,
    WorkAlreadyStarted = 7,
    WorkNotStarted = 8,
    
    // Escrow creation errors
    JobCreationPaused = 9,
    InvalidDuration = 10,
    MilestoneCountMismatch = 11,
    TooManyMilestones = 12,
    TooManyArbiters = 13,
    InvalidConfirmations = 14,
    TokenNotWhitelisted = 15,
    
    // Marketplace errors
    NotOpenJob = 16,
    JobClosed = 17,
    CannotApplyToOwnJob = 18,
    TooManyApplications = 19,
    OnlyDepositor = 20,
    FreelancerNotApplied = 21,
    AlreadyApplied = 22,
    
    // Milestone errors
    InvalidMilestone = 23,
    MilestoneAlreadySubmitted = 24,
    MilestoneNotSubmitted = 25,
    MilestoneAlreadyProcessed = 26,
    
    // Refund errors
    NothingToRefund = 27,
    DeadlineNotPassed = 28,
    EmergencyPeriodNotReached = 29,
    CannotRefund = 30,
    InvalidExtension = 31,
    CannotExtend = 32,
    
    // Authorization errors
    OnlyBeneficiary = 33,
    Unauthorized = 34,
    
    // Validation errors
    InvalidAmount = 35,
    InvalidAddress = 36,
    InvalidParameter = 37,
    
    // Rating errors
    EscrowNotCompleted = 38,
    RatingAlreadySubmitted = 39,
    InvalidRating = 40,
    OnlyDepositorCanRate = 41,
    
    // Generic
    Unknown = 999,
}

impl From<SecureFlowError> for ApiError {
    fn from(error: SecureFlowError) -> Self {
        ApiError::User(error as u16)
    }
}

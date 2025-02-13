// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @dev Basis points
uint256 constant BPS = 10000;

/// @notice Emitted when a sale is created
/// @param saleId The ID of the sale
/// @param seller The address of the seller
/// @param token The address of the token being sold
/// @param quantity The quantity of tokens being sold
/// @param totalPrice The total price for the sale
/// @param saleTime The sale created time
event SaleCreated(
    uint256 saleId,
    address indexed seller,
    address token,
    uint256 quantity,
    uint256 totalPrice,
    uint256 saleTime
);

/// @notice Emitted when a sale is cancelled
/// @param saleId The ID of the sale
/// @param seller The address of the seller
/// @param token The address of the token for the cancelled sale
/// @param saleCancelledTime The sale cancelled time
event SaleCancelled(uint256 saleId, address indexed seller, address token, uint256 saleCancelledTime);

/// @notice Emitted when tokens are purchased
/// @param buyer The address of the buyer
/// @param seller The address of the seller
/// @param token The address of the token being purchased
/// @param quantity The quantity of tokens purchased
/// @param totalPrice The total price paid by the buyer
/// @param tokenPurchasedTime The token purchased time
event TokensPurchased(
    address indexed buyer,
    address indexed seller,
    address token,
    uint256 quantity,
    uint256 totalPrice,
    uint256 tokenPurchasedTime
);

/// @notice Represents a sale listing with details about the seller, quantity, strike, and total price.
/// @dev This struct is used to store information related to a specific sale in the marketplace.
struct Sale {
    address seller;
    uint256 quantity;
    uint256 totalPrice;
}

/// @notice Struct that stores details of each duel
struct Duel {
    /// @notice Address of the duel creator
    address creator;
    /// @notice Topic of the duel
    string topic;
    /// @notice UNIX timestamp when the duel creates
    uint256 createTime;
    /// @notice UNIX timestamp when the duel starts
    uint256 startTime;
    /// @notice UNIX timestamp when the duel expires
    uint256 expiryTime;
    /// @notice Duel duration
    DuelDuration duelDuration;
    /// @notice Status of the duel
    DuelStatus duelStatus;
    /// @notice Category of the duel
    DuelCategory category;
}

/// @notice Struct that stores details of each crypto duel
struct CryptoDuel {
    /// @notice Address of the duel creator
    address creator;
    /// @notice Symbol of the token
    string tokenSymbol;
    /// @notice UNIX timestamp when the duel creates
    uint256 createTime;
    /// @notice UNIX timestamp when the duel starts
    uint256 startTime;
    /// @notice UNIX timestamp when the duel expires
    uint256 expiryTime;
    /// @notice Trigger value of the token
    int256 triggerValue;
    /// @notice Trigger type
    TriggerType triggerType;
    /// @notice Trigger condition
    TriggerCondition triggerCondition;
    /// @notice Duel duration
    DuelDuration duelDuration;
    /// @notice Status of the duel
    DuelStatus duelStatus;
}

/// @notice Struct that stores details of each pending duel
struct PendingDuel {
    /// @notice Address of the duel creator
    address creator;
    /// @notice Category of the duel
    DuelCategory category;
    /// @notice Topic of the duel
    string topic;
    /// @notice Options available in the duel
    string[] options;
    /// @notice Duration of the duel
    DuelDuration duration;
    /// @notice Approval status of the duel
    bool isApproved;
    /// @notice Amount of USDC for the duel
    uint256 usdcAmount;
}

/// @notice Struct that stores details of each pending crypto duel
struct PendingCryptoDuel {
    /// @notice Address of the duel creator
    address creator;
    /// @notice Category of the duel
    DuelCategory category;
    /// @notice Symbol of the token
    string tokenSymbol;
    /// @notice Options available in the duel
    string[] options;
    /// @notice Duration of the duel
    DuelDuration duration;
    /// @notice Approval status of the duel
    bool isApproved;
    /// @notice Amount of USDC for the duel
    uint256 usdcAmount;
    /// @notice Trigger value of the token
    int256 triggerValue;
    /// @notice Trigger type
    TriggerType triggerType;
    /// @notice Trigger condition
    TriggerCondition triggerCondition;
}

/// @notice Enum representing different possible duel durations
enum DuelDuration {
    ThreeHours,
    SixHours,
    TwelveHours
}

/// @notice Enum representing the current status of a duel
enum DuelStatus {
    NotStarted,
    BootStrapped,
    Live,
    Settled,
    Cancelled
}

/// @notice Enum representing categories a duel can belong to
enum DuelCategory {
    Any,
    Crypto,
    Politics,
    Sports,
    Twitter,
    NFTs,
    News
}

/// @notice Enum representing trigger type
enum TriggerType {
    Absolute,
    Percentage
}

/// @notice Enum representing trigger condition
enum TriggerCondition {
    Above,
    Below
}

/// @notice Emitted when a new duel is created
/// @param creator The address of the duel creator
/// @param duelId The unique ID of the duel
/// @param topic The description of duel
/// @param createTime The time the duel was created
/// @param createDuelFee The fee paid for creating the duel
/// @param category The category of the duel
event DuelCreated(
    address indexed creator,
    string duelId,
    string topic,
    uint256 createTime,
    uint256 createDuelFee,
    DuelCategory category
);

/// @notice Emitted when a new crypto duel is created
/// @param creator The address of the duel creator
/// @param tokenSymbol The symbol of token
/// @param duelId The unique ID of the duel
/// @param createTime The time the duel was created
/// @param createDuelFee The fee paid for creating the duel
/// @param category The category of the duel
event CryptoDuelCreated(
    address indexed creator,
    string tokenSymbol,
    string duelId,
    uint256 createTime,
    uint256 createDuelFee,
    int256 triggerValue,
    TriggerType triggerType,
    TriggerCondition triggerCondition,
    DuelCategory category
);

/// @notice Emitted when a participant joins a duel
/// @param duelId The ID of the duel being joined
/// @param topic The topic/description related to the duel
/// @param participant The address of the participant
/// @param amount The amount wagered
/// @param optionToken The option token
/// @param amountOptionToken The amount of option token to mint
/// @param joinTime The time the participant joined the duel
event DuelJoined(
    string duelId,
    string topic,
    string option,
    address indexed participant,
    address optionToken,
    uint256 optionIndex,
    uint256 amount,
    uint256 amountOptionToken,
    uint256 joinTime
);

/// @notice Emitted when a participant joins a crypto duel
/// @param duelId The ID of the duel being joined
/// @param tokenSymbol The token symbol
/// @param participant The address of the participant
/// @param tokenSymbol The token symbol being wagered on
/// @param amount The amount wagered
/// @param optionToken The option token
/// @param amountOptionToken The amount of option token to mint
/// @param joinTime The time the participant joined the duel
event CryptoDuelJoined(
    string duelId,
    string tokenSymbol,
    string option,
    address indexed participant,
    address optionToken,
    uint256 optionIndex,
    uint256 amount,
    uint256 amountOptionToken,
    uint256 joinTime
);

/// @notice Emitted when a duel starts
/// @param duelId The ID of the duel that started
/// @param startTime The time the duel started
/// @param expiryTime The time the duel will expire
event DuelStarted(string duelId, uint256 startTime, uint256 expiryTime);

/// @notice Emitted when a duel is settled and the winner is determined
/// @param duelId The ID of the duel that was settled
/// @param winningOption The winning option
/// @param optionIndex The option index
/// @param settleTime The time the duel will settle
event DuelSettled(string duelId, string winningOption, uint256 optionIndex, uint256 settleTime);

/// @notice Emitted when a user withdraws their earnings
/// @param user The address of the user withdrawing earnings
/// @param amount The amount withdrawn
/// @param withdrawEarningTime The earnings withdraw timestamp
event WithdrawEarning(address indexed user, uint256 amount, uint256 withdrawEarningTime);

/// @notice Emitted when a duel creator withdraws their creator fees
/// @param user The address of the duel creator
/// @param creatorFee The fee withdrawn by the creator
/// @param withdrawCreatorEarningTime The creator earnings withdraw timestamp
event WithdrawCreatorEarning(address indexed user, uint256 creatorFee, uint256 withdrawCreatorEarningTime);

/// @notice Emitted when protocol fees are withdrawn
/// @param user The address of the protocol
/// @param protocolBalance The amount withdrawn as protocol fees
/// @param withdrawProtocolFeeTime The protocol fees withdraw timestamp
event WithdrawProtocolFee(address indexed user, uint256 protocolBalance, uint256 withdrawProtocolFeeTime);

/// @notice Emitted when a refund is issued for a cancelled duel
/// @param duelId The ID of the cancelled duel
/// @param option The option for which refund issued
/// @param recipient The address receiving the refund
/// @param amount The amount refunded for option
/// @param refundTime The refund time for the duel
event RefundIssued(string duelId, string option, address indexed recipient, uint256 amount, uint256 refundTime);

/// @notice Emitted when a duel is cancelled
/// @param duelId The ID of the cancelled duel
/// @param duelStartTime The duel start time
/// @param duelCancelTime The duel cancel time
event DuelCancelled(string duelId, uint256 duelStartTime, uint256 duelCancelTime);

/// @notice Emitted when a duel is partially settled with a winning option.
/// @dev This event is triggered when a duel has been settled partially, indicating the winning option and the corresponding option index.
/// @param duelId The unique identifier for the duel.
/// @param winningOption The option that won in the duel.
/// @param optionIndex The index of the winning option in the duel.
/// @param time The timestamp when the duel settlement occurred.
event PartialDuelSettled(string duelId, string winningOption, uint256 optionIndex, uint256 time);

/// @notice Emitted when partial winnings have been distributed to the winners.
/// @dev This event is emitted during the distribution of winnings in chunks, indicating the partial completion of the process.
/// @param duelId The unique identifier for the duel.
/// @param time The timestamp when partial winnings were distributed.
event PartialWinningsDistributed(string duelId, uint256 time);

/// @notice Emitted when the winnings distribution process is completed.
/// @dev This event signals that all winnings have been distributed, marking the end of the distribution process.
/// @param duelId The unique identifier for the duel.
/// @param time The timestamp when the distribution was fully completed.
event WinningsDistributionCompleted(string duelId, uint256 time);

/// @notice Emitted when the chunk size for distributing winnings is updated.
/// @param winnersChunkSize The new chunk size for distributing winnings.
event WinnersChunkSizesUpdated(uint256 winnersChunkSize);

/// @notice Emitted when the chunk size for refunding wager is updated.
/// @param refundChunkSize The new chunk size for distributing winnings.
event RefundChunkSizesUpdated(uint256 refundChunkSize);

/// @notice Emitted when the chunk size for refunding wager is updated.
/// @param duelId The duelId.
/// @param time The timestamp.
event PartialRefundsDistributed(string duelId, uint256 time);

/// @notice Emitted when the chunk size for refunding wager is updated.
/// @param duelId The duelId.
/// @param time The timestamp.
event RefundsDistributionCompleted(string duelId, uint256 time);

/// @notice Emitted when the fee for creating a duel is updated.
/// @param newFee The updated fee amount for creating a duel.
event CreateDuelFeeUpdated(uint256 newFee);

/// @notice Emitted when the minimum wager threshold is updated.
/// @param newThreshold The updated minimum wager threshold required to participate in a duel.
event MinimumWagerThresholdUpdated(uint256 newThreshold);

/// @notice Emitted when the bot address is updated.
/// @param newBotAddress The new address for the bot responsible for certain automated functions in the contract.
event BotAddressUpdated(address newBotAddress);

/// @notice Emitted when the protocol address is updated.
/// @param newProtocolTreasury The new address for the protocol treasury.
event ProtocolTreasuryUpdated(address newProtocolTreasury);

/// @notice Emitted when the bootstrap period is updated.
/// @param newBootstrapPeriod The updated duration for the bootstrap period.
event BootstrapPeriodUpdated(uint256 newBootstrapPeriod);

/// @notice Emitted when a duel is requested
/// @param user The address of the user who requested the duel
/// @param category The category of the duel
/// @param topic The topic of the duel
/// @param duration The duration of the duel
/// @param amount The amount of USDC requested
/// @param timestamp The timestamp of the duel request
event CreateDuelRequested(
    address indexed user,
    DuelCategory category,
    string topic,
    DuelDuration duration,
    uint256 amount,
    uint256 timestamp
);

/// @notice Emitted when a duel is approved and created
/// @param user The address of the user who approved and created the duel
/// @param duelId The ID of the duel
/// @param category The category of the duel
/// @param topic The topic of the duel
/// @param duration The duration of the duel
/// @param timestamp The timestamp of the duel approval and creation
event DuelApprovedAndCreated(
    address indexed user,
    string duelId,
    DuelCategory category,
    string topic,
    DuelDuration duration,
    uint256 timestamp
);

/// @notice Emitted when a duel request is revoked
/// @param user The address of the user who revoked the duel request
/// @param refundAmount The amount of USDC refunded
/// @param timestamp The timestamp of the duel request revocation
event DuelRequestRevoked(address indexed user, uint256 refundAmount, uint256 timestamp);

/// @notice Emitted when the resolving period is updated.
/// @param newResolvingPeriod The resolving period.
event ResolvingPeriodUpdated(uint256 newResolvingPeriod);

/// @notice Thrown when the duel has been already ended
error FlashDuelsMarketplace__DuelEnded(string duelId);


/// @notice Thrown when the owner or bot address is invalid
error FlashDuels__InvalidOwnerOrBot();

/// @notice Thrown when the bot address is invalid
error FlashDuels__InvalidBot();

struct AppStorage {
    /// @notice Total protocol fees generated by the contract
    uint256 totalProtocolFeesGenerated;
    /// @notice Protocol fee percentage taken from the winnings (default 2%)
    uint256 protocolFeePercentage;
    /// @notice Fee percentage given to the duel creator (default 2%)
    uint256 creatorFeePercentage;
    /// @notice Winners chunk size
    uint256 winnersChunkSize;
    /// @notice Refund chunk size
    uint256 refundChunkSize;
    /// @notice Resolving period
    uint256 resolvingPeriod;
    /// @notice Time period for bootstrapping before a duel goes live (30 minutes by default)
    uint256 bootstrapPeriod;
    /// @notice Marketplace fees
    uint256 marketPlaceFees; // 0.1%
    /// @notice Fee in USDC required to create a duel
    uint256 createDuelFee;
    /// @notice The minimum threshold for wagering, set to 50 USDC (or configurable)
    uint256 minThreshold;
    /// @notice Sale Counter
    uint256 saleCounter;
    /// @notice Nonce used to generate unique duel IDs
    uint256 nonce;
    /// @notice address of flashDuels diamond contract
    address flashDuelsContract; // @note mainnet - can be removed for mainnet deployment
    /// @notice Protocol address to receive fees
    address protocolTreasury;
    /// @notice USDC token contract address used for payments and fees
    address usdc;
    /// @notice Address of the bot
    address bot;
    /// @notice  Storage for all pending duels
    PendingDuel[] allPendingDuels;
    /// @notice  Storage for all pending crypto duels
    PendingCryptoDuel[] allPendingCryptoDuels;
    /// @notice Mapping for duelId -> option-> user -> 1-based index in the participants array
    mapping(string => mapping(string => mapping(address => uint256))) participantIndices;
    /// @notice Mapping to track total bets on duel option for a particular duel
    mapping(string => mapping(uint256 => mapping(string => uint256))) totalBetsOnOption;
    /// @notice Maps for duelId -> option -> user -> existence (true/false)
    mapping(string => mapping(string => mapping(address => bool))) userExistsInOption;
    /// @notice Mapping of user to the duelId to the option to the user wager amount
    mapping(address => mapping(string => mapping(string => uint256))) userWager;
    /// @notice Mapping to store pending duels by user address
    mapping(address => mapping(DuelCategory => PendingDuel[])) pendingDuels;
    /// @notice Mapping to store pending crypto duels by user address
    mapping(address => PendingCryptoDuel[]) pendingCryptoDuels;
    /// @notice Mapping of duelId to optionIndex to the option token address
    mapping(string => mapping(uint256 => address)) optionIndexToOptionToken;
    /// @notice Mapping of duelId to the option to the total wager for option
    mapping(string => mapping(string => uint256)) totalWagerForOption;
    /// @notice Mapping of duelId to the option to the duel users for option
    mapping(string => mapping(string => address[])) duelUsersForOption;
    /// @notice Mapping of duelId to the token to the start price
    mapping(string => mapping(string => int256)) startPriceToken;
    /// @notice Mapping to track sales for each token by sale ID
    mapping(address => mapping(uint256 => Sale)) sales;
    /// @notice Mapping to track total fees earned by duel creators
    mapping(address => uint256) totalCreatorFeeEarned;
    /// @notice Mapping to track distribution progress for each duel
    mapping(string => uint256) distributionProgress;
    /// @notice Mapping of optionIndex to the option
    mapping(uint256 => string) optionIndexToOption;
    /// @notice Mapping to check if the distribution for a duel is completed
    mapping(string => bool) distributionCompleted;
    /// @notice Mapping to store multiple duel IDs for the same creator
    mapping(address => string[]) creatorToDuelIds;
    /// @notice Mapping of duelId to their options
    mapping(string => string[]) duelIdToOptions;
    /// @notice Mapping to track total earnings for participants
    mapping(address => uint256) allTimeEarnings;
    /// @notice Mapping to track total bets on duel
    mapping(string => uint256) totalBetsOnDuel;
    /// @notice Mapping of duel IDs to crypto duel information
    mapping(string => CryptoDuel) cryptoDuels;
    /// @notice Mapping to check refund in progress for duelId
    mapping(string => bool) refundInProgress;
    /// @notice Mapping to refund progress
    mapping(string => uint256) refundProgress;
    /// @notice Mapping to track valid duel IDs to prevent duplicates
    mapping(string => bool) isValidDuelId;
    /// @notice Mapping of duel IDs to duel information
    mapping(string => Duel) duels;
    /// @notice Mapping of duelId to the optionIndex to the winning option to the total winning option payout
    mapping(string => mapping(uint256 => mapping(string => uint256))) totalWinningOptionPayout; // @note - can be shited up during mainnet deployment
}

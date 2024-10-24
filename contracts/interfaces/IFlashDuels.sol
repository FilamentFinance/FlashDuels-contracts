// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

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

interface IFlashDuels {
    function getDuel(string memory duelId) external view returns (Duel memory);
    function duels(string memory duelId) external view returns (Duel memory);
    function cryptoDuels(string memory cryptoDuelId) external view returns (CryptoDuel memory);
    function getOptionIndexToOptionToken(
        string memory cryptoDuelId,
        uint256 optionIndex
    ) external view returns (address);
}

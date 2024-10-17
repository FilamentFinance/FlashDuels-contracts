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
    /// @notice Minimum wager amount in the duel option
    uint256 minWager;
    /// @notice Status of the duel
    DuelStatus duelStatus;
    /// @notice Category of the duel
    DuelCategory category;
}

/// @notice Struct that stores details of each crypto duel
struct CryptoDuel {
    /// @notice Address of the duel creator
    address creator;
    /// @notice Address of the token
    address token;
    /// @notice UNIX timestamp when the duel creates
    uint256 createTime;
    /// @notice UNIX timestamp when the duel starts
    uint256 startTime;
    /// @notice UNIX timestamp when the duel expires
    uint256 expiryTime;
    /// @notice Minimum wager amount in the duel option
    uint256 minWager;
    /// @notice Trigger value
    int256 triggerValue;
    /// @notice Trigger type
    TriggerType triggerType;
    /// @notice Trigger condition
    TriggerCondition triggerCondition;
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
/// @param options The options of the duel
/// @param createTime The time the duel was created
/// @param expiryTime The time the duel will expire
/// @param createDuelFee The fee paid for creating the duel
/// @param category The category of the duel
event DuelCreated(
    address creator,
    string duelId,
    string topic,
    string[] options,
    uint256 createTime,
    uint256 expiryTime,
    uint256 createDuelFee,
    DuelCategory category
);

/// @notice Emitted when a new duel is created
/// @param creator The address of the duel creator
/// @param token The address of token
/// @param duelId The unique ID of the duel
/// @param options The options of the duel
/// @param createTime The time the duel was created
/// @param expiryTime The time the duel will expire
/// @param createDuelFee The fee paid for creating the duel
/// @param category The category of the duel
event CryptoDuelCreated(
    address creator,
    address token,
    string duelId,
    string[] options,
    uint256 createTime,
    uint256 expiryTime,
    uint256 createDuelFee,
    int256 triggerValue,
    TriggerType triggerType,
    TriggerCondition triggerCondition,
    DuelCategory category
);

/// @notice Emitted when a participant joins a duel
/// @param duelId The ID of the duel being joined
/// @param topic The topic related to the token
/// @param participant The address of the participant
/// @param amount The amount wagered
/// @param optionToken The option token
/// @param amountOptionToken The amount of option token to mint
/// @param joinTime The time the participant joined the duel
event DuelJoined(
    string duelId,
    string topic,
    address participant,
    uint256 amount,
    address optionToken,
    uint256 amountOptionToken,
    uint256 joinTime
);

/// @notice Emitted when a participant joins a duel
/// @param duelId The ID of the duel being joined
/// @param participant The address of the participant
/// @param token The token being wagered on
/// @param amount The amount wagered
/// @param optionToken The option token
/// @param amountOptionToken The amount of option token to mint
/// @param joinTime The time the participant joined the duel
event CryptoDuelJoined(
    string duelId,
    address participant,
    address token,
    uint256 amount,
    address optionToken,
    uint256 amountOptionToken,
    uint256 joinTime
);

/// @notice Emitted when a duel starts
/// @param duelId The ID of the duel that started
/// @param startTime The time the duel started
event DuelStarted(string duelId, uint256 startTime);

/// @notice Emitted when a duel is settled and the winner is determined
/// @param duelId The ID of the duel that was settled
/// @param winningTopic The topic associated with the winning token
/// @param optionIndex The option index
event DuelSettled(string duelId, string winningTopic, uint256 optionIndex);

/// @notice Emitted when a user withdraws their earnings
/// @param user The address of the user withdrawing earnings
/// @param amount The amount withdrawn
event WithdrawEarning(address user, uint256 amount);

/// @notice Emitted when a duel creator withdraws their creator fees
/// @param user The address of the duel creator
/// @param creatorFee The fee withdrawn by the creator
event WithdrawCreatorEarning(address user, uint256 creatorFee);

/// @notice Emitted when protocol fees are withdrawn
/// @param user The address of the protocol
/// @param protocolBalance The amount withdrawn as protocol fees
event WithdrawProtocolFee(address user, uint256 protocolBalance);

/// @notice Emitted when a refund is issued for a cancelled duel
/// @param duelId The ID of the cancelled duel
/// @param option The option for which refund issued
/// @param recipient The address receiving the refund
/// @param amount The amount refunded for option
event RefundIssued(string duelId, string option, address recipient, uint256 amount);

/// @notice Emitted when a duel is cancelled
/// @param duelId The ID of the cancelled duel
/// @param duelStartTime The duel start time
/// @param duelCancelTime The duel cancel time
event DuelCancelled(string duelId, uint256 duelStartTime, uint256 duelCancelTime);

interface IFlashDuels {
    function duels(string memory duelId) external view returns (Duel memory);
    function cryptoDuels(string memory cryptoDuelId) external view returns (CryptoDuel memory);
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AppStorage, Duel, DuelCategory, DuelDuration, DuelStatus, PendingDuel, DuelApprovedAndCreated, ParticipationTokenTypeUpdated, ParticipationTokenType, DuelRequestRevoked, DuelCreated, WithdrawProtocolFee, CreateDuelFeeUpdated, MinimumWagerThresholdUpdated, BotAddressUpdated, ProtocolTreasuryUpdated, BootstrapPeriodUpdated, ResolvingPeriodUpdated, WinnersChunkSizesUpdated, RefundChunkSizesUpdated, CreditsAddressUpdated, FlashDuelsAdminFacet__InvalidOwnerOrBot, FlashDuelsAdminFacet__InvalidProtocolAddress, FlashDuelsAdminFacet__InvalidCRDAddress, FlashDuelsAdminFacet__InvalidCreateDuelFee, FlashDuelsAdminFacet__InvalidMinimumWagerThreshold, FlashDuelsAdminFacet__InvalidBootstrapPeriod, FlashDuelsAdminFacet__InvalidResolvingPeriod, FlashDuelsAdminFacet__InvalidWinnersChunkSize, FlashDuelsAdminFacet__InvalidRefundChunkSize, FlashDuelsAdminFacet__InvalidDuelDuration, FlashDuelsAdminFacet__DuelAlreadyApproved, FlashDuelsAdminFacet__InvalidUSDCAmount, FlashDuelsAdminFacet__NoUSDCAmountToRefund, FlashDuelsAdminFacet__NoFundsAvailable, FlashDuelsAdminFacet__TransferFailed, FlashDuelsAdminFacet__InvalidCategory, FlashDuelsAdminFacet__InvalidBot, FlashDuelsAdminFacet__USDCRefundFailed, FlashDuelsAdminFacet__CreditsRefundFailed, FlashDuelsAdminFacet__InvalidPendingDuelsIndex, FlashDuelsAdminFacet__InvalidCRDAddress, FlashDuelsAdminFacet__InvalidCreateDuelFee, FlashDuelsAdminFacet__InvalidMinimumWagerThreshold, FlashDuelsAdminFacet__InvalidBootstrapPeriod, FlashDuelsAdminFacet__InvalidResolvingPeriod, FlashDuelsAdminFacet__InvalidWinnersChunkSize, FlashDuelsAdminFacet__InvalidRefundChunkSize, FlashDuelsAdminFacet__InvalidDuelDuration, FlashDuelsAdminFacet__DuelAlreadyApproved, FlashDuelsAdminFacet__InvalidUSDCAmount, FlashDuelsAdminFacet__NoUSDCAmountToRefund, FlashDuelsAdminFacet__NoFundsAvailable, FlashDuelsAdminFacet__TransferFailed, FlashDuelsAdminFacet__InvalidCategory, FlashDuelsAdminFacet__InvalidBot, FlashDuelsAdminFacet__USDCRefundFailed, FlashDuelsAdminFacet__CreditsRefundFailed, FlashDuelsAdminFacet__InvalidPendingDuelsIndex, FlashDuelsAdminFacet__InvalidMinWagerTradeSize, MinWagerTradeSizeUpdated, MaxLiquidityCapPerDuelUpdated, MaxLiquidityCapAcrossProtocolUpdated, FlashDuelsAdminFacet__InvalidMaxLiquidityCapPerDuel, FlashDuelsAdminFacet__InvalidMaxLiquidityCapAcrossProtocol, FlashDuelsAdminFacet__InvalidMaxAutoWithdraw, MaxAutoWithdrawUpdated} from "../AppStorage.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LibFlashDuels} from "../libraries/LibFlashDuels.sol";

/// @title FlashDuelsAdminFacet
/// @notice This contract allows the admin to manage the duels and the pending duels.
contract FlashDuelsAdminFacet is PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using LibFlashDuels for LibFlashDuels.LibFlashDuelsAppStorage;

    AppStorage internal s;

    /// ============ Modifiers ============ ///
    /// @notice Modifier to restrict function access to only the bot address.
    /// @dev Throws FlashDuels__InvalidOwnerOrBot if the caller is not the owner or the bot address
    modifier onlyOwnerOrBot() {
        require(msg.sender == LibDiamond.contractOwner() || msg.sender == s.bot, FlashDuelsAdminFacet__InvalidOwnerOrBot());
        _;
    }

    /// @notice Modifier to restrict function access to only the contract owner.
    /// @dev Uses the LibDiamond library to enforce contract ownership.
    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    // ============ External Functions ============
    /// @notice Pauses the contract, disabling certain critical functions
    /// @dev Can only be called by the owner to prevent further operations during an emergency
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses the contract, enabling previously disabled functions
    /// @dev Can only be called by the owner to resume normal contract operations
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Sets the fee required to create a duel.
    /// @dev This function can only be called by the contract owner.
    /// It updates the createDuelFee variable with the new fee value.
    /// @param _fee The new fee amount to set for creating a duel.
    function setCreateDuelFee(uint256 _fee) external onlyOwner {
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(_fee <= 10 * 1e6, FlashDuelsAdminFacet__InvalidCreateDuelFee());
        } else {
            require(_fee <= 10 * 1e18, FlashDuelsAdminFacet__InvalidCreateDuelFee());
        }
        s.createDuelFee = _fee;
        emit CreateDuelFeeUpdated(_fee);
    }

    /// @notice Sets the address of the bot.
    /// @dev This function can only be called by the contract owner.
    /// It updates the bot variable with the specified address.
    /// @param _bot The address of the bot to set.
    function setBotAddress(address _bot) external onlyOwner {
        require(_bot != address(0), FlashDuelsAdminFacet__InvalidBot());
        s.bot = _bot;
        emit BotAddressUpdated(_bot);
    }

    /// @notice Sets the address of the protocol.
    /// @dev This function can only be called by the contract owner.
    /// It updates the protocolAddress variable with the new address.
    /// @param _protocolTreasury The address of the protocol to set.
    function setProtocolAddress(address _protocolTreasury) external onlyOwner {
        require(_protocolTreasury != address(0), FlashDuelsAdminFacet__InvalidProtocolAddress());
        s.protocolTreasury = _protocolTreasury;
        emit ProtocolTreasuryUpdated(_protocolTreasury);
    }

    /// @notice Sets the minimum threshold.
    /// @dev This function can only be called by the contract owner.
    /// It updates the minThreshold variable with the new threshold value.
    /// @param _minThreshold The minimum threshold for the duel to start for each topic.
    function setMinimumWagerThreshold(uint256 _minThreshold) external onlyOwner {
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(
                _minThreshold >= 50 * 1e6 && _minThreshold <= 200 * 1e6,
                FlashDuelsAdminFacet__InvalidMinimumWagerThreshold()
            );
        } else {
            require(
                _minThreshold >= 50 * 1e18 && _minThreshold <= 200 * 1e18,
                FlashDuelsAdminFacet__InvalidMinimumWagerThreshold()
            );
        }
        s.minThreshold = _minThreshold;
        emit MinimumWagerThresholdUpdated(_minThreshold);
    }

    /// @notice Updates the bootstrap period.
    /// @param _bootstrapPeriod The new bootstrap period.
    function updateBootstrapPeriod(uint256 _bootstrapPeriod) external onlyOwner {
        require(
            _bootstrapPeriod >= 5 minutes && _bootstrapPeriod <= 30 minutes,
            FlashDuelsAdminFacet__InvalidBootstrapPeriod()
        );
        s.bootstrapPeriod = _bootstrapPeriod;
        emit BootstrapPeriodUpdated(_bootstrapPeriod);
    }

    /// @notice Updates the resolving period for duels.
    /// @dev Allows only the owner to set a new resolving period for duels.
    /// @param _newResolvingPeriod The new duration (in seconds) for the resolving period.
    function setResolvingPeriod(uint256 _newResolvingPeriod) external onlyOwner {
        require(_newResolvingPeriod >= 48 hours, FlashDuelsAdminFacet__InvalidResolvingPeriod());
        s.resolvingPeriod = _newResolvingPeriod;
        emit ResolvingPeriodUpdated(_newResolvingPeriod);
    }

    /// @notice Sets the chunk size for processing winners during distribution.
    /// @dev The chunk size must be between 30 and 100 to ensure efficient distribution.
    /// @param _winnersChunkSize The size of the chunk for distributing winnings, in the range of 30 to 100.
    /// @custom:restriction This function can only be called by the contract owner.
    function setWinnersChunkSizes(uint256 _winnersChunkSize) external onlyOwner {
        require(_winnersChunkSize >= 30 && _winnersChunkSize <= 100, FlashDuelsAdminFacet__InvalidWinnersChunkSize());
        s.winnersChunkSize = _winnersChunkSize;
        emit WinnersChunkSizesUpdated(_winnersChunkSize);
    }

    /// @notice Sets the chunk size for processing winners during distribution.
    /// @dev The chunk size must be between 30 and 100 to ensure efficient distribution.
    /// @param _refundChunkSize The size of the chunk for distributing winnings, in the range of 30 to 100.
    /// @custom:restriction This function can only be called by the contract owner.
    function setRefundChunkSizes(uint256 _refundChunkSize) external onlyOwner {
        require(_refundChunkSize >= 30 && _refundChunkSize <= 100, FlashDuelsAdminFacet__InvalidRefundChunkSize());
        s.refundChunkSize = _refundChunkSize;
        emit RefundChunkSizesUpdated(_refundChunkSize);
    }

    /// @notice Sets the address of the CRD token.
    /// @dev This function can only be called by the contract owner.
    /// It updates the credits variable with the specified address.
    /// @param _creditsAddress The address of the CRD token to set.
    function setCRDAddress(address _creditsAddress) external onlyOwner {
        require(_creditsAddress != address(0), FlashDuelsAdminFacet__InvalidCRDAddress());
        s.credits = _creditsAddress;
        emit CreditsAddressUpdated(_creditsAddress);
    }

    /// @notice Sets the token type for participation in duels.
    /// @dev This function can only be called by the contract owner.
    /// @param _tokenType The token type to set for participation (0 for USDC, 1 for Credits).
    function setParticipationTokenType(ParticipationTokenType _tokenType) external onlyOwner {
        s.participationTokenType = _tokenType;
        emit ParticipationTokenTypeUpdated(_tokenType);
    }

    /// @notice Sets the minimum wager trade size to join a duel.
    /// @dev This function can only be called by the contract owner.
    /// @param _minWagerTradeSize The minimum wager trade size to set.
    function setMinWagerTradeSize(uint256 _minWagerTradeSize) external onlyOwner {
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(_minWagerTradeSize >= 5 * 1e6, FlashDuelsAdminFacet__InvalidMinWagerTradeSize());
        } else {
            require(_minWagerTradeSize >= 5 * 1e18, FlashDuelsAdminFacet__InvalidMinWagerTradeSize());
        }
        s.minWagerTradeSize = _minWagerTradeSize;
        emit MinWagerTradeSizeUpdated(_minWagerTradeSize);
    }

    /// @notice Sets the maximum liquidity cap per duel
    /// @param _maxLiquidityCapPerDuel The maximum liquidity cap per duel
    function setMaxLiquidityCapPerDuel(uint256 _maxLiquidityCapPerDuel) external onlyOwner {
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(_maxLiquidityCapPerDuel >= 20000 * 1e6, FlashDuelsAdminFacet__InvalidMaxLiquidityCapPerDuel());
        } else {
            require(_maxLiquidityCapPerDuel >= 20000 * 1e18, FlashDuelsAdminFacet__InvalidMaxLiquidityCapPerDuel());
        }
        s.maxLiquidityCapPerDuel = _maxLiquidityCapPerDuel;
        emit MaxLiquidityCapPerDuelUpdated(_maxLiquidityCapPerDuel);
    }

    /// @notice Sets the maximum liquidity cap across protocol
    /// @param _maxLiquidityCapAcrossProtocol The maximum liquidity cap across protocol
    function setMaxLiquidityCapAcrossProtocol(uint256 _maxLiquidityCapAcrossProtocol) external onlyOwner {
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(_maxLiquidityCapAcrossProtocol >= 200000 * 1e6, FlashDuelsAdminFacet__InvalidMaxLiquidityCapAcrossProtocol());
        } else {
            require(_maxLiquidityCapAcrossProtocol >= 200000 * 1e18, FlashDuelsAdminFacet__InvalidMaxLiquidityCapAcrossProtocol());
        }
        s.maxLiquidityCapAcrossProtocol = _maxLiquidityCapAcrossProtocol;
        emit MaxLiquidityCapAcrossProtocolUpdated(_maxLiquidityCapAcrossProtocol);
    }

    /// @notice Sets the maximum auto withdraw amount
    /// @param _maxAutoWithdrawAmount The maximum auto withdraw amount
    function setMaxAutoWithdraw(uint256 _maxAutoWithdrawAmount) external onlyOwner {
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(_maxAutoWithdrawAmount >= 5 * 1e6, FlashDuelsAdminFacet__InvalidMaxAutoWithdraw());
        } else {
            require(_maxAutoWithdrawAmount >= 5 * 1e18, FlashDuelsAdminFacet__InvalidMaxAutoWithdraw());
        }
        s.maxAutoWithdrawAmount = _maxAutoWithdrawAmount;
        emit MaxAutoWithdrawUpdated(_maxAutoWithdrawAmount);
    }

    /// @notice Creates a duel for an approved user
    /// @param _user Address of the user who approved the duel creation
    /// @param _category The category of the duel to approve
    /// @param _index The index of the pending duel in the array
    /// @return _duelId A unique string representing the ID of the created duel
    function approveAndCreateDuel(
        address _user,
        DuelCategory _category,
        uint256 _index
    ) external whenNotPaused onlyOwnerOrBot returns (string memory) {
        string memory duelId;
        require(_category != DuelCategory.Crypto, FlashDuelsAdminFacet__InvalidCategory());
        duelId = _processPendingDuel(_user, _category, _index);
        return duelId;
    }

    /// @notice Revokes duel approval and refunds USDC for a specific user
    /// @param _user Address of the user whose duel request should be revoked
    /// @param _category The category of the duel to revoke
    /// @param _index The index of the pending duel in the array
    /// @return success boolean indicating if the revocation and refund was successful
    function revokeCreateDuelRequest(
        address _user,
        DuelCategory _category,
        uint256 _index
    ) external whenNotPaused onlyOwnerOrBot returns (bool) {
        uint256 refundAmount;
        require(_category != DuelCategory.Crypto, FlashDuelsAdminFacet__InvalidCategory());
        refundAmount = _revokePendingDuel(_user, _category, _index);
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(IERC20(s.usdc).transfer(_user, refundAmount), FlashDuelsAdminFacet__USDCRefundFailed());
        } else {
            require(IERC20(s.credits).transfer(_user, refundAmount), FlashDuelsAdminFacet__CreditsRefundFailed());
        }
        emit DuelRequestRevoked(_user, refundAmount, block.timestamp);
        return true;
    }

    /// @notice Withdraws protocol fees by the owner.
    /// @dev This function can only be called by the owner.
    function withdrawProtocolFees() external nonReentrant onlyOwner {
        uint256 protocolBalance = s.totalProtocolFeesGenerated;
        require(protocolBalance > 0, FlashDuelsAdminFacet__NoFundsAvailable());
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(IERC20(s.usdc).transfer(msg.sender, protocolBalance), FlashDuelsAdminFacet__TransferFailed());
        } else {
            require(IERC20(s.credits).transfer(msg.sender, protocolBalance), FlashDuelsAdminFacet__TransferFailed());
        }
        s.totalProtocolFeesGenerated = 0;
        emit WithdrawProtocolFee(msg.sender, protocolBalance, block.timestamp);
    }


    // ============ Internal Functions ============
    /// @notice Creates a new duel with the specified parameters
    /// @dev Internal function that allows any user to create a duel with a predefined duel duration.
    ///       A USDC fee is required for duel creation, and the duel starts after the bootstrap period.
    /// @param _user Address of the user
    /// @param _category The category of the duel (e.g., Politics, or other categories).
    /// @param _topic A string representing the topic or title or description or questions in the duel.
    /// @param _options An array of strings representing the options for the duel.
    /// @param _duelDuration The duration of the duel, chosen from predefined options (3 hours, 6 hours, or 12 hours).
    /// @return _duelId A unique string representing the ID of the created duel.
    function _createDuel(
        address _user,
        DuelCategory _category,
        string memory _topic,
        string[] memory _options,
        DuelDuration _duelDuration
    ) internal returns (string memory) {
        require(_category != DuelCategory.Crypto, FlashDuelsAdminFacet__InvalidCategory());
        s.totalProtocolFeesGenerated = s.totalProtocolFeesGenerated + s.createDuelFee;

        require(
            _duelDuration == DuelDuration.FiveMinutes ||
                _duelDuration == DuelDuration.FifteenMinutes ||
                _duelDuration == DuelDuration.ThirtyMinutes ||
                _duelDuration == DuelDuration.OneHour ||
                _duelDuration == DuelDuration.ThreeHours ||
                _duelDuration == DuelDuration.SixHours ||
                _duelDuration == DuelDuration.TwelveHours ||
                _duelDuration == DuelDuration.OneDay ||
                _duelDuration == DuelDuration.OneWeek ||
                _duelDuration == DuelDuration.OneMonth,
            FlashDuelsAdminFacet__InvalidDuelDuration()
        );

        string memory _duelId = LibFlashDuels._generateDuelId(_user);
        Duel storage duel = s.duels[_duelId];
        duel.creator = _user;
        duel.topic = _topic;
        duel.createTime = block.timestamp;
        duel.duelDuration = _duelDuration;
        duel.duelStatus = DuelStatus.BootStrapped;
        duel.category = _category;
        s.duelIdToOptions[_duelId] = _options;
        s.creatorToDuelIds[_user].push(_duelId);

        emit DuelCreated(_user, _duelId, _topic, block.timestamp, s.createDuelFee, _category);

        return _duelId;
    }

    /// @notice Internal function to process and create a regular duel
    /// @param _user Address of the user
    /// @param _category The category of the duel
    /// @param _index The index of the pending duel
    /// @return duelId A unique string representing the ID of the created duel
    function _processPendingDuel(
        address _user,
        DuelCategory _category,
        uint256 _index
    ) internal returns (string memory) {
        PendingDuel[] storage userPendingDuels = s.pendingDuels[_user][_category];
        require(_index < userPendingDuels.length, FlashDuelsAdminFacet__InvalidPendingDuelsIndex());
        PendingDuel memory pendingDuel = userPendingDuels[_index];
        require(!pendingDuel.isApproved, FlashDuelsAdminFacet__DuelAlreadyApproved());
        require(pendingDuel.usdcAmount == s.createDuelFee, FlashDuelsAdminFacet__InvalidUSDCAmount());
        string memory duelId = _createDuel(
            _user,
            pendingDuel.category,
            pendingDuel.topic,
            pendingDuel.options,
            pendingDuel.duration
        );
        uint256 lastIndex = userPendingDuels.length - 1;
        if (_index != lastIndex) {
            userPendingDuels[_index] = userPendingDuels[lastIndex];
        }
        userPendingDuels.pop();
        lastIndex = s.allPendingDuels.length - 1;
        if (_index != lastIndex) {
            s.allPendingDuels[_index] = s.allPendingDuels[lastIndex];
        }
        s.allPendingDuels.pop();
        emit DuelApprovedAndCreated(
            _user,
            duelId,
            pendingDuel.category,
            pendingDuel.topic,
            pendingDuel.duration,
            block.timestamp
        );
        return duelId;
    }

    /// @notice Processes a pending regular duel for a user and returns the refund amount.
    /// @dev This function ensures the regular duel is not approved and has a valid USDC amount.
    /// @param _user The address of the user whose pending regular duel is being processed.
    /// @param _category The category of the duel.
    /// @param _index The index of the pending duel in the user's pending duels array.
    /// @return The amount of USDC to be refunded.
    function _revokePendingDuel(address _user, DuelCategory _category, uint256 _index) internal returns (uint256) {
        PendingDuel[] storage userPendingDuels = s.pendingDuels[_user][_category];
        require(_index < userPendingDuels.length, FlashDuelsAdminFacet__InvalidPendingDuelsIndex());
        PendingDuel memory pendingDuel = userPendingDuels[_index];
        require(!pendingDuel.isApproved, FlashDuelsAdminFacet__DuelAlreadyApproved());
        require(pendingDuel.usdcAmount > 0, FlashDuelsAdminFacet__NoUSDCAmountToRefund());
        uint256 refundAmount = pendingDuel.usdcAmount;
        uint256 lastIndex = userPendingDuels.length - 1;
        if (_index != lastIndex) {
            userPendingDuels[_index] = userPendingDuels[lastIndex];
        }
        userPendingDuels.pop();
        lastIndex = s.allPendingDuels.length - 1;
        if (_index != lastIndex) {
            s.allPendingDuels[_index] = s.allPendingDuels[lastIndex];
        }
        s.allPendingDuels.pop();
        return refundAmount;
    }
}

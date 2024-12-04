// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AppStorage, Duel, CryptoDuel, DuelCategory, DuelDuration, TriggerType, TriggerCondition, DuelStatus, DuelCreated, CryptoDuelCreated, DuelJoined, CryptoDuelJoined, DuelStarted, DuelSettled, DuelCancelled, RefundIssued, WithdrawEarning, WithdrawCreatorEarning, WithdrawProtocolFee, CreateDuelFeeUpdated, MinimumWagerThresholdUpdated, BotAddressUpdated, ProtocolTreasuryUpdated, BootstrapPeriodUpdated, ResolvingPeriodUpdated, PartialDuelSettled, PartialWinningsDistributed, WinningsDistributionCompleted, WinnersChunkSizesUpdated, RefundChunkSizesUpdated, PartialRefundsDistributed, RefundsDistributionCompleted} from "../AppStorage.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFlashDuelsView} from "../interfaces/IFlashDuelsView.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import {OptionToken} from "../OptionToken.sol";

/// @notice Thrown when the bot address is invalid
error FlashDuels__InvalidBot();

/// @title FlashDuels
/// @notice This contract allows users to create and participate in duels by betting on the options.
contract FlashDuelsCoreFacet is PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    AppStorage internal s;

    /**
     * @notice Restricts the function to only the bot address
     * @dev Throws FlashDuels__InvalidBot if the caller is not the bot address
     */
    modifier onlyBot() {
        require(s.bot == msg.sender, FlashDuels__InvalidBot());
        _;
    }

    /// @notice Modifier to restrict function access to only the contract owner.
    /// @dev Uses the LibDiamond library to enforce contract ownership.
    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    // ========================== External Functions ========================== //

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
        // @note - zokyo-audit-fix-13
        require(_fee <= 10 * 1e6, "Duel fees cannot be more than 10 dollars");
        s.createDuelFee = _fee;
        // @note - zokyo-audit-fix-14
        emit CreateDuelFeeUpdated(_fee);
    }

    /// @notice Sets the address of the bot.
    /// @dev This function can only be called by the contract owner.
    /// It updates the bot variable with the specified address.
    /// @param _bot The address of the bot to set.
    function setBotAddress(address _bot) external onlyOwner {
        require(_bot != address(0), "Invalid bot address");
        s.bot = _bot;
        // @note - zokyo-audit-fix-14
        emit BotAddressUpdated(_bot);
    }

    /// @notice Sets the address of the protocol.
    /// @dev This function can only be called by the contract owner.
    /// It updates the protocolAddress variable with the new address.
    /// @param _protocolTreasury The address of the protocol to set.
    function setProtocolAddress(address _protocolTreasury) external onlyOwner {
        require(_protocolTreasury != address(0), "Invalid protocol address");
        s.protocolTreasury = _protocolTreasury;
        emit ProtocolTreasuryUpdated(_protocolTreasury);
    }

    /// @notice Sets the minimum threshold.
    /// @dev This function can only be called by the contract owner.
    /// It updates the minThreshold variable with the new threshold value.
    /// @param _minThreshold The minimum threshold for the duel to start for each topic.
    function setMinimumWagerThreshold(uint256 _minThreshold) external onlyOwner {
        // @note - zokyo-audit-fix-13
        require(
            _minThreshold >= 50 * 1e6 && _minThreshold <= 200 * 1e6,
            "Minimum threshold should be in the range 50 to 100 dollars"
        );
        s.minThreshold = _minThreshold;
        // @note - zokyo-audit-fix: 14
        emit MinimumWagerThresholdUpdated(_minThreshold);
    }

    /// @notice Updates the bootstrap period.
    /// @param _bootstrapPeriod The new bootstrap period.
    function updateBootstrapPeriod(uint256 _bootstrapPeriod) external onlyOwner {
        require(
            _bootstrapPeriod >= 5 minutes && _bootstrapPeriod <= 30 minutes,
            "Bootstrap period should be in the range 5 to 30 mins"
        );
        s.bootstrapPeriod = _bootstrapPeriod;
        emit BootstrapPeriodUpdated(_bootstrapPeriod);
    }
    // @note - zokyo-audit-fix-5
    /// @notice Updates the resolving period for duels.
    /// @dev Allows only the owner to set a new resolving period for duels.
    /// @param _newResolvingPeriod The new duration (in seconds) for the resolving period.

    function setResolvingPeriod(uint256 _newResolvingPeriod) external onlyOwner {
        require(_newResolvingPeriod >= 48 hours, "Resolving period should be atleast 48 hours");
        s.resolvingPeriod = _newResolvingPeriod;
        emit ResolvingPeriodUpdated(_newResolvingPeriod);
    }

    /// @notice Sets the chunk size for processing winners during distribution.
    /// @dev The chunk size must be between 30 and 100 to ensure efficient distribution.
    /// @param _winnersChunkSize The size of the chunk for distributing winnings, in the range of 30 to 100.
    /// @custom:restriction This function can only be called by the contract owner.
    function setWinnersChunkSizes(uint256 _winnersChunkSize) external onlyOwner {
        require(_winnersChunkSize >= 30 && _winnersChunkSize <= 100, "Chunk size should be in the range 30 to 100");
        s.winnersChunkSize = _winnersChunkSize;
        emit WinnersChunkSizesUpdated(_winnersChunkSize);
    }

    /// @notice Sets the chunk size for processing winners during distribution.
    /// @dev The chunk size must be between 30 and 100 to ensure efficient distribution.
    /// @param _refundChunkSize The size of the chunk for distributing winnings, in the range of 30 to 100.
    /// @custom:restriction This function can only be called by the contract owner.
    function setRefundChunkSizes(uint256 _refundChunkSize) external onlyOwner {
        require(_refundChunkSize >= 30 && _refundChunkSize <= 100, "Chunk size should be in the range 30 to 100");
        s.refundChunkSize = _refundChunkSize;
        emit RefundChunkSizesUpdated(_refundChunkSize);
    }

    /// @notice Creates a new duel with the specified parameters
    /// @dev Allows any user to create a duel with a predefined duel duration.
    ///       A USDC fee is required for duel creation, and the duel starts after the bootstrap period.
    /// @param _category The category of the duel (e.g., Politics, or other categories).
    /// @param _topic A string representing the topic or title or description or questions in the duel.
    /// @param _options A string representing the first option for the duel.
    /// @param _duelDuration The duration of the duel, chosen from predefined options (3 hours, 6 hours, or 12 hours).
    /// @return _duelId A unique string representing the ID of the created duel.
    function createDuel(
        DuelCategory _category,
        string memory _topic,
        string[] memory _options,
        DuelDuration _duelDuration
    ) external nonReentrant whenNotPaused returns (string memory) {
        require(_category != DuelCategory.Crypto, "Should not crypto category duel");
        // Transfer USDC fee for duel creation
        require(IERC20(s.usdc).transferFrom(msg.sender, address(this), s.createDuelFee), "USDC transfer failed");
        s.totalProtocolFeesGenerated = s.totalProtocolFeesGenerated + s.createDuelFee;

        require(
            _duelDuration == DuelDuration.ThreeHours ||
                _duelDuration == DuelDuration.SixHours ||
                _duelDuration == DuelDuration.TwelveHours,
            "Invalid duel duration"
        );

        string memory _duelId = _generateDuelId(msg.sender);
        Duel storage duel = s.duels[_duelId];
        duel.creator = msg.sender;
        duel.topic = _topic;
        duel.createTime = block.timestamp;
        duel.duelDuration = _duelDuration;
        duel.duelStatus = DuelStatus.BootStrapped;
        duel.category = _category;
        s.duelIdToOptions[_duelId] = _options;
        s.creatorToDuelIds[msg.sender].push(_duelId);

        emit DuelCreated(msg.sender, _duelId, _topic, block.timestamp, s.createDuelFee, _category);

        return _duelId;
    }
    /// @notice Creates a new crypto duel.
    /// @param _tokenSymbol Allowed token symbol for wagering.
    /// @param _options Betting options for the duel.
    /// @param _triggerValue Value that triggers the outcome.
    /// @param _triggerType Type of trigger (e.g., absolute, percentage).
    /// @param _triggerCondition Condition for triggering (e.g., above, below).
    /// @param _duelDuration Duration of the duel.
    /// @return Duel ID as a string.

    function createCryptoDuel(
        string memory _tokenSymbol,
        string[] memory _options,
        int256 _triggerValue,
        TriggerType _triggerType,
        TriggerCondition _triggerCondition,
        DuelDuration _duelDuration
    ) external nonReentrant whenNotPaused returns (string memory) {
        // Transfer USDC fee for duel creation
        require(IERC20(s.usdc).transferFrom(msg.sender, address(this), s.createDuelFee), "USDC transfer failed");
        s.totalProtocolFeesGenerated = s.totalProtocolFeesGenerated + s.createDuelFee;
        require(
            _duelDuration == DuelDuration.ThreeHours ||
                _duelDuration == DuelDuration.SixHours ||
                _duelDuration == DuelDuration.TwelveHours,
            "Invalid duel duration"
        );

        string memory _duelId = _generateDuelId(msg.sender);
        CryptoDuel storage duel = s.cryptoDuels[_duelId];
        duel.creator = msg.sender;
        duel.tokenSymbol = _tokenSymbol;
        duel.createTime = block.timestamp;
        duel.duelDuration = _duelDuration;
        duel.triggerValue = _triggerValue;
        duel.triggerType = _triggerType;
        duel.triggerCondition = _triggerCondition;
        duel.duelStatus = DuelStatus.BootStrapped;
        s.duelIdToOptions[_duelId] = _options;
        s.creatorToDuelIds[msg.sender].push(_duelId);

        emit CryptoDuelCreated(
            msg.sender,
            _tokenSymbol,
            _duelId,
            block.timestamp,
            s.createDuelFee,
            _triggerValue,
            _triggerType,
            _triggerCondition,
            DuelCategory.Crypto
        );

        return _duelId;
    }

    /// @notice Allows a user to join an existing duel by placing a wager on one of the options.
    /// @param _duelId The ID of the duel to join.
    /// @param _option The option of the duel.
    /// @param _optionsIndex The option index.
    /// @param _optionPrice The option price.
    /// @param _amount The amount of the token to wager in the duel.
    /// @param _user The user address.
    function joinDuel(
        string memory _duelId,
        string memory _option,
        uint256 _optionsIndex,
        uint256 _optionPrice,
        uint256 _amount,
        address _user
    ) external nonReentrant whenNotPaused onlyBot {
        /// @note - zokyo-audit-fix-1 (added onlyBot modifier to be called by out secured bot)
        Duel storage duel = s.duels[_duelId];
        require(s.isValidDuelId[_duelId] && duel.createTime != 0, "Duel doesn't exist");
        require(duel.category != DuelCategory.Crypto, "Should not a crypto duel");
        require(duel.duelStatus == DuelStatus.BootStrapped || duel.duelStatus == DuelStatus.Live, "Duel isn't live");
        require(_amount >= _optionPrice, "Less than minimum wager");
        // Transfer the wager amount in USDC to the contract
        require(IERC20(s.usdc).transferFrom(_user, address(this), _amount), "Token transfer failed");

        // Increment wager for the selected topic
        s.totalWagerForOption[_duelId][s.duelIdToOptions[_duelId][_optionsIndex]] += _amount;
        s.duelUsersForOption[_duelId][s.duelIdToOptions[_duelId][_optionsIndex]].push(_user);
        s.userWager[_user][_duelId][s.duelIdToOptions[_duelId][_optionsIndex]] += _amount;

        uint256 amountTokenToMint = (_amount * 1e18) / _optionPrice;
        // @note - zokyo-audit-fix-2
        address optionToken = s.optionIndexToOptionToken[_duelId][_optionsIndex];
        if (optionToken == address(0)) {
            // Deploy a new ERC-20 token contract
            OptionToken newOptionToken = new OptionToken(_option, _option);
            // Mint the specified amount of option tokens to the recipient address
            newOptionToken.mint(_user, amountTokenToMint);
            optionToken = address(newOptionToken);
            s.optionIndexToOptionToken[_duelId][_optionsIndex] = address(newOptionToken);
        } else {
            // OptionToken(optionToken).mint(msg.sender, amountTokenToMint);
            OptionToken(optionToken).mint(_user, amountTokenToMint);
        }

        s.totalBetsOnDuel[_duelId] += amountTokenToMint;
        s.totalBetsOnOption[_duelId][_optionsIndex][_option] += amountTokenToMint;

        emit DuelJoined(
            _duelId,
            duel.topic,
            _option,
            _user,
            optionToken,
            _optionsIndex,
            _amount,
            amountTokenToMint,
            block.timestamp
        );
    }

    /// @notice Allows a user to join an existing duel by placing a wager on one of the options.
    /// @param _duelId The ID of the duel to join.
    /// @param _option The option of the duel.
    /// @param _optionsIndex The option index of the duel.
    /// @param _optionPrice The option price of the duel.
    /// @param _amount The amount of the token to wager in the duel.
    /// @param _user The user address.
    function joinCryptoDuel(
        string memory _duelId,
        string memory _option,
        uint256 _optionsIndex,
        uint256 _optionPrice,
        uint256 _amount,
        address _user
    ) external nonReentrant whenNotPaused onlyBot {
        CryptoDuel storage duel = s.cryptoDuels[_duelId];
        require(s.isValidDuelId[_duelId] && duel.createTime != 0, "Duel ddrawoesn't exist");
        require(duel.duelStatus == DuelStatus.BootStrapped || duel.duelStatus == DuelStatus.Live, "Duel isn't live");
        require(_amount >= _optionPrice, "Less than minimum wager");
        // Transfer the wager amount in USDC to the contract
        require(IERC20(s.usdc).transferFrom(_user, address(this), _amount), "Token transfer failed");

        // Increment wager for the selected topic
        s.totalWagerForOption[_duelId][s.duelIdToOptions[_duelId][_optionsIndex]] += _amount;
        s.duelUsersForOption[_duelId][s.duelIdToOptions[_duelId][_optionsIndex]].push(_user);
        s.userWager[_user][_duelId][s.duelIdToOptions[_duelId][_optionsIndex]] += _amount;
        uint256 amountTokenToMint = (_amount * 1e18) / _optionPrice;
        // @note - zokyo-audit-fix-2
        address optionToken = s.optionIndexToOptionToken[_duelId][_optionsIndex];
        if (optionToken == address(0)) {
            // Deploy a new ERC-20 token contract
            OptionToken newOptionToken = new OptionToken(_option, _option);
            // Mint the specified amount of option tokens to the recipient address
            newOptionToken.mint(_user, amountTokenToMint);
            optionToken = address(newOptionToken);
            s.optionIndexToOptionToken[_duelId][_optionsIndex] = address(newOptionToken);
        } else {
            // OptionToken(optionToken).mint(msg.sender, amountTokenToMint);
            OptionToken(optionToken).mint(_user, amountTokenToMint);
        }

        s.totalBetsOnDuel[_duelId] += amountTokenToMint;
        s.totalBetsOnOption[_duelId][_optionsIndex][_option] += amountTokenToMint;

        emit CryptoDuelJoined(
            _duelId,
            duel.tokenSymbol,
            _option,
            _user,
            optionToken,
            _optionsIndex,
            _amount,
            amountTokenToMint,
            block.timestamp
        );
    }

    /// @notice Starts the duel once the bootstrap period has ended and both sides have met the minimum threshold requirements.
    /// @param _duelId The ID of the duel to be started.
    /// Emits a {DuelStarted} event upon successful execution.
    function startDuel(string memory _duelId) external nonReentrant whenNotPaused onlyBot {
        Duel storage duel = s.duels[_duelId];
        require(s.isValidDuelId[_duelId] && duel.createTime != 0, "Duel doesn't exist");
        // Ensure the duel is not already live
        require(duel.duelStatus == DuelStatus.BootStrapped, "Duel has already started or settled");
        bool _isThresholdMet = IFlashDuelsView(address(this)).checkIfThresholdMet(_duelId);
        require(_isThresholdMet, "Threshold not met");
        // Record the start time and mark the duel as live
        duel.startTime = block.timestamp;
        // uint256 duelDuration = duel.expiryTime - (duel.createTime + bootstrapPeriod);
        uint256 duelDuration = duel.duelDuration == DuelDuration.ThreeHours
            ? 3 hours
            : duel.duelDuration == DuelDuration.SixHours
                ? 6 hours
                : 12 hours;
        duel.expiryTime = block.timestamp + duelDuration;
        duel.duelStatus = DuelStatus.Live;

        emit DuelStarted(_duelId, block.timestamp, duel.expiryTime);
    }
    /// @notice Starts the crypto duel with the specified ID.
    /// @dev Can only be called by the bot when the contract is not paused. Uses nonReentrant for security.
    /// @param _duelId The ID of the duel to start.
    /// @param _startTokenPrice The start price of the token.

    function startCryptoDuel(
        string memory _duelId,
        int256 _startTokenPrice
    ) external nonReentrant whenNotPaused onlyBot {
        CryptoDuel storage cryptoDuel = s.cryptoDuels[_duelId];
        require(s.isValidDuelId[_duelId] && cryptoDuel.createTime != 0, "Duel doesn't exist");
        // Ensure the duel is not already live
        require(cryptoDuel.duelStatus == DuelStatus.BootStrapped, "Duel has already started or settled");
        bool _isThresholdMet = IFlashDuelsView(address(this)).checkIfThresholdMet(_duelId);
        require(_isThresholdMet, "Threshold not met");

        s.startPriceToken[_duelId][cryptoDuel.tokenSymbol] = _startTokenPrice;
        // Record the start time and mark the duel as live
        cryptoDuel.startTime = block.timestamp;
        // uint256 duelDuration = cryptoDuel.expiryTime - (cryptoDuel.createTime + bootstrapPeriod);
        uint256 duelDuration = cryptoDuel.duelDuration == DuelDuration.ThreeHours
            ? 3 hours
            : cryptoDuel.duelDuration == DuelDuration.SixHours
                ? 6 hours
                : 12 hours;
        cryptoDuel.expiryTime = block.timestamp + duelDuration;
        cryptoDuel.duelStatus = DuelStatus.Live;

        emit DuelStarted(_duelId, block.timestamp, cryptoDuel.expiryTime);
    }

    /// @notice Settles the duel after it has expired, distributing the winnings to the correct side.
    /// @param _duelId The ID of the duel to settle.
    /// @param _optionIndex The option index of the duel.
    /// Emits a {DuelSettled} event with the duel ID and the winning topic.
    function settleDuel(string memory _duelId, uint256 _optionIndex) external nonReentrant onlyBot {
        Duel storage duel = s.duels[_duelId];

        // Ensure the duel is live and has expired, but within resolving time
        require(duel.duelStatus == DuelStatus.Live, "Duel not live or already settled");
        uint256 expiryTime = duel.expiryTime;
        require(block.timestamp >= expiryTime, "Duel not expired");
        require(block.timestamp <= expiryTime + s.resolvingPeriod, "Resolving time expired");

        string[] memory options = s.duelIdToOptions[_duelId];
        string memory winningOption = options[_optionIndex];
        uint256 totalWagerLooser;

        // Calculate total wager for losing options
        for (uint256 i = 0; i < options.length; i++) {
            if (i != _optionIndex) {
                totalWagerLooser += s.totalWagerForOption[_duelId][options[i]];
            }
        }

        // Calculate protocol fee, creator fee, and final payout using helper function
        (uint256 protocolFee, uint256 creatorFee, uint256 payout) = _calculateFeesAndPayout(totalWagerLooser);

        // Update accumulated fees
        s.totalProtocolFeesGenerated += protocolFee;
        s.totalCreatorFeeEarned[duel.creator] += creatorFee;

        // Distribute winnings in chunks to prevent out-of-gas errors
        _distributeWinningsInChunks(_duelId, winningOption, _optionIndex, payout);

        // Finalize or signal ongoing distribution
        if (s.distributionCompleted[_duelId]) {
            duel.duelStatus = DuelStatus.Settled;
            emit DuelSettled(_duelId, winningOption, _optionIndex, block.timestamp);
        } else {
            emit PartialDuelSettled(_duelId, winningOption, _optionIndex, block.timestamp);
        }
    }

    /// @notice Continues the distribution of winnings to users based on the winning option in a duel.
    /// @param _duelId The unique identifier of the duel.
    /// @param _optionIndex The index of the option that won the duel.
    /// @param _winningOption The option that was chosen as the winning option.
    /// @param _payout The total amount of winnings to be distributed.
    // @note - zokyo-audit-fix-8
    function continueWinningsDistribution(
        string memory _duelId,
        uint256 _optionIndex,
        string memory _winningOption,
        uint256 _payout
    ) external {
        require(!s.distributionCompleted[_duelId], "Distribution already completed");

        // Continue distribution using the preset winnersChunkSize
        _distributeWinningsInChunks(_duelId, _winningOption, _optionIndex, _payout);

        // Emit event when fully completed
        if (s.distributionCompleted[_duelId]) {
            emit WinningsDistributionCompleted(_duelId, block.timestamp);
        } else {
            emit PartialWinningsDistributed(_duelId, block.timestamp);
        }
    }

    /// @notice Settles the crypto duel with the given ID.
    /// @dev Can only be called by the bot. Uses nonReentrant for security.
    /// @param _duelId The ID of the duel to settle.
    /// @param _endTokenPrice The end token price.
    function settleCryptoDuel(string memory _duelId, int256 _endTokenPrice) external nonReentrant onlyBot {
        // Retrieve the duel and check for status and timing conditions
        CryptoDuel storage cryptoDuel = s.cryptoDuels[_duelId];
        require(cryptoDuel.duelStatus == DuelStatus.Live, "Duel not live or already settled");
        require(block.timestamp >= cryptoDuel.expiryTime, "Duel not expired");
        require(block.timestamp <= cryptoDuel.expiryTime + s.resolvingPeriod, "Resolving time expired");

        // Determine the winning option and total wager of the losing side
        (string memory winningOption, uint256 totalWagerLooser, uint256 optionIndex) = _determineWinningOptionAndWager(
            _duelId,
            _endTokenPrice,
            cryptoDuel
        );
        // Calculate fees and payout for distribution
        (uint256 protocolFee, uint256 creatorFee, uint256 payout) = _calculateFeesAndPayout(totalWagerLooser);
        // Update protocol and creator fee earnings
        s.totalProtocolFeesGenerated += protocolFee;
        s.totalCreatorFeeEarned[cryptoDuel.creator] += creatorFee;

        // Distribute winnings in chunks
        _distributeWinningsInChunks(_duelId, winningOption, optionIndex, payout);

        // Update duel status based on completion of distribution
        if (s.distributionCompleted[_duelId]) {
            s.cryptoDuels[_duelId].duelStatus = DuelStatus.Settled;
            emit DuelSettled(_duelId, winningOption, optionIndex, block.timestamp);
        } else {
            emit PartialDuelSettled(_duelId, winningOption, optionIndex, block.timestamp);
        }
    }

    /// @notice Cancels the duel if the threshold amount is not met after the bootstrap period
    /// @dev This function can only be called by a bot and only after the bootstrap period ends
    /// @param _duelCategory The duel category
    /// @param _duelId The unique ID of the duel to be cancelled
    function cancelDuelIfThresholdNotMet(
        DuelCategory _duelCategory,
        string calldata _duelId
    ) external nonReentrant onlyBot {
        require(s.isValidDuelId[_duelId], "Duel doesn't exist");

        if (_duelCategory != DuelCategory.Crypto) {
            Duel storage duel = s.duels[_duelId];
            // @note - zokyo-audit-fix-20
            require(duel.duelStatus == DuelStatus.BootStrapped, "Duel already started");
            require(block.timestamp >= duel.createTime + s.bootstrapPeriod, "Bootstrap period not ended");
        } else {
            CryptoDuel storage cryptoDuel = s.cryptoDuels[_duelId];
            // @note - zokyo-audit-fix-20
            require(cryptoDuel.duelStatus == DuelStatus.BootStrapped, "Duel already started");
            require(block.timestamp >= cryptoDuel.createTime + s.bootstrapPeriod, "Bootstrap period not ended");
        }

        bool _isThresholdMet = IFlashDuelsView(address(this)).checkIfThresholdMet(_duelId);
        require(!_isThresholdMet, "Threshold met, cannot cancel");

        // Update duel status to Cancelled
        if (_duelCategory != DuelCategory.Crypto) {
            s.duels[_duelId].duelStatus = DuelStatus.Cancelled;
            emit DuelCancelled(_duelId, s.duels[_duelId].startTime, block.timestamp);
        } else {
            s.cryptoDuels[_duelId].duelStatus = DuelStatus.Cancelled;
            emit DuelCancelled(_duelId, s.cryptoDuels[_duelId].startTime, block.timestamp);
        }

        // Initiate refund process
        s.refundInProgress[_duelId] = true;
        s.refundProgress[_duelId] = 0; // Reset progress for this duel

        // Trigger an initial round of refund distribution
        _processRefundsInChunks(_duelId);
    }

    /// @notice Continues the distribution of refunds to users who wagered in a cancelled duel.
    /// @param _duelId The unique identifier of the duel.
    function continueRefundsInChunks(string memory _duelId) external {
        require(s.refundInProgress[_duelId], "Refund distribution already completed");
        _processRefundsInChunks(_duelId);
    }

    /// @notice Withdraws earnings for the caller.
    /// @param _amount The amount to withdraw.
    // @note - zokyo-audit-fix-19 (added nonReentrant modifier)
    function withdrawEarnings(uint256 _amount) external nonReentrant {
        uint256 _allTimeEarnings = s.allTimeEarnings[msg.sender];
        require(_amount <= _allTimeEarnings, "Amount should be less than equal earnings");
        // @note - zokyo-audit-fix-7
        require(IERC20(s.usdc).transfer(msg.sender, _amount), "Transfer failed");
        s.allTimeEarnings[msg.sender] -= _amount;
        emit WithdrawEarning(msg.sender, _amount, block.timestamp);
    }

    /// @notice Withdraws creator fees for the caller.
    function withdrawCreatorFee() external nonReentrant {
        uint256 creatorFee = s.totalCreatorFeeEarned[msg.sender];
        require(creatorFee > 0, "No funds available");
        // @note - zokyo-audit-fix-7
        require(IERC20(s.usdc).transfer(msg.sender, creatorFee), "Transfer failed");
        s.totalCreatorFeeEarned[msg.sender] = 0;
        emit WithdrawCreatorEarning(msg.sender, creatorFee, block.timestamp);
    }
    /// @notice Withdraws protocol fees by the owner.

    function withdrawProtocolFees() external nonReentrant onlyOwner {
        uint256 protocolBalance = s.totalProtocolFeesGenerated;
        require(protocolBalance > 0, "No funds available");
        // @note - zokyo-audit-fix-7
        require(IERC20(s.usdc).transfer(msg.sender, protocolBalance), "Transfer failed");
        s.totalProtocolFeesGenerated = 0;
        emit WithdrawProtocolFee(msg.sender, protocolBalance, block.timestamp);
    }

    // @note - zokyo-audit-fix-12
    // /**
    //  * @notice Fallback function that receives Ether.
    //  */
    // fallback() external payable {}

    // /**
    //  * @notice Receive function that receives Ether.
    //  */
    // receive() external payable {}

    // ========================== Internal Functions ========================== //

    /// @notice Generates a unique duel ID based on user and block details
    /// @dev Uses the user address, block data, and a nonce to generate a unique ID via keccak256 hashing
    /// @param userAddress The address of the user creating the duel
    /// @return duelIdStr A string representing the unique duel ID
    function _generateDuelId(address userAddress) internal returns (string memory) {
        s.nonce++; // Increment nonce to ensure uniqueness

        // Generate a new duel ID using keccak256
        bytes32 newId = keccak256(
            abi.encodePacked(block.timestamp, block.prevrandao, userAddress, s.nonce, blockhash(block.number - 1))
        );

        // Convert the bytes32 ID to a string
        string memory duelIdStr = toHexString(newId);

        // Ensure the generated ID is unique
        require(!s.isValidDuelId[duelIdStr], "ID collision detected");

        // Mark the ID as used
        s.isValidDuelId[duelIdStr] = true;

        return duelIdStr;
    }

    /// @notice Converts a bytes32 value to its hexadecimal string representation
    /// @dev Used for converting the keccak256 hash to a readable string
    /// @param _bytes The bytes32 value to be converted to a string
    /// @return A string representing the hexadecimal version of the bytes32 input
    function toHexString(bytes32 _bytes) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(64); // Each byte takes 2 hex characters (32 bytes = 64 hex characters)
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2] = hexChars[uint8(_bytes[i] >> 4)]; // First nibble (4 bits)
            str[1 + i * 2] = hexChars[uint8(_bytes[i] & 0x0f)]; // Second nibble (4 bits)
        }

        return string(str);
    }

    /// @notice Distributes winnings in chunks to the winners of a specific duel.
    /// @dev This function allows the distribution of the total payout to be executed in smaller, manageable chunks. It ensures that no winner is skipped and the distribution continues from where it last left off. The chunk size is determined by the preset value `winnersChunkSize`. The distribution progress is tracked and updated to enable continuation.
    /// @param _duelId The unique identifier of the duel.
    /// @param _winningOption The option that won the duel.
    /// @param _optionIndex The index of the winning option.
    /// @param _payout The total payout amount to be distributed to the winners.
    // @note - zokyo-audit-fix-8
    function _distributeWinningsInChunks(
        string memory _duelId,
        string memory _winningOption,
        uint256 _optionIndex,
        uint256 _payout
    ) internal {
        address[] storage winners = s.duelUsersForOption[_duelId][_winningOption];
        uint256 totalWinningWagers = s.totalWagerForOption[_duelId][_winningOption];
        uint256 winningOptionPoolBalance = totalWinningWagers + _payout;

        // Define the starting index based on progress to allow continuation in chunks
        uint256 startIndex = s.distributionProgress[_duelId];
        uint256 endIndex = startIndex + s.winnersChunkSize;

        // Ensure the end index does not exceed the array length
        if (endIndex > winners.length) {
            endIndex = winners.length;
        }

        // Distribute winnings to winners within the defined chunk
        for (uint256 i = startIndex; i < endIndex; i++) {
            address winner = winners[i];
            uint256 winnerShare = IFlashDuelsView(address(this)).getUserDuelOptionShare(_duelId, _optionIndex, winner);
            uint256 winnerWinningTokenAmount = (winnerShare * winningOptionPoolBalance) / 1e18;

            s.allTimeEarnings[winner] += winnerWinningTokenAmount;
        }

        // Update progress and check if distribution is complete
        s.distributionProgress[_duelId] = endIndex;
        if (endIndex == winners.length) {
            s.distributionCompleted[_duelId] = true;
        }
    }
    /// @notice Internal function to process refund distribution in chunks for a cancelled duel.
    /// @param _duelId The unique identifier of the duel.

    function _processRefundsInChunks(string memory _duelId) internal {
        uint256 optionsLength = s.duelIdToOptions[_duelId].length;
        uint256 processedCount = 0;

        for (uint256 i = s.refundProgress[_duelId]; i < optionsLength && processedCount < s.refundChunkSize; i++) {
            string memory option = s.duelIdToOptions[_duelId][i];
            address[] memory participants = s.duelUsersForOption[_duelId][option];

            for (uint256 j = 0; j < participants.length && processedCount < s.refundChunkSize; j++) {
                address participant = participants[j];
                uint256 wager = s.userWager[participant][_duelId][option];

                if (wager > 0) {
                    s.userWager[participant][_duelId][option] = 0;
                    // @note - zokyo-audit-fix-7
                    require(IERC20(s.usdc).transfer(participant, wager), "Transfer failed");

                    emit RefundIssued(_duelId, option, participant, wager, block.timestamp);
                    processedCount++;
                }
            }
        }

        // Update refund progress
        s.refundProgress[_duelId] += processedCount;

        // Check if all refunds are completed
        if (s.refundProgress[_duelId] >= optionsLength) {
            s.refundInProgress[_duelId] = false;
            emit RefundsDistributionCompleted(_duelId, block.timestamp);
        } else {
            emit PartialRefundsDistributed(_duelId, block.timestamp);
        }
    }

    /// @notice Determines the winning option based on the duel's trigger condition and end token price.
    /// @param _duelId The unique identifier of the duel.
    /// @param _endTokenPrice The ending price of the token, which will determine the duel's outcome.
    /// @param cryptoDuel The duel configuration containing trigger type, value, and condition.
    /// @return winningOption The name of the winning option.
    /// @return totalWagerLooser The total wager amount for the losing option.
    /// @return optionIndex The index of the winning option in the options array.
    function _determineWinningOptionAndWager(
        string memory _duelId,
        int256 _endTokenPrice,
        CryptoDuel storage cryptoDuel
    ) internal view returns (string memory winningOption, uint256 totalWagerLooser, uint256 optionIndex) {
        string[] memory _options = s.duelIdToOptions[_duelId];
        int256 _triggerValue = cryptoDuel.triggerValue;

        if (cryptoDuel.triggerType == TriggerType.Absolute) {
            if (cryptoDuel.triggerCondition == TriggerCondition.Above) {
                winningOption = _endTokenPrice > _triggerValue ? _options[0] : _options[1];
                optionIndex = _endTokenPrice > _triggerValue ? 0 : 1;
                totalWagerLooser = s.totalWagerForOption[_duelId][_options[1]];
            } else if (cryptoDuel.triggerCondition == TriggerCondition.Below) {
                winningOption = _endTokenPrice > _triggerValue ? _options[1] : _options[0];
                optionIndex = _endTokenPrice > _triggerValue ? 1 : 0;
                totalWagerLooser = s.totalWagerForOption[_duelId][_options[0]];
            }
        }
        // @note - TriggerType.Percentage can be implemented here when supported
        return (winningOption, totalWagerLooser, optionIndex);
    }

    /// @notice Calculates the protocol fee, creator fee, and the payout amount.
    /// @param totalWagerLooser The total wager amount from the losing side, which will be used to calculate fees.
    /// @return protocolFee The fee collected by the protocol.
    /// @return creatorFee The fee collected by the creator.
    /// @return payout The remaining amount after fees, which is distributed to the winning side.
    /// @dev This function is a helper to keep the main duel settlement function cleaner and modular.
    function _calculateFeesAndPayout(
        uint256 totalWagerLooser
    ) internal view returns (uint256 protocolFee, uint256 creatorFee, uint256 payout) {
        protocolFee = (totalWagerLooser * s.protocolFeePercentage) / 10000;
        creatorFee = (totalWagerLooser * s.creatorFeePercentage) / 10000;
        payout = totalWagerLooser - protocolFee - creatorFee;
        return (protocolFee, creatorFee, payout);
    }
}

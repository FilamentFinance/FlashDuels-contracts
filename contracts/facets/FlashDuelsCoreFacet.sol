// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AppStorage, Duel, CryptoDuel, DuelCategory, DuelDuration, TriggerType, TriggerCondition, DuelStatus, ParticipationTokenType, CreateDuelRequested, PendingDuel, DuelJoined, CryptoDuelJoined, DuelStarted, DuelSettled, DuelCancelled, RefundIssued, WithdrawEarning, WithdrawCreatorEarning, CreateDuelFeeUpdated, PartialDuelSettled, PartialWinningsDistributed, WinningsDistributionCompleted, PartialRefundsDistributed, RefundsDistributionCompleted, CryptoDuelCreated, DuelApprovedAndCreated, FlashDuels__InvalidBot} from "../AppStorage.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFlashDuelsView} from "../interfaces/IFlashDuelsView.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LibFlashDuels} from "../libraries/LibFlashDuels.sol";
import {OptionToken} from "../OptionToken.sol";

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

    /// @notice Approves USDC and stores duel parameters for later creation
    /// @param _category The category of the duel
    /// @param _topic The topic or description of the duel
    /// @param _options Array of options for the duel
    /// @param _duelDuration The duration of the duel
    /// @return success boolean indicating if the approval and parameter storage was successful
    function requestCreateDuel(
        DuelCategory _category,
        string memory _topic,
        string[] memory _options,
        DuelDuration _duelDuration
    ) external nonReentrant whenNotPaused returns (bool) {
        require(_category != DuelCategory.Crypto, "Should not crypto category duel");
        require(_duelDuration >= DuelDuration.OneHour, "Duel duration must be at least one hour");

        // Transfer USDC fee upfront
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(IERC20(s.usdc).transferFrom(msg.sender, address(this), s.createDuelFee), "USDC transfer failed");
        } else {
            require(IERC20(s.credits).transferFrom(msg.sender, address(this), s.createDuelFee), "Credits transfer failed");
        }

        PendingDuel memory pendingDuel = PendingDuel({
            creator: msg.sender,
            category: _category,
            topic: _topic,
            options: _options,
            duration: _duelDuration,
            isApproved: false,
            usdcAmount: s.createDuelFee
        });

        s.pendingDuels[msg.sender][_category].push(pendingDuel);
        s.allPendingDuels.push(pendingDuel);

        emit CreateDuelRequested(msg.sender, _category, _topic, _duelDuration, s.createDuelFee, block.timestamp);
        return true;
    }

    /// @notice Approves USDC and stores crypto duel parameters for later creation
    /// @param _tokenSymbol Allowed token symbol for wagering
    /// @param _options Betting options for the duel
    /// @param _triggerValue Value that triggers the outcome
    /// @param _triggerType Type of trigger (e.g., absolute, percentage)
    /// @param _triggerCondition Condition for triggering (e.g., above, below)
    /// @param _duelDuration Duration of the duel
    /// @return success boolean indicating if the approval and parameter storage was successful
    function requestCreateCryptoDuel(
        string memory _tokenSymbol,
        string[] memory _options,
        int256 _triggerValue,
        TriggerType _triggerType,
        TriggerCondition _triggerCondition,
        DuelDuration _duelDuration
    ) external nonReentrant whenNotPaused returns (string memory) {
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(IERC20(s.usdc).transferFrom(msg.sender, address(this), s.createDuelFee), "USDC transfer failed");
        } else {
            require(IERC20(s.credits).transferFrom(msg.sender, address(this), s.createDuelFee), "Credits transfer failed");
        }
        // PendingCryptoDuel memory pendingCryptoDuel = PendingCryptoDuel({
        //     creator: msg.sender,
        //     category: DuelCategory.Crypto,
        //     tokenSymbol: _tokenSymbol,
        //     options: _options,
        //     duration: _duelDuration,
        //     isApproved: false,
        //     usdcAmount: s.createDuelFee,
        //     triggerValue: _triggerValue,
        //     triggerType: _triggerType,
        //     triggerCondition: _triggerCondition
        // });
        // s.pendingCryptoDuels[msg.sender].push(pendingCryptoDuel);
        // s.allPendingCryptoDuels.push(pendingCryptoDuel);
        emit CreateDuelRequested(
            msg.sender,
            DuelCategory.Crypto,
            _tokenSymbol,
            _duelDuration,
            s.createDuelFee,
            block.timestamp
        );

        string memory duelId = _createCryptoDuel(
            msg.sender,
            _tokenSymbol,
            _options,
            _triggerValue,
            _triggerType,
            _triggerCondition,
            _duelDuration
        );
        emit DuelApprovedAndCreated(
            msg.sender,
            duelId,
            DuelCategory.Crypto,
            _tokenSymbol,
            _duelDuration,
            block.timestamp
        );
        return duelId;
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
        LibFlashDuels.LibFlashDuelsAppStorage storage libFlashDuelsStorage = LibFlashDuels.appStorage();
        require(libFlashDuelsStorage.isValidDuelId[_duelId] && duel.createTime != 0, "Duel doesn't exist");
        require(duel.category != DuelCategory.Crypto, "Should not a crypto duel");
        require(duel.duelStatus == DuelStatus.BootStrapped || duel.duelStatus == DuelStatus.Live, "Duel isn't live");
        require(_amount >= _optionPrice, "Less than minimum wager");
        // Transfer the wager amount in USDC to the contract
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(IERC20(s.usdc).transferFrom(_user, address(this), _amount), "Token transfer failed");
        } else {
            require(IERC20(s.credits).transferFrom(_user, address(this), _amount), "Token transfer failed");
        }

        string memory option = s.duelIdToOptions[_duelId][_optionsIndex];
        // Increment wager for the selected topic
        s.totalWagerForOption[_duelId][option] += _amount;
        s.userWager[_user][_duelId][option] += _amount;

        uint256 amountTokenToMint = (_amount * 1e18) / _optionPrice;

        if (!s.userExistsInOption[_duelId][option][_user]) {
            // Push user to the array
            s.duelUsersForOption[_duelId][option].push(_user);
            // Update participantIndices with a 1-based index
            uint256 userIndex = s.duelUsersForOption[_duelId][option].length; // 1-based index
            s.participantIndices[_duelId][option][_user] = userIndex;
            // Mark user as added
            s.userExistsInOption[_duelId][option][_user] = true;
        }

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
        LibFlashDuels.LibFlashDuelsAppStorage storage libFlashDuelsStorage = LibFlashDuels.appStorage();
        require(libFlashDuelsStorage.isValidDuelId[_duelId] && duel.createTime != 0, "Duel doesn't exist");
        require(duel.duelStatus == DuelStatus.BootStrapped || duel.duelStatus == DuelStatus.Live, "Duel isn't live");
        require(_amount >= _optionPrice, "Less than minimum wager");
        // Transfer the wager amount in USDC to the contract
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(IERC20(s.usdc).transferFrom(_user, address(this), _amount), "Token transfer failed");
        } else {
            require(IERC20(s.credits).transferFrom(_user, address(this), _amount), "Token transfer failed");
        }

        string memory option = s.duelIdToOptions[_duelId][_optionsIndex];
        // Increment wager for the selected topic
        s.totalWagerForOption[_duelId][option] += _amount;
        s.userWager[_user][_duelId][option] += _amount;

        uint256 amountTokenToMint = (_amount * 1e18) / _optionPrice;

        if (!s.userExistsInOption[_duelId][option][_user]) {
            // Push user to the array
            s.duelUsersForOption[_duelId][option].push(_user);
            // Update participantIndices with a 1-based index
            uint256 userIndex = s.duelUsersForOption[_duelId][option].length; // 1-based index
            s.participantIndices[_duelId][option][_user] = userIndex;
            // Mark user as added
            s.userExistsInOption[_duelId][option][_user] = true;
        }
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
        LibFlashDuels.LibFlashDuelsAppStorage storage libFlashDuelsStorage = LibFlashDuels.appStorage();
        require(libFlashDuelsStorage.isValidDuelId[_duelId] && duel.createTime != 0, "Duel doesn't exist");
        // Ensure the duel is not already live
        require(duel.duelStatus == DuelStatus.BootStrapped, "Duel has already started or settled");
        bool _isThresholdMet = IFlashDuelsView(address(this)).checkIfThresholdMet(_duelId);
        require(_isThresholdMet, "Threshold not met");
        // Record the start time and mark the duel as live
        duel.startTime = block.timestamp;
        // uint256 duelDuration = duel.expiryTime - (duel.createTime + bootstrapPeriod);
        uint256 duelDuration = duel.duelDuration == DuelDuration.OneHour
            ? 1 hours
            : duel.duelDuration == DuelDuration.ThreeHours
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
        LibFlashDuels.LibFlashDuelsAppStorage storage libFlashDuelsStorage = LibFlashDuels.appStorage();
        require(libFlashDuelsStorage.isValidDuelId[_duelId] && cryptoDuel.createTime != 0, "Duel doesn't exist");
        // Ensure the duel is not already live
        require(cryptoDuel.duelStatus == DuelStatus.BootStrapped, "Duel has already started or settled");
        if (cryptoDuel.duelDuration > DuelDuration.ThirtyMinutes) {
            bool _isThresholdMet = IFlashDuelsView(address(this)).checkIfThresholdMet(_duelId);
            require(_isThresholdMet, "Threshold not met");
        }

        s.startPriceToken[_duelId][cryptoDuel.tokenSymbol] = _startTokenPrice;
        // Record the start time and mark the duel as live
        cryptoDuel.startTime = block.timestamp;
        // uint256 duelDuration = cryptoDuel.expiryTime - (cryptoDuel.createTime + bootstrapPeriod);
        uint256 duelDuration = cryptoDuel.duelDuration == DuelDuration.FiveMinutes
            ? 5 minutes
            : cryptoDuel.duelDuration == DuelDuration.FifteenMinutes
                ? 15 minutes
                : cryptoDuel.duelDuration == DuelDuration.ThirtyMinutes
                    ? 30 minutes
                    : cryptoDuel.duelDuration == DuelDuration.OneHour
                        ? 1 hours
                        : cryptoDuel.duelDuration == DuelDuration.ThreeHours
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
        s.totalWinningOptionPayout[_duelId][_optionIndex][winningOption] = payout;
        _distributeWinningsInChunks(_duelId, winningOption, _optionIndex, payout);

        // Finalize or signal ongoing distribution
        if (s.distributionCompleted[_duelId]) {
            duel.duelStatus = DuelStatus.Settled;
            emit WinningsDistributionCompleted(_duelId, block.timestamp);
            emit DuelSettled(_duelId, winningOption, _optionIndex, block.timestamp);
        } else {
            emit PartialWinningsDistributed(_duelId, block.timestamp);
            emit PartialDuelSettled(_duelId, winningOption, _optionIndex, block.timestamp);
        }
    }

    /// @notice Continues the distribution of winnings to users based on the winning option in a duel.
    /// @param _duelId The unique identifier of the duel.
    /// @param _optionIndex The index of the option that won the duel.
    /// @param _winningOption The option that was chosen as the winning option.
    function continueWinningsDistribution(
        string memory _duelId,
        uint256 _optionIndex,
        string memory _winningOption
    ) external {
        require(!s.distributionCompleted[_duelId], "Distribution already completed");
        uint256 _payout = s.totalWinningOptionPayout[_duelId][_optionIndex][_winningOption];
        require(_payout > 0, "No payout to distribute");
        // Continue distribution using the preset winnersChunkSize
        _distributeWinningsInChunks(_duelId, _winningOption, _optionIndex, _payout);

        // Emit event when fully completed
        if (s.distributionCompleted[_duelId]) {
            emit WinningsDistributionCompleted(_duelId, block.timestamp);
            emit DuelSettled(_duelId, _winningOption, _optionIndex, block.timestamp);
        } else {
            emit PartialWinningsDistributed(_duelId, block.timestamp);
            emit PartialDuelSettled(_duelId, _winningOption, _optionIndex, block.timestamp);
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
        s.totalWinningOptionPayout[_duelId][optionIndex][winningOption] = payout;
        _distributeWinningsInChunks(_duelId, winningOption, optionIndex, payout);

        // Update duel status based on completion of distribution
        if (s.distributionCompleted[_duelId]) {
            s.cryptoDuels[_duelId].duelStatus = DuelStatus.Settled;
            emit WinningsDistributionCompleted(_duelId, block.timestamp);
            emit DuelSettled(_duelId, winningOption, optionIndex, block.timestamp);
        } else {
            emit PartialWinningsDistributed(_duelId, block.timestamp);
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
        LibFlashDuels.LibFlashDuelsAppStorage storage libFlashDuelsStorage = LibFlashDuels.appStorage();
        require(libFlashDuelsStorage.isValidDuelId[_duelId], "Duel doesn't exist");

        if (_duelCategory != DuelCategory.Crypto) {
            Duel storage duel = s.duels[_duelId];
            require(duel.duelStatus == DuelStatus.BootStrapped, "Duel already started");
            require(block.timestamp >= duel.createTime + s.bootstrapPeriod, "Bootstrap period not ended");
        } else {
            CryptoDuel storage cryptoDuel = s.cryptoDuels[_duelId];
            require(cryptoDuel.duelStatus == DuelStatus.BootStrapped, "Duel already started");
            require(block.timestamp >= cryptoDuel.createTime + s.bootstrapPeriod, "Bootstrap period not ended");
        }

        bool _isThresholdMet = IFlashDuelsView(address(this)).checkIfThresholdMet(_duelId);
        require(!_isThresholdMet, "Threshold met, cannot cancel");

        // Update duel status to Cancelled
        if (_duelCategory != DuelCategory.Crypto) {
            s.duels[_duelId].duelStatus = DuelStatus.Cancelled;
            emit DuelCancelled(_duelId, s.duels[_duelId].createTime, block.timestamp);
        } else {
            s.cryptoDuels[_duelId].duelStatus = DuelStatus.Cancelled;
            emit DuelCancelled(_duelId, s.cryptoDuels[_duelId].createTime, block.timestamp);
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
    function withdrawEarnings(uint256 _amount) external nonReentrant {
        uint256 _allTimeEarnings = s.allTimeEarnings[msg.sender];
        require(_amount <= _allTimeEarnings, "Amount should be less than equal earnings");
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(IERC20(s.usdc).transfer(msg.sender, _amount), "Transfer failed");
        } else {
            require(IERC20(s.credits).transfer(msg.sender, _amount), "Transfer failed");
        }
        s.allTimeEarnings[msg.sender] -= _amount;
        emit WithdrawEarning(msg.sender, _amount, block.timestamp);
    }

    /// @notice Withdraws creator fees for the caller.
    function withdrawCreatorFee() external nonReentrant {
        uint256 creatorFee = s.totalCreatorFeeEarned[msg.sender];
        require(creatorFee > 0, "No funds available");
        if (s.participationTokenType == ParticipationTokenType.USDC) {
            require(IERC20(s.usdc).transfer(msg.sender, creatorFee), "Transfer failed");
        } else {
            require(IERC20(s.credits).transfer(msg.sender, creatorFee), "Transfer failed");
        }
        s.totalCreatorFeeEarned[msg.sender] = 0;
        emit WithdrawCreatorEarning(msg.sender, creatorFee, block.timestamp);
    }

    // ========================== Internal Functions ========================== //

    /// @notice Internal function to create a new crypto duel
    /// @param _user Address of the user
    /// @param _tokenSymbol Allowed token symbol for wagering
    /// @param _options Betting options for the duel
    /// @param _triggerValue Value that triggers the outcome
    /// @param _triggerType Type of trigger (e.g., absolute, percentage)
    /// @param _triggerCondition Condition for triggering (e.g., above, below)
    /// @param _duelDuration Duration of the duel
    /// @return Duel ID as a string
    function _createCryptoDuel(
        address _user,
        string memory _tokenSymbol,
        string[] memory _options,
        int256 _triggerValue,
        TriggerType _triggerType,
        TriggerCondition _triggerCondition,
        DuelDuration _duelDuration
    ) internal returns (string memory) {
        s.totalProtocolFeesGenerated = s.totalProtocolFeesGenerated + s.createDuelFee;
        require(
            _duelDuration == DuelDuration.FiveMinutes ||
                _duelDuration == DuelDuration.FifteenMinutes ||
                _duelDuration == DuelDuration.ThirtyMinutes ||
                _duelDuration == DuelDuration.OneHour ||
                _duelDuration == DuelDuration.ThreeHours ||
                _duelDuration == DuelDuration.SixHours ||
                _duelDuration == DuelDuration.TwelveHours,
            "Invalid duel duration"
        );

        string memory _duelId = LibFlashDuels._generateDuelId(_user);
        CryptoDuel storage duel = s.cryptoDuels[_duelId];
        duel.creator = _user;
        duel.tokenSymbol = _tokenSymbol;
        duel.createTime = block.timestamp;
        duel.duelDuration = _duelDuration;
        duel.triggerValue = _triggerValue;
        duel.triggerType = _triggerType;
        duel.triggerCondition = _triggerCondition;
        duel.duelStatus = DuelStatus.BootStrapped;
        s.duelIdToOptions[_duelId] = _options;
        s.creatorToDuelIds[_user].push(_duelId);

        emit CryptoDuelCreated(
            _user,
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

    /// @notice Distributes winnings in chunks to the winners of a specific duel.
    /// @dev This function allows the distribution of the total payout to be executed in smaller, manageable chunks. It ensures that no winner is skipped and the distribution continues from where it last left off. The chunk size is determined by the preset value `winnersChunkSize`. The distribution progress is tracked and updated to enable continuation.
    /// @param _duelId The unique identifier of the duel.
    /// @param _winningOption The option that won the duel.
    /// @param _optionIndex The index of the winning option.
    /// @param _payout The total payout amount to be distributed to the winners.
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
            s.totalWinningOptionPayout[_duelId][_optionIndex][_winningOption] = 0;
            s.totalWagerForOption[_duelId][_winningOption] = 0;
            delete s.duelUsersForOption[_duelId][_winningOption];
        }
    }
    /// @notice Internal function to process refund distribution in chunks for a cancelled duel.
    /// @param _duelId The unique identifier of the duel.

    function _processRefundsInChunks(string memory _duelId) internal {
        uint256 optionsLength = s.duelIdToOptions[_duelId].length;
        uint256 processedCount = 0;
        uint256 totalParticipants = 0;

        // Calculate the total number of participants across all options
        for (uint256 i = 0; i < optionsLength; i++) {
            string memory option = s.duelIdToOptions[_duelId][i];
            totalParticipants += s.duelUsersForOption[_duelId][option].length;
        }

        // Track the total number of participants processed
        uint256 totalProcessed = s.refundProgress[_duelId];

        for (uint256 i = 0; i < optionsLength && processedCount < s.refundChunkSize; i++) {
            string memory option = s.duelIdToOptions[_duelId][i];
            address[] memory participants = s.duelUsersForOption[_duelId][option];
            for (uint256 j = 0; j < participants.length && processedCount < s.refundChunkSize; j++) {
                if (totalProcessed > 0) {
                    totalProcessed--;
                    continue;
                }

                address participant = participants[j];
                uint256 wager = s.userWager[participant][_duelId][option];

                if (wager > 0) {
                    s.userWager[participant][_duelId][option] = 0;
                    if (s.participationTokenType == ParticipationTokenType.USDC) {
                        require(IERC20(s.usdc).transfer(participant, wager), "Transfer failed");
                    } else {
                        require(IERC20(s.credits).transfer(participant, wager), "Transfer failed");
                    }

                    emit RefundIssued(_duelId, option, participant, wager, block.timestamp);
                    processedCount++;
                }
            }
        }

        // Update refund progress
        s.refundProgress[_duelId] += processedCount;

        // Check if all refunds are completed
        if (s.refundProgress[_duelId] >= totalParticipants) {
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

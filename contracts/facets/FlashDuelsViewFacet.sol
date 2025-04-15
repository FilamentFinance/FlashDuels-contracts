// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AppStorage, Duel, CryptoDuel, Sale, PendingDuel, DuelCategory, ParticipationTokenType} from "../AppStorage.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibFlashDuels} from "../libraries/LibFlashDuels.sol";

/// @title FlashDuelsViewFacet
/// @author FlashDuels
/// @notice Provides view functions to access and retrieve FlashDuels data.
/// @dev This contract is part of the FlashDuels system and allows for reading various stored values.
contract FlashDuelsViewFacet is PausableUpgradeable {
    using LibFlashDuels for LibFlashDuels.LibFlashDuelsAppStorage;
    AppStorage internal s;

    /// @notice Checks if the minimum threshold for all options in a duel has been met.
    /// @param _duelId The unique identifier of the duel to check.
    /// @return Returns true if the threshold is met for each option in the duel, otherwise false.
    function checkIfThresholdMet(string calldata _duelId) public view returns (bool) {
        uint256 optionsLength = s.duelIdToOptions[_duelId].length;
        uint256 totalWager = 0;

        for (uint256 i = 0; i < optionsLength; i++) {
            totalWager += s.totalWagerForOption[_duelId][s.duelIdToOptions[_duelId][i]];
        }

        // Check if the total wager meets the minimum threshold
        return totalWager >= s.minThreshold;
    }

    /// @notice Retrieves the list of duel IDs created by a specified address.
    /// @param _address The address of the duel creator.
    /// @return An array of duel IDs associated with the specified creator.
    function getCreatorToDuelIds(address _address) public view returns (string[] memory) {
        return s.creatorToDuelIds[_address];
    }

    /// @notice Retrieves the betting options associated with a specific duel.
    /// @param _duelId The unique identifier of the duel.
    /// @return An array of option strings for the specified duel.
    function getDuelIdToOptions(string memory _duelId) public view returns (string[] memory) {
        return s.duelIdToOptions[_duelId];
    }

    /// @notice Retrieves the token address for a specific option in a duel.
    /// @param _duelId The unique identifier of the duel.
    /// @param _optionIndex The index of the option within the duel.
    /// @return The address of the token associated with the specified option.
    function getOptionIndexToOptionToken(string memory _duelId, uint256 _optionIndex) public view returns (address) {
        return s.optionIndexToOptionToken[_duelId][_optionIndex];
    }

    /// @notice Retrieves the users who selected a specific option in a duel.
    /// @param _duelId The unique identifier of the duel.
    /// @param _option The option selected by users in the duel.
    /// @return An array of addresses representing users who chose the specified option.
    function getDuelUsersForOption(
        string memory _duelId,
        string memory _option
    ) public view returns (address[] memory) {
        return s.duelUsersForOption[_duelId][_option];
    }

    /// @notice Retrieves the share of a user for a specific option in a duel.
    /// @dev Allows external contracts or users to query a user's share in a given duel option.
    /// @param _duelId The unique identifier of the duel.
    /// @param _optionIndex The index of the option within the duel.
    /// @param _user The address of the user whose share is being queried.
    /// @return optionShare The share of the user in the specified option, represented as a percentage.
    function getUserDuelOptionShare(
        string memory _duelId,
        uint256 _optionIndex,
        address _user
    ) public view returns (uint256 optionShare) {
        address optionToken = s.optionIndexToOptionToken[_duelId][_optionIndex];
        uint256 optionTokenBalance = IERC20(optionToken).balanceOf(_user);
        uint256 totalOptionTokenSupply = IERC20(optionToken).totalSupply();
        optionShare = (optionTokenBalance * 1e18) / totalOptionTokenSupply;
    }

    /// @notice Retrieves the wager amounts deposited by a user in a duel.
    /// @param _duelId The unique identifier of the duel.
    /// @param _user The address of the user whose wagers are being queried.
    /// @return _optionsLength The number of options in the duel.
    /// @return _options An array of options available in the duel.
    /// @return _wagerAmountsForOptions An array of wager amounts corresponding to each option.
    function getWagerAmountDeposited(
        string memory _duelId,
        address _user
    ) public view returns (uint256 _optionsLength, string[] memory _options, uint256[] memory _wagerAmountsForOptions) {
        _optionsLength = s.duelIdToOptions[_duelId].length;
        _options = s.duelIdToOptions[_duelId];
        _wagerAmountsForOptions = new uint256[](_optionsLength);
        for (uint256 i = 0; i < _optionsLength; i++) {
            _wagerAmountsForOptions[i] = s.userWager[_user][_duelId][_options[i]];
        }
    }

    /// @notice Retrieves the allowed token symbol for a specific duel.
    /// @param _duelId The unique identifier of the duel.
    /// @return A string representing the token symbol associated with the specified duel.
    function getDuelIdToTokenSymbol(string memory _duelId) public view returns (string memory) {
        CryptoDuel memory cryptoDuel = s.cryptoDuels[_duelId];
        return cryptoDuel.tokenSymbol;
    }

    /// @notice Retrieves detailed information about a duel.
    /// @param _duelId The unique identifier of the duel.
    /// @return A Duel struct containing all details of the specified duel.
    function getDuel(string memory _duelId) public view returns (Duel memory) {
        return s.duels[_duelId];
    }

    /// @notice Retrieves detailed information about a crypto duel.
    /// @param _duelId The unique identifier of the crypto duel.
    /// @return A CryptoDuel struct containing all details of the specified crypto duel.
    function getCryptoDuel(string memory _duelId) public view returns (CryptoDuel memory) {
        return s.cryptoDuels[_duelId];
    }

    /// @notice Calculates the price delta for a specific token in a duel.
    /// @param _duelId The unique identifier of the duel.
    /// @param _tokenSymbol The symbol of the token to calculate the delta for.
    /// @param _currentOraclePrice The current oracle price of the token.
    /// @return endPrice The end price of the token as per the current oracle.
    /// @return startPrice The starting price of the token recorded at the start of the duel.
    /// @return delta The difference between the end and start prices of the token.
    /// @return isEndPriceGreater True if the end price is greater than the start price.
    function getPriceDelta(
        string memory _duelId,
        string memory _tokenSymbol,
        int256 _currentOraclePrice
    ) public view returns (int256 endPrice, int256 startPrice, int256 delta, bool isEndPriceGreater) {
        endPrice = _currentOraclePrice;
        startPrice = s.startPriceToken[_duelId][_tokenSymbol];
        delta = endPrice - startPrice;
        isEndPriceGreater = endPrice > startPrice;
    }

    /// @notice Retrieves the details of a specific duel by ID.
    /// @param _duelId The unique identifier of the duel to retrieve.
    /// @return The `Duel` struct containing all information about the specified duel.
    function getDuels(string memory _duelId) public view returns (Duel memory) {
        return s.duels[_duelId];
    }

    /// @notice Retrieves the details of a specific sale.
    /// @param optionToken The address of the option token.
    /// @param saleId The unique identifier of the sale.
    /// @return The `Sale` struct containing all information about the specified sale.
    function getSales(address optionToken, uint256 saleId) public view returns (Sale memory) {
        return s.sales[optionToken][saleId];
    }

    /// @notice Fetches the all-time earnings of a specific user.
    /// @param _user The address of the user whose all-time earnings are requested.
    /// @return The total earnings of the user from all duels.
    function getAllTimeEarnings(address _user) public view returns (uint256) {
        return s.allTimeEarnings[_user];
    }

    /// @notice Retrieves the total amount of bets placed on a specific option in a duel.
    /// @param _duelId The unique identifier of the duel.
    /// @param _optionsIndex The index of the option within the duel.
    /// @param _option The specific option to retrieve the total bets for.
    /// @return The total amount of bets placed on the specified option.
    function getTotalBetsOnOption(
        string memory _duelId,
        uint256 _optionsIndex,
        string memory _option
    ) public view returns (uint256) {
        return s.totalBetsOnOption[_duelId][_optionsIndex][_option];
    }

    /// @notice Checks if a duel ID is valid within the system.
    /// @param _duelId The duel ID to validate.
    /// @return True if the duel ID is valid; otherwise, false.
    function isValidDuelId(string memory _duelId) public view returns (bool) {
        LibFlashDuels.LibFlashDuelsAppStorage storage libFlashDuelsStorage = LibFlashDuels.appStorage();
        return libFlashDuelsStorage.isValidDuelId[_duelId];
    }

    /// @notice Checks if the refund distribution is in progress for a specific duel.
    /// @param _duelId The unique identifier of the duel.
    /// @return A boolean indicating whether the refund distribution is in progress.
    function isRefundInProgress(string memory _duelId) public view returns (bool) {
        return s.refundInProgress[_duelId];
    }

    /// @notice Retrieves the address of the protocol's treasury.
    /// @return The address designated as the protocol's treasury.
    function getProtocolTreasury() public view returns (address) {
        return s.protocolTreasury;
    }

    /// @notice Fetches the total protocol fees generated across all duels.
    /// @return The cumulative protocol fees collected.
    function getTotalProtocolFeesGenerated() public view returns (uint256) {
        return s.totalProtocolFeesGenerated;
    }

    /// @notice Retrieves the total creator fees earned by a specific creator.
    /// @param _creator The address of the creator whose fees are requested.
    /// @return The total fees earned by the creator across all duels.
    function getCreatorFeesEarned(address _creator) public view returns (uint256) {
        return s.totalCreatorFeeEarned[_creator];
    }

    /// @notice Retrieves the pending duels for a specific user and category.
    /// @param _user The address of the user whose pending duels are requested.
    /// @param _category The category of duels to retrieve.
    /// @return pendingDuels An array of pending duels.
    /// @return pendingDuelsLength The number of pending duels.
    function getPendingDuels(
        address _user,
        DuelCategory _category
    ) public view returns (PendingDuel[] memory, uint256 pendingDuelsLength) {
        PendingDuel[] memory pendingDuels = s.pendingDuels[_user][_category];
        pendingDuelsLength = pendingDuels.length;
        return (pendingDuels, pendingDuelsLength);
    }

    /// @notice Retrieves a pending duel by index for a specific user and category.
    /// @param _user The address of the user whose pending duel is requested.
    /// @param _category The category of duels to retrieve.
    /// @param _index The index of the pending duel to retrieve.
    /// @return pendingDuel The pending duel at the specified index.
    function getPendingDuelByIndex(
        address _user,
        DuelCategory _category,
        uint256 _index
    ) public view returns (PendingDuel memory) {
        return s.pendingDuels[_user][_category][_index];
    }

    /// @notice Retrieves all pending duels and their count.
    /// @return allPendingDuels An array of all pending duels.
    /// @return allPendingDuelsLength The number of all pending duels.
    function getAllPendingDuelsAndCount() public view returns (PendingDuel[] memory, uint256 allPendingDuelsLength) {
        return (s.allPendingDuels, s.allPendingDuels.length);
    }

    /// @notice Retrieves the create duel fee.
    /// @return The create duel fee.
    function getCreateDuelFee() public view returns (uint256) {
        return s.createDuelFee;
    }

    /// @notice Returns the protocol fee percentage.
    /// @return The protocol fee percentage.
    function getProtocolFeePercentage() public view returns (uint256) {
        return s.protocolFeePercentage;
    }

    /// @notice Returns the creator fee percentage.
    /// @return The creator fee percentage.
    function getCreatorFeePercentage() public view returns (uint256) {
        return s.creatorFeePercentage;
    }

    /// @notice Returns the winners chunk size.
    /// @return The winners chunk size.
    function getWinnersChunkSize() public view returns (uint256) {
        return s.winnersChunkSize;
    }

    /// @notice Returns the refund chunk size.
    /// @return The refund chunk size.
    function getRefundChunkSize() public view returns (uint256) {
        return s.refundChunkSize;
    }

    /// @notice Returns the resolving period.
    /// @return The resolving period.
    function getResolvingPeriod() public view returns (uint256) {
        return s.resolvingPeriod;
    }

    /// @notice Returns the bootstrap period.
    /// @return The bootstrap period.
    function getBootstrapPeriod() public view returns (uint256) {
        return s.bootstrapPeriod;
    }

    /// @notice Returns the seller and buyer fees.
    /// @return The seller and buyer fees.
    function getSellerAndBuyerFees() public view returns (uint256, uint256) {
        return (s.sellerFees, s.buyerFees);
    }

    /// @notice Returns the minimum threshold for wagering.
    /// @return The minimum threshold.
    function getMinThreshold() public view returns (uint256) {
        return s.minThreshold;
    }

    /// @notice Returns the sale counter.
    /// @return The sale counter.
    function getSaleCounter() public view returns (uint256) {
        return s.saleCounter;
    }

    /// @notice Returns the nonce used to generate unique duel IDs.
    /// @return The nonce.
    function getNonce() public view returns (uint256) {
        return s.nonce;
    }

    /// @notice Returns the USDC token contract address.
    /// @return The USDC token contract address.
    function getUsdcAddress() public view returns (address) {
        return s.usdc;
    }

    /// @notice Returns the bot address.
    /// @return The bot address.
    function getBotAddress() public view returns (address) {
        return s.bot;
    }

    /// @notice Returns the credits address.
    /// @return The credits address.
    function getCreditsAddress() public view returns (address) {
        return s.credits;
    }

    /// @notice Returns the participation token type.
    /// @return The participation token type.
    function getParticipationTokenType() public view returns (ParticipationTokenType) {
        return s.participationTokenType;
    }
}

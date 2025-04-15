// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BPS, AppStorage, Duel, DuelStatus, Sale, SaleCreated, TokensPurchased, SaleCancelled, ParticipationTokenType, DuelDuration, DuelCategory, CryptoDuel, FlashDuelsMarketplaceFacet__InvalidBot, FlashDuelsMarketplaceFacet__InvalidOption, FlashDuelsMarketplaceFacet__AmountMustBeGreaterThanZero, FlashDuelsMarketplaceFacet__PricePerTokenMustBeGreaterThanZero, FlashDuelsMarketplaceFacet__SellerCannotBuyOwnTokens, FlashDuelsMarketplaceFacet__BuyerCannotBeTheBot,  FlashDuelsMarketplaceFacet__NotEnoughTokensAvailable,  FlashDuelsMarketplaceFacet__DuelHasExpired, FlashDuelsMarketplaceFacet__SellingNotAllowedForShortDurationDuels, FlashDuelsMarketplaceFacet__MarketBuyNotAllowedForShortDurationDuels, FlashDuelsMarketplaceFacet__MarketBuyNotAllowedYet, FlashDuelsMarketplaceFacet__NotTheSeller, FlashDuelsMarketplaceFacet__NoActiveSale, FlashDuelsMarketplaceFacet__MismatchedArrayLengths, FlashDuelsMarketplaceFacet__InsufficientTokenBalance, FlashDuelsMarketplaceFacet__InsufficientAllowance, FlashDuelsMarketplaceFacet__DuelEnded} from "../AppStorage.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OptionToken} from "../OptionToken.sol";
import {IFlashDuelsView} from "../interfaces/IFlashDuelsView.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";

/// @title FlashDuelsMarketplaceFacet
/// @author FlashDuels
/// @notice This contract manages the marketplace functionalities for FlashDuels, including token transfers and transaction processing.
/// @dev This contract handles the buying and selling of option tokens, with built-in fee calculations and validation checks.
contract FlashDuelsMarketplaceFacet is ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    AppStorage internal s;

    /// @notice Modifier to restrict function access to only the contract owner.
    /// @dev Uses the LibDiamond library to enforce contract ownership.
    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    /// @notice Modifier to restrict function access to only the bot.
    modifier onlyBot() {
        require(msg.sender == s.bot, FlashDuelsMarketplaceFacet__InvalidBot());
        _;
    }

    /// @notice Updates the seller fees
    /// @param _newSellerFees The new seller fees
    function updateSellerFees(uint256 _newSellerFees) external onlyOwner {
        s.sellerFees = _newSellerFees;
    }

    /// @notice Updates the buyer fees
    /// @param _newBuyerFees The new buyer fees
    function updateBuyerFees(uint256 _newBuyerFees) external onlyOwner {
        s.buyerFees = _newBuyerFees;
    }

    /// @notice Creates a new sale for the given token
    /// @param duelId The ID of the associated duel
    /// @param token The address of the token to be sold
    /// @param duelCategory The category of the duel (Crypto or Flash)
    /// @param optionIndex The index of the option
    /// @param quantity The quantity of tokens to be sold (in 18 decimals)
    /// @param totalPrice The total price for the sale (in 6 decimals for USDC, 18 decimals for Credits)
    /// @dev This function validates the duel status and token ownership before creating a sale
    function sell(
        string memory duelId,
        address token,
        DuelCategory duelCategory,
        uint256 optionIndex,
        uint256 quantity,
        uint256 totalPrice
    ) external nonReentrant {
        address diamondContract = address(this);
        if (duelCategory == DuelCategory.Crypto) {
            CryptoDuel memory cryptoDuel = IFlashDuelsView(diamondContract).getCryptoDuel(duelId);
            _validateDuelSelling(cryptoDuel.expiryTime, cryptoDuel.duelDuration);
        } else {
            Duel memory flashDuel = IFlashDuelsView(diamondContract).getDuel(duelId);
            _validateDuelSelling(flashDuel.expiryTime, flashDuel.duelDuration);
        }
        require(
            token == IFlashDuelsView(diamondContract).getOptionIndexToOptionToken(duelId, optionIndex),
            FlashDuelsMarketplaceFacet__InvalidOption()
        );
        require(quantity > 0, FlashDuelsMarketplaceFacet__AmountMustBeGreaterThanZero());
        require(totalPrice > 0, FlashDuelsMarketplaceFacet__PricePerTokenMustBeGreaterThanZero());
        IERC20 erc20 = IERC20(token);
        require(erc20.balanceOf(msg.sender) >= quantity, FlashDuelsMarketplaceFacet__InsufficientTokenBalance());
        require(erc20.allowance(msg.sender, address(this)) >= quantity, FlashDuelsMarketplaceFacet__InsufficientAllowance());
        s.sales[token][s.saleCounter] = Sale({seller: msg.sender, quantity: quantity, totalPrice: totalPrice});
        emit SaleCreated(s.saleCounter, msg.sender, token, quantity, totalPrice, block.timestamp);
        ++s.saleCounter;
    }

    /// @notice Cancels an existing sale
    /// @param token The address of the token for the sale
    /// @param saleId The ID of the sale to cancel
    function cancelSell(address token, uint256 saleId) external nonReentrant {
        Sale memory sale = s.sales[token][saleId];
        require(sale.seller == msg.sender, FlashDuelsMarketplaceFacet__NotTheSeller());
        require(sale.quantity > 0, FlashDuelsMarketplaceFacet__NoActiveSale());
        delete s.sales[token][saleId];
        emit SaleCancelled(saleId, msg.sender, token, block.timestamp);
    }

    /// @notice Allows a user to buy tokens from a sale
    /// @param duelId The duel ID
    /// @param buyer The address of the buyer
    /// @param token The address of the token being sold
    /// @param duelCategory The category of the duel (Crypto or Flash)
    /// @param optionIndex The option index in the duel
    /// @param saleIds Array of sale IDs to buy from
    /// @param amounts Array of amounts to buy from each seller
    /// @dev This function handles the purchase of tokens from multiple sales, including fee calculations and token transfers
    function buy(
        string memory duelId,
        address buyer,
        address token,
        DuelCategory duelCategory,
        uint256 optionIndex,
        uint256[] memory saleIds,
        uint256[] memory amounts
    ) external onlyBot nonReentrant {
        address diamondContract = address(this);
        require(saleIds.length == amounts.length, FlashDuelsMarketplaceFacet__MismatchedArrayLengths());
        if (duelCategory == DuelCategory.Crypto) {
            CryptoDuel memory cryptoDuel = IFlashDuelsView(diamondContract).getCryptoDuel(duelId);
            _validateMarketBuyTiming(cryptoDuel.expiryTime, cryptoDuel.duelDuration, cryptoDuel.duelStatus, duelId);
        } else {
            Duel memory flashDuel = IFlashDuelsView(diamondContract).getDuel(duelId);
            _validateMarketBuyTiming(flashDuel.expiryTime, flashDuel.duelDuration, flashDuel.duelStatus, duelId);
        }
        require(
            token == IFlashDuelsView(diamondContract).getOptionIndexToOptionToken(duelId, optionIndex),
            FlashDuelsMarketplaceFacet__InvalidOption()
        );
        IERC20 erc20 = IERC20(token);
        uint256 totalCost = 0;
        uint256 platformFee = 0;

        for (uint256 i = 0; i < saleIds.length; i++) {
            uint256 saleId = saleIds[i];
            uint256 buyAmount = amounts[i];

            Sale memory sale = s.sales[token][saleId];
            require(sale.seller != buyer, FlashDuelsMarketplaceFacet__SellerCannotBuyOwnTokens());
            require(sale.seller != s.bot, FlashDuelsMarketplaceFacet__BuyerCannotBeTheBot());

            require(sale.quantity >= buyAmount, FlashDuelsMarketplaceFacet__NotEnoughTokensAvailable());

            uint256 sellPricePerToken = (sale.totalPrice * 1e18) / sale.quantity;
            uint256 cost = (buyAmount * sellPricePerToken) / 1e18;
            uint256 sellerfees = (cost * s.sellerFees) / BPS; // 0.03% (3)
            uint256 buyerFees = (cost * s.buyerFees) / BPS; // 0.05% (5)
            uint256 fee = sellerfees + buyerFees;
            uint256 receivables = cost - sellerfees;

            // Transfer funds and tokens
            if (s.participationTokenType == ParticipationTokenType.USDC) {
                IERC20(s.usdc).safeTransferFrom(buyer, sale.seller, receivables);
                IERC20(s.usdc).safeTransferFrom(buyer, s.protocolTreasury, fee);
            } else {
                IERC20(s.credits).safeTransferFrom(buyer, sale.seller, receivables);
                IERC20(s.credits).safeTransferFrom(buyer, s.protocolTreasury, fee);
            }
            uint256 burnAmount = (buyerFees * 1e18) / sellPricePerToken;
            uint256 newBuyAmount = buyAmount - burnAmount;
            erc20.safeTransferFrom(sale.seller, address(this), buyAmount);
            // burn burnAmount tokens
            OptionToken(token).burn(burnAmount);
            if (newBuyAmount > 0) {
                erc20.safeTransfer(buyer, newBuyAmount);
            }
            _updateDuelInfoForSellerBuyer(token, sale.seller, buyer, duelId, optionIndex);
            // Update sale details
            if (buyAmount == sale.quantity) {
                delete s.sales[token][saleId]; // Sale fully matched, remove
            } else {
                s.sales[token][saleId].quantity -= buyAmount;
                s.sales[token][saleId].totalPrice -= cost;
            }

            totalCost += cost;
            platformFee += fee;
            emit TokensPurchased(buyer, sale.seller, token, newBuyAmount, cost, block.timestamp);
        }
    }

    /// @notice Get Sale information from seller and saleId
    /// @param seller The address of the seller
    /// @param saleId The sale ID
    /// @return The Sale struct containing sale details
    function getSale(address seller, uint256 saleId) external view returns (Sale memory) {
        return s.sales[seller][saleId];
    }

    /// @notice Updates the duel participant list based on seller and buyer actions.
    /// @param _token The option token address.
    /// @param _seller The address of the seller.
    /// @param _buyer The address of the buyer.
    /// @param _duelId The ID of the duel.
    /// @param _optionIndex The index of the option.
    /// @dev This internal function manages the participant list when tokens are bought or sold
    function _updateDuelInfoForSellerBuyer(
        address _token,
        address _seller,
        address _buyer,
        string memory _duelId,
        uint256 _optionIndex
    ) internal {
        IERC20 optionToken = IERC20(_token);
        string memory option = s.duelIdToOptions[_duelId][_optionIndex];
        address[] storage participants = s.duelUsersForOption[_duelId][option];
        mapping(address => uint256) storage participantIndices = s.participantIndices[_duelId][option];

        if (participantIndices[_buyer] == 0) {
            participants.push(_buyer);
            participantIndices[_buyer] = participants.length; // 1-based index
        }

        if (participantIndices[_seller] != 0) {
            uint256 sellerBalance = optionToken.balanceOf(_seller);
            if (sellerBalance == 0) {
                uint256 sellerIndex = participantIndices[_seller] - 1;
                uint256 lastIndex = participants.length - 1;
                address lastUser = participants[lastIndex];

                if (sellerIndex != lastIndex) {
                    participants[sellerIndex] = lastUser;
                    participantIndices[lastUser] = sellerIndex + 1; // Update last user's index
                }

                participants.pop();
                delete participantIndices[_seller];
                delete s.userExistsInOption[_duelId][option][_seller];
            }
        }
    }

    /// @notice Validates the duel selling timing rules
    /// @param expiryTime The expiry time of the duel
    /// @param duelDuration The duration of the duel
    /// @dev This internal function ensures selling is only allowed for valid duels
    function _validateDuelSelling(uint256 expiryTime, DuelDuration duelDuration) private view {
        require(expiryTime > block.timestamp, FlashDuelsMarketplaceFacet__DuelHasExpired());

        if (duelDuration == DuelDuration.FiveMinutes || duelDuration == DuelDuration.FifteenMinutes) {
            revert FlashDuelsMarketplaceFacet__SellingNotAllowedForShortDurationDuels();
        }
    }

    /// @notice Validates the market buy timing rules
    /// @param expiryTime The expiry time of the duel
    /// @param duelDuration The duration of the duel
    /// @param duelStatus The status of the duel
    /// @param duelId The ID of the duel
    /// @dev This internal function enforces timing rules for market buys based on duel duration
    function _validateMarketBuyTiming(
        uint256 expiryTime,
        DuelDuration duelDuration,
        DuelStatus duelStatus,
        string memory duelId
    ) private view {
        if (duelStatus == DuelStatus.Settled || duelStatus == DuelStatus.Cancelled) {
            revert FlashDuelsMarketplaceFacet__DuelEnded(duelId);
        }
        require(expiryTime > block.timestamp, FlashDuelsMarketplaceFacet__DuelHasExpired());

        // No market buy for 5 mins and 15 mins duels
        if (duelDuration == DuelDuration.FiveMinutes || duelDuration == DuelDuration.FifteenMinutes) {
            revert FlashDuelsMarketplaceFacet__MarketBuyNotAllowedForShortDurationDuels();
        }

        // For 30 mins duels, allow market buy in last 10 mins
        if (duelDuration == DuelDuration.ThirtyMinutes) {
            require(expiryTime - block.timestamp <= 10 minutes, FlashDuelsMarketplaceFacet__MarketBuyNotAllowedYet());
        } else {
            // For all longer durations (1h, 3h, 6h, 12h), allow market buy in last 30 mins
            require(expiryTime - block.timestamp <= 30 minutes, FlashDuelsMarketplaceFacet__MarketBuyNotAllowedYet());
        }
    }
}

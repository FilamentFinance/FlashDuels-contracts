// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AppStorage, Duel, DuelStatus, Sale, SaleCreated, TokensPurchased, SaleCancelled, BPS} from "../AppStorage.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFlashDuels} from "../interfaces/IFlashDuels.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";

/// @notice Thrown when the duel has been already ended
error FlashDuelsMarketplace__DuelEnded(string duelId);

/// @title FlashDuelsMarketplaceFacet
/// @notice This contract manages the marketplace functionalities for FlashDuels, including token transfers and transaction processing.
contract FlashDuelsMarketplaceFacet is ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    AppStorage internal s;

    /// @notice Modifier to restrict function access to only the contract owner.
    /// @dev Uses the LibDiamond library to enforce contract ownership.
    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    /// @notice Updates the maximum allowed strikes for failed buy attempts
    /// @param _newMaxStrikes The new maximum number of strikes
    function updateMaxStrikes(uint256 _newMaxStrikes) external onlyOwner {
        s.maxStrikes = _newMaxStrikes;
    }

    /// @notice Updates the platform fee for transactions
    /// @param _newFee The new fee in basis points
    function updateFee(uint256 _newFee) external onlyOwner {
        s.marketPlaceFees = _newFee;
    }

    /// @notice Creates a new sale for the given token
    /// @param token The address of the token to be sold
    /// @param duelId The ID of the associated duel
    /// @param optionIndex The index of the option
    /// @param quantity The quantity of tokens to be sold
    /// @param totalPrice The total price for the sale
    function sell(
        address token,
        string memory duelId,
        uint256 optionIndex,
        uint256 quantity,
        uint256 totalPrice
    ) external nonReentrant {
        require(
            token == IFlashDuels(s.flashDuelsContract).getOptionIndexToOptionToken(duelId, optionIndex),
            "Invalid option"
        );
        require(quantity > 0, "Amount must be greater than zero");
        require(totalPrice > 0, "Price per token must be greater than zero");
        IERC20 erc20 = IERC20(token);
        // @note - zokyo-audit-fix-11
        require(erc20.balanceOf(msg.sender) >= quantity, "Insufficient token balance");
        require(erc20.allowance(msg.sender, address(this)) >= quantity, "Insufficient allowance for the contract");
        s.sales[token][s.saleCounter] = Sale({
            seller: msg.sender,
            quantity: quantity,
            totalPrice: totalPrice,
            strike: 0
        });
        emit SaleCreated(s.saleCounter, msg.sender, token, quantity, totalPrice, block.timestamp);
        ++s.saleCounter;
    }

    /// @notice Cancels an existing sale
    /// @param token The address of the token for the sale
    /// @param saleId The ID of the sale to cancel
    function cancelSell(address token, uint256 saleId) external nonReentrant {
        Sale memory sale = s.sales[token][saleId];
        require(sale.seller == msg.sender, "You are not the seller");
        require(sale.quantity > 0, "No active sale");
        delete s.sales[token][saleId];
        emit SaleCancelled(saleId, msg.sender, token, block.timestamp);
    }

    /// @notice Allows a user to buy tokens from a sale
    /// @param token The address of the token being sold
    /// @param duelId The duel id of the duel.
    /// @param saleId The ID of the sale to buy from
    function buy(address token, string memory duelId, uint256 saleId) external nonReentrant {
        Duel memory duel = IFlashDuels(s.flashDuelsContract).getDuel(duelId);
        if (duel.duelStatus == DuelStatus.Settled || duel.duelStatus == DuelStatus.Cancelled) {
            revert FlashDuelsMarketplace__DuelEnded(duelId);
        }
        Sale memory sale = s.sales[token][saleId];
        IERC20 erc20 = IERC20(token);
        if (erc20.allowance(sale.seller, address(this)) < sale.quantity && sale.strike <= s.maxStrikes) {
            sale.strike += 1;
            return;
        }

        if (sale.strike > s.maxStrikes) {
            delete s.sales[token][saleId];
            emit SaleCancelled(saleId, msg.sender, token, block.timestamp);
        } else {
            uint256 platformFee = (sale.totalPrice * s.marketPlaceFees) / BPS;
            uint256 receivables = sale.totalPrice - platformFee;
            IERC20(s.usdc).safeTransferFrom(msg.sender, sale.seller, receivables);
            IERC20(s.usdc).safeTransferFrom(msg.sender, s.protocolTreasury, platformFee);
            erc20.safeTransferFrom(sale.seller, msg.sender, sale.quantity);
            emit TokensPurchased(msg.sender, sale.seller, token, sale.quantity, sale.totalPrice, block.timestamp);
            delete s.sales[token][saleId];
        }
    }

    /// @notice Get Sale information from seller and saleId
    /// @param seller The address of the seller
    /// @param saleId The sale ID
    function getSale(address seller, uint256 saleId) public view returns (Sale memory) {
        return s.sales[seller][saleId];
    }
}

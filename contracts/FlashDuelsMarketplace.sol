// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IFlashDuels, Duel, DuelStatus} from "./interfaces/IFlashDuels.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

error FlashDuelsMarketplace__DuelEnded(string duelId);

/// @title Flash Duels Marketplace Contract
/// @notice This contract allows users to create, cancel, and purchase sales of tokens tied to Flash Duels.
/// @dev Implements ERC20 token functionality with pausable and upgradeable features.
contract FlashDuelsMarketplace is UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    struct Sale {
        address seller;
        uint256 quantity;
        uint256 strike;
        uint256 totalPrice;
    }

    address public protocolTreasury;
    uint256 public saleCounter;
    uint256 public maxStrikes;
    uint256 constant BPS = 10000;
    uint256 public fees; // 0.1%
    IFlashDuels public flashDuels;
    IERC20 public usdc;

    /// @notice Mapping to track sales for each token by sale ID
    mapping(address => mapping(uint256 => Sale)) public sales;

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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with the USDC token and Flash Duels addresses
    /// @dev Can only be called once due to the initializer modifier
    /// @param _usdc The address of the USDC token contract
    /// @param _flashDuels The address of the Flash Duels contract
    /// @param _protocolTreasury The address of the protocol treasury contract
    function initialize(address _usdc, address _flashDuels, address _protocolTreasury) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __UUPSUpgradeable_init();
        flashDuels = IFlashDuels(_flashDuels);
        usdc = IERC20(_usdc);
        protocolTreasury = _protocolTreasury;
        maxStrikes = 5;
        fees = 10;
    }

    /// @notice Updates the maximum allowed strikes for failed buy attempts
    /// @param _newMaxStrikes The new maximum number of strikes
    function updateMaxStrikes(uint256 _newMaxStrikes) external onlyOwner {
        maxStrikes = _newMaxStrikes;
    }

    /// @notice Updates the platform fee for transactions
    /// @param _newFee The new fee in basis points
    function updateFee(uint256 _newFee) external onlyOwner {
        fees = _newFee;
    }

    /// @notice Pauses the contract to prevent certain critical functions
    /// @dev Can only be called by the owner
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses the contract, re-enabling paused functions
    /// @dev Can only be called by the owner
    function unpause() external onlyOwner {
        _unpause();
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
    ) external {
        // tokenToDuelId[token] = duelId;
        require(token == flashDuels.getOptionIndexToOptionToken(duelId, optionIndex), "Invalid option");
        require(quantity > 0, "Amount must be greater than zero");
        require(totalPrice > 0, "Price per token must be greater than zero");
        IERC20 erc20 = IERC20(token);
        require(erc20.allowance(msg.sender, address(this)) >= quantity, "Insufficient allowance for the contract");
        sales[token][saleCounter] = Sale({seller: msg.sender, quantity: quantity, totalPrice: totalPrice, strike: 0});
        emit SaleCreated(saleCounter, msg.sender, token, quantity, totalPrice, block.timestamp);
        ++saleCounter;
    }

    /// @notice Cancels an existing sale
    /// @param token The address of the token for the sale
    /// @param saleId The ID of the sale to cancel
    function cancelSell(address token, uint256 saleId) external {
        Sale memory sale = sales[token][saleId];
        require(sale.seller == msg.sender, "You are not the seller");
        require(sale.quantity > 0, "No active sale");
        delete sales[token][saleId];
        emit SaleCancelled(saleId, msg.sender, token, block.timestamp);
    }

    /// @notice Allows a user to buy tokens from a sale
    /// @param token The address of the token being sold
    /// @param duelId The duel id of the duel.
    /// @param saleId The ID of the sale to buy from
    function buy(address token, string memory duelId, uint256 saleId) external {
        Duel memory duel = flashDuels.getDuel(duelId);
        if (duel.duelStatus == DuelStatus.Settled || duel.duelStatus == DuelStatus.Cancelled) {
            revert FlashDuelsMarketplace__DuelEnded(duelId);
        }
        Sale memory sale = sales[token][saleId];
        IERC20 erc20 = IERC20(token);
        if (erc20.allowance(sale.seller, address(this)) < sale.quantity && sale.strike <= maxStrikes) {
            sale.strike += 1;
            return;
        }

        if (sale.strike > maxStrikes) {
            delete sales[token][saleId];
            emit SaleCancelled(saleId, msg.sender, token, block.timestamp);
        } else {
            uint256 platformFee = (sale.totalPrice * fees) / BPS;
            uint256 receivables = sale.totalPrice - platformFee;
            usdc.safeTransferFrom(msg.sender, sale.seller, receivables);
            usdc.safeTransferFrom(msg.sender, protocolTreasury, platformFee);
            erc20.safeTransferFrom(sale.seller, msg.sender, sale.quantity);
            emit TokensPurchased(msg.sender, sale.seller, token, sale.quantity, sale.totalPrice, block.timestamp);
            delete sales[token][saleId];
        }
    }

    /// @notice Get Sale information from seller and saleId
    /// @param seller The address of the seller
    /// @param saleId The sale ID
    function getSale(address seller, uint256 saleId) public view returns (Sale memory) {
        return sales[seller][saleId];
    }

    /// @notice Authorizes an upgrade to a new implementation contract
    /// @param newImplementation The address of the new implementation contract
    /// @dev Can only be called by the owner
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

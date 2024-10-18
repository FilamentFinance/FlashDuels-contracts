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

contract FlashDuelsMarketplace is UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    struct Sale {
        address seller;
        uint256 qnty;
        uint256 strike; // @review - What is the use of strike here ? Explained Below
        uint256 totalPrice;
    }

    mapping(address => mapping(uint256 => Sale)) public sales;
    mapping(address => string) public tokenToDuelId;
    uint256 public saleCounter;
    IERC20 public usdc;
    uint256 public maxStrikes; // @review - What is maxStrike and why 5 ? Explained Below
    uint256 constant BPS = 1000000;
    uint256 public fees; // 0.1%
    IFlashDuels public flashDuels;

    event SaleCreated(uint256 saleId, address seller, address token, uint256 qnty, uint256 totalPrice);
    event SaleCancelled(uint256 saleId, address seller, address token);
    event TokensPurchased(address buyer, address seller, address token, uint256 qnty, uint256 totalPrice);
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with the USDC token address and bot address
    /// @dev This function can only be called once as it uses the initializer modifier
    /// @param _usdc The address of the USDC token contract
    function initialize(address _usdc, address _flashDuels) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __UUPSUpgradeable_init();
        usdc = IERC20(_usdc);
        maxStrikes = 5;
        fees = 10;
        flashDuels = IFlashDuels(_flashDuels);
    }

    function updateMaxStrikes(uint256 _newMaxStrikes) external onlyOwner {
        maxStrikes = _newMaxStrikes;
    }

    function updateFee(uint256 _newFee) external onlyOwner {
        fees = _newFee;
    }

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

    function sell(address token, string memory duelId, uint256 qnty, uint256 totalPrice) external {
       
            tokenToDuelId[token] = duelId;
     
        require(qnty > 0, "Amount must be greater than zero");
        require(totalPrice > 0, "Price per token must be greater than zero");
        IERC20 erc20 = IERC20(token);
        require(erc20.allowance(msg.sender, address(this)) >= qnty, "Insufficient allowance for the contract");
        // @review - Instead safeTransferFrom here, it should be called during buying function call, when user is ready to buy the option tokens
        // @note - fixed
        // @review - Sale struct has 4 params, but 3 used, so not compiling
        // @note - fixed
        sales[token][saleCounter] = Sale({seller: msg.sender, qnty: qnty, totalPrice: totalPrice, strike: 0});
        emit SaleCreated(saleCounter, msg.sender, token, qnty, totalPrice);
        ++saleCounter;
    }

    function cancelSell(address token, uint256 saleId) external {
        Sale memory sale = sales[token][saleId];
        require(sale.seller == msg.sender, "You are not the seller");
        require(sale.qnty > 0, "No active sale");
        // @review - If assets are not transferred while selling (just getting approval), it's not required for tranfer function, just cancel it without transfer
        // @note - fixed.
        delete sales[token][saleId];
        emit SaleCancelled(saleId, msg.sender, token);
    }

    function buy(address token, uint256 saleId) external {
        Duel memory duel = flashDuels.duels(tokenToDuelId[token]);
        if(duel.duelStatus == DuelStatus.Settled || duel.duelStatus == DuelStatus.Cancelled){
            revert FlashDuelsMarketplace__DuelEnded(tokenToDuelId[token]);
        }
        Sale memory sale = sales[token][saleId];
        IERC20 erc20 = IERC20(token);
        // @review - What is this check for ??
        // @note - If User Approves to create the sell order and later revokes the approval, then buy option will fail.
        // buy function might also fail if buyer enters quantity greater than approved. Have removed the option for user
        // to buy a specific quantity now. Now, buyer has to buy the complete qnty and cannot buy part qnty.
        // Buy Function will fail, if the user revoked approval, thus if buy trx fails move than maxStrikes, we remove the listing.
        if (erc20.allowance(sale.seller, address(this)) < sale.qnty && sale.strike <= maxStrikes) {
            sale.strike += 1;
            return;
        }
        if (sale.strike > maxStrikes) {
            delete sales[token][saleId];
            emit SaleCancelled(saleId, msg.sender, token);
        } else {
            // @review - Check the decimals of tokens qnty (as 18 decimals are used for option tokens)
            // @note - fixed
            uint256 platformFee = (sale.totalPrice * fees) / BPS;
            uint256 receivables = sale.totalPrice - platformFee;
            usdc.safeTransferFrom(msg.sender, sale.seller, receivables);
            usdc.safeTransferFrom(msg.sender, owner(), platformFee);
            erc20.safeTransferFrom(sale.seller, msg.sender, sale.qnty);
            emit TokensPurchased(msg.sender, sale.seller, token, sale.qnty, sale.totalPrice);
            delete sales[token][saleId];
        }
    }

    /// @notice Authorize an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation contract
    /// @dev Can only be called by the owner
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

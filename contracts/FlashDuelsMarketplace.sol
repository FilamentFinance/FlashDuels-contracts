// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import {ITokenMarketplace} from "./interfaces/ITokenMarketplace.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import {IFlashDuels} from "./interfaces/IFlashDuels.sol";

contract FlashDuelsMarketplace {
    using SafeERC20 for IERC20;

    struct Sale {
        address seller;
        uint256 qnty;
        uint256 strike; // @review - What is the use of strike here ? Explained Below
        uint256 totalPrice;
    }

    mapping(address => mapping(uint256 => Sale)) public sales;
    uint256 public saleCounter;
    IERC20 public usdc;
    uint256 public maxStrikes = 5; // @review - What is maxStrike and why 5 ? Explained Below

    event SaleCreated(
        uint256 saleId, address seller, address  token, uint256 qnty, uint256 totalPrice
    );
    event SaleCancelled(uint256 saleId, address  seller, address  token);
    event TokensPurchased(
        address  buyer, address  seller, address  token, uint256 qnty, uint256 totalPrice
    );

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function sell(address token, uint256 qnty, uint256 totalPrice) external {
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
            usdc.safeTransferFrom(msg.sender, sale.seller, sale.totalPrice);
            erc20.safeTransferFrom(sale.seller, msg.sender, sale.qnty);
            emit TokensPurchased(msg.sender, sale.seller, token, sale.qnty, sale.totalPrice);
            delete sales[token][saleId];
        }
    }
}

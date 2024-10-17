// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ITokenMarketplace} from "./interfaces/ITokenMarketplace.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IFlashDuels} from "./interfaces/IFlashDuels.sol";

contract TokenMarketplace is ITokenMarketplace {
    using SafeERC20 for IERC20;

    struct Sale {
        address seller;
        uint256 qnty;
        uint256 strike;
        uint256 pricePerToken;
    }

    mapping(address => mapping(uint256 => Sale)) public sales;
    uint256 public saleCounter;
    IERC20 public usdc;
    uint256 public maxStrikes = 5;

    event SaleCreated(
        uint256 saleId, address seller, address  token, uint256 qnty, uint256 pricePerToken
    );
    event SaleCancelled(uint256 saleId, address  seller, address  token);
    event TokensPurchased(
        address  buyer, address  seller, address  token, uint256 qnty, uint256 totalPrice
    );

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function sell(address token, uint256 qnty, uint256 pricePerToken) external {
        require(qnty > 0, "Amount must be greater than zero");
        require(pricePerToken > 0, "Price per token must be greater than zero");
        IERC20 erc20 = IERC20(token);
        require(erc20.allowance(msg.sender, address(this)) >= qnty, "Insufficient allowance for the contract");
        require(erc20.safeTransferFrom(msg.sender, address(this), qnty), "Token transfer failed");
        sales[token][saleCounter] = Sale({seller: msg.sender, qnty: qnty, pricePerToken: pricePerToken});
        emit SaleCreated(saleCounter, msg.sender, token, qnty, pricePerToken);
        ++saleCounter;
    }

    function cancelSell(address token, uint256 saleId) external {
        Sale memory sale = sales[token][saleId];
        require(sale.seller == msg.sender, "You are not the seller");
        require(sale.qnty > 0, "No active sale");
        IERC20 erc20 = IERC20(token);
        require(erc20.safeTransfer(msg.sender, sale.qnty), "Token transfer failed");
        delete sales[token][saleId];

        emit SaleCancelled(saleId, msg.sender, token);
    }

    function buy(address token, uint256 saleId, uint256 qnty) external {
        Sale memory sale = sales[token][saleId];
        IERC20 erc20 = IERC20(token);

        if (erc20.allowance(sale.sender, address(this)) < qnty && sale.strike <= maxStrikes) {
            sale.strike += 1;
            return;
        }
        if (sale.strike > maxStrikes) {
            delete sales[token][saleId];
            emit SaleCancelled(saleId, msg.sender, token);
        } else {
            require(sale.qnty >= qnty, "Not enough tokens for sale");
            require(qnty > 0, "Amount must be greater than zero");

            uint256 totalPrice = qnty * sale.pricePerToken;
            require(usdc.safeTransferFrom(msg.sender, sale.seller, totalPrice), "USDC transfer failed");
            require(erc20.safeTransferFrom(sale.seller, msg.sender, qnty), "Token transfer failed");

            sales[token][seller].qnty -= qnty;
            if (sales[token][seller].qnty == 0) {
                delete sales[token][seller];
            }
            emit TokensPurchased(msg.sender, seller, token, qnty, totalPrice);
        }
    }
}

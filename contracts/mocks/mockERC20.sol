// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    // Constructor to initialize the token with name, symbol, and decimals
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, 1000000 * (10 ** decimals_)); // Mint 1,000,000 tokens to the deployer for testing
    }

    // Override decimals function to return custom decimals (e.g., 6 for USDC)
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    // Mint additional tokens for testing purposes
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract OptionToken is ERC20 {
    // Constructor to initialize the token with name, symbol, and decimals
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    // Mint additional tokens for testing purposes
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @dev A mock ERC20 token contract for testing purposes
/// This contract extends OpenZeppelin's ERC20 implementation and allows for custom decimals
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    /// @dev Constructor to initialize the mock token
    /// @param name The name of the token
    /// @param symbol The symbol of the token
    /// @param decimals_ The number of decimal places for the token
    /// Mints 1,000,000 tokens to the deployer for testing purposes
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, 1000000 * (10 ** decimals_)); // Mint 1,000,000 tokens to the deployer for testing
    }

    /// @dev Returns the number of decimals used to get its user representation
    /// @return The number of decimals
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @dev Mints new tokens for testing purposes
    /// @param to The address that will receive the minted tokens
    /// @param amount The amount of tokens to mint
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract OptionToken is ERC20 {
    /// @notice Thrown when the flashDuels address is invalid
    error OptionToken__InvalidFlashDuels();

    address public flashDuels;

    /**
     * @notice Restricts the function to only the bot address
     * @dev Throws FlashDuels__InvalidBot if the caller is not the bot address
     */
    modifier onlyFlashDuels() {
        require(flashDuels == msg.sender, OptionToken__InvalidFlashDuels());
        _;
    }

    // Constructor to initialize the token with name, symbol, and decimals
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        flashDuels = msg.sender;
    }

    // Mint additional tokens for testing purposes
    function mint(address to, uint256 amount) external onlyFlashDuels {
        _mint(to, amount);
    }
}

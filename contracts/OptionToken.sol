// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title OptionToken
 * @notice This contract implements an ERC20 token used for representing options in a duel.
 * @dev The contract is restricted to certain addresses for minting and other administrative actions.
 */
contract OptionToken is ERC20 {
    /// @notice Thrown when the flashDuels address is invalid
    error OptionToken__InvalidFlashDuels();

    /// @notice The address of the FlashDuels Diamond contract
    address public flashDuelsDiamond;

    /**
     * @notice Restricts the function to only the FlashDuels Diamond contract address
     * @dev This modifier ensures that only the FlashDuels Diamond contract can call restricted functions.
     */
    modifier onlyFlashDuelsDiamond() {
        require(flashDuelsDiamond == msg.sender, OptionToken__InvalidFlashDuels());
        _;
    }

    /**
     * @notice Constructor that initializes the OptionToken contract with a name and symbol.
     * @dev The constructor also sets the FlashDuels Diamond contract address to the sender of the transaction.
     * @param _name The name of the token.
     * @param _symbol The symbol of the token.
     */
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        flashDuelsDiamond = msg.sender;
    }

    /**
     * @notice Mints new tokens to a specified address.
     * @dev This function can only be called by the FlashDuels Diamond contract.
     * @param to The address to mint the tokens to.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external onlyFlashDuelsDiamond {
        _mint(to, amount);
    }
}

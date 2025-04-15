// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title USDC Storage Contract
/// @notice Abstract contract that contains storage variables and modifiers for USDC implementation
abstract contract USDC_Storage {
    mapping(address => bool) faucetMinted;

    error AlreadyMinted(address);

    address public admin;
    mapping(address => uint256) lastMinted;

    /// @notice Modifier to restrict function access to admin only
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _; // Continue executing the function
    }
}

/// @title FLASHUSDC Token Contract
/// @notice An upgradeable ERC20 token implementation with faucet functionality
/// @dev This contract extends ERC20Upgradeable, UUPSUpgradeable, and OwnableUpgradeable
/// @custom:oz-upgrades-from test/Mocks/mockToken.sol:USDC
contract FLASHUSDC is USDC_Storage, ERC20Upgradeable, UUPSUpgradeable, OwnableUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() payable {
        _disableInitializers();
    }

    /// @notice Initializes the token contract with name, symbol, and admin
    /// @param _name The name of the token
    /// @param _symbol The symbol of the token
    /// @param _admin The address of the admin who can use the faucet
    function initialize(string memory _name, string memory _symbol, address _admin) public initializer {
        __ERC20_init(_name, _symbol);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        admin = _admin;
        // Mint initial tokens to the contract deployer (for testing purposes)
        _mint(msg.sender, 1_000_000 * (10 ** uint256(decimals())));
    }

    /// @notice Authorizes an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Mints new tokens to a specified address
    /// @param _account The address to mint tokens to
    /// @param _amount The amount of tokens to mint
    function mint(address _account, uint256 _amount) external payable onlyOwner {
        _mint(_account, _amount);
    }

    /// @notice Returns the number of decimals used by the token
    /// @return _decimals The number of decimals (6 for USDC)
    function decimals() public pure override returns (uint8 _decimals) {
        return 6;
    }

    /// @notice Allows admin to mint tokens through the faucet
    /// @param _address The address to mint tokens to
    /// @dev Reverts if the address has already minted tokens within the last 7 days
    function faucetMint(address _address) public onlyAdmin {
        if (lastMinted[_address] + 7 days > block.timestamp) {
            revert AlreadyMinted(_address);
        }
        lastMinted[_address] = block.timestamp;
        _mint(_address, 10_000 * (10 ** uint256(decimals())));
    }

    /// @notice Increases the allowance of a spender
    /// @param spender The address allowed to spend tokens
    /// @param value The amount to increase the allowance by
    function increaseAllowance(address spender, uint256 value) external {
        _approve(msg.sender, spender, allowance(msg.sender, spender) + value);
    }

    /// @notice Decreases the allowance of a spender
    /// @param spender The address allowed to spend tokens
    /// @param value The amount to decrease the allowance by
    /// @dev Reverts if the value is greater than the current allowance
    function decreaseAllowance(address spender, uint256 value) external {
        uint256 currentAllowance = allowance(msg.sender, spender);
        require(value >= currentAllowance, "not enough to decrease");
        _approve(msg.sender, spender, currentAllowance - value);
    }

    /// @notice Changes the admin address
    /// @param newAdmin The new admin address
    /// @dev Only callable by the owner or current admin
    function changeAdmin(address newAdmin) external {
        require(msg.sender == owner() || msg.sender == admin, "unauth");
        admin = newAdmin;
    }

    /// @notice Returns the timestamp of the last faucet mint for a user
    /// @param _userAddress The address of the user to check
    /// @return _lastMinted The timestamp of the last faucet mint
    function walletLastMinted(address _userAddress) public view returns (uint256 _lastMinted) {
        return lastMinted[_userAddress];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

error Credits__ArrayLengthMismatch();
error Credits__MaxSupplyReached();
error Credits__NotEnoughCredtis();
error Credits__InvalidValue();

/// @title Credits
/// @notice An upgradeable ERC20 token contract for managing credits
/// @dev This contract implements UUPS upgradeability pattern and includes functionality for airdropping and claiming credits
contract Credits is ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    /// @notice Maximum supply of credits that can be minted
    uint256 public maxSupply;

    /// @notice Total amount of credits allocated to users
    uint256 public totalCreditsAllocated;

    /// @notice Mapping of user addresses to their available credits
    mapping(address => uint256) public credits;

    /// @notice Mapping of user addresses to their total claimed credits
    /// @dev This `totalClaimed` mapping was added on March 29, 2025. Before this date, the totalClaimed for all users will be 0.
    /// After March 29, it will be taken into account for this variable.
    mapping(address => uint256) public totalClaimed;

    /// @notice Address of the bot that can perform airdrops
    /// @dev The botAddress can airdrop credits to users. (Added on March 29, 2025)
    address public botAddress;

    /// @notice Event emitted when a user claims their credits
    /// @dev `CreditsClaimed` event emitted when a user claims their credits. (Added on March 29, 2025)
    event CreditsClaimed(address indexed user, uint256 amount);

    /// @notice Modifier to restrict function access to owner or bot
    modifier onlyOwnerOrBot() {
        require(msg.sender == owner() || msg.sender == botAddress, "Only owner or bot can call this function");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with maximum supply and token details
    /// @param _maxSupply The maximum supply of credits that can be minted
    function initialize(uint256 _maxSupply) public initializer {
        maxSupply = _maxSupply;
        __ERC20_init("Credits", "CRD");
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    /// @notice Sets the address of the bot that can perform airdrops
    /// @param _botAddress The address of the bot
    function setBotAddress(address _botAddress) external onlyOwner {
        require(_botAddress != address(0), "Bot address cannot be 0");
        botAddress = _botAddress;
    }

    /// @notice Airdrops credits to multiple recipients
    /// @param _recipients Array of recipient addresses
    /// @param _amounts Array of credit amounts to airdrop
    /// @dev Only callable by owner or bot
    function airdrop(address[] calldata _recipients, uint256[] calldata _amounts) external onlyOwnerOrBot {
        require(_recipients.length == _amounts.length, Credits__ArrayLengthMismatch());
        uint256 _totalCreditsAllocated = totalCreditsAllocated;
        uint256 aLength = _recipients.length;
        for (uint256 i; i < aLength; ) {
            credits[_recipients[i]] += _amounts[i]; // Users can get extra Credits in phases
            _totalCreditsAllocated = _totalCreditsAllocated + _amounts[i];
            unchecked {
                ++i;
            }
        }
        totalCreditsAllocated = _totalCreditsAllocated;
        require(_totalCreditsAllocated <= maxSupply, Credits__MaxSupplyReached());
    }

    /// @notice Allows users to claim their allocated credits
    /// @dev Mints tokens to the caller's address and updates their claimed amount
    function claim() external {
        uint256 availableCredits = credits[msg.sender];
        require(availableCredits != 0, Credits__NotEnoughCredtis());
        require(availableCredits + totalSupply() <= maxSupply, Credits__MaxSupplyReached());
        _mint(msg.sender, availableCredits);
        totalClaimed[msg.sender] += availableCredits;
        credits[msg.sender] = 0;
        emit CreditsClaimed(msg.sender, availableCredits);
    }

    /// @notice Burns tokens from the caller's balance
    /// @param value Amount of tokens to burn
    function burn(uint256 value) external {
        _burn(msg.sender, value);
    }

    /// @notice Burns tokens from a specified address
    /// @param account Address to burn tokens from
    /// @param value Amount of tokens to burn
    function burnFrom(address account, uint256 value) external {
        _spendAllowance(account, msg.sender, value);
        _burn(account, value);
    }

    /// @notice Transfers ownership of the contract
    /// @param newOwner Address of the new owner
    function changeOwnership(address newOwner) external onlyOwner {
        transferOwnership(newOwner);
    }

    /// @notice Updates the maximum supply of credits
    /// @param _newSupply New maximum supply value
    /// @dev New supply must be greater than current max supply
    function updateMaxSupply(uint256 _newSupply) external onlyOwner {
        require(_newSupply > maxSupply, Credits__InvalidValue());
        maxSupply = _newSupply;
    }

    /// @notice Authorizes contract upgrades
    /// @param newImplementation Address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

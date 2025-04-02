// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

error Credits__ArrayLengthMismatch();
error Credits__MaxSupplyReached();
error Credits__NotEnoughCredtis();
error Credits__InvalidValue();

contract Credits is ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {

    uint256 public maxSupply;
    uint256 public totalCreditsAllocated;
    mapping(address => uint256) public credits;
    /// @dev This `totalClaimed` mapping was added on March 29, 2025. Before this date, the totalClaimed for all users will be 0. 
    /// After March 29, it will be taken into account for this variable.
    mapping(address => uint256) public totalClaimed;
    /// @dev The botAddress can airdrop credits to users. (Added on March 29, 2025)
    address public botAddress;

    /// @dev `CreditsClaimed` event emitted when a user claims their credits. (Added on March 29, 2025)
    event CreditsClaimed(address indexed user, uint256 amount);

    modifier onlyOwnerOrBot() {
        require(msg.sender == owner() || msg.sender == botAddress, "Only owner or bot can call this function");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 _maxSupply) public initializer {
        maxSupply = _maxSupply;
        __ERC20_init("Credits", "CRD");
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    /// @dev Set the bot address.
    /// @param _botAddress The address of the bot.
    function setBotAddress(address _botAddress) external onlyOwner {
        require(_botAddress != address(0), "Bot address cannot be 0");
        botAddress = _botAddress;
    }

    function airdrop(address[] calldata _recipients, uint256[] calldata _amounts) external onlyOwnerOrBot {
        require(_recipients.length == _amounts.length, Credits__ArrayLengthMismatch());
        uint256 _totalCreditsAllocated = totalCreditsAllocated;
        uint256 aLength = _recipients.length;
        for (uint256 i; i < aLength;) {
            credits[_recipients[i]] += _amounts[i]; // Users can get extra Credits in phases
            _totalCreditsAllocated = _totalCreditsAllocated + _amounts[i];
            unchecked {
                ++i;
            }
        }
        totalCreditsAllocated = _totalCreditsAllocated;
        require(_totalCreditsAllocated <= maxSupply, Credits__MaxSupplyReached());
    }

    function claim() external {
        uint256 availableCredits = credits[msg.sender];
        require(availableCredits != 0, Credits__NotEnoughCredtis());
        require(availableCredits + totalSupply() <= maxSupply, Credits__MaxSupplyReached());
        _mint(msg.sender, availableCredits);
        totalClaimed[msg.sender] += availableCredits;
        credits[msg.sender] = 0;
        emit CreditsClaimed(msg.sender, availableCredits);
    }

    function burn(uint256 value) external {
        _burn(msg.sender, value);
    }

    function burnFrom(address account, uint256 value) external {
        _spendAllowance(account, msg.sender, value);
        _burn(account, value);
    }

    function changeOwnership(address newOwner) external onlyOwner {
        transferOwnership(newOwner);
    }

    function updateMaxSupply(uint256 _newSupply) external onlyOwner {
        require(_newSupply > maxSupply, Credits__InvalidValue());
        maxSupply = _newSupply;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }

}

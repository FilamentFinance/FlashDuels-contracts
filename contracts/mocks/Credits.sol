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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 _maxSupply) public initializer {
        maxSupply = _maxSupply;
        __ERC20_init("FlashDuels Credits", "FDCRD");
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    modifier onlyOwnerOrBot() {
        require(msg.sender == owner() || msg.sender == 0x2Eb671E6e0cd965A79A80caF35c5123b7a5D8ebb, "Only the owner or bot can call this function");
        _;
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
        require(credits[msg.sender] != 0, Credits__NotEnoughCredtis());
        require(credits[msg.sender] + totalSupply() <= maxSupply, Credits__MaxSupplyReached());
        _mint(msg.sender, credits[msg.sender]);
        credits[msg.sender] = 0;
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

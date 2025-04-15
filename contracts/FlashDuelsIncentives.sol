// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title FlashDuelsIncentives
/// @author FlashDuels
/// @notice A contract for managing Ether (Native Currency) incentives for users, allowing them to claim funds based on allocations
/// @dev This contract implements:
///      - User incentive allocation and claiming
///      - Native currency (Ether) management
///      - Upgradeable contract pattern
///      - Reentrancy protection
///      - Ownership control
contract FlashDuelsIncentives is ReentrancyGuardUpgradeable, OwnableUpgradeable, UUPSUpgradeable {
    /// ============ Errors ============ ///
    /// @notice Thrown when the length of users and amounts arrays don't match
    error FlashDuelsIncentives__ArrayLengthMismatch();
    /// @notice Thrown when an amount is zero or negative
    error FlashDuelsIncentives__MustBeGreaterThanZero();
    /// @notice Thrown when contract balance is insufficient for allocation
    error FlashDuelsIncentives__NotEnoughNativeCurrency();
    /// @notice Thrown when user has no allocation available to claim
    error FlashDuelsIncentives__NoAllocationAvailable();
    /// @notice Thrown when native currency transfer fails
    error FlashDuelsIncentives__NativeCurrencyTransferFailed();
    /// @notice Thrown when there's no unallocated native currency to withdraw
    error FlashDuelsIncentives__NoUnallocatedNativeCurrencyToWithdraw();
    /// @notice Thrown when native currency withdrawal fails
    error FlashDuelsIncentives__NativeCurrencyWithdrawFailed();
    /// @notice Thrown when upgrade authorization fails
    error FlashDuelsIncentives__UnauthorizedUpgrade();
    /// @notice Thrown when initialization is attempted more than once
    error FlashDuelsIncentives__AlreadyInitialized();
    /// @notice Thrown when a zero address is provided where not allowed
    error FlashDuelsIncentives__ZeroAddressNotAllowed();

    /// ============ Events ============ ///
    /// @notice Event emitted when funds are allocated to a user
    /// @param user The address of the user receiving the allocation
    /// @param amount The amount of Ether allocated
    event Allocated(address indexed user, uint256 indexed amount);

    /// @notice Event emitted when a user claims their allocation
    /// @param user The address of the user who claimed the allocation
    /// @param amount The total amount of Ether claimed
    event Claimed(address indexed user, uint256 indexed amount);

    /// @notice Event emitted when the contract receives funding
    /// @param user The address of the user who funded the contract
    /// @param amount The amount of Ether received
    event Funded(address indexed user, uint256 indexed amount);

    /// ============ Structs ============ ///
    /// @notice Structure to store user incentive information
    /// @param claimable The amount of Ether the user can claim
    /// @param claimed The amount of Ether the user has already claimed
    struct Incentive {
        uint256 claimable;
        uint256 claimed;
    }

    /// ============ State Variables ============ ///
    /// @notice Mapping to store allocation data for each user
    mapping(address => Incentive) public incentives;

    /// ============ Constructor & Initialization ============ ///
    /// @notice Constructor that disables initializers
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with necessary setup
    /// @dev Initializes ReentrancyGuard, Ownable, and UUPSUpgradeable
    function initialize() public initializer {
        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    /// ============ External Functions ============ ///
    /// @notice Allocates Ether to multiple users
    /// @dev Only the Owner can call this function
    /// @param users The addresses of the users to allocate Ether to
    /// @param amounts The amounts of Ether to allocate to each user
    function allocateNativeCurrency(address[] calldata users, uint256[] calldata amounts) external onlyOwner {
        require(users.length == amounts.length, FlashDuelsIncentives__ArrayLengthMismatch());
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < users.length; i++) {
            require(amounts[i] > 0, FlashDuelsIncentives__MustBeGreaterThanZero());
            incentives[users[i]].claimable += amounts[i];
            totalAmount += amounts[i];
            emit Allocated(users[i], amounts[i]);
        }

        require(address(this).balance >= totalAmount, FlashDuelsIncentives__NotEnoughNativeCurrency());
    }

    /// @notice Allows a user to claim their allocated Ether
    /// @dev Users can only claim their own allocations
    /// @dev Uses nonReentrant modifier to prevent reentrancy attacks
    function claim() external nonReentrant {
        uint256 amount = incentives[msg.sender].claimable;
        require(amount > 0, FlashDuelsIncentives__NoAllocationAvailable());

        delete incentives[msg.sender].claimable;
        incentives[msg.sender].claimed += amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, FlashDuelsIncentives__NativeCurrencyTransferFailed());

        emit Claimed(msg.sender, amount);
    }

    /// @notice Allows the owner to withdraw any unallocated Ether from the contract
    /// @dev Only the owner can call this function
    function withdrawUnallocated() external onlyOwner {
        uint256 unallocatedAmount = address(this).balance;
        require(unallocatedAmount > 0, FlashDuelsIncentives__NoUnallocatedNativeCurrencyToWithdraw());
        address ownerAddr = owner();
        (bool success, ) = ownerAddr.call{value: unallocatedAmount}("");
        require(success, FlashDuelsIncentives__NativeCurrencyWithdrawFailed());
    }

    /// @notice Returns the total claimable and claimed Ether for a user
    /// @param user The address of the user
    /// @return claimable The total claimable amount of Ether
    /// @return claimed The total claimed amount of Ether
    function totalAllocations(address user) external view returns (uint256 claimable, uint256 claimed) {
        claimable = incentives[user].claimable;
        claimed = incentives[user].claimed;
    }

    /// @notice Returns the current balance of native currency in the contract
    /// @return The current balance of the contract in wei
    function getNativeCurrencyBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// ============ Internal Functions ============ ///
    /// @notice Authorizes contract upgrades
    /// @dev Only the owner can authorize upgrades
    /// @param newImplementation The address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// ============ Fallback Functions ============ ///
    /// @notice Fallback function to accept Ether directly
    /// @dev Allows the contract to receive Ether through direct transfers
    receive() external payable {}
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title EtherAllocation
 * @dev A contract for managing Ether incentives for users, allowing them to claim funds based on allocations.
 */
contract FlashDuelsIncentives is OwnableUpgradeable, UUPSUpgradeable {

    /**
     * @dev Structure to store user incentive.
     * @param claimable The amount of Ether the user can claim for staking.
     * @param claimed The amount of Ether the user has already claimed for staking.
     */
    struct Incentive {
        uint256 claimable;
        uint256 claimed;
    }

    error IncentiveAlloc__ArrayLengthMismatch();
    error IncentiveAlloc__MustBeGreaterThanZero();
    error IncentiveAlloc__NotEnoughSei();
    error IncentiveAlloc__NoAllocationAvailable();
    error IncentiveAlloc__SeiTransferFailed();
    error IncentiveAlloc__NoUnallocatedSeiToWithdraw();
    error IncentiveAlloc__SeiWithdrawFailed();

    /// @notice Mapping to store allocation data for each user.
    mapping(address => Incentive) public incentives;

    /// @notice Event emitted when funds are allocated to a user.
    /// @param user The address of the user receiving the allocation.
    /// @param amount The amount of Ether allocated.
    event Allocated(address indexed user, uint256 indexed amount);

    /// @notice Event emitted when a user claims their allocation.
    /// @param user The address of the user who claimed the allocation.
    /// @param amount The total amount of Ether claimed.
    event Claimed(address indexed user, uint256 indexed amount);

    /// @notice Event emitted when the contract receives funding.
    /// @param user The address of the user who funded the contract.
    /// @param amount The amount of Ether received.
    event Funded(address indexed user, uint256 indexed amount);

    /// @notice Constructor.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    /**
     * @notice Allocates Ether to multiple users for either staking or trading.
     * @dev Only the Owner can call this function.
     * @param users The addresses of the users to allocate Ether to.
     * @param amounts The amounts of Ether to allocate to each user.
     */
    function allocateSei(address[] calldata users, uint256[] calldata amounts) external onlyOwner {
        require(users.length == amounts.length, IncentiveAlloc__ArrayLengthMismatch());
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < users.length; i++) {
            require(amounts[i] > 0, IncentiveAlloc__MustBeGreaterThanZero());
            incentives[users[i]].claimable += amounts[i];
            totalAmount += amounts[i];
            emit Allocated(users[i], amounts[i]);
        }

        require(address(this).balance >= totalAmount, IncentiveAlloc__NotEnoughSei());
    }

    /**
     * @notice Allows a user to claim their allocated Ether.
     * @dev Users can only claim their own allocations.
     */
    function claim() external {
        uint256 amount = incentives[msg.sender].claimable;
        require(amount > 0, IncentiveAlloc__NoAllocationAvailable());

        delete incentives[msg.sender].claimable;
        incentives[msg.sender].claimed += amount;

        (bool success,) = msg.sender.call{ value: amount }("");
        require(success, IncentiveAlloc__SeiTransferFailed());

        emit Claimed(msg.sender, amount);
    }

    /**
     * @notice Allows the owner to withdraw any unallocated Ether from the contract.
     * @dev Only the owner can call this function.
     */
    function withdrawUnallocated() external onlyOwner {
        uint256 unallocatedAmount = address(this).balance;
        require(unallocatedAmount > 0, IncentiveAlloc__NoUnallocatedSeiToWithdraw());
        address ownerAddr = owner();
        (bool success,) = ownerAddr.call{ value: unallocatedAmount }("");
        require(success, IncentiveAlloc__SeiWithdrawFailed());
    }

    /**
     * @notice Returns the total claimable and claimed Ether for a user.
     * @param user The address of the user.
     * @return claimable The total claimable amount of Ether.
     * @return claimed The total claimed amount of Ether.
     */
    function totalAllocations(address user) external view returns (uint256 claimable, uint256 claimed) {
        claimable = incentives[user].claimable;
        claimed = incentives[user].claimed;
    }

    /**
     * @notice Allows any user to fund the contract with Ether.
     */
    function fundVault() external payable {
        emit Funded(msg.sender, msg.value);
    }

    function getSeiBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Fallback function to accept Ether directly.
     */
    receive() external payable { }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }

}
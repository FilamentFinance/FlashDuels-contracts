// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC173} from "../interfaces/IERC173.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";

contract OwnershipFacet is IERC173 {
    /// @notice Transfers ownership of the contract to a new address.
    /// @param newOwner The address of the new owner to transfer ownership to.
    /// @dev Only the current contract owner can call this function.
    function transferOwnership(address newOwner) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.transferOwnership(newOwner);
    }

    /// @notice Retrieves the current owner's address.
    /// @return The address of the contract owner.
    function owner() external view override returns (address) {
        return LibDiamond.contractOwner();
    }

    /**
     * @notice Returns the address of the pending owner.
     * @dev This address is the one set to take over ownership upon acceptance.
     * @return The address of the pending owner.
     */
    function pendingOwner() external view returns (address) {
        return LibDiamond.pendingOwner();
    }

    // @note - zokyo-audit-fix-15
    /**
     * @notice Allows the pending owner to accept the transfer of ownership.
     * @dev Can only be called by the pending owner to finalize ownership transfer.
     * Emits an {OwnershipTransferred} event indicating the transfer from the previous owner.
     */
    function acceptOwnership() external {
        address previousOwner = LibDiamond.contractOwner();
        LibDiamond.acceptOwnership();
        emit OwnershipTransferred(previousOwner, msg.sender);
    }
}

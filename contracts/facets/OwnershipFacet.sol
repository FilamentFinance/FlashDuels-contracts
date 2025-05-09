// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC173} from "../interfaces/IERC173.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";

/// @title OwnershipFacet
/// @author FlashDuels
/// @notice This contract implements the ownership functionality for the diamond contract
/// @dev This facet handles ownership transfer and management through the diamond pattern
contract OwnershipFacet is IERC173 {
    /// @notice Transfers ownership of the contract to a new address
    /// @param newOwner The address of the new owner to transfer ownership to
    /// @dev Only the current contract owner can call this function
    /// @dev This initiates a two-step ownership transfer process
    function transferOwnership(address newOwner) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.transferOwnership(newOwner);
    }

    /// @notice Retrieves the current owner's address
    /// @return The address of the contract owner
    /// @dev This function is part of the IERC173 interface
    function owner() external view override returns (address) {
        return LibDiamond.contractOwner();
    }

    /// @notice Returns the address of the pending owner
    /// @return The address of the pending owner
    /// @dev This address is the one set to take over ownership upon acceptance
    /// @dev Returns address(0) if there is no pending owner
    function pendingOwner() external view returns (address) {
        return LibDiamond.pendingOwner();
    }

    /// @notice Allows the pending owner to accept the transfer of ownership
    /// @dev Can only be called by the pending owner to finalize ownership transfer
    /// @dev Emits an {OwnershipTransferred} event with the previous owner and new owner addresses
    /// @dev This completes the two-step ownership transfer process
    function acceptOwnership() external {
        address previousOwner = LibDiamond.contractOwner();
        LibDiamond.acceptOwnership();
        emit OwnershipTransferred(previousOwner, msg.sender);
    }
}

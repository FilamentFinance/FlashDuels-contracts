// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title Diamond
 * @author Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
 * @notice Implementation of the EIP-2535 Diamond standard
 * @dev This contract implements the core functionality of a diamond, including:
 *      - Diamond storage pattern for state management
 *      - Facet management for modular functionality
 *      - Function delegation through fallback mechanism
 *      - Upgradeability through diamond cut functionality
 */
import {IDiamondCut} from "./interfaces/IDiamondCut.sol";
import {LibDiamond} from "./libraries/LibDiamond.sol";

/// @title Diamond
/// @author Nick Mudge <nick@perfectabstractions.com>
/// @notice Implementation of the EIP-2535 Diamond standard
/// @dev This contract implements the core functionality of a diamond, including:
///      - Diamond storage pattern
///      - Facet management
///      - Function delegation
///      - Fallback handling
contract Diamond {
    /// @notice Thrown when a function does not exist in the diamond
    /// @dev This error is thrown when attempting to call a function that hasn't been added to the diamond
    error Diamond__FunctionDoesNotExist();

    /// @notice Initializes the diamond contract with an owner and diamond cut facet
    /// @dev This constructor:
    ///      - Sets the contract owner using LibDiamond
    ///      - Adds the diamondCut function from the diamondCutFacet
    ///      - Initializes the diamond storage
    ///      - Sets up the initial facet configuration
    /// @param _contractOwner The address that will be set as the contract owner
    /// @param _diamondCutFacet The address of the diamond cut facet that will be used for upgrades
    constructor(address _contractOwner, address _diamondCutFacet) payable {
        LibDiamond.setContractOwner(_contractOwner);

        // Add the diamondCut external function from the diamondCutFacet
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory functionSelectors = new bytes4[](1);
        functionSelectors[0] = IDiamondCut.diamondCut.selector;
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: _diamondCutFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: functionSelectors
        });

        LibDiamond.diamondCut(cut, address(0), "");
    }

    /// @notice Fallback function that handles all function calls to the diamond
    /// @dev This function:
    ///      - Retrieves the diamond storage using assembly
    ///      - Finds the facet address for the called function selector
    ///      - Delegates the call to the appropriate facet using delegatecall
    ///      - Returns any value from the delegated call
    ///      - Reverts if the function doesn't exist or the call fails
    /// @dev The function uses assembly for gas optimization and direct memory manipulation
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        // get diamond storage
        assembly {
            ds.slot := position
        }
        // get facet from function selector
        address facet = address(bytes20(ds.facets[msg.sig]));
        require(facet != address(0), Diamond__FunctionDoesNotExist());
        // Execute external function from facet using delegatecall and return any value.
        assembly {
            // copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
            // execute function call using the facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            // get any return value
            returndatacopy(0, 0, returndatasize())
            // return any return value or error back to the caller
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    /// @notice Receive function to accept incoming ether
    /// @dev This function allows the contract to receive ether payments
    /// @dev It is required for the contract to be able to receive ETH
    receive() external payable {}
}

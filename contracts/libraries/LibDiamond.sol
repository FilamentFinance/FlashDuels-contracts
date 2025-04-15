// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title LibDiamond
/// @author Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
/// @notice Library implementing the EIP-2535 Diamond Standard
/// @dev This library provides core functionality for the Diamond proxy pattern
/// @custom:see https://eips.ethereum.org/EIPS/eip-2535
import {IDiamondCut} from "../interfaces/IDiamondCut.sol";

error InitializationFunctionReverted(address _initializationContractAddress, bytes _calldata);
error OwnableUnauthorizedAccount(address _account);
error LibDiamond__MustBeContractOwner();
error LibDiamondCut__NoSelectorsInFacetToCut();
error LibDiamondCut__CanNotAddFunctionThatAlreadyExists();
error LibDiamondCut__CanNotReplaceImmutableFunction();
error LibDiamondCut__CanNotReplaceFunctionWithSameFunction();
error LibDiamondCut__CanNotReplaceFunctionThatDoesNotExist();
error LibDiamondCut__RemoveFacetAddressMustBeAddressZero();
error LibDiamondCut__CanNotRemoveFunctionThatDoesNotExist();
error LibDiamondCut__CanNotRemoveImmutableFunction();
error LibDiamondCut__IncorrectFacetCutAction();

/// @title LibDiamond
/// @notice Library implementing the Diamond proxy pattern storage and management
/// @dev Remember to add the loupe functions from DiamondLoupeFacet to the diamond.
/// @dev The loupe functions are required by the EIP2535 Diamonds standard
library LibDiamond {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.diamond.storage");

    /// @notice Diamond storage structure
    /// @dev Contains all the state variables for the Diamond proxy
    struct DiamondStorage {
        // maps function selectors to the facets that execute the functions.
        // and maps the selectors to their position in the selectorSlots array.
        // func selector => address facet, selector position
        mapping(bytes4 => bytes32) facets;
        // array of slots of function selectors.
        // each slot holds 8 function selectors.
        mapping(uint256 => bytes32) selectorSlots;
        // The number of function selectors in selectorSlots
        uint16 selectorCount;
        // Used to query if a contract implements an interface.
        // Used to implement ERC-165.
        mapping(bytes4 => bool) supportedInterfaces;
        // owner of the contract
        address contractOwner;
        // pending owner
        address pendingOwner;
    }

    /// @notice Returns the Diamond storage struct
    /// @return ds Diamond storage struct
    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    /// @notice Returns the address of the pending owner
    /// @return The address of the pending owner
    function pendingOwner() internal view returns (address) {
        DiamondStorage storage ds = diamondStorage();
        return ds.pendingOwner;
    }

    /// @notice Starts the ownership transfer of the contract to a new account
    /// @dev Replaces the pending transfer if there is one. Can only be called by the current owner
    /// @param newOwner The address of the new owner
    function transferOwnership(address newOwner) internal {
        DiamondStorage storage ds = diamondStorage();

        ds.pendingOwner = newOwner;
        emit OwnershipTransferStarted(ds.contractOwner, newOwner);
    }

    /// @notice Accepts the ownership transfer
    /// @dev Can only be called by the pending owner
    function acceptOwnership() internal {
        DiamondStorage storage ds = diamondStorage();

        if (pendingOwner() != msg.sender) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }
        delete ds.pendingOwner;
        LibDiamond.setContractOwner(msg.sender);
    }

    /// @notice Sets the contract owner
    /// @param _newOwner The address of the new owner
    function setContractOwner(address _newOwner) internal {
        DiamondStorage storage ds = diamondStorage();
        ds.contractOwner = _newOwner;
    }

    /// @notice Returns the current contract owner
    /// @return contractOwner_ The address of the current owner
    function contractOwner() internal view returns (address contractOwner_) {
        contractOwner_ = diamondStorage().contractOwner;
    }

    /// @notice Enforces that the caller is the contract owner
    /// @dev Reverts if the caller is not the contract owner
    function enforceIsContractOwner() internal view {
        require(msg.sender == diamondStorage().contractOwner, LibDiamond__MustBeContractOwner());
    }

    event DiamondCut(IDiamondCut.FacetCut[] _diamondCut, address _init, bytes _calldata);

    bytes32 constant CLEAR_ADDRESS_MASK = bytes32(uint256(0xffffffffffffffffffffffff));
    bytes32 constant CLEAR_SELECTOR_MASK = bytes32(uint256(0xffffffff << 224));

    /// @notice Internal function version of diamondCut
    /// @dev This code is almost the same as the external diamondCut, except it is using 'Facet[] memory _diamondCut' instead of 'Facet[] calldata _diamondCut'
    /// @param _diamondCut The array of facet cuts to perform
    /// @param _init The address of the initialization contract
    /// @param _calldata The calldata to pass to the initialization contract
    function diamondCut(IDiamondCut.FacetCut[] memory _diamondCut, address _init, bytes memory _calldata) internal {
        DiamondStorage storage ds = diamondStorage();
        uint256 originalSelectorCount = ds.selectorCount;
        uint256 selectorCount = originalSelectorCount;
        bytes32 selectorSlot;
        // Check if last selector slot is not full
        // "selectorCount & 7" is a gas efficient modulo by eight "selectorCount % 8"
        if (selectorCount & 7 > 0) {
            // get last selectorSlot
            // "selectorSlot >> 3" is a gas efficient division by 8 "selectorSlot / 8"
            selectorSlot = ds.selectorSlots[selectorCount >> 3];
        }
        // loop through diamond cut
        for (uint256 facetIndex; facetIndex < _diamondCut.length; ) {
            (selectorCount, selectorSlot) = addReplaceRemoveFacetSelectors(
                selectorCount,
                selectorSlot,
                _diamondCut[facetIndex].facetAddress,
                _diamondCut[facetIndex].action,
                _diamondCut[facetIndex].functionSelectors
            );

            unchecked {
                facetIndex++;
            }
        }
        if (selectorCount != originalSelectorCount) {
            ds.selectorCount = uint16(selectorCount);
        }
        // If last selector slot is not full
        // "selectorCount & 7" is a gas efficient modulo by eight "selectorCount % 8"
        if (selectorCount & 7 > 0) {
            // "selectorSlot >> 3" is a gas efficient division by 8 "selectorSlot / 8"
            ds.selectorSlots[selectorCount >> 3] = selectorSlot;
        }
        emit DiamondCut(_diamondCut, _init, _calldata);
        initializeDiamondCut(_init, _calldata);
    }

    /// @notice Adds, replaces, or removes facet selectors
    /// @param _selectorCount The current selector count
    /// @param _selectorSlot The current selector slot
    /// @param _newFacetAddress The address of the new facet
    /// @param _action The action to perform (Add, Replace, Remove)
    /// @param _selectors The selectors to modify
    /// @return The new selector count and selector slot
    function addReplaceRemoveFacetSelectors(
        uint256 _selectorCount,
        bytes32 _selectorSlot,
        address _newFacetAddress,
        IDiamondCut.FacetCutAction _action,
        bytes4[] memory _selectors
    ) internal returns (uint256, bytes32) {
        DiamondStorage storage ds = diamondStorage();
        require(_selectors.length > 0, LibDiamondCut__NoSelectorsInFacetToCut());
        if (_action == IDiamondCut.FacetCutAction.Add) {
            enforceHasContractCode(_newFacetAddress, "LibDiamondCut: Add facet has no code");
            for (uint256 selectorIndex; selectorIndex < _selectors.length;) {
                bytes4 selector = _selectors[selectorIndex];
                bytes32 oldFacet = ds.facets[selector];
                require(
                    address(bytes20(oldFacet)) == address(0),
                    LibDiamondCut__CanNotAddFunctionThatAlreadyExists()
                );
                // add facet for selector
                ds.facets[selector] = bytes20(_newFacetAddress) | bytes32(_selectorCount);
                // "_selectorCount & 7" is a gas efficient modulo by eight "_selectorCount % 8"
                // " << 5 is the same as multiplying by 32 ( * 32)
                uint256 selectorInSlotPosition = (_selectorCount & 7) << 5;
                // clear selector position in slot and add selector
                _selectorSlot =
                    (_selectorSlot & ~(CLEAR_SELECTOR_MASK >> selectorInSlotPosition)) |
                    (bytes32(selector) >> selectorInSlotPosition);
                // if slot is full then write it to storage
                if (selectorInSlotPosition == 224) {
                    // "_selectorSlot >> 3" is a gas efficient division by 8 "_selectorSlot / 8"
                    ds.selectorSlots[_selectorCount >> 3] = _selectorSlot;
                    _selectorSlot = 0;
                }
                _selectorCount++;

                unchecked {
                    selectorIndex++;
                }
            }
        } else if (_action == IDiamondCut.FacetCutAction.Replace) {
            enforceHasContractCode(_newFacetAddress, "LibDiamondCut: Replace facet has no code");
            for (uint256 selectorIndex; selectorIndex < _selectors.length;) {
                bytes4 selector = _selectors[selectorIndex];
                bytes32 oldFacet = ds.facets[selector];
                address oldFacetAddress = address(bytes20(oldFacet));
                // only useful if immutable functions exist
                require(oldFacetAddress != address(this), LibDiamondCut__CanNotReplaceImmutableFunction());
                require(
                    oldFacetAddress != _newFacetAddress,
                    LibDiamondCut__CanNotReplaceFunctionWithSameFunction()
                );
                require(oldFacetAddress != address(0), LibDiamondCut__CanNotReplaceFunctionThatDoesNotExist());
                // replace old facet address
                ds.facets[selector] = (oldFacet & CLEAR_ADDRESS_MASK) | bytes20(_newFacetAddress);

                unchecked {
                    selectorIndex++;
                }
            }
        } else if (_action == IDiamondCut.FacetCutAction.Remove) {
            require(_newFacetAddress == address(0), LibDiamondCut__RemoveFacetAddressMustBeAddressZero());
            // "_selectorCount >> 3" is a gas efficient division by 8 "_selectorCount / 8"
            uint256 selectorSlotCount = _selectorCount >> 3;
            // "_selectorCount & 7" is a gas efficient modulo by eight "_selectorCount % 8"
            uint256 selectorInSlotIndex = _selectorCount & 7;
            for (uint256 selectorIndex; selectorIndex < _selectors.length; ) {
                if (_selectorSlot == 0) {
                    // get last selectorSlot
                    selectorSlotCount--;
                    _selectorSlot = ds.selectorSlots[selectorSlotCount];
                    selectorInSlotIndex = 7;
                } else {
                    selectorInSlotIndex--;
                }
                bytes4 lastSelector;
                uint256 oldSelectorsSlotCount;
                uint256 oldSelectorInSlotPosition;
                // adding a block here prevents stack too deep error
                {
                    bytes4 selector = _selectors[selectorIndex];
                    bytes32 oldFacet = ds.facets[selector];
                    require(
                        address(bytes20(oldFacet)) != address(0),
                        LibDiamondCut__CanNotRemoveFunctionThatDoesNotExist()
                    );
                    // only useful if immutable functions exist
                    require(
                        address(bytes20(oldFacet)) != address(this),
                        LibDiamondCut__CanNotRemoveImmutableFunction()
                    );
                    // replace selector with last selector in ds.facets
                    // gets the last selector
                    // " << 5 is the same as multiplying by 32 ( * 32)
                    lastSelector = bytes4(_selectorSlot << (selectorInSlotIndex << 5));
                    if (lastSelector != selector) {
                        // update last selector slot position info
                        ds.facets[lastSelector] = (oldFacet & CLEAR_ADDRESS_MASK) | bytes20(ds.facets[lastSelector]);
                    }
                    delete ds.facets[selector];
                    uint256 oldSelectorCount = uint16(uint256(oldFacet));
                    // "oldSelectorCount >> 3" is a gas efficient division by 8 "oldSelectorCount / 8"
                    oldSelectorsSlotCount = oldSelectorCount >> 3;
                    // "oldSelectorCount & 7" is a gas efficient modulo by eight "oldSelectorCount % 8"
                    // " << 5 is the same as multiplying by 32 ( * 32)
                    oldSelectorInSlotPosition = (oldSelectorCount & 7) << 5;
                }
                if (oldSelectorsSlotCount != selectorSlotCount) {
                    bytes32 oldSelectorSlot = ds.selectorSlots[oldSelectorsSlotCount];
                    // clears the selector we are deleting and puts the last selector in its place.
                    oldSelectorSlot =
                        (oldSelectorSlot & ~(CLEAR_SELECTOR_MASK >> oldSelectorInSlotPosition)) |
                        (bytes32(lastSelector) >> oldSelectorInSlotPosition);
                    // update storage with the modified slot
                    ds.selectorSlots[oldSelectorsSlotCount] = oldSelectorSlot;
                } else {
                    // clears the selector we are deleting and puts the last selector in its place.
                    _selectorSlot =
                        (_selectorSlot & ~(CLEAR_SELECTOR_MASK >> oldSelectorInSlotPosition)) |
                        (bytes32(lastSelector) >> oldSelectorInSlotPosition);
                }
                if (selectorInSlotIndex == 0) {
                    delete ds.selectorSlots[selectorSlotCount];
                    _selectorSlot = 0;
                }

                unchecked {
                    selectorIndex++;
                }
            }
            _selectorCount = selectorSlotCount * 8 + selectorInSlotIndex;
        } else {
            revert LibDiamondCut__IncorrectFacetCutAction();
        }
        return (_selectorCount, _selectorSlot);
    }

    /// @notice Initializes the diamond cut
    /// @param _init The address of the initialization contract
    /// @param _calldata The calldata to pass to the initialization contract
    function initializeDiamondCut(address _init, bytes memory _calldata) internal {
        if (_init == address(0)) {
            return;
        }
        enforceHasContractCode(_init, "LibDiamondCut: _init address has no code");
        (bool success, bytes memory error) = _init.delegatecall(_calldata);
        if (!success) {
            if (error.length > 0) {
                // bubble up error
                /// @solidity memory-safe-assembly
                assembly {
                    let returndata_size := mload(error)
                    revert(add(32, error), returndata_size)
                }
            } else {
                revert InitializationFunctionReverted(_init, _calldata);
            }
        }
    }

    /// @notice Enforces that a contract has code
    /// @param _contract The address of the contract to check
    /// @param _errorMessage The error message to revert with if the contract has no code
    function enforceHasContractCode(address _contract, string memory _errorMessage) internal view {
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(_contract)
        }
        require(contractSize > 0, _errorMessage);
    }
}

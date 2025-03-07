// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AppStorage} from "../AppStorage.sol";

library LibFlashDuels {
    struct LibFlashDuelsAppStorage {
        uint256 nonce;
        mapping(string => bool) isValidDuelId;
    }

    // Function to get the storage struct
    function appStorage() internal pure returns (LibFlashDuelsAppStorage storage s) {
        bytes32 position = keccak256("diamond.storage.LibFlashDuels");
        assembly {
            s.slot := position
        }
    }

    /// @notice Generates a unique duel ID based on user and block details
    /// @dev Uses the user address, block data, and a nonce to generate a unique ID via keccak256 hashing
    /// @param userAddress The address of the user creating the duel
    /// @return duelIdStr A string representing the unique duel ID
    function _generateDuelId(address userAddress) internal returns (string memory) {
        LibFlashDuelsAppStorage storage s = appStorage();
        
        s.nonce++; // Increment nonce to ensure uniqueness

        // Generate a new duel ID using keccak256
        bytes32 newId = keccak256(
            abi.encodePacked(block.timestamp, block.prevrandao, userAddress, s.nonce, blockhash(block.number - 1))
        );

        // Convert the bytes32 ID to a string
        string memory duelIdStr = toHexString(newId);

        // Ensure the generated ID is unique
        require(!s.isValidDuelId[duelIdStr], "ID collision detected");

        // Mark the ID as used
        s.isValidDuelId[duelIdStr] = true;

        return duelIdStr;
    }

    /// @notice Converts a bytes32 value to its hexadecimal string representation
    /// @dev Used for converting the keccak256 hash to a readable string
    /// @param _bytes The bytes32 value to be converted to a string
    /// @return A string representing the hexadecimal version of the bytes32 input
    function toHexString(bytes32 _bytes) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(64); // Each byte takes 2 hex characters (32 bytes = 64 hex characters)
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2] = hexChars[uint8(_bytes[i] >> 4)]; // First nibble (4 bits)
            str[1 + i * 2] = hexChars[uint8(_bytes[i] & 0x0f)]; // Second nibble (4 bits)
        }

        return string(str);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Duel, CryptoDuel} from "../AppStorage.sol";

interface IFlashDuels {
    function getDuel(string memory duelId) external view returns (Duel memory);
    function duels(string memory duelId) external view returns (Duel memory);
    function cryptoDuels(string memory cryptoDuelId) external view returns (CryptoDuel memory);
    function getOptionIndexToOptionToken(
        string memory cryptoDuelId,
        uint256 optionIndex
    ) external view returns (address);
}

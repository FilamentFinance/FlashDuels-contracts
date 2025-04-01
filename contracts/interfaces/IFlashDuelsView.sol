// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Duel, CryptoDuel} from "../AppStorage.sol";

interface IFlashDuelsView {
    function checkIfThresholdMet(string memory duelId) external view returns (bool);
    function getUserDuelOptionShare(
        string memory _duelId,
        uint256 _optionIndex,
        address _user
    ) external view returns (uint256 optionShare);
    function getDuel(string memory _duelId) external view returns (Duel memory);
    function getCryptoDuel(string memory _duelId) external view returns (CryptoDuel memory);
    function getOptionIndexToOptionToken(
        string memory cryptoDuelId,
        uint256 optionIndex
    ) external view returns (address);
}

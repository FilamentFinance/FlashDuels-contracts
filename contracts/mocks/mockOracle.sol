// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockOracle {
    int256 private price;

    // Set the price in the mock oracle
    function setPrice(int256 _price) external {
        price = _price;
    }

    // Get the current price (mimics Chainlink oracle's latestRoundData function)
    function latestAnswer() external view returns (int256) {
        return price;
    }

    // Optionally, you can mimic Chainlink's more complex `latestRoundData` if needed
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (0, price, block.timestamp, block.timestamp, 0);
    }
}

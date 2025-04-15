// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title MockOracle
/// @notice A mock oracle contract that simulates a price feed oracle
/// @dev This contract is used for testing purposes to simulate price feed behavior
contract MockOracle {
    int256 private price;

    /// @notice Sets the mock price value
    /// @dev This function allows setting an arbitrary price value for testing
    /// @param _price The price value to set
    function setPrice(int256 _price) external {
        price = _price;
    }

    /// @notice Returns the current mock price
    /// @dev Mimics Chainlink oracle's latestAnswer function
    /// @return The current price value
    function latestAnswer() external view returns (int256) {
        return price;
    }

    /// @notice Returns the current mock price with additional metadata
    /// @dev Mimics Chainlink oracle's latestRoundData function
    /// @return roundId The round ID (always 0 for mock)
    /// @return answer The current price value
    /// @return startedAt The timestamp when the round started (current block timestamp)
    /// @return updatedAt The timestamp when the round was updated (current block timestamp)
    /// @return answeredInRound The round ID in which the answer was computed (always 0 for mock)
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (0, price, block.timestamp, block.timestamp, 0);
    }
}

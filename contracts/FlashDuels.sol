// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract FlashDuels is UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    uint256 public constant minThreshold = 50_000_000; // $50

    /// @notice Struct to store details of each duel
    struct Duel {
        /// @notice Address of the creator of the duel
        address creator;
        /// @notice Address of the first token used in the duel
        address tokenA;
        /// @notice Address of the second token used in the duel
        address tokenB;
        /// @notice Create time of the duel in UNIX timestamp
        uint256 createTime;
        /// @notice Expiry time of the duel in UNIX timestamp
        uint256 expiryTime;
        /// @notice Minimum wager amount for the duel
        uint256 minWager;
        /// @notice Total amount wagered on token A
        uint256 totalWagerA;
        /// @notice Total amount wagered on token B
        uint256 totalWagerB;
        /// @notice Status indicating if the duel is live
        bool isLive;
        /// @notice Status indicating if the duel is settled
        bool isSettled;
        /// @notice Start time of the duel in UNIX timestamp
        uint256 startTime;
        /// @notice Starting price of token A at the beginning of the duel
        int256 startPriceA;
        /// @notice Starting price of token B at the beginning of the duel
        int256 startPriceB;
        /// @notice Duel user of token A
        address[] duelUsersA;
        /// @notice Duel user of token B
        address[] duelUsersB;
        /// @notice Mapping of addresses to their wager amounts on token A
        mapping(address => uint256) wagersA;
        /// @notice Mapping of addresses to their wager amounts on token B
        mapping(address => uint256) wagersB;
    }

    /// @notice USDC contract address
    address public usdc;
    /// @notice Counter for the total number of duels created
    uint256 public duelCounter;
    /// @notice Fee in wei to create a duel (default 1 SEI token equivalent)
    uint256 public createDuelFee = 1 * 10 ** 18;
    /// @notice Protocol fee percentage (2% by default)
    uint256 public protocolFeePercentage = 200;
    /// @notice Creator fee percentage (2% by default)
    uint256 public creatorFeePercentage = 200;
    /// @notice Bootstrap period duration before the duel goes live (30 minutes)
    uint256 public bootstrapPeriod = 30 minutes;
    /// @notice Mapping from duel ID to the Duel struct
    mapping(uint256 => Duel) public duels;
    /// @notice Mapping of supported token addresses
    mapping(address => bool) public supportedTokens;
    /// @notice Mapping of supported token addresses to aggregator
    mapping(address => address) public priceAggregator;

    /// @notice Enum representing the supported expiry times
    enum ExpiryTime {
        ThreeHours,
        SixHours,
        TwelveHours
    }

    event DuelCreated(
        uint256 indexed duelId,
        address indexed creator,
        address tokenA,
        address tokenB,
        uint256 createTime,
        uint256 expiryTime
    );
    event DuelJoined(
        uint256 indexed duelId, address indexed participant, address token, uint256 amount, uint256 joinTime
    );
    event DuelStarted(uint256 indexed duelId, uint256 startTime);
    event DuelSettled(uint256 indexed duelId, address indexed winningToken);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the contract with the USDC token address
    /// @param _usdc The address of the USDC token contract
    function initialize(address _usdc) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __UUPSUpgradeable_init();
        usdc = _usdc;
    }

    function addSupportedToken(address _token) external onlyOwner {
        supportedTokens[_token] = true;
    }

    // ========================== External Functions ========================== //

    /// @notice Pause the contract, disabling certain functions
    /// @dev Can only be called by the owner
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract, enabling certain functions
    /// @dev Can only be called by the owner
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Set the price aggregator for a specific token
     * @param _token The address of the token
     * @param _aggregator The address of the Chainlink price feed aggregator for the token
     */
    function setPriceAggregator(address _token, address _aggregator) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(_aggregator != address(0), "Invalid aggregator address");

        priceAggregator[_token] = _aggregator;
    }

    /// @notice Creates a new duel with the specified parameters
    /// @dev Allows any user to create a duel using two supported tokens and a predefined expiry time.
    ///      A SEI fee is required for duel creation. The duel starts after the bootstrap period.
    /// @param _tokenA The address of the first token used in the duel (e.g., WIF).
    /// @param _tokenB The address of the second token used in the duel (e.g., PEPE).
    /// @param _expiryTime The predefined expiry time option for the duel: 3 hours, 6 hours, or 12 hours after the start.
    /// @param _minWager The minimum wager amount required for the duel.
    /// @notice Requires a minimum of 1 SEI token as a fee to create a duel.
    /// @notice The duel will start after a 30-minute bootstrap period and remain active for the selected expiry duration.
    function createDuel(address _tokenA, address _tokenB, ExpiryTime _expiryTime, uint256 _minWager)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        require(supportedTokens[_tokenA] && supportedTokens[_tokenB], "Unsupported tokens");
        require(msg.value >= 1 * 10 ** 18, "Minimum 1 SEI required to create a duel");

        // Determine the expiry duration based on the selected enum value
        uint256 expiryDuration;
        if (_expiryTime == ExpiryTime.ThreeHours) {
            expiryDuration = 3 hours;
        } else if (_expiryTime == ExpiryTime.SixHours) {
            expiryDuration = 6 hours;
        } else if (_expiryTime == ExpiryTime.TwelveHours) {
            expiryDuration = 12 hours;
        } else {
            revert("Invalid expiry time");
        }

        duelCounter++;
        Duel storage duel = duels[duelCounter];
        duel.creator = msg.sender;
        duel.tokenA = _tokenA;
        duel.tokenB = _tokenB;
        duel.createTime = block.timestamp;
        duel.expiryTime = block.timestamp + bootstrapPeriod + expiryDuration;
        duel.minWager = _minWager;
        duel.isLive = false;
        duel.isSettled = false;

        emit DuelCreated(duelCounter, msg.sender, _tokenA, _tokenB, duel.createTime, duel.expiryTime);
    }

    /// @notice Allows a user to join an existing duel by placing a wager on one of the two sides.
    /// @dev Users must choose one of the tokens used in the duel and place a wager. The function ensures that the duel exists,
    ///      is live, and the token selected is valid for the duel.
    /// @param _duelId The ID of the duel to join.
    /// @param _token The address of the token to wager (must be either token A or token B of the duel).
    /// @param _amount The amount of the token to wager in the duel.
    /// @notice The user must join the duel before it expires. The duel must meet the minimum threshold to go live.
    function joinDuel(uint256 _duelId, address _token, uint256 _amount) external nonReentrant whenNotPaused {
        Duel storage duel = duels[_duelId];
        require(_duelId != 0 && duel.createTime != 0, "Duel doesn't exist");
        require(block.timestamp < duel.expiryTime, "Duel expired");
        require(_token == duel.tokenA || _token == duel.tokenB, "Invalid token for this duel");
        require(_amount >= duel.minWager, "Wager below minimum");

        if (_token == duel.tokenA) {
            duel.wagersA[msg.sender] += _amount;
            duel.totalWagerA += _amount;
            duel.duelUsersA.push(msg.sender);
        } else {
            duel.wagersB[msg.sender] += _amount;
            duel.totalWagerB += _amount;
            duel.duelUsersB.push(msg.sender);
        }

        require(IERC20(_token).transferFrom(msg.sender, address(this), _amount), "Token transfer failed");

        emit DuelJoined(_duelId, msg.sender, _token, _amount, block.timestamp);
    }

    /// @notice Starts the duel once the bootstrap period has ended and minimum wagers have been met on both sides.
    /// @dev The duel must have met the minimum wager requirements for both tokens, and the bootstrap period must have ended.
    ///      The function fetches the initial prices for both tokens from an oracle and marks the duel as live.
    /// @param _duelId The ID of the duel to start.
    function startDuel(uint256 _duelId) external nonReentrant whenNotPaused {
        Duel storage duel = duels[_duelId];
        require(_duelId != 0 && duel.createTime != 0, "Duel doesn't exist");

        // Ensure the bootstrap period has ended
        require(block.timestamp >= duel.createTime + bootstrapPeriod, "Bootstrap period not ended");

        // Ensure the duel is not already live
        require(!duel.isLive, "Duel already live");

        // Ensure both tokens have met the minimum wager requirements
        require(
            duel.totalWagerA >= minThreshold && duel.totalWagerB >= minThreshold,
            "Threshold not reach to start the duel"
        );

        // Fetch initial prices from oracle for both tokens (implementation depends on oracle)
        duel.startPriceA = getOraclePrice(duel.tokenA);
        duel.startPriceB = getOraclePrice(duel.tokenB);

        // Record the start time and mark the duel as live
        duel.startTime = block.timestamp;
        uint256 duelDuration = duel.expiryTime - (duel.createTime + bootstrapPeriod);
        duel.expiryTime = block.timestamp + duelDuration;
        duel.isLive = true;

        emit DuelStarted(_duelId, duel.startTime);
    }

    function settleDuel(uint256 _duelId) external nonReentrant {
        Duel storage duel = duels[_duelId];
        require(duel.isLive, "Duel not live");
        require(block.timestamp >= duel.expiryTime, "Duel not expired");
        require(!duel.isSettled, "Duel already settled");

        (int256 deltaA, int256 deltaB) = _getPriceDelta(_duelId);

        address winningToken = deltaA > deltaB ? duel.tokenA : duel.tokenB;

        // Calculate and distribute winnings
        uint256 protocolFee;
        uint256 creatorFee;
        uint256 payout;

        if (winningToken == duel.tokenA) {
            protocolFee = (duel.totalWagerB * protocolFeePercentage) / 10000;
            creatorFee = (duel.totalWagerB * creatorFeePercentage) / 10000;
            payout = duel.totalWagerB - protocolFee - creatorFee;

            distributeWinnings(duel, true, payout);
        } else {
            protocolFee = (duel.totalWagerA * protocolFeePercentage) / 10000;
            creatorFee = (duel.totalWagerA * creatorFeePercentage) / 10000;
            payout = duel.totalWagerA - protocolFee - creatorFee;

            distributeWinnings(duel, false, payout);
        }

        duel.isSettled = true;

        emit DuelSettled(_duelId, winningToken);
    }

    function distributeWinnings(Duel storage duel, bool isTokenAWinning, uint256 payout) internal {
        if (isTokenAWinning) {
            uint256 duelUserALength = duel.duelUsersA.length;
            for (uint256 i = 0; i < duelUserALength; i++) {
                address userA = duel.duelUsersA[i];
                uint256 userWager = duel.wagersA[userA];
                uint256 userPayout = (userWager * payout) / duel.totalWagerA;
                IERC20(usdc).transfer(userA, userPayout);
            }
        } else {
            uint256 duelUserBLength = duel.duelUsersB.length;
            for (uint256 i = 0; i < duelUserBLength; i++) {
                address userB = duel.duelUsersB[i];
                uint256 userWagerB = duel.wagersB[userB];
                uint256 userPayout = (userWagerB * payout) / duel.totalWagerB;
                IERC20(usdc).transfer(userB, userPayout);
            }
        }
    }

    function withdrawFees() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    function withdrawFunds() external onlyOwner {
        uint256 balance = IERC20(usdc).balanceOf(address(this));
        require(balance > 0, "No funds available");
        IERC20(usdc).transfer(msg.sender, balance);
    }

    /**
     * @notice Get the price from the oracle for a specific token
     * @param _token The address of the token
     * @return int256 The latest price from the oracle, in 8 decimals
     */
    function getOraclePrice(address _token) public view returns (int256) {
        address aggregator = priceAggregator[_token];
        require(aggregator != address(0), "Price aggregator not set");

        AggregatorV3Interface priceFeed = AggregatorV3Interface(aggregator);
        (, int256 price,,,) = priceFeed.latestRoundData();
        return price;
    }

    /**
     * @notice Calculates the price delta for tokens in a duel
     * @param _duelId The ID of the duel
     * @return (int256, int256) The price delta for the tokens
     */
    function getPriceDelta(uint256 _duelId) public view returns (int256, int256) {
        return _getPriceDelta(_duelId);
    }

    function _getPriceDelta(uint256 _duelId) public view returns (int256, int256) {
        Duel storage duel = duels[_duelId];
        // Ensure the price aggregator is set for the token
        address aggregatorA = priceAggregator[duel.tokenA];
        address aggregatorB = priceAggregator[duel.tokenB];
        require(aggregatorA != address(0), "Price aggregator A not set");
        require(aggregatorB != address(0), "Price aggregator B not set");

        // Fetch the latest price from the oracle
        AggregatorV3Interface priceFeedA = AggregatorV3Interface(aggregatorA);
        (, int256 currentPriceA,,,) = priceFeedA.latestRoundData();

        AggregatorV3Interface priceFeedB = AggregatorV3Interface(aggregatorB);
        (, int256 currentPriceB,,,) = priceFeedB.latestRoundData();

        // Calculate and return the price delta
        return (currentPriceA - duel.startPriceA, currentPriceB - duel.startPriceB);
    }

    /// @notice Authorize an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation contract
    /// @dev Can only be called by the owner
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

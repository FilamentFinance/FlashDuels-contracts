// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract FlashDuels is
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    error FlashDuels__InvalidBot();

    uint256 public constant minThreshold = 50 * 1e18; // $50 or 50 SEI can be configurred

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
    /// @notice Bot address for starting duel
    address public bot;
    /// @notice Counter for the total number of duels created
    uint256 public duelCounter;
    /// @notice Fee in wei to create a duel (default 1 SEI token equivalent)
    uint256 public createDuelFee;
    /// @notice Protocol fee percentage (2% by default)
    uint256 public protocolFeePercentage;
    /// @notice Creator fee percentage (2% by default)
    uint256 public creatorFeePercentage;
    /// @notice Bootstrap period duration before the duel goes live (30 minutes)
    uint256 public bootstrapPeriod;
    /// @notice Mapping from duel ID to the Duel struct
    mapping(uint256 => Duel) public duels;
    /// @notice Mapping of supported token addresses
    mapping(address => bool) public supportedTokens;
    /// @notice Mapping of supported token addresses to aggregator
    mapping(address => address) public priceAggregator;

    /// @notice Enum representing the supported duel duration
    enum DuelDuration {
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
        uint256 indexed duelId,
        address indexed participant,
        address token,
        uint256 amount,
        uint256 joinTime
    );
    event DuelStarted(uint256 indexed duelId, uint256 startTime);
    event DuelSettled(uint256 indexed duelId, address indexed winningToken);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the contract with the USDC token address
    /// @param _usdc The address of the USDC token contract
    /// @param _bot The address of the bot for starting duel
    function initialize(address _usdc, address _bot) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __UUPSUpgradeable_init();
        usdc = _usdc;
        bot = _bot;
        createDuelFee = 1 * 1e18;
        protocolFeePercentage = 200;
        creatorFeePercentage = 200;
        bootstrapPeriod = 30 minutes;
    }

    /**
     * @dev Modifier to restrict function access to only the bot address.
     */
    modifier onlyBot() {
        require(bot == msg.sender, FlashDuels__InvalidBot());
        _;
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

    function addSupportedToken(address _token) external onlyOwner {
        supportedTokens[_token] = true;
    }

    /**
     * @notice Set the price aggregator for a specific token
     * @param _token The address of the token
     * @param _aggregator The address of the Chainlink price feed aggregator for the token
     */
    function setPriceAggregator(
        address _token,
        address _aggregator
    ) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(_aggregator != address(0), "Invalid aggregator address");

        priceAggregator[_token] = _aggregator;
    }

    /// @notice Creates a new duel with the specified parameters
    /// @dev Allows any user to create a duel using two supported tokens and a predefined duel duration.
    ///      A SEI fee is required for duel creation. The duel starts after the bootstrap period.
    /// @param _tokenA The address of the first token used in the duel (e.g., WIF).
    /// @param _tokenB The address of the second token used in the duel (e.g., PEPE).
    /// @param _duelDuration The predefined duration for the duel: 3 hours, 6 hours, or 12 hours after the start.
    /// @param _minWager The minimum wager amount required for the duel.
    /// @notice Requires a minimum of 1 SEI token as a fee to create a duel.
    /// @notice The duel will start after a 30-minute bootstrap period and remain active for the selected expiry duration.
    function createDuel(
        address _tokenA,
        address _tokenB,
        DuelDuration _duelDuration,
        uint256 _minWager
    ) external payable nonReentrant whenNotPaused {
        require(
            supportedTokens[_tokenA] && supportedTokens[_tokenB],
            "Unsupported tokens"
        );
        require(
            msg.value >= 1 * 10 ** 18,
            "Minimum 1 SEI required to create a duel"
        );

        // Determine the expiry duration based on the selected enum value
        uint256 duelDuration;
        if (_duelDuration == DuelDuration.ThreeHours) {
            duelDuration = 3 hours;
        } else if (_duelDuration == DuelDuration.SixHours) {
            duelDuration = 6 hours;
        } else if (_duelDuration == DuelDuration.TwelveHours) {
            duelDuration = 12 hours;
        } else {
            revert("Invalid expiry time");
        }

        duelCounter++;
        Duel storage duel = duels[duelCounter];
        duel.creator = msg.sender;
        duel.tokenA = _tokenA;
        duel.tokenB = _tokenB;
        duel.createTime = block.timestamp;
        duel.expiryTime = block.timestamp + bootstrapPeriod + duelDuration;
        duel.minWager = _minWager;
        duel.isLive = false;
        duel.isSettled = false;

        emit DuelCreated(
            duelCounter,
            msg.sender,
            _tokenA,
            _tokenB,
            duel.createTime,
            duel.expiryTime
        );
    }

    /// @notice Allows a user to join an existing duel by placing a wager on one of the two sides.
    /// @dev Users must choose one of the tokens used in the duel and place a wager. The function ensures that the duel exists,
    ///      is live, and the token selected is valid for the duel.
    /// @param _duelId The ID of the duel to join.
    /// @param _token The address of the token to wager (must be either token A or token B of the duel).
    /// @param _amount The amount of the token to wager in the duel.
    /// @notice The user must join the duel before it expires. The duel must meet the minimum threshold to go live.
    function joinDuel(
        uint256 _duelId,
        address _token,
        uint256 _amount
    ) external nonReentrant whenNotPaused {
        Duel storage duel = duels[_duelId];
        require(_duelId != 0 && duel.createTime != 0, "Duel doesn't exist");
        require(block.timestamp < duel.expiryTime, "Duel expired");
        require(
            _token == duel.tokenA || _token == duel.tokenB,
            "Invalid token for this duel"
        );
        require(_amount >= duel.minWager, "Wager below minimum");
        // or, if native token
        // require(msg.value >= duel.minWager, "Wager below minimum");

        if (_token == duel.tokenA) {
            duel.wagersA[msg.sender] += _amount;
            duel.totalWagerA += _amount;
            duel.duelUsersA.push(msg.sender);
        } else {
            duel.wagersB[msg.sender] += _amount;
            duel.totalWagerB += _amount;
            duel.duelUsersB.push(msg.sender);
        }
        // @note - whether to recieve in tokens or usdc
        require(
            IERC20(_token).transferFrom(msg.sender, address(this), _amount),
            "Token transfer failed"
        );

        emit DuelJoined(_duelId, msg.sender, _token, _amount, block.timestamp);
    }

    /// @notice Starts the duel once the bootstrap period has ended and minimum wagers have been met on both sides.
    /// @dev The duel must have met the minimum wager requirements for both tokens, and the bootstrap period must have ended.
    ///      The function fetches the initial prices for both tokens from an oracle and marks the duel as live.
    /// @param _duelId The ID of the duel to start.
    function startDuel(
        uint256 _duelId
    ) external nonReentrant whenNotPaused onlyBot {
        Duel storage duel = duels[_duelId];
        require(_duelId != 0 && duel.createTime != 0, "Duel doesn't exist");

        // Ensure the bootstrap period has ended
        require(
            block.timestamp >= duel.createTime + bootstrapPeriod,
            "Bootstrap period not ended"
        );

        // Ensure the duel is not already live
        require(!duel.isLive, "Duel already live");

        // Ensure both tokens have met the minimum wager requirements
        require(
            duel.totalWagerA >= minThreshold &&
                duel.totalWagerB >= minThreshold,
            "Threshold not reach to start the duel"
        );

        // Fetch initial prices from oracle for both tokens (implementation depends on oracle)
        duel.startPriceA = getOraclePrice(duel.tokenA);
        duel.startPriceB = getOraclePrice(duel.tokenB);

        // Record the start time and mark the duel as live
        duel.startTime = block.timestamp;
        uint256 duelDuration = duel.expiryTime -
            (duel.createTime + bootstrapPeriod);
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
        duel.isLive = false;
        duel.isSettled = true;

        emit DuelSettled(_duelId, winningToken);
    }

    // Fallback and receive functions
    fallback() external payable {}
    receive() external payable {}

    /**
     * @notice Distributes winnings to the users who bet on the winning side.
     * @dev This function calculates and distributes both the winning token and a portion of the losing token to the winners.
     * It transfers the respective amounts based on each user's wager proportionally.
     * @param duel The duel for which the winnings are being distributed.
     * @param isTokenAWinner A boolean indicating if token A is the winning token. If true, token A is the winner, else token B is.
     * @param payout The total amount of the winning token to be distributed among the winners.
     */
    function distributeWinnings(
        Duel storage duel,
        bool isTokenAWinner,
        uint256 payout
    ) internal {
        // Determine the winning and losing tokens based on the outcome of the duel
        address winningToken = isTokenAWinner ? duel.tokenA : duel.tokenB;
        address losingToken = isTokenAWinner ? duel.tokenB : duel.tokenA;

        // Get the list of winners and their respective wagers based on the outcome
        address[] storage winners = isTokenAWinner
            ? duel.duelUsersA
            : duel.duelUsersB;
        mapping(address => uint256) storage winningWagers = isTokenAWinner
            ? duel.wagersA
            : duel.wagersB;

        // Total amounts wagered by both sides
        uint256 totalWinningWagers = isTokenAWinner
            ? duel.totalWagerA
            : duel.totalWagerB;
        uint256 totalLosingWagers = isTokenAWinner
            ? duel.totalWagerB
            : duel.totalWagerA;

        // Iterate over all winners to calculate and distribute their winnings
        for (uint256 i = 0; i < winners.length; i++) {
            address winner = winners[i];
            uint256 winnerWager = winningWagers[winner];

            // Calculate the proportion of the total wagered amount contributed by the winner
            uint256 winnerShare = (winnerWager * 1e18) / totalWinningWagers;

            // Calculate the winner's share of the winning token
            uint256 winnerWinningTokenAmount = (winnerShare * payout) / 1e18;

            // Calculate the winner's share of the losing token
            uint256 winnerLosingTokenAmount = (winnerShare *
                totalLosingWagers) / 1e18;

            // Transfer the winning token amount to the winner
            require(
                IERC20(winningToken).transfer(winner, winnerWinningTokenAmount),
                "Winning token transfer failed"
            );

            // Transfer the losing token amount to the winner
            require(
                IERC20(losingToken).transfer(winner, winnerLosingTokenAmount),
                "Losing token transfer failed"
            );
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
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price;
    }

    /**
     * @notice Calculates the price delta for tokens in a duel
     * @param _duelId The ID of the duel
     * @return (int256, int256) The price delta for the tokens
     */
    function getPriceDelta(
        uint256 _duelId
    ) public view returns (int256, int256) {
        return _getPriceDelta(_duelId);
    }

    /**
     * @notice Gets the price delta of both tokens in a duel using their oracle data.
     * @param _duelId The ID of the duel.
     * @return deltaA The price change of tokenA.
     * @return deltaB The price change of tokenB.
     */
    function _getPriceDelta(
        uint256 _duelId
    ) internal view returns (int256 deltaA, int256 deltaB) {
        Duel storage duel = duels[_duelId];
        int256 endPriceA = getOraclePrice(duel.tokenA);
        int256 endPriceB = getOraclePrice(duel.tokenB);

        deltaA = endPriceA - duel.startPriceA;
        deltaB = endPriceB - duel.startPriceB;
    }

    /// @notice Authorize an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation contract
    /// @dev Can only be called by the owner
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}

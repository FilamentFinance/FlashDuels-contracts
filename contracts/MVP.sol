// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {MathLib} from "./MathLib.sol";

contract Betting {
    struct Battle {
        address creator;
        uint256[2] heroIndex; // index on fantasy cards
        uint256 startTime;
        uint256 totalPool;
        uint256[2] heropool;
        uint256[2] heroSharepool;
        bool finalized;
    }

    struct Bet {
        uint256 battleId;
        uint256 heroIndexinBattle;
        uint256 amount;
        uint256 share;
        address bettor;
    }

    uint256 immutable CREATION_FEE = 0.002 ether;
    uint256 immutable POOL_INITIALIZATION = 0.0004 ether;
    address immutable PROTOCOL_ADDRESS;
    address immutable BATTLE_FINIALIZER;
    uint256 immutable PROTOCOL_FEE_PERCENTAGE = 1;
    uint256 immutable BATTLE_DURATION = 60 minutes;
    uint256 immutable BATTLE_WAITING_TIME = 30 minutes;
    uint256 immutable WINNER_PERCENTAGE = 80;
    uint256 immutable b = 1; //LSMR liquidity parameter

    uint256 public battleCount;
    mapping(uint256 => Battle) public battles;
    mapping(uint256 => mapping(address => Bet)) public bets; // battleId => bettor => amount
    mapping(uint256 => address[]) public battleIdtoBettor;

    constructor(address _protocolfeeaddress, address _battlefinalizer) {
        PROTOCOL_ADDRESS = _protocolfeeaddress;
        BATTLE_FINIALIZER = _battlefinalizer;
    }

    event BattleCreated(
        uint256 indexed battleId,
        address indexed creator,
        uint256 hero1,
        uint256 hero2,
        uint256 startTime
    );
    event BetPlaced(uint256 indexed battleId, address indexed bettor, uint256 hero, uint256 amount);
    event BattleFinalized(uint256 indexed battleId, uint256 winner);

    error InvalidHeroIndex(uint256 battleId, uint256 heroIndex);

    function createBattle(uint256 hero1Index, uint256 hero2Index, uint256 betonheroIndex) external payable {
        require(msg.value >= CREATION_FEE, "Creation fee is 0.002 ETH");
        require(hero1Index != hero2Index, "Both heroes cannot be same");

        battleCount++;
        Battle storage battle = battles[battleCount];
        battle.creator = msg.sender;
        battle.heroIndex = [hero1Index, hero2Index];
        battle.heropool = [POOL_INITIALIZATION, POOL_INITIALIZATION]; //    0.0004 ether,0.004 ether
        battle.startTime = block.timestamp;
        battle.totalPool = 2 * POOL_INITIALIZATION;
        battle.finalized = false;

        payable(PROTOCOL_ADDRESS).transfer(CREATION_FEE - (2 * POOL_INITIALIZATION));

        uint256 betonhero1 = 0;
        if (hero2Index == betonheroIndex) {
            betonhero1 = 1;
        } else if (hero1Index != betonheroIndex) {
            revert("Betting on Invalid Hero");
        }

        uint256[2] memory pricepershare = getcurrentPrice(battleCount);

        uint256 betshareAsPerCurrentPrice = ((msg.value - CREATION_FEE) * 10000) / pricepershare[betonhero1];
        battle.heropool[betonhero1] += msg.value - CREATION_FEE;
        battle.heroSharepool[betonhero1] += betshareAsPerCurrentPrice;
        battle.totalPool += msg.value - CREATION_FEE;

        bets[battleCount][msg.sender].battleId = battleCount;
        bets[battleCount][msg.sender].heroIndexinBattle = betonhero1;
        bets[battleCount][msg.sender].amount += msg.value - CREATION_FEE;
        bets[battleCount][msg.sender].share += betshareAsPerCurrentPrice;

        battleIdtoBettor[battleCount].push(msg.sender);

        emit BattleCreated(battleCount, msg.sender, hero1Index, hero2Index, block.timestamp);
    }

    function placeBet(uint256 battleId, uint256 heroIndex) external payable isWindowOpen(battleId) {
        Battle storage battle = battles[battleId];
        require(msg.value > 0, "Bet amount must be greater than 0");
        require(battle.finalized == false, "Battle has ended");
        uint256 inBattleHeroIndex;
        if (battle.heroIndex[1] == heroIndex) {
            inBattleHeroIndex = 1;
        } else if (battle.heroIndex[0] == heroIndex) {
            inBattleHeroIndex = 0;
        } else {
            revert InvalidHeroIndex(battleId, heroIndex);
        }
        require(
            battle.heropool[inBattleHeroIndex] + msg.value <= uint256(uint128(type(int128).max)),
            "Bet amount is too high"
        );
        if (bets[battleId][msg.sender].amount > 0) {
            require(
                bets[battleId][msg.sender].heroIndexinBattle == inBattleHeroIndex,
                "You have already placed bet on other hero"
            );
        }

        uint256[2] memory currentPrice = getcurrentPrice(battleId);
        uint256 betValue = (msg.value * (100 - PROTOCOL_FEE_PERCENTAGE)) / 100;

        require(betValue * 10000 > currentPrice[inBattleHeroIndex], "need to bet atleast 0.01% of current price");

        payable(PROTOCOL_ADDRESS).transfer((msg.value * PROTOCOL_FEE_PERCENTAGE) / 100);
        uint256 shareAsPerCurrentPrice = (betValue * 10000) / currentPrice[inBattleHeroIndex];

        battle.totalPool += betValue;
        battle.heropool[inBattleHeroIndex] += betValue;
        battle.heroSharepool[inBattleHeroIndex] += shareAsPerCurrentPrice;
        bets[battleId][msg.sender].battleId = battleId;
        bets[battleId][msg.sender].heroIndexinBattle = inBattleHeroIndex;
        bets[battleId][msg.sender].amount += betValue;
        bets[battleId][msg.sender].share = shareAsPerCurrentPrice;

        if (bets[battleId][msg.sender].bettor == address(0)) {
            bets[battleId][msg.sender].bettor = msg.sender;
            battleIdtoBettor[battleId].push(msg.sender);
        }

        emit BetPlaced(battleId, msg.sender, heroIndex, msg.value);
    }

    function finalizeBattle(
        uint256 battleId,
        uint256 winnerIndex,
        address cardHolder
    ) external onlyBattleFinalizer canbeFinalized(battleId) {
        require(battles[battleId].creator != address(0), "Battle is not prepered yet");
        require(!battles[battleId].finalized, "Battle has Ended");

        Battle storage battle = battles[battleId];
        battle.finalized = true;

        if (winnerIndex != 2 && battle.heropool[1 - winnerIndex] != 0) {
            for (uint256 i = 0; i < battleIdtoBettor[battleId].length; i++) {
                address bettor = battleIdtoBettor[battleId][i];
                if (bets[battleId][bettor].heroIndexinBattle == winnerIndex) {
                    uint256 amountWon = bets[battleId][bettor].amount +
                        ((bets[battleId][bettor].share * WINNER_PERCENTAGE * battle.heropool[1 - winnerIndex]) /
                            (battle.heroSharepool[winnerIndex] * 100));
                    payable(bettor).transfer(amountWon);
                }
            }
            payable(cardHolder).transfer(((100 - WINNER_PERCENTAGE) * battle.heropool[1 - winnerIndex]) / 100); // transfer remaining balance to dummy address
        } else {
            for (uint256 i = 0; i < battleIdtoBettor[battleId].length; i++) {
                address bettor = battleIdtoBettor[battleId][i];
                uint256 amountWon = bets[battleId][bettor].amount;
                payable(bettor).transfer(amountWon);
            }
        }
    }

    function getcurrentPrice(uint256 battleId) public view returns (uint256[2] memory) {
        Battle memory battle = battles[battleId];
        uint256 qA = battle.heropool[0] / b;
        uint256 qB = battle.heropool[1] / b;

        uint256 TOTAL = exp(qA) + exp(qB);

        uint256 PriceA = (exp(qA) * 0.001 ether) / TOTAL;
        uint256 PriceB = (exp(qB) * 0.001 ether) / TOTAL;

        return [PriceA, PriceB];
    }

    function exp(uint256 x) public pure returns (uint256) {
        return uint256(uint128(MathLib.exp(int128(uint128(x)))));
    }

    // function exp(uint256 x) internal pure returns (uint256) {
    //     return 2 ** (x * 1 ether / 271828); // approximation using exp base 2
    // }

    function getBattle(uint256 id) public view returns (Battle memory) {
        return battles[id];
    }

    modifier isWindowOpen(uint256 battleId) {
        require(
            block.timestamp - battles[battleId].startTime < BATTLE_DURATION + BATTLE_WAITING_TIME,
            "Battle has ended"
        );
        if (block.timestamp - battles[battleId].startTime > BATTLE_WAITING_TIME) {
            uint256 windowtime = block.timestamp - battles[battleId].startTime - BATTLE_WAITING_TIME;
            require(
                (0 <= windowtime && windowtime <= 10 minutes) ||
                    (35 minutes <= windowtime && windowtime <= 40 minutes) ||
                    (55 minutes <= windowtime && windowtime <= 60 minutes),
                "Wait till betting window opens"
            );
        }
        _;
    }

    modifier isBattleLive(uint256 battleId) {
        require(
            block.timestamp - battles[battleId].startTime < BATTLE_DURATION + BATTLE_WAITING_TIME,
            "Battle has ended"
        );
        require(30 minutes < block.timestamp - battles[battleId].startTime, "Battle has ended");
        _;
    }

    modifier onlyBattleFinalizer() {
        require(msg.sender == BATTLE_FINIALIZER, "Only Battle Finalizer can call this function");
        _;
    }

    modifier canbeFinalized(uint256 battleId) {
        require(
            block.timestamp > battles[battleId].startTime + BATTLE_DURATION + BATTLE_WAITING_TIME,
            "Battle has not ended yet"
        );
        _;
    }
}

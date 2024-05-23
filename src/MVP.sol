// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

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

    struct Bet{
        uint battleId;
        uint heroIndexinBattle;
        uint amount;
        uint share;
        address bettor;
    }


    uint immutable CREATION_FEE= 0.002 ether;
    uint immutable POOL_INITIALIZATION= 0.0004 ether;
    address immutable PROTOCOL_ADDRESS;
    address immutable BATTLE_FINIALIZER;
    uint immutable PROTOCOL_FEE_PERCENTAGE = 1;
    uint immutable BATTLE_DURATION = 60 minutes; 
    uint immutable BATTLE_WAITING_TIME = 30 minutes;
    uint immutable WINNER_PERCENTAGE = 80;
    uint immutable b =1; //LSMR liquidity parameter

    uint256 public battleCount;
    mapping(uint256 => Battle) public battles;
    mapping(uint256 => mapping(address => Bet)) public bets; // battleId => bettor => amount
    mapping(uint256 => address[]) public battleIdtoBettor;

    constructor(address _protocolfeeaddress,address _battlefinalizer){
        PROTOCOL_ADDRESS=_protocolfeeaddress;
        BATTLE_FINIALIZER=_battlefinalizer;
    }

    event BattleCreated(uint256 indexed battleId, address indexed creator, uint hero1, uint hero2, uint256 startTime);
    event BetPlaced(uint256 indexed battleId, address indexed bettor, uint hero, uint256 amount);
    event BattleFinalized(uint256 indexed battleId, uint winner);

    error InvalidHeroIndex(uint battleId,uint heroIndex);

    function createBattle(uint hero1Index, uint hero2Index ) external payable {

        require(msg.value == CREATION_FEE, "Creation fee is 0.002 ETH");

        battleCount++;
        Battle storage battle = battles[battleCount];
        battle.creator = msg.sender;
        battle.heroIndex = [hero1Index,hero2Index];
        battle.heropool = [POOL_INITIALIZATION,POOL_INITIALIZATION]; //    0.0004 ether,0.004 ether
        battle.startTime = block.timestamp;
        battle.totalPool = 0;
        battle.finalized = false;

        payable(PROTOCOL_ADDRESS).transfer(CREATION_FEE-(2*POOL_INITIALIZATION));

        emit BattleCreated(battleCount, msg.sender, hero1Index, hero2Index, block.timestamp);
    }


    function placeBet(uint256 battleId, uint heroIndex) external isWindowOpen(battleId) payable {
        Battle storage battle = battles[battleId];
        require(msg.value > 0  ,   "Bet amount must be greater than 0");
        if(bets[battleId][msg.sender].amount>0){
            require(bets[battleId][msg.sender].heroIndexinBattle==heroIndex,"You have already placed bet on other hero");
        }
        require(battle.heropool[heroIndex]+msg.value<=uint256(uint128(type(int128).max)),"Bet amount is too high");
        
        if(heroIndex>1){
            revert InvalidHeroIndex ( battleId , heroIndex );
        }

        uint[2] memory currentPrice=getcurrentPrice(battleId);

        payable(PROTOCOL_ADDRESS).transfer(msg.value*PROTOCOL_FEE_PERCENTAGE/100);
        uint betValue=msg.value*(100-PROTOCOL_FEE_PERCENTAGE)/100;
        uint shareAsPerCurrentPrice=betValue*100/currentPrice[heroIndex];

        battle.totalPool                    += betValue;
        battle.heropool[heroIndex]          += betValue;
        battle.heroSharepool[heroIndex]     += shareAsPerCurrentPrice;
        bets[battleId][msg.sender].battleId  = battleId;
        bets[battleId][msg.sender].heroIndexinBattle = heroIndex;
        bets[battleId][msg.sender].amount   = betValue;
        bets[battleId][msg.sender].share    = shareAsPerCurrentPrice;
        bets[battleId][msg.sender].bettor   = msg.sender;

        battleIdtoBettor[battleId].push(msg.sender);

        emit BetPlaced(battleId, msg.sender, heroIndex, msg.value);
    }

    function finalizeBattle (uint256 battleId,uint winnerIndex,address cardHolder) onlyBattleFinalizer canbeFinalized(battleId) external {
        require(battles[battleId].creator != address(0),"Battle is not prepered yet");
        require(!battles[battleId].finalized,"Battle has Ended");
        require(block.timestamp > battles[battleId].startTime + BATTLE_DURATION, "Battle has not ended yet");

        Battle storage battle = battles[battleId];
        battle.finalized = true;

        if(winnerIndex!=2&&battle.heropool[1-winnerIndex]!=0){
            for(uint i=0;i<battleIdtoBettor[battleId].length;i++){
                address bettor = battleIdtoBettor[battleId][i];
                if(bets[battleId][bettor].heroIndexinBattle==winnerIndex){
                    uint amountWon = bets[battleId][bettor].amount +  (bets[battleId][bettor].share*WINNER_PERCENTAGE* battle.heropool[1-winnerIndex] / (battle.heroSharepool[winnerIndex]*100));
                    payable(bettor).transfer(amountWon);
                }
        }
        payable(cardHolder).transfer((100 - WINNER_PERCENTAGE)* battle.heropool[1-winnerIndex]/100); // transfer remaining balance to dummy address
        }else{
            for(uint i=0;i<battleIdtoBettor[battleId].length;i++){
                address bettor = battleIdtoBettor[battleId][i];
                uint amountWon = bets[battleId][bettor].amount;
                payable(bettor).transfer(amountWon);
            }
        }
    }

    function getcurrentPrice(uint256 battleId) public view returns(uint[2] memory){
        Battle memory battle = battles[battleId];
        uint qA= battle.heropool[0]/b;
        uint qB= battle.heropool[1]/b;


        uint TOTAL=exp(qA)+exp(qB);

        uint PriceA = exp(qA)*1 ether/TOTAL;
        uint PriceB = exp(qB)*1 ether/TOTAL;

        return [PriceA,PriceB];
    }
    function exp(uint x) public pure returns(uint){
        return uint256(uint128(MathLib.exp(int128(uint128(x)))));
    }

    // function exp(uint256 x) internal pure returns (uint256) {
    //     return 2 ** (x * 1 ether / 271828); // approximation using exp base 2
    // }

    function getBattle(uint id) public view returns(Battle memory){
        return battles[id];
    }


    modifier isWindowOpen(uint256 battleId){
        require(block.timestamp - battles[battleId].startTime < BATTLE_DURATION+BATTLE_WAITING_TIME, "Battle has ended");
        require(30 minutes <=block.timestamp - battles[battleId].startTime , "Battle has not started yet");
        uint windowtime= block.timestamp - battles[battleId].startTime-BATTLE_WAITING_TIME;
        require( 0<=windowtime&&windowtime<=10 minutes ||
            30 minutes<=windowtime&&windowtime<=40 minutes , "Wait for Win");
        _;
    }
    modifier isBattleLive(uint256 battleId){
        require(block.timestamp - battles[battleId].startTime < BATTLE_DURATION+BATTLE_WAITING_TIME, "Battle has ended");
        require(30 minutes <block.timestamp - battles[battleId].startTime , "Battle has ended");
        _;
    }

    modifier onlyBattleFinalizer() {
        require(msg.sender==BATTLE_FINIALIZER,"Only Battle Finalizer can call this function");
        _;
    }
    modifier canbeFinalized(uint256 battleId){
        require(block.timestamp > battles[battleId].startTime + BATTLE_DURATION+BATTLE_WAITING_TIME, "Battle has not ended yet");
        _;
    }


}
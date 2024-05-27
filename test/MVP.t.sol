// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {Betting} from "../src/MVP.sol";
import {MathLib} from "../src/MathLib.sol";



contract CounterTest is Test {
    Betting public betting;
    uint startAt;
    uint immutable b =1 ; //LSMR liquidity parameter

    function setUp() public {
        betting = new Betting( makeAddr('Protocol'),makeAddr('Finalizer'));

        startAt = block.timestamp;// 0 min


        vm.deal(makeAddr('Battler'),0.02 ether);

        vm.prank(makeAddr('Battler'));
        vm.deal(makeAddr('Protocol'),0);
        betting.createBattle{value:0.002 ether}(100, 200,100);
        skip(30 minutes); // 30 min
    }

    function test_basic() public {
        assertEq(betting.battleCount(),1);


        uint[2] memory betammountfor1share_1=getcurrentPrice(1);
        // console.log("betammountfor1share_1[0] ",betammountfor1share_1[0]/.000001 ether);
        // console.log("betammountfor1share_1[1] ",betammountfor1share_1[1]/.000001 ether);
        
        vm.deal(makeAddr('Better1onzero'),betammountfor1share_1[0] );
        vm.prank(makeAddr('Better1onzero'));
        betting.placeBet{value:betammountfor1share_1[0] }(1,100);

        skip(35 minutes); // 65 min (35 in battle time)

        uint[2] memory betammountfor1share_2=getcurrentPrice(1);
        // console.log("betammountfor1share_2[0] ",betammountfor1share_2[0]/.000001 ether);
        // console.log("betammountfor1share_2[1] ",betammountfor1share_2[1]/.000001 ether);
        vm.deal(makeAddr('Better2onone'),2*betammountfor1share_2[1]);
        vm.prank(makeAddr('Better2onone'));
        betting.placeBet{value:2*betammountfor1share_2[1]}(1,200);

        uint[2] memory betammountfor1share_3=getcurrentPrice(1);
        // console.log("betammountfor1share_3[0] ",betammountfor1share_3[0]/.000001 ether);
        // console.log("betammountfor1share_3[1] ",betammountfor1share_3[1]/.000001 ether);
        assertEq(betting.battleIdtoBettor(1,1),makeAddr('Better2onone'));
        skip(31 minutes);// 91 min (61 in battle time)

        vm.prank(makeAddr('Finalizer'));
        betting.finalizeBattle(1,0,makeAddr('cardHolder'));

        assertEq(makeAddr('cardHolder').balance,(0.0004 ether+(2*99*betammountfor1share_2[1]/100))*20/100);
        assertEq(makeAddr('Better1onzero').balance,99*betammountfor1share_1[0]/100+(0.0004 ether+2*(99*betammountfor1share_2[1]/100))*80/100);
        assertEq(makeAddr('Better2onone').balance,0);
    }

    function test_Working_With_2_users() public {
        assertEq(betting.battleCount(),1);

        uint[2] memory betammountfor1share_1=getcurrentPrice(1);

        vm.deal(makeAddr('Better1onzero'),40*betammountfor1share_1[0]/100);
        vm.prank(makeAddr('Better1onzero'));
        betting.placeBet{value:40*betammountfor1share_1[0]/100}(1,100); // should get 40% of one share

        skip(10 minutes); // 40 min(10 in battle time)

        uint[2] memory betammountfor1share_2=getcurrentPrice(1);
        vm.deal(makeAddr('Better2onzero'),betammountfor1share_2[0]*2);
        vm.prank(makeAddr('Better2onzero'));
        betting.placeBet{value:betammountfor1share_2[0]*2}(1,100); // should get  2 share

        skip(25 minutes); // 65 min(35 in battle time)

        uint[2] memory betammountfor1share_3=getcurrentPrice(1);
        vm.deal(makeAddr('Better1onOne'),betammountfor1share_3[1]);
        vm.prank(makeAddr('Better1onOne'));
        betting.placeBet{value:betammountfor1share_3[1]}(1,200);

        uint[2] memory betammountfor1share_4=getcurrentPrice(1);
        vm.deal(makeAddr('Better2onOne'),betammountfor1share_4[1]);
        vm.prank(makeAddr('Better2onOne'));
        betting.placeBet{value:betammountfor1share_4[1]}(1,200);

        skip(31 minutes); // 91 min

        vm.prank(makeAddr('Finalizer'));
        betting.finalizeBattle(1,0,makeAddr('cardHolder'));

        uint looseramount=0.0004 ether +(betammountfor1share_4[1]*99/100)+(betammountfor1share_3[1]*99/100);
        assertEq(makeAddr('cardHolder').balance,(looseramount)*20/(100));
        Betting.Battle memory battle = betting.getBattle(1);
        console.log("battle.finalized ",battle.finalized);  
    }
    // function testing_for_low_cap() public {
    //     assertEq(betting.battleCount(),1);

    //     uint[2] memory betammountfor1share_1=getcurrentPrice(1);

    //     vm.deal(makeAddr('Better1onzero'),40*betammountfor1share_1[0]/100);
    //     vm.prank(makeAddr('Better1onzero'));
    //     betting.placeBet{value:betammountfor1share_1[0]/1000}(1,100); // should get 40% of one share
    //     Betting.Battle memory battle = betting.getBattle(1);
    //     console.log("battle.herosharepool[0] ",battle.heroSharepool[0]);
    
    // }

    function getcurrentPrice(uint256 battleId) public view returns(uint[2] memory){
        Betting.Battle memory battle = betting.getBattle(battleId);
        uint qA= battle.heropool[0]/b;
        uint qB= battle.heropool[1]/b;

        uint TOTAL=exp(qA)+exp(qB);

        uint PriceA = exp(qA)*0.001 ether/TOTAL;
        uint PriceB = exp(qB)*0.001 ether/TOTAL;

        return [PriceA,PriceB];
    }

    function exp(uint x) public pure returns(uint){
        return uint256(uint128(MathLib.exp(int128(uint128(x)))));
    }

}



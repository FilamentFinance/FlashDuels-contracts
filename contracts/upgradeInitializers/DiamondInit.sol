// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * \
 * Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
 * EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535
 *
 * Implementation of a diamond.
 * /*****************************************************************************
 */
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IDiamondLoupe} from "../interfaces/IDiamondLoupe.sol";
import {IDiamondCut} from "../interfaces/IDiamondCut.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import {IERC165} from "../interfaces/IERC165.sol";
import {IERC173} from "../interfaces/IERC173.sol";
import {AppStorage} from "../AppStorage.sol";

// It is expected that this contract is customized if you want to deploy your diamond
// with data from a deployment script. Use the init function to initialize state variables
// of your diamond. Add parameters to the init function if you need to.

contract DiamondInit is Initializable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    AppStorage internal s;

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    // You can add parameters to this function in order to pass in
    // data to set your own state variables
    function init(
        address _protocolTreasury,
        address _flashDuels,
        address _usdc,
        address _bot
    ) external onlyOwner initializer {
        // adding ERC165 data
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;

        // add your own state variables
        // EIP-2535 specifies that the `diamondCut` function takes two optional
        // arguments: address _init and bytes calldata _calldata
        // These arguments are used to execute an arbitrary function using delegatecall
        // in order to set state variables in the diamond during deployment or an upgrade
        // More info here: https://eips.ethereum.org/EIPS/eip-2535#diamond-interface

        __Pausable_init();
        __ReentrancyGuard_init();

        s.protocolTreasury = _protocolTreasury;
        s.flashDuelsContract = _flashDuels;
        s.usdc = _usdc;
        s.bot = _bot;
        s.bootstrapPeriod = 30 minutes;
        s.protocolFeePercentage = 200; // 2%
        s.creatorFeePercentage = 200; // 2%
        s.resolvingPeriod = 48 hours;
        s.createDuelFee = 5 * 1e6; // 5 USDC
        s.minThreshold = 50 * 1e6; // 50 USDC
        s.winnersChunkSize = 50;
        s.refundChunkSize = 50;
        s.marketPlaceFees = 10; // 0.1%
        s.maxStrikes = 5;
    }
}

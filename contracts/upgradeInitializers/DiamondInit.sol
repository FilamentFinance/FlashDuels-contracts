// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title DiamondInit
 * @author Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
 * @notice Initialization contract for EIP-2535 Diamond implementation
 * @dev This contract is responsible for initializing the diamond's state variables and interfaces
 * @dev It implements Initializable, ReentrancyGuardUpgradeable, and PausableUpgradeable for upgradeable functionality
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
    /// @notice AppStorage instance for managing contract state
    AppStorage internal s;

    /// @notice Modifier to ensure only the contract owner can execute certain functions
    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    /// @notice Initializes the diamond contract with required parameters and state variables
    /// @dev This function sets up ERC165 interfaces, initializes upgradeable contracts, and sets initial state variables
    /// @param _protocolTreasury Address of the protocol treasury
    /// @param _usdc Address of the USDC token contract
    /// @param _bot Address of the bot contract
    /// @param _credits Address of the credits token contract
    function init(
        address _protocolTreasury,
        address _usdc,
        address _bot,
        address _credits
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

        // Initialize contract state variables
        s.protocolTreasury = _protocolTreasury;
        s.usdc = _usdc;
        s.bot = _bot;
        s.credits = _credits;
        s.bootstrapPeriod = 30 minutes;
        s.protocolFeePercentage = 200; // 2%
        s.creatorFeePercentage = 200; // 2%
        s.resolvingPeriod = 48 hours;
        s.createDuelFee = 5 * 1e6; // 5 USDC , 5*10^18 (for CRD tokens)
        s.minThreshold = 50 * 1e6; // 50 USDC, 50*10^18 (for CRD tokens)
        s.winnersChunkSize = 50;
        s.refundChunkSize = 50;
        s.sellerFees = 3; // 0.03%
        s.buyerFees = 5; // 0.05%
    }
}

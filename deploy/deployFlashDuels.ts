import { ethers, upgrades, network } from "hardhat"
import { updateContractsJson } from "../utils/updateContracts"
import verify from "../utils/verify"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
import FlashDuelsCoreABI from "../constants/abis/FlashDuelsCoreFacet.json"
import OwnershipABI from "../constants/abis/OwnershipFacet.json"
import DiamondInitABI from "../constants/abis/FlashDuelsCoreFacet.json"
import { FlashDuelsCoreFacet } from "../typechain-types"
// import fs from "fs"
// import { createSubgraphConfig } from "../utils/subgraph"

const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 }

const main = async () => {
    let tx, txr, usdAddress, creditsAddress, Credits
    const accounts = await ethers.getSigners()
    const networkName = network.name
    const owner = accounts[0].address
    const deployer = networkConfig[networkName].deployer

    const protocolTreasury = networkConfig[networkName].protocolTreasury
    const bot = networkConfig[networkName].bot

    const startBlock: any = await ethers.provider.getBlock("latest")
    console.log(startBlock!.number)

    if (deployer?.toLowerCase() !== owner.toLowerCase()) {
        throw Error("Deployer must be the Owner")
    }
    console.log("Deployer: ", owner)

    if (networkName === "seiMainnet") {
        usdAddress = { target: networkConfig[networkName].usdc }
        creditsAddress = { target: networkConfig[networkName].Credits }
    } else {
        console.log("Deploying USDC")
        let USDC = await ethers.getContractFactory("FLASHUSDC")
        const usdcNew = await upgrades.deployProxy(USDC, [
            "FLASHUSDC",
            "FLASHUSDC",
            networkConfig[networkName].usdcAdmin
        ])
        let flashUSDC = await usdcNew.waitForDeployment()
        console.log("USDC deployed:", flashUSDC.target)
        usdAddress = flashUSDC.target
    }

    Credits = await ethers.getContractFactory("Credits")
    const flashDuelsCreditsContract = await upgrades.deployProxy(Credits, [networkConfig[networkName].creditsMaxSupply])
    const flashDuelsCredits = await flashDuelsCreditsContract.waitForDeployment()
    console.log("FlashDuelsCredits deployed:", flashDuelsCredits.target)

    const FlashDuelsIncentives = await ethers.getContractFactory("FlashDuelsIncentives")
    const flashDuelsIncentives = await FlashDuelsIncentives.deploy()
    await flashDuelsIncentives.waitForDeployment()
    console.log("FlashDuelsIncentives deployed:", flashDuelsIncentives.target)

    // deploy DiamondCutFacet
    const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet")
    const diamondCutFacet = await DiamondCutFacet.deploy()
    await diamondCutFacet.waitForDeployment()
    console.log("DiamondCutFacet deployed:", diamondCutFacet.target)

    const DiamondLoupeFacet = await ethers.getContractFactory("DiamondLoupeFacet")
    const diamondLoupeFacet = await DiamondLoupeFacet.deploy()
    await diamondLoupeFacet.waitForDeployment()
    console.log("DiamondLoupeFacet deployed:", diamondLoupeFacet.target)

    const FlashDuelsAdminFacet = await ethers.getContractFactory("FlashDuelsAdminFacet")
    const flashDuelsAdminFacet = await FlashDuelsAdminFacet.deploy()
    await flashDuelsAdminFacet.waitForDeployment()
    console.log("FlashDuelsAdminFacet deployed:", flashDuelsAdminFacet.target)

    const FlashDuelsCoreFacet = await ethers.getContractFactory("FlashDuelsCoreFacet")
    const flashDuelsCoreFacet = await FlashDuelsCoreFacet.deploy()
    await flashDuelsCoreFacet.waitForDeployment()
    console.log("FlashDuelsCoreFacet deployed:", flashDuelsCoreFacet.target)

    const FlashDuelsMarketplaceFacet = await ethers.getContractFactory("FlashDuelsMarketplaceFacet")
    const flashDuelsMarketplaceFacet = await FlashDuelsMarketplaceFacet.deploy()
    await flashDuelsMarketplaceFacet.waitForDeployment()
    console.log("FlashDuelsMarketplaceFacet deployed:", flashDuelsMarketplaceFacet.target)

    const FlashDuelsViewFacet = await ethers.getContractFactory("FlashDuelsViewFacet")
    const flashDuelsViewFacet = await FlashDuelsViewFacet.deploy()
    await flashDuelsViewFacet.waitForDeployment()
    console.log("FlashDuelsViewFacet deployed:", flashDuelsViewFacet.target)

    const OwnershipFacet = await ethers.getContractFactory("OwnershipFacet")
    const ownershipFacet = await OwnershipFacet.deploy()
    await ownershipFacet.waitForDeployment()
    console.log("OwnershipFacet deployed:", ownershipFacet.target)

    const DiamondInit = await ethers.getContractFactory("DiamondInit")
    const diamondInit = await DiamondInit.deploy()
    await diamondInit.waitForDeployment()
    console.log("DiamondInit deployed:", diamondInit.target)

    const Diamond = await ethers.getContractFactory("Diamond")
    const diamond = await Diamond.deploy(owner, diamondCutFacet.target)
    await diamond.waitForDeployment()
    console.log("Diamond deployed:", diamond.target)

    // const FacetNames = ["DiamondLoupeFacet"]

    const diamondLoupe = ["0xcdffacc6", "0x52ef6b2c", "0xadfca15e", "0x7a0ed627", "0x01ffc9a7"]
    const flashDuelsAdminFacetSelectors = [
        "0x8456cb59", // pause()
        "0x3f4ba83a", // unpause()
        "0x096d0721", // setCreateDuelFee(uint256)
        "0x2d4f40c6", // setBotAddress(address)
        "0x58e47004", // setProtocolAddress(address)
        "0x78a0003e", // setMinimumWagerThreshold(uint256)
        "0x67eb8097", // updateBootstrapPeriod(uint256)
        "0xbb849878", // setResolvingPeriod(uint256)
        "0xe94e40cd", // setWinnersChunkSizes(uint256)
        "0x93d11d38", // setRefundChunkSizes(uint256)
        "0xf4c49a9e", // setCRDAddress(address)
        "0x8088a328", // approveAndCreateDuel(address,uint8,uint256)
        "0x3100694f", // revokeCreateDuelRequest(address,uint8,uint256)
        "0x8795cccb", // withdrawProtocolFees()
        "0x69940054" // setParticipationTokenType(uint8)
    ]
    const flashDuelsCoreFacetSelectors = [
        "0x59a9e4f6", // requestCreateDuel(uint8,string,string[],uint8)
        "0x48fa0ebe", // requestCreateCryptoDuel(string,string[],int256,uint8,uint8,uint8)
        "0x1852d000", // joinDuel(string,string,uint256,uint256,uint256,address)
        "0xdd20ca2a", // joinCryptoDuel(string,string,uint256,uint256,uint256,address)
        "0xf78283bd", // startDuel(string)
        "0xb117a1dc", // startCryptoDuel(string,int256)
        "0xc0dbdcab", // settleDuel(string,uint256)
        "0x0f9f3b7c", // continueWinningsDistribution(string,uint256,string)
        "0x2afa99d9", // settleCryptoDuel(string,int256)
        "0x3f3a631b", // cancelDuelIfThresholdNotMet(uint8,string)
        "0x6e70096e", // withdrawEarnings(uint256)
        "0xf1675271", // withdrawCreatorFee()
        "0xef82031a" // continueRefundsInChunks(string)
    ]

    const flashDuelsMarketplaceFacetSelectors = [
        // "0x9012c4a8", // updateFee(uint256)
        "0xf1d6debd", // updateSellerFees(uint256)
        "0x143c790d", // updateBuyerFees(uint256)
        "0x07b4c084", // sell(address,string,uint256,uint256,uint256)
        "0xaa6ecb55", // cancelSell(address,uint256)
        "0x374b2fde", // buy(address,address,string,uint256,uint256[],uint256[])
        "0x225c3131" // getSale(address,uint256)
    ]

    const flashDuelsViewFacetSelectors = [
        "0x3784823b", // checkIfThresholdMet(string)
        "0x0e523e4a", // getCreatorToDuelIds(address)
        "0x8da3c387", // getDuelIdToOptions(string)
        "0x593f4eda", // getOptionIndexToOptionToken(string,uint256)
        "0x57420683", // getDuelUsersForOption(string,string)
        "0x976fb75b", // getUserDuelOptionShare(string,uint256,address)
        "0xf90f7c24", // getWagerAmountDeposited(string,address)
        "0x28da2497", // getDuelIdToTokenSymbol(string)
        "0xf3859fcb", // getDuel(string)
        "0x75a0471c", // getPriceDelta(string,string,int256)
        "0xb63211f1", // getDuels(string)
        "0x56400a3b", // getAllTimeEarnings(address)
        "0x2da76d29", // getTotalBetsOnOption(string,uint256,string)
        "0xf1e287be", // isValidDuelId(string)
        "0x8f957b70", // getCryptoDuel(string)
        "0x711cd895", // isRefundInProgress(string)
        "0x9611f3d9", // getProtocolTreasury()
        "0x74e5ed59", // getTotalProtocolFeesGenerated()
        "0x9448cb58", // getCreatorFeesEarned(address)
        "0xa7745713", // getSales(address,uint256)
        "0x72e14c5f", // getPendingDuels(address,uint8)
        "0x1cb85b1f", // getPendingDuelByIndex(address,uint8,uint256)
        // "0x335b96ff", // getPendingCryptoDuels(address)
        // "0x57710916", // getPendingCryptoDuelByIndex(address,uint256)
        "0x583f105b", // getAllPendingDuelsAndCount()
        // "0xee45b057", // getAllPendingCryptoDuelsAndCount()
        "0x66ca21a8", // getCreateDuelFee()
        "0x706d9f78", // getProtocolFeePercentage()
        "0xd722ab26", // getCreatorFeePercentage()
        "0x7765ff33", // getWinnersChunkSize()
        "0xecbf647b", // getRefundChunkSize()
        "0xab1a778a", // getResolvingPeriod()
        "0xb734a264", // getBootstrapPeriod()
        // "0x8edf8f0f", // getMarketPlaceFees()
        "0x5c769f34", // getSellerAndBuyerFees()
        "0xe6bbe9dd", // getMinThreshold()
        "0x2f06c7d5", // getSaleCounter()
        "0xd087d288", // getNonce()
        "0xdbe0b5b2", // getUsdcAddress()
        "0xc2fdda7d", // getBotAddress()
        "0x535eb845", // getCreditsAddress()
        "0x795c3677" // getParticipationTokenType()
    ]

    const ownershipFacetSelectors = [
        "0xf2fde38b", // transferOwnership(address)
        "0x8da5cb5b", // owner()
        "0xe30c3978", // pendingOwner()
        "0x79ba5097" // acceptOwnership()
    ]

    const cut = []

    cut.push({
        facetAddress: diamondLoupeFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: diamondLoupe
    })

    cut.push({
        facetAddress: flashDuelsAdminFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: flashDuelsAdminFacetSelectors
    })

    cut.push({
        facetAddress: flashDuelsCoreFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: flashDuelsCoreFacetSelectors
    })

    cut.push({
        facetAddress: flashDuelsMarketplaceFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: flashDuelsMarketplaceFacetSelectors
    })
    cut.push({
        facetAddress: flashDuelsViewFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: flashDuelsViewFacetSelectors
    })
    cut.push({
        facetAddress: ownershipFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: ownershipFacetSelectors
    })

    const diamondCut = await ethers.getContractAt("IDiamondCut", diamond.target)

    let functionCall = diamondInit.interface.encodeFunctionData("init", [
        protocolTreasury,
        diamond.target,
        usdAddress,
        bot,
        flashDuelsCredits.target
    ])
    tx = await diamondCut.diamondCut(cut, diamondInit.target, functionCall)
    console.log("Diamond cut tx: ", tx.hash)
    txr = await tx.wait()
    if (!txr?.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    console.log("Completed diamond cut")

    console.log("Setting Protocol Address");
    const flashDuels: any = await FlashDuelsAdminFacet.attach(diamond.target)
    tx = await flashDuels.setProtocolAddress(networkConfig[networkName].protocolTreasury)
    await tx.wait(1)

    let contracts = [
        { name: "FLASHUSDC", address: usdAddress },
        { name: "FlashDuelsCredits", address: flashDuelsCredits.target },
        { name: "FlashDuelsIncentives", address: flashDuelsIncentives.target },
        { name: "FlashDuelsAdminFacet", address: flashDuelsAdminFacet.target },
        { name: "FlashDuelsCoreFacet", address: flashDuelsCoreFacet.target },
        {
            name: "FlashDuelsMarketplaceFacet",
            address: flashDuelsMarketplaceFacet.target
        },
        {
            name: "FlashDuelsViewFacet",
            address: flashDuelsViewFacet.target
        },
        {
            name: "OwnershipFacet",
            address: ownershipFacet.target
        },
        { name: "DiamondCutFacet", address: diamondCutFacet.target },
        { name: "DiamondLoupeFacet", address: diamondLoupeFacet.target },
        { name: "DiamondInit", address: diamondInit.target },
        { name: "Diamond", address: diamond.target },
        { name: "StartBlock", address: startBlock.number },
        {
            name: "Goldsky_Subgraph",
            address: ""
        },
        {
            name: "deploymentDate",
            address: new Date().toISOString()
        }
    ]

    updateContractsJson(contracts)
    // createSubgraphConfig()
    console.table(contracts)

    if (
        testNetworkChains.includes(networkName) &&
        process.env.SEITRACE_API_KEY &&
        process.env.VERIFY_CONTRACTS === "true"
    ) {
        console.log("Verifying...")
        await verify(flashDuelsCoreFacet.target.toString(), [])
    }
    console.log("🚀🚀🚀 FlashDuels Deployment Successful 🚀🚀🚀")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

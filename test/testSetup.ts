import { ethers, upgrades, network } from "hardhat"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
import fs from "fs"

const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 }
import { flashDuelsAdminFacetSelectors, flashDuelsCoreFacetSelectors, flashDuelsMarketplaceFacetSelectors, flashDuelsViewFacetSelectors, ownershipFacetSelectors } from "../utils/facetSelectors"


export const setupContracts = async () => {
    let tx, txr, usdAddress, USDC, creditsAddress, Credits
    let tokenA: any
    let tokenB: any
    let mockOracleA: any
    let mockOracleB: any
    const accounts = await ethers.getSigners()
    const networkName = network.name
    const owner = accounts[0].address
    const deployer = networkConfig[networkName].deployer

    if (deployer?.toLowerCase() !== owner.toLowerCase()) {
        throw Error("Deployer must be the Owner")
    }
    // console.log(owner)

    const protocolTreasury = networkConfig[networkName].protocolTreasury
    const bot = accounts[5].address

    // Deploy USDC and other Tokens contract
    const startBlock: any = await ethers.provider.getBlock("latest")
    // console.log(startBlock!.number)
    if (networkName === "seiMainnet") {
        usdAddress = { target: networkConfig[networkName].usdc }
        creditsAddress = { target: networkConfig[networkName].Credits }
    } else {
        USDC = await ethers.getContractFactory("FLASHUSDC")
        const usdcNew = await upgrades.deployProxy(USDC, [
            "FLASHUSDC",
            "FLASHUSDC",
            networkConfig[networkName].usdcAdmin
        ])
        let flashUSDC = await usdcNew.waitForDeployment()
        // console.log("USDC deployed to:", flashUSDC.target)
        usdAddress = flashUSDC.target

        const Credits = await ethers.getContractFactory("Credits")
        const creditsNew = await upgrades.deployProxy(Credits, [networkConfig[networkName].creditsMaxSupply])
        let flashCredits = await creditsNew.waitForDeployment()
        // console.log("Credits deployed to:", flashCredits.target)
        creditsAddress = flashCredits.target
    }

    // Deploy mock tokens for the duel
    const TokenAMock = await ethers.getContractFactory("MockERC20")
    tokenA = await TokenAMock.deploy("Token A", "TKA", 18)
    await tokenA.waitForDeployment()

    const TokenBMock = await ethers.getContractFactory("MockERC20")
    tokenB = await TokenBMock.deploy("Token B", "TKB", 18)
    await tokenB.waitForDeployment()

    const MockOracleFactoryA = await ethers.getContractFactory("MockOracle")
    mockOracleA = await MockOracleFactoryA.deploy()
    await mockOracleA.waitForDeployment()

    await mockOracleA.setPrice(1500)

    const MockOracleFactoryB = await ethers.getContractFactory("MockOracle")
    mockOracleB = await MockOracleFactoryB.deploy()
    await mockOracleB.waitForDeployment()

    await mockOracleB.setPrice(2000)

    // deploy DiamondCutFacet
    const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet")
    const diamondCutFacet = await DiamondCutFacet.deploy()
    await diamondCutFacet.waitForDeployment()
    // console.log("DiamondCutFacet deployed:", diamondCutFacet.target)

    const DiamondLoupeFacet = await ethers.getContractFactory("DiamondLoupeFacet")
    const diamondLoupeFacet = await DiamondLoupeFacet.deploy()
    await diamondLoupeFacet.waitForDeployment()
    // console.log("DiamondLoupeFacet deployed:", diamondLoupeFacet.target)

    const FlashDuelsAdminFacet = await ethers.getContractFactory("FlashDuelsAdminFacet")
    const flashDuelsAdminFacet = await FlashDuelsAdminFacet.deploy()
    await flashDuelsAdminFacet.waitForDeployment()
    // console.log("FlashDuelsAdminFacet deployed:", flashDuelsAdminFacet.target)

    const FlashDuelsCoreFacet = await ethers.getContractFactory("FlashDuelsCoreFacet")
    const flashDuelsCoreFacet = await FlashDuelsCoreFacet.deploy()
    await flashDuelsCoreFacet.waitForDeployment()
    // console.log("FlashDuelsCoreFacet deployed:", flashDuelsCoreFacet.target)

    const FlashDuelsMarketplaceFacet = await ethers.getContractFactory("FlashDuelsMarketplaceFacet")
    const flashDuelsMarketplaceFacet = await FlashDuelsMarketplaceFacet.deploy()
    await flashDuelsMarketplaceFacet.waitForDeployment()
    // console.log("FlashDuelsMarketplaceFacet deployed:", flashDuelsMarketplaceFacet.target)

    const FlashDuelsViewFacet = await ethers.getContractFactory("FlashDuelsViewFacet")
    const flashDuelsViewFacet = await FlashDuelsViewFacet.deploy()
    await flashDuelsViewFacet.waitForDeployment()
    // console.log("FlashDuelsViewFacet deployed:", flashDuelsViewFacet.target)

    const OwnershipFacet = await ethers.getContractFactory("OwnershipFacet")
    const ownershipFacet = await OwnershipFacet.deploy()
    await ownershipFacet.waitForDeployment()
    // console.log("OwnershipFacet deployed:", ownershipFacet.target)

    const DiamondInit = await ethers.getContractFactory("DiamondInit")
    const diamondInit = await DiamondInit.deploy()
    await diamondInit.waitForDeployment()
    // console.log("DiamondInit deployed:", diamondInit.target)

    const Diamond = await ethers.getContractFactory("Diamond")
    const diamond = await Diamond.deploy(owner, diamondCutFacet.target)
    await diamond.waitForDeployment()
    // console.log("Diamond deployed:", diamond.target)

    // const FacetNames = ["DiamondLoupeFacet"]

    const diamondLoupe = ["0xcdffacc6", "0x52ef6b2c", "0xadfca15e", "0x7a0ed627", "0x01ffc9a7"]

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
        usdAddress,
        bot,
        creditsAddress
    ])
    tx = await diamondCut.diamondCut(cut, diamondInit.target, functionCall)
    // console.log("Diamond cut tx: ", tx.hash)
    txr = await tx.wait()
    if (!txr?.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    // console.log("Completed diamond cut")

    let contracts = {
        USDC: {
            usdAddress: usdAddress,
            usdcContract: USDC
        },
        Credits: {
            creditsAddress: creditsAddress,
            creditsContract: Credits
        },
        DiamondCutFacet: { diamondCutFacet: diamondCutFacet.target, diamondCutFacetContract: DiamondCutFacet },
        DiamondLoupeFacet: {
            diamondLoupeFacet: diamondLoupeFacet.target,
            diamondLoupeFacetContract: DiamondLoupeFacet
        },
        OwnershipFacet: { ownershipFacet: ownershipFacet.target, ownershipFacetContract: OwnershipFacet },
        FlashDuelsAdminFacet: {
            flashDuelsAdminFacet: flashDuelsAdminFacet.target,
            flashDuelsAdminFacetContract: FlashDuelsAdminFacet
        },
        FlashDuelsCoreFacet: {
            flashDuelsCoreFacet: flashDuelsCoreFacet.target,
            flashDuelsCoreFacetContract: FlashDuelsCoreFacet
        },
        FlashDuelsMarketplaceFacet: {
            flashDuelsMarketplaceFacet: flashDuelsMarketplaceFacet.target,
            flashDuelsMarketplaceFacetContract: FlashDuelsMarketplaceFacet
        },
        FlashDuelsViewFacet: {
            flashDuelsViewFacet: flashDuelsViewFacet.target,
            flashDuelsViewFacetContract: FlashDuelsViewFacet
        },
        DiamondInit: { diamondInit: diamondInit.target, diamondInitContract: DiamondInit },
        Diamond: { diamond: diamond.target, diamondContract: Diamond },
        Bot: { bot: accounts[5] },
        ProtocolTreasury: { protocolTreasury: protocolTreasury },
        TokenA: { tokenA: tokenA.target, tokenAContract: tokenA },
        TokenB: { tokenB: tokenB.target, tokenBContract: tokenB }
    }

    return contracts
}

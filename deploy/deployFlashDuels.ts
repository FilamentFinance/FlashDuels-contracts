import { ethers, upgrades, network } from "hardhat"
import { updateContractsJson } from "../utils/updateContracts"
import verify from "../utils/verify"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
import { diamondLoupeFacetSelectors, flashDuelsAdminFacetSelectors, flashDuelsCoreFacetSelectors, flashDuelsMarketplaceFacetSelectors, flashDuelsViewFacetSelectors, ownershipFacetSelectors } from "../utils/facetSelectors"
// import fs from "fs"
// import { createSubgraphConfig } from "../utils/subgraph"

const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 }

const main = async () => {
    let tx: any, txr: any, usdAddress: any, creditsAddress: any, Credits: any, flashDuelsCredits: any
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
        usdAddress = { target: flashUSDC.target }

        Credits = await ethers.getContractFactory("Credits")
        const flashDuelsCreditsContract = await upgrades.deployProxy(Credits, [networkConfig[networkName].creditsMaxSupply])
        flashDuelsCredits = await flashDuelsCreditsContract.waitForDeployment()
        console.log("FlashDuelsCredits deployed:", flashDuelsCredits.target)
        creditsAddress = { target: flashDuelsCredits.target }
    }



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

    const cut = []

    cut.push({
        facetAddress: diamondLoupeFacet.target,
        action: FacetCutAction.Add,
        functionSelectors: diamondLoupeFacetSelectors
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
        usdAddress.target,
        bot,
        creditsAddress.target
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
        { name: "FLASHUSDC", address: usdAddress.target },
        { name: "FlashDuelsCredits", address: creditsAddress.target },
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

import { ethers, network } from "hardhat"
import * as netMap from "../constants/networkMapping.json"
import { forkedChain } from "../helper-hardhat-config"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"

const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 }

async function main() {
    let tx, txr, deployer
    const networkName = network.name as keyof typeof netMap
    const diamondAddress = netMap[networkName].Diamond

    if (forkedChain.includes(networkName)) {
        await helpers.mine()
        const provider = ethers.provider
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN!.toString(), provider)
    } else {
        ;[deployer] = await ethers.getSigners()
    }
    console.log(deployer?.address)
    console.log(await ethers.provider.getBalance(deployer?.address))

    const DiamondCutFacet = await ethers.getContractAt("IDiamondCut", diamondAddress, deployer)

    // Deploy new facet
    const FlashDuelsAdminFacet = await ethers.getContractFactory("FlashDuelsAdminFacet")
    const flashDuelsAdminFacet = await FlashDuelsAdminFacet.deploy()
    await flashDuelsAdminFacet.waitForDeployment()
    console.log("FlashDuelsAdminFacet deployed:", flashDuelsAdminFacet.target)

    const FlashDuelsCoreFacet = await ethers.getContractFactory("FlashDuelsCoreFacet")
    const flashDuelsCoreFacet = await FlashDuelsCoreFacet.deploy()
    await flashDuelsCoreFacet.waitForDeployment()
    console.log("FlashDuelsCoreFacet deployed:", flashDuelsCoreFacet.target)

    // const FlashDuelsMarketplaceFacet = await ethers.getContractFactory("FlashDuelsMarketplaceFacet")
    // const flashDuelsMarketplaceFacet = await FlashDuelsMarketplaceFacet.deploy()
    // await flashDuelsMarketplaceFacet.waitForDeployment()
    // console.log("FlashDuelsMarketplaceFacet deployed:", flashDuelsMarketplaceFacet.target)

    const FlashDuelsViewFacet = await ethers.getContractFactory("FlashDuelsViewFacet")
    const flashDuelsViewFacet = await FlashDuelsViewFacet.deploy()
    await flashDuelsViewFacet.waitForDeployment()
    console.log("FlashDuelsViewFacet deployed:", flashDuelsViewFacet.target)

    // const OwnershipFacet = await ethers.getContractFactory("OwnershipFacet")
    // const ownershipFacet = await OwnershipFacet.deploy()
    // await ownershipFacet.waitForDeployment()
    // console.log("OwnershipFacet deployed:", ownershipFacet.target)

    // Prepare the cut transaction
    const cut: any = [
        {
            facetAddress: flashDuelsViewFacet.target,
            action: FacetCutAction.Add, // 0 means Add
            functionSelectors: [
                "0x5fb1fb0f", // getTotalProtocolLiquidity()
                "0x2a477d77", // getLiveDuelIds()
                "0x48e20264", // isDuelLive(string)
                "0x55c52bed", // getMaxLiquidityCapPerDuel()
                "0xc2d71655", // getMaxLiquidityCapAcrossProtocol()
                "0x550ec678", // getWithdrawalRequestIds(address)
                "0xf813d8e6", // getWithdrawalRequestIdsPaginated(address,uint256,uint256)
                "0x2e0cf294", // getUserWithdrawalRequest(uint256)
            ]
        },
        {
            facetAddress: flashDuelsAdminFacet.target,
            action: FacetCutAction.Add, // 0 means Add
            functionSelectors: [
                "0x42bf3258", // setMaxLiquidityCapPerDuel(uint256)
                "0x2f385fe6", // setMaxLiquidityCapAcrossProtocol(uint256)
            ]
        },
        {
            facetAddress: flashDuelsCoreFacet.target,
            action: FacetCutAction.Add, // 0 means Add
            functionSelectors: [
                "0xefe75b9c", // updateWithdrawalRequestStatus(uint256,bool)
            ]
        }
    ]

    try {
        // Execute the diamond cut
        tx = await DiamondCutFacet.diamondCut(cut, "0x0000000000000000000000000000000000000000", "0x")
        console.log("Diamond cut transaction sent:", tx.hash)
        txr = await tx.wait()
        console.log("Diamond Cut Successfully! ✅✅✅")
    } catch (error: any) {
        console.log("Error", error.message)
        console.error("Diamond cut failed ❌❌❌")
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })

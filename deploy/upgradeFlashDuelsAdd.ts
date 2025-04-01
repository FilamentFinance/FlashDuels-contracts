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
    // const FlashDuelsAdminFacet = await ethers.getContractFactory("FlashDuelsAdminFacet")
    // const flashDuelsAdminFacet = await FlashDuelsAdminFacet.deploy()
    // await flashDuelsAdminFacet.waitForDeployment()
    // console.log("FlashDuelsAdminFacet deployed:", flashDuelsAdminFacet.target)

    // const FlashDuelsCoreFacet = await ethers.getContractFactory("FlashDuelsCoreFacet")
    // const flashDuelsCoreFacet = await FlashDuelsCoreFacet.deploy()
    // await flashDuelsCoreFacet.waitForDeployment()
    // console.log("FlashDuelsCoreFacet deployed:", flashDuelsCoreFacet.target)

    const FlashDuelsMarketplaceFacet = await ethers.getContractFactory("FlashDuelsMarketplaceFacet")
    const flashDuelsMarketplaceFacet = await FlashDuelsMarketplaceFacet.deploy()
    await flashDuelsMarketplaceFacet.waitForDeployment()
    console.log("FlashDuelsMarketplaceFacet deployed:", flashDuelsMarketplaceFacet.target)

    // const FlashDuelsViewFacet = await ethers.getContractFactory("FlashDuelsViewFacet")
    // const flashDuelsViewFacet = await FlashDuelsViewFacet.deploy()
    // await flashDuelsViewFacet.waitForDeployment()
    // console.log("FlashDuelsViewFacet deployed:", flashDuelsViewFacet.target)

    // const OwnershipFacet = await ethers.getContractFactory("OwnershipFacet")
    // const ownershipFacet = await OwnershipFacet.deploy()
    // await ownershipFacet.waitForDeployment()
    // console.log("OwnershipFacet deployed:", ownershipFacet.target)

    // Prepare the cut transaction
    const cut: any = [
        {
            facetAddress: flashDuelsMarketplaceFacet.target,
            action: FacetCutAction.Add, // 0 means Add
            functionSelectors: [
                "0xe803c94f", // sell(string,address,uint8,uint256,uint256,uint256)
                "0x2ca85a38" // buy(string,address,address,uint8,uint256,uint256[],uint256[])
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

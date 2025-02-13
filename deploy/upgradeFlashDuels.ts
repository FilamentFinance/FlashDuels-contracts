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

    const FlashDuelsCoreFacet = await ethers.getContractFactory("FlashDuelsCoreFacet")
    const flashDuelsCoreFacet = await FlashDuelsCoreFacet.deploy()
    await flashDuelsCoreFacet.waitForDeployment()
    console.log("FlashDuelsCoreFacet deployed:", flashDuelsCoreFacet.target)

    // const FlashDuelsMarketplaceFacet = await ethers.getContractFactory("FlashDuelsMarketplaceFacet")
    // const flashDuelsMarketplaceFacet = await FlashDuelsMarketplaceFacet.deploy()
    // await flashDuelsMarketplaceFacet.waitForDeployment()
    // console.log("FlashDuelsMarketplaceFacet deployed:", flashDuelsMarketplaceFacet.target)

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

        // {
        //     facetAddress: "0x0000000000000000000000000000000000000000",
        //     action: FacetCutAction.Remove, // 0 means Add ,  1Replace function
        //     functionSelectors: [
        //         "0x55718670", // continueWinningsDistribution(string,uint256,string,uint256)
        //     ]
        // },
        {
            facetAddress: flashDuelsCoreFacet.target,
            action: FacetCutAction.Replace, // 0 means Add ,  1Replace function
            functionSelectors: [
                "0x0f9f3b7c", // continueWinningsDistribution(string,uint256,string)
            ]
        },
        // {
        //     facetAddress: "0x0000000000000000000000000000000000000000",
        //     action: FacetCutAction.Remove, // 0 means Add ,  1 Replace function , 2 for Remove
        //     functionSelectors: ["0x1c79558a"] // buy
        // },
        // {
        //     facetAddress: flashDuelsAdminFacet.target,
        //     action: FacetCutAction.Replace, // 0 means Add ,  1 Replace function, 2 for Remove
        //     functionSelectors: [
        //         "0x8456cb59", // pause()
        // "0x3f4ba83a", // unpause()
        // "0x096d0721", // setCreateDuelFee(uint256)
        // "0x2d4f40c6", // setBotAddress(address)
        // "0x58e47004", // setProtocolAddress(address)
        // "0x78a0003e", // setMinimumWagerThreshold(uint256)
        // "0x67eb8097", // updateBootstrapPeriod(uint256)
        // "0xbb849878", // setResolvingPeriod(uint256)
        // "0xe94e40cd", // setWinnersChunkSizes(uint256)
        // "0x93d11d38", // setRefundChunkSizes(uint256)
        //         "0x8088a328", // approveAndCreateDuel(address,uint8,uint256)
        //         "0x3100694f", // revokeCreateDuelRequest(address,uint8,uint256)
        //         "0x8795cccb", // withdrawProtocolFees()
        //     ],
        // },

        // @note - need to upgrade after PR review
        // {
        //     facetAddress: flashDuelsCoreFacet.target,
        //     action: FacetCutAction.Remove, // 0 means Add ,  1 Replace function, 2 for Remove
        //     functionSelectors: ["0x658c0973", "0xa7b84a0c"] // createDuel, createCryptoDuel
        // },
        // {
        //     facetAddress: flashDuelsCoreFacet.target,
        //     action: FacetCutAction.Add, // 0 means Add ,  1 Replace function, 2 for Remove
        //     functionSelectors: ["0x59a9e4f6", "0x48fa0ebe", "0x8088a328", "0x3100694f"] // requestCreateDuel, requestCreateCryptoDuel, approveAndCreateDuel, revokeCreateDuelRequest
        // },
        // {
        //     facetAddress: flashDuelsViewFacet.target,
        //     action: FacetCutAction.Add, // 0 means Add ,  1 Replace function, 2 for Remove
        //     functionSelectors: ["0x72e14c5f", "0x1cb85b1f", "0x335b96ff", "0x57710916", "0x583f105b", "0xee45b057"] // getPendingDuels, getPendingDuelByIndex, getPendingCryptoDuels, getPendingCryptoDuelByIndex, getAllPendingDuelsAndCount, getAllPendingCryptoDuelsAndCount
        // }
        // {
        //     facetAddress: flashDuelsCoreFacet.target,
        //     action: FacetCutAction.Replace, // 0 means Add ,  1 Replace function
        //     functionSelectors: [
        //         "0x8456cb59", // pause()
        //         "0x3f4ba83a", // unpause()
        //         "0x096d0721", // setCreateDuelFee(uint256)
        //         "0x2d4f40c6", // setBotAddress(address)
        //         "0x58e47004", // setProtocolAddress(address)
        //         "0x78a0003e", // setMinimumWagerThreshold(uint256)
        //         "0x67eb8097", // updateBootstrapPeriod(uint256)
        //         "0xbb849878", // setResolvingPeriod(uint256)
        //         "0xe94e40cd", // setWinnersChunkSizes(uint256)
        //         "0x658c0973", // createDuel(uint8,string,string[],uint8)
        //         "0xa7b84a0c", // createCryptoDuel(string,string[],int256,uint8,uint8,uint8)
        //         "0x1852d000", // joinDuel(string,string,uint256,uint256,uint256,address)
        //         "0xde77ba38", // joinCryptoDuel(string,string,string,uint256,uint256,uint256,address)
        //         "0xf78283bd", // startDuel(string)
        //         "0xb117a1dc", // startCryptoDuel(string,int256)
        //         "0xc0dbdcab", // settleDuel(string,uint256)
        //         "0x55718670", // continueWinningsDistribution(string,uint256,string,uint256)
        //         "0x2afa99d9", // settleCryptoDuel(string,int256)
        //         "0x3f3a631b", // cancelDuelIfThresholdNotMet(uint8,string)
        //         "0xae650247", // refundDuel(uint8,string)
        //         "0x6e70096e", // withdrawEarnings(uint256)
        //         "0xf1675271", // withdrawCreatorFee()
        //         "0x8795cccb" // withdrawProtocolFees()
        //     ]
        // }
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

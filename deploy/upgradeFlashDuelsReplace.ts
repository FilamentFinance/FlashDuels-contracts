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

    // Prepare the cut transaction
    const cut: any = [
        // {
        //     facetAddress: flashDuelsAdminFacet.target,
        //     action: FacetCutAction.Replace, // 0 means Add ,  1 Replace function, 2 for Remove
        //     functionSelectors: [
        //     "0x8456cb59", // pause()
        //     "0x3f4ba83a", // unpause()
        //     "0x096d0721", // setCreateDuelFee(uint256)
        //     "0x2d4f40c6", // setBotAddress(address)
        //     "0x58e47004", // setProtocolAddress(address)
        //     "0x78a0003e", // setMinimumWagerThreshold(uint256)
        //     "0x67eb8097", // updateBootstrapPeriod(uint256)
        //     "0xbb849878", // setResolvingPeriod(uint256)
        //     "0xe94e40cd", // setWinnersChunkSizes(uint256)
        //     "0x93d11d38", // setRefundChunkSizes(uint256)
        //     "0xf4c49a9e", // setCRDAddress(address)
        //     "0x8088a328", // approveAndCreateDuel(address,uint8,uint256)
        //     "0x3100694f", // revokeCreateDuelRequest(address,uint8,uint256)
        //     "0x8795cccb", // withdrawProtocolFees()
        //     "0x69940054" // setParticipationTokenType(uint8)
        // ]
        // },

        // {
        //     facetAddress: flashDuelsCoreFacet.target,
        //     action: FacetCutAction.Replace, // 0 means Add ,  1 Replace function, 2 for Remove
        //     functionSelectors: [
        //         "0x59a9e4f6", // requestCreateDuel(uint8,string,string[],uint8)
        //         "0x48fa0ebe", // requestCreateCryptoDuel(string,string[],int256,uint8,uint8,uint8)
        //         "0x1852d000", // joinDuel(string,string,uint256,uint256,uint256,address)
        //         "0xdd20ca2a", // joinCryptoDuel(string,string,uint256,uint256,uint256,address)
        //         "0xf78283bd", // startDuel(string)
        //         "0xb117a1dc", // startCryptoDuel(string,int256)
        //         "0xc0dbdcab", // settleDuel(string,uint256)
        //         "0x0f9f3b7c", // continueWinningsDistribution(string,uint256,string)
        //         "0x2afa99d9", // settleCryptoDuel(string,int256)
        //         "0x3f3a631b", // cancelDuelIfThresholdNotMet(uint8,string)
        //         "0x6e70096e", // withdrawEarnings(uint256)
        //         "0xf1675271", // withdrawCreatorFee()
        //         "0xef82031a" // continueRefundsInChunks(string)
        //     ]
        // },
        {
            facetAddress: flashDuelsMarketplaceFacet.target,
            action: FacetCutAction.Replace, // 0 means Add ,  1 Replace function, 2 for Remove
            functionSelectors: [
                "0xf1d6debd", // updateSellerFees(uint256)
                "0x143c790d", // updateBuyerFees(uint256)
                "0xe803c94f", // sell(string,address,uint8,uint256,uint256,uint256)
                "0xaa6ecb55", // cancelSell(address,uint256)
                "0x2ca85a38", // buy(string,address,address,uint8,uint256,uint256[],uint256[])
                "0x225c3131" // getSale(address,uint256)
            ]
        },
        // {
        //     facetAddress: flashDuelsViewFacet.target,
        //     action: FacetCutAction.Replace, // 0 means Add ,  1 Replace function, 2 for Remove
        //     functionSelectors: [
        //     "0x3784823b", // checkIfThresholdMet(string)
        //     "0x0e523e4a", // getCreatorToDuelIds(address)
        //     "0x8da3c387", // getDuelIdToOptions(string)
        //     "0x593f4eda", // getOptionIndexToOptionToken(string,uint256)
        //     "0x57420683", // getDuelUsersForOption(string,string)
        //     "0x976fb75b", // getUserDuelOptionShare(string,uint256,address)
        //     "0xf90f7c24", // getWagerAmountDeposited(string,address)
        //     "0x28da2497", // getDuelIdToTokenSymbol(string)
        //     "0xf3859fcb", // getDuel(string)
        //     "0x75a0471c", // getPriceDelta(string,string,int256)
        //     "0xb63211f1", // getDuels(string)
        //     "0x56400a3b", // getAllTimeEarnings(address)
        //     "0x2da76d29", // getTotalBetsOnOption(string,uint256,string)
        //     "0xf1e287be", // isValidDuelId(string)
        //     "0x8f957b70", // getCryptoDuel(string)
        //     "0x711cd895", // isRefundInProgress(string)
        //     "0x9611f3d9", // getProtocolTreasury()
        //     "0x74e5ed59", // getTotalProtocolFeesGenerated()
        //     "0x9448cb58", // getCreatorFeesEarned(address)
        //     "0xa7745713", // getSales(address,uint256)
        //     "0x72e14c5f", // getPendingDuels(address,uint8)
        //     "0x1cb85b1f", // getPendingDuelByIndex(address,uint8,uint256)
        //     "0x583f105b", // getAllPendingDuelsAndCount()
        //     "0x66ca21a8", // getCreateDuelFee()
        //     "0x706d9f78", // getProtocolFeePercentage()
        //     "0xd722ab26", // getCreatorFeePercentage()
        //     "0x7765ff33", // getWinnersChunkSize()
        //     "0xecbf647b", // getRefundChunkSize()
        //     "0xab1a778a", // getResolvingPeriod()
        //     "0xb734a264", // getBootstrapPeriod()
        //     "0x5c769f34", // getSellerAndBuyerFees()
        //     "0xe6bbe9dd", // getMinThreshold()
        //     "0x2f06c7d5", // getSaleCounter()
        //     "0xd087d288", // getNonce()
        //     "0xdbe0b5b2", // getUsdcAddress()
        //     "0xc2fdda7d", // getBotAddress()
        //     "0x535eb845", // getCreditsAddress()
        //     "0x795c3677" // getParticipationTokenType()
        // ]
        // },

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

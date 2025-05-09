import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { FlashDuelsAdminFacet, FlashDuelsViewFacet, FLASHUSDC } from "../typechain-types"
import FLASHUSDCABI from "../constants/abis/FLASHUSDC.json"
import FlashDuelsAdminFacetABI from "../constants/abis/FlashDuelsAdminFacet.json"
import FlashDuelsViewFacetABI from "../constants/abis/FlashDuelsViewFacet.json"
import netMap from "../constants/networkMapping.json"
import { forkedChain, networkConfig } from "../helper-hardhat-config"

const main = async () => {
    let tx, txr, deployer, sequencer, liquidator, rajeeb
    const networkName: any = network.name as keyof typeof netMap

    if (forkedChain.includes(networkName)) {
        console.log("here")
        await helpers.mine()
        const provider = ethers.provider
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN!.toString(), provider)
    } else {
        ;[deployer, , sequencer, liquidator] = await ethers.getSigners()
    }

    const flashUSDC: FLASHUSDC = new ethers.Contract(netMap[networkName].FLASHUSDC, FLASHUSDCABI, deployer)
    console.log(netMap[networkName].FlashDuelsAdminFacet)

    const adminFacet: FlashDuelsAdminFacet = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsAdminFacetABI, deployer)

    const viewFacet: FlashDuelsViewFacet = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsViewFacetABI, deployer)

    const protocolAddress = await viewFacet.getProtocolTreasury()
    console.log("Protocol Address: ", protocolAddress)


    tx = await adminFacet.setBotAddress("0x2Eb671E6e0cd965A79A80caF35c5123b7a5D8ebb")
    await tx.wait(1)

    console.log("Set Bot address")

    console.log("🚀🚀🚀 Bot Address Set Done 🚀🚀🚀")
}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })

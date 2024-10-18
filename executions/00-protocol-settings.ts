import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { FlashDuels, FLASHUSDC } from "../typechain-types"
import FlashDuelsABI from "../constants/abis/FlashDuels.json"
import FLASHUSDCABI from "../constants/abis/FLASHUSDC.json"
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

    const flashDuels: FlashDuels = new ethers.Contract(netMap[networkName].FlashDuels, FlashDuelsABI, deployer)
    const flashUSDC: FLASHUSDC = new ethers.Contract(netMap[networkName].FLASHUSDC, FLASHUSDCABI, deployer)

    const pythSupportedTokens: any = []
    const pythSupportedTokensAggrgators: any = []

    tx = await flashDuels.setSupportedTokens(pythSupportedTokens)
    await tx.wait(1)
    console.log("Set Pyth Supported tokens")

    tx = await flashDuels.setPriceAggregators(pythSupportedTokens, pythSupportedTokensAggrgators)
    await tx.wait(1)

    console.log("Set Pyth Supported tokens aggrgator")

    tx = await flashDuels.setProtocolAddress(networkConfig[networkName].protocolTreasury)
    await tx.wait(1)

    console.log("Set protocol address")

    console.log("🚀🚀🚀 Protocol Settings Done 🚀🚀🚀")
}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })

import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { FlashDuels, FLASHUSDC } from "../typechain-types"
import FlashDuelsViewABI from "../constants/abis/FlashDuelsViewFacet.json"
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

    const flashDuelsView: FlashDuels = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsViewABI, deployer)
    const flashUSDC: FLASHUSDC = new ethers.Contract(netMap[networkName].FLASHUSDC, FLASHUSDCABI, deployer)

    tx = await flashDuelsView.checkIfThresholdMet("0cddb03a185de75e7dc0806b2554505d9bc8a8425c89cc904319f7d6f09d8339")
    console.log("IsThresholdMet", tx)
    tx = await flashDuelsView.checkIfThresholdMet("ea24717d35987caba6b7395e8a39a74903d76d8b2b1d21af51538373cbd200d9")
    console.log("IsThresholdMet", tx)
}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })


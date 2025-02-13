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

    tx = await flashDuelsView.checkIfThresholdMet("f414a841f8e14c39aa7cc9d18cb9667f07c2d13dda67962536b32dfd19d343cc")
    console.log("IsThresholdMet", tx)
    tx = await flashDuelsView.checkIfThresholdMet("f414a841f8e14c39aa7cc9d18cb9667f07c2d13dda67962536b32dfd19d343cc")
    console.log("IsThresholdMet", tx)
    tx = await flashDuelsView.getCryptoDuel("f414a841f8e14c39aa7cc9d18cb9667f07c2d13dda67962536b32dfd19d343cc")
    console.log("Get CryptoDuel", tx)


}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })


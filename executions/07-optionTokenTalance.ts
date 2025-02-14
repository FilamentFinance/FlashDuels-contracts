import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { FLASHUSDC, OptionToken } from "../typechain-types"
import OptionTokenABI from "../constants/abis/OptionToken.json"
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
    
    tx = await flashDuelsView.getAllTimeEarnings("0x2Eb671E6e0cd965A79A80caF35c5123b7a5D8ebb")
    console.log("optionToken balance", tx)

}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })
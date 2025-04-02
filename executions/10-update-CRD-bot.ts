import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { Credits } from "../typechain-types"
import CreditsABI from "../constants/abis/Credits.json"
import netMap from "../constants/networkMapping.json"
import { forkedChain } from "../helper-hardhat-config"

const main = async () => {
    let tx, txr, deployer, sequencer, liquidator
    const networkName = network.name as keyof typeof netMap

    if (forkedChain.includes(networkName)) {
        console.log("here")
        await helpers.mine()
        const provider = ethers.provider
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN!.toString(), provider)
    } else {
        ;[deployer, , sequencer, liquidator] = await ethers.getSigners()
    }
    const botAddress = "0x2Eb671E6e0cd965A79A80caF35c5123b7a5D8ebb"
    const credits: Credits = new ethers.Contract(netMap[networkName].FlashDuelsCredits, CreditsABI, deployer)

    tx = await credits.botAddress()
    console.log("Current Bot Address: ", tx)

    console.log("Setting Bot Address...")
    tx = await credits.setBotAddress(botAddress)
    await tx.wait()

    tx = await credits.botAddress()
    console.log("Bot Address: ", tx)

    console.log("Done")
}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })

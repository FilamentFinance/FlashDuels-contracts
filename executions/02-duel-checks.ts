import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { FlashDuels, FLASHUSDC } from "../typechain-types"
import FlashDuelsABI from "../constants/abis/FlashDuels.json"
import FLASHUSDCABI from "../constants/abis/FLASHUSDC.json"
import netMap from "../constants/networkMapping.json"
import { forkedChain, networkConfig } from "../helper-hardhat-config"

const main = async () => {
    let tx, txr, deployer, sequencer, liquidator, rajeeb, addr1: any
    const networkName: any = network.name as keyof typeof netMap

    if (forkedChain.includes(networkName)) {
        console.log("here")
        await helpers.mine()
        const provider = ethers.provider
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN!.toString(), provider)
    } else {
        ;[deployer, , sequencer, liquidator, addr1] = await ethers.getSigners()
    }

    const flashDuels: FlashDuels = new ethers.Contract(netMap[networkName].FlashDuels, FlashDuelsABI, deployer)
    const flashUSDC: FLASHUSDC = new ethers.Contract(netMap[networkName].FLASHUSDC, FLASHUSDCABI, deployer)

    tx = await flashDuels.getDuel("")
    console.log(tx)
    tx = await flashDuels.cryptoDuels("")
    console.log(tx)
    tx = await flashDuels.totalBetsOnDuel("83ed863e6dc1cbd2a4cb34e87d15219a9d8529501f54330da92cd701eacfc3a7");
    console.log(tx)
    tx = await flashDuels.totalBetsOnOption("83ed863e6dc1cbd2a4cb34e87d15219a9d8529501f54330da92cd701eacfc3a7", "0", "YES");
    console.log(tx)
    tx = await flashDuels.totalBetsOnOption("83ed863e6dc1cbd2a4cb34e87d15219a9d8529501f54330da92cd701eacfc3a7", "1", "NO");
    console.log(tx)

    // // console.log("Total logs length: ", txr?.logs.length)
    // let duelId
    // for (let i = 0; i < txr?.logs.length; i++) {
    //     if (txr?.logs[i]["args"]) {
    //         // console.log("duelId: ", txr?.logs[i]["args"][1]);
    //         duelId = txr?.logs[i]["args"][1]
    //     }
    // }
}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })

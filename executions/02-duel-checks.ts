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
    tx = await flashDuels.totalBetsOnDuel("bcafcc9ed1a6c112caa693b5c304495e745bafbec1500ad24ac86cf827578474")
    console.log(tx)
    tx = await flashDuels.totalBetsOnOption(
        "bcafcc9ed1a6c112caa693b5c304495e745bafbec1500ad24ac86cf827578474",
        "0",
        "YES"
    )
    console.log(tx)
    tx = await flashDuels.totalBetsOnOption(
        "bcafcc9ed1a6c112caa693b5c304495e745bafbec1500ad24ac86cf827578474",
        "1",
        "NO"
    )
    console.log(tx)

    tx = await flashDuels.allTimeEarnings("0x2Eb671E6e0cd965A79A80caF35c5123b7a5D8ebb"); // 13466.071343
    console.log("all time earnings", tx)

    tx = await flashDuels.allTimeEarnings("0xB69787d7e50746eE3aa96501390AdE6dEaD5beCe"); // 1050.768656
    console.log("all time earnings", tx)
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

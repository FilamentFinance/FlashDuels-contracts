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

    const expiryTime = 1
    const minWager = ethers.parseUnits("10", 6) // 10 USDC
    // await flashUSDC.connect(deployer).mint(addr1.address, ethers.parseUnits("10", 6))
    await flashUSDC.connect(deployer).approve(flashDuels.target, ethers.parseUnits("10", 6))
    let receipt = await flashDuels
        .connect(deployer)
        .createDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], minWager, expiryTime)
    txr = await receipt.wait(1)
    console.log(txr?.logs)
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

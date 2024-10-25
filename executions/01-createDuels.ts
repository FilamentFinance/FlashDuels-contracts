import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { FlashDuels, FLASHUSDC } from "../typechain-types"
import FlashDuelsABI from "../constants/abis/FlashDuels.json"
import FLASHUSDCABI from "../constants/abis/FLASHUSDC.json"
import netMap from "../constants/networkMapping.json"
import { forkedChain, networkConfig } from "../helper-hardhat-config"

const main = async () => {
    let tx, txr, deployer, bot, liquidator, rajeeb, addr1: any
    const networkName: any = network.name as keyof typeof netMap

    if (forkedChain.includes(networkName)) {
        console.log("Forked Chain")
        await helpers.mine()
        const provider = ethers.provider
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN!.toString(), provider)
        bot = new ethers.Wallet(process.env.PRIVATE_KEY_BOT!.toString(), provider)
    } else {
        ;[deployer, , bot, liquidator, addr1] = await ethers.getSigners()
    }

    const flashDuels: FlashDuels = new ethers.Contract(netMap[networkName].FlashDuels, FlashDuelsABI, deployer)
    const flashUSDC: FLASHUSDC = new ethers.Contract(netMap[networkName].FLASHUSDC, FLASHUSDCABI, deployer)

    const expiryTime = 1
    const minWager = ethers.parseUnits("10", 6) // 10 USDC
    // await flashUSDC.connect(deployer).mint(addr1.address, ethers.parseUnits("10", 6))
    await flashUSDC.connect(deployer).approve(flashDuels.target, ethers.parseUnits("170", 6))
    tx = await flashDuels.connect(deployer).createCryptoDuel("BTC", ["Yes", "No"], "70000000000", 0, 0, 0)
    txr = await tx.wait(1)

    let duelId = txr?.logs[1].args[2].toString() as string
    console.log("duelId", duelId)

    let yes = await flashDuels.duelIdToOptions(duelId, 0)

    let no = await flashDuels.duelIdToOptions(duelId, 1)
    console.log(`${yes} --- ${no}`)
    tx = await flashDuels.connect(deployer).joinCryptoDuel(duelId, "Yes", "BTC", 1, 50000000, 80000000)
    txr = await tx.wait(1)

    tx = await flashDuels.connect(deployer).joinCryptoDuel(duelId, "No", "BTC", 0, 50000000, 80000000)
    txr = await tx.wait(1)

    await ethers.provider.send("evm_increaseTime", [2 * 60])
    await ethers.provider.send("evm_mine", [])

    tx = await flashDuels.connect(bot).startCryptoDuel(duelId, 50000000)
    txr = await tx.wait(1)
    console.log(txr?.logs)
}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })

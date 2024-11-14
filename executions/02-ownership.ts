import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { FlashDuels, FLASHUSDC } from "../typechain-types"
import FlashDuelsABI from "../constants/abis/FlashDuels.json"
import FLASHUSDCABI from "../constants/abis/FLASHUSDC.json"
import netMap from "../constants/networkMapping.json"
import { forkedChain, networkConfig } from "../helper-hardhat-config"
import OwnershipABI from "../constants/abis/OwnershipFacet.json"

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

    console.log(deployer)

    const ownership = new ethers.Contract(netMap[networkName].Diamond, OwnershipABI, deployer)

    tx = await ownership.owner()
    // await tx.wait(1)
    console.log("owner", tx)
    tx = await ownership.transferOwnership(liquidator)
    txr = await tx.wait(1)

    tx = await ownership.owner()
    // await tx.wait(1)
    console.log("owner", tx)

    tx = await ownership.pendingOwner()
    // await tx.wait(1)
    console.log("pendingOwner", tx)
    console.log("accounts[1]", liquidator)

    tx = await ownership.connect(liquidator).acceptOwnership()
    txr = await tx.wait(1)

    tx = await ownership.owner()
    // await tx.wait(1)
    console.log("owner", tx)

    tx = await ownership.pendingOwner()
    // await tx.wait(1)
    console.log("pendingOwner", tx)
    console.log("accounts[1]", liquidator)
}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })

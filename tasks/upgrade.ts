import { task } from "hardhat/config"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import netMap from "../constants/networkMapping.json"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { forkedChain } from "../helper-hardhat-config"

const upgrade = async (args: any, hre: HardhatRuntimeEnvironment) => {
    let tx, txr, deployer
    const networkName = network.name as keyof typeof netMap

    if (forkedChain.includes(networkName)) {
        await helpers.mine()
        const provider = ethers.provider
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN!.toString(), provider)
    } else {
        ;[deployer] = await ethers.getSigners()
    }

    if (args.name) {
        const contractFactory: any = await hre.ethers.getContractFactory(args.name, deployer)
        const contract: any = await hre.upgrades.upgradeProxy(netMap[networkName][args.name], contractFactory)
        console.log(`Contract has been upgraded with tx hash:`, contract.deployTransaction.hash)
    } else {
        console.log("Invalid Inputs")
    }
}

task("upgrade", "Upgrade the contracts", upgrade).addParam("name", "The contract name")

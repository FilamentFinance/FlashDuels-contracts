import { ethers, upgrades, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import netMap from "../constants/networkMapping.json"
import { forkedChain, networkConfig } from "../helper-hardhat-config"

async function main() {
    let tx, txr, deployer
    const networkName = network.name as keyof typeof netMap
    const contractNames = ["Credits"]

    if (forkedChain.includes(networkName)) {
        await helpers.mine()
        const provider = ethers.provider
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN!.toString(), provider)
    } else {
        ;[deployer] = await ethers.getSigners()
    }
    console.log(deployer?.address)

    for (let i = 0; i < contractNames.length; i++) {
        const contractFactory = await ethers.getContractFactory(contractNames[i], deployer) // For testing on forked network (localhost)
        // const old = await upgrades.forceImport(netMap[networkName][contractName], contractFactory)

        // Upgrade the proxy to use the new implementation
        console.log("Upgrading Contract...")
        await upgrades.upgradeProxy(
            netMap[networkName]["FlashDuelsCredits"] as keyof (typeof netMap)[typeof networkName],
            contractFactory
        )
        console.log(`${contractNames[i]} Contract upgraded successfully`)
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

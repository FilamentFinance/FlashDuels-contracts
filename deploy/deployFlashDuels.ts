import { ethers, upgrades, network } from "hardhat"
import { updateContractsJson } from "../utils/updateContracts"
import verify from "../utils/verify"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
import fs from "fs"

const main = async () => {
    let tx, txr, usdAddress
    const accounts = await ethers.getSigners()
    const networkName = network.name
    const owner = accounts[0].address
    const deployer = networkConfig[networkName].deployer

    if (deployer?.toLowerCase() !== owner.toLowerCase()) {
        throw Error("Deployer must be the Owner")
    }
    console.log(owner)

    if (networkName === "seiMainnet") {
        usdAddress = { target: networkConfig[networkName].usdc }
    } else {
        let USDC = await ethers.getContractFactory("FLASHUSDC")
        const usdcNew = await upgrades.deployProxy(USDC, [
            "FLASHUSDC",
            "FLASHUSDC",
            networkConfig[networkName].usdcAdmin
        ])
        let flashUSDC = await usdcNew.waitForDeployment()
        console.log("USDC deployed to:", flashUSDC.target)
        usdAddress = flashUSDC.target
    }

    const FlashDuels = await ethers.getContractFactory("FlashDuels")
    const flashDuels = await upgrades.deployProxy(FlashDuels, [usdAddress, networkConfig[networkName].bot])
    const flashDuelsAddress = await flashDuels.waitForDeployment()
    console.log("FlashDuels deployed to:", flashDuelsAddress.target)

    const FlashDuelsMarketplace = await ethers.getContractFactory("FlashDuelsMarketplace")
    const flashDuelsMarketplace = await upgrades.deployProxy(FlashDuelsMarketplace, [usdAddress])
    const flashDuelsMarketplaceAddress = await flashDuelsMarketplace.waitForDeployment()
    console.log("FlashDuelsMarketplace deployed to:", flashDuelsMarketplaceAddress.target)

    let contracts = [
        { name: "FLASHUSDC", address: usdAddress },
        { name: "FlashDuels", address: flashDuelsAddress.target },
        {
            name: "FlashDuelsMarketplace",
            address: flashDuelsMarketplaceAddress.target
        }
    ]

    updateContractsJson(contracts)
    console.table(contracts)

    if (
        testNetworkChains.includes(networkName) &&
        process.env.SEITRACE_API_KEY &&
        process.env.VERIFY_CONTRACTS === "true"
    ) {
        console.log("Verifying...")
        await verify(flashDuelsAddress.target.toString(), [])
    }
    console.log("🚀🚀🚀 FlashDuels Deployment Successful 🚀🚀🚀")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

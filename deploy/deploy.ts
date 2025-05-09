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

    const protocolfeeaddress = "0x91C2352245065B9e5d2514a313b60c1f01BfF60F"
    const battlefinalizer = "0x81F20658e0265d89f4Cca7BAf8FB3933B4FcA6Be"
    const contractName = "";
    const Betting = await ethers.getContractFactory(contractName);
    const betting = await Betting.deploy(protocolfeeaddress, battlefinalizer)
    console.log("Betting deployed to:", betting.target)

    let contracts = [{ name: "", address: betting.target }]

    updateContractsJson(contracts)
    console.table(contracts)

    if (
        testNetworkChains.includes(networkName) &&
        process.env.SEITRACE_API_KEY &&
        process.env.VERIFY_CONTRACTS === "true"
    ) {
        console.log("Verifying...")
        await verify(betting.target.toString(), [])
    }
    console.log("🚀🚀🚀 Betting Deployment Successful 🚀🚀🚀")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

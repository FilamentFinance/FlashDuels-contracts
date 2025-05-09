import { ethers } from "ethers"
import { task } from "hardhat/config"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import netMap from "../constants/networkMapping.json"
import FLASHUSDCABI from "../constants/abis/FLASHUSDC.json"
import { FLASHUSDC } from "../typechain-types"

const main = async (args: any, hre: HardhatRuntimeEnvironment) => {
    const [deployer, usdcAdmin] = await hre.ethers.getSigners()
    const chainId = hre.network.config.chainId || 31337
    const chainName = hre.network.name || "localhost"
    // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
    let tx, balance
    if (args.address) {
        const usdcContract: FLASHUSDC = new ethers.Contract(netMap[chainName].FLASHUSDC, FLASHUSDCABI, usdcAdmin)

        let admin = await usdcContract.admin()
        console.log(`Current Admin: ${admin}`)

        console.log("Usdc Admin", usdcAdmin.address)

        balance = await usdcContract.balanceOf(args.address)
        console.log(`User: ${args.address} \nBalance: ${balance}`)

        if (args.amount) {
            let amount = ethers.parseUnits(args.amount, 6)
            tx = await usdcContract.connect(deployer).mint(args.address, amount)
            await tx.wait(1)
        } else {
            tx = await usdcContract.faucetMint(args.address)
            await tx.wait(1)
        }
        balance = await usdcContract.balanceOf(args.address)
        console.log(`\n----- Mint Successful 🚀🚀🚀------\n`)
        console.log(`User: ${args.address} \nBalance: ${balance}`)
    } else {
        console.log("Invalid Inputs")
    }
}

task("mint", "mint USDC Tokens to specific address", main)
    .addParam("address", "The address of the recipient")
    .addOptionalParam("amount", "amount of tokens to mint")
// .addOptionalParam("token", "The address of the token to send")
// .addFlag("gastoken", "use as gasToken for erc20 deposit")
// .addFlag("json", "Output in JSON")

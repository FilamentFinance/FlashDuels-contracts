import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { FlashDuelsAdminFacet, FlashDuelsCoreFacet, FLASHUSDC } from "../typechain-types"
import FlashDuelsAdminFacetABI from "../constants/abis/FlashDuelsAdminFacet.json"
import FlashDuelsCoreFacetABI from "../constants/abis/FlashDuelsCoreFacet.json"
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

    const flashDuels: FlashDuelsCoreFacet = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsCoreFacetABI, deployer)
    const flashDuelsAdmin: FlashDuelsAdminFacet = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsAdminFacetABI, deployer)
    const flashUSDC: FLASHUSDC = new ethers.Contract(netMap[networkName].FLASHUSDC, FLASHUSDCABI, deployer)

    const expiryTime = 3
    // await flashUSDC.connect(deployer).mint(addr1.address, ethers.parseUnits("10", 6))
    await flashUSDC.connect(deployer).approve(flashDuels.target, ethers.parseUnits("10", 6))
    let receipt = await flashDuels
        .connect(deployer)
        .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
    txr = await receipt.wait(1)
    receipt = await flashDuelsAdmin.connect(deployer).approveAndCreateDuel(deployer.address, 2, 0);
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

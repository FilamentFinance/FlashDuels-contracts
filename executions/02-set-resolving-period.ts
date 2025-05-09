import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { FlashDuelsAdminFacet, FlashDuelsCoreFacet, FLASHUSDC } from "../typechain-types"
import FlashDuelsAdminFacetABI from "../constants/abis/FlashDuelsAdminFacet.json"
import FLASHUSDCABI from "../constants/abis/FLASHUSDC.json"
import netMap from "../constants/networkMapping.json"
import { forkedChain, networkConfig } from "../helper-hardhat-config"
import OwnershipABI from "../constants/abis/OwnershipFacet.json"
import FlashDuelsCoreFacetABI from "../constants/abis/FlashDuelsCoreFacet.json";


const main = async () => {
    let tx, txr, deployer, sequencer, liquidator, rajeeb, bot
    const networkName: any = network.name as keyof typeof netMap

    if (forkedChain.includes(networkName)) {
        console.log("here")
        await helpers.mine()
        const provider = ethers.provider
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN!.toString(), provider)
    } else {
        ;[deployer, bot, , sequencer, liquidator] = await ethers.getSigners()
    }

    const flashDuels: FlashDuelsAdminFacet = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsAdminFacetABI, deployer)
    
    const flashDuelsCore: FlashDuelsCoreFacet = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsCoreFacetABI, deployer)
    
    tx = await flashDuels.setResolvingPeriod("360000000");
    txr = await tx.wait(1);
    console.log("resolving time set")
    // Execute settlement
    tx = await flashDuelsCore.connect(bot).settleDuel("ac8d66bf34704865981781ee84082de788514b4308fecb42458dd9518bf49f94", 0);
    txr = await tx.wait(1)
  
    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait(1); // Wait for 1 confirmation

    console.log(`Settlement confirmed - Transaction: ${tx.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })

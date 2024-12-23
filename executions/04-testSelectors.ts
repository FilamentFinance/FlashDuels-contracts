import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import FLASHUSDCABI from "../constants/abis/FLASHUSDC.json"
import FLASHUSDC_CORE_ABI from "../constants/abis/FlashDuelsCoreFacet.json"
import FLASHUSDC_VIEW_ABI from "../constants/abis/FlashDuelsViewFacet.json"
import FLASHUSDC_MARKETPLACE_ABI from "../constants/abis/FlashDuelsMarketplaceFacet.json"
import FLASHUSDC_LOUPE_ABI from "../constants/abis/DiamondLoupeFacet.json"
import netMap from "../constants/networkMapping.json"
import { forkedChain, networkConfig } from "../helper-hardhat-config"
import { FLASHUSDC } from "../typechain-types"

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

    const flashUSDC: FLASHUSDC = new ethers.Contract(netMap[networkName].FLASHUSDC, FLASHUSDCABI, deployer)

    const flashDuelsCore: any = new ethers.Contract(netMap[networkName].Diamond, FLASHUSDC_CORE_ABI, deployer) 
    const flashDuelsMarketplace: any = new ethers.Contract(netMap[networkName].Diamond, FLASHUSDC_MARKETPLACE_ABI, deployer) 
    const flashDuelsView: any = new ethers.Contract(netMap[networkName].Diamond, FLASHUSDC_VIEW_ABI, deployer) 
    const diamondLoupe: any = new ethers.Contract(netMap[networkName].Diamond, FLASHUSDC_LOUPE_ABI, deployer) 

    console.log(netMap[networkName].Diamond);
    // console.log(netMap[networkName].Diamond);
    // console.log(netMap[networkName].Diamond);
    // console.log(netMap[networkName].Diamond);

    tx = await diamondLoupe.facets();
    console.log("facets: ", tx)
    // tx = await diamondLoupe.facetAddresses();
    // console.log("facet addresses: ", tx)
    tx = await flashDuelsView.getProtocolTreasury();
    console.log("getTotalProtocolFeesGenerated: ", tx)
    tx = await flashDuelsMarketplace.getSale("0x81F20658e0265d89f4Cca7BAf8FB3933B4FcA6Be", "1");
    console.log("getTotalProtocolFeesGenerated: ", tx)

}

main()




    
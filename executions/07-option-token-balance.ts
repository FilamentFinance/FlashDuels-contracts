import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { FLASHUSDC, OptionToken } from "../typechain-types"
import OptionTokenABI from "../constants/abis/OptionToken.json"
import FlashDuelsViewABI from "../constants/abis/FlashDuelsViewFacet.json"
import FLASHUSDCABI from "../constants/abis/FLASHUSDC.json"
import netMap from "../constants/networkMapping.json"
import { forkedChain, networkConfig } from "../helper-hardhat-config"

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
    const flashDuelsView: FlashDuels = new ethers.Contract("0xf513ead7b64d9d9af17122c10f9e7e3a106e6121", FlashDuelsViewABI, deployer)
    // tx = await flashDuelsView.getDuelIdToOptions("76960d2ea0df8d5f885ffc91306a149e7620462f0322d2e9af9e630282ef623f")
    // console.log(tx)
    tx = await flashDuelsView.getOptionIndexToOptionToken("aea7050df0ccaa58007d6ed18c6c615e6f8e92c2e27ae92e3a6585435ee287cb", 0)
    console.log(tx)
    tx = await flashDuelsView.getCryptoDuel("5f3624aaa915592c8a45c56ab4fdae4766f0b986353c09d0745cfe843632daaf")
    console.log("getDuels", tx)
    const optionToken: OptionToken = new ethers.Contract("0xc9f2501E9bae67C52123263ad5CA526cfC0770Af", OptionTokenABI, deployer);

    tx = await optionToken.allowance("0x8F5D833272017fF60E4A64121779E006B8E598a9", "0xF513eaD7B64D9D9aF17122C10f9e7e3a106e6121");
    console.log(tx)

    
    // tx = await flashDuelsView.getAllTimeEarnings("0x2Eb671E6e0cd965A79A80caF35c5123b7a5D8ebb")
    // console.log("optionToken balance", tx)

}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })
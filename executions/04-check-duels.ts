import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { FlashDuelsViewFacet, FlashDuelsMarketplaceFacet, FLASHUSDC } from "../typechain-types"
import FlashDuelsViewABI from "../constants/abis/FlashDuelsViewFacet.json"
import FlashDuelsMarketplaceABI from "../constants/abis/FlashDuelsMarketplaceFacet.json"
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

    const flashDuelsView: FlashDuelsViewFacet = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsViewABI, deployer)
    const flashDuelsMarketplace: FlashDuelsMarketplaceFacet = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsMarketplaceABI, deployer)

    // tx = await flashDuelsView.checkIfThresholdMet("7fe60b106113aa3c8b95b22462b1fd0089c91f367fcbec58e105d19e907946e1")
    // console.log("IsThresholdMet", tx)
    // tx = await flashDuelsView.checkIfThresholdMet("7fe60b106113aa3c8b95b22462b1fd0089c91f367fcbec58e105d19e907946e1")
    // console.log("IsThresholdMet", tx)
    // tx = await flashDuelsView.getCryptoDuel("9b512e34fdbf3950665edfbe6e689158b41bdaa3dcdd0b419d11ea4c474fd2fc")
    // console.log("Get CryptoDuel", tx)

    // const optionTokenAddressData = await flashDuelsView.getOptionIndexToOptionToken("bc148ee076e91da6a427c75eb5c9bf4caf99b14b0b07b9cf91dddb2a2701c88c", 0);
    // console.log("Option Token Address", optionTokenAddressData)

    const salesData = await flashDuelsMarketplace.getSale("0x2Eb671E6e0cd965A79A80caF35c5123b7a5D8ebb", "21")
    console.log("Sales Data", salesData)

}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })


    // old
        // "seiTestnet": {
        //     "FLASHUSDC": "0x542938B5c37d082159C0933EC982E3585c94BD62",
        //     "FlashDuelsAdminFacet": "0x88498614Af73Ba8643C8190DBeDE42eff14EF102",
        //     "FlashDuelsCoreFacet": "0x9c34E4e6c6075A35a23d13BF2d50ed5b1Af787a3",
        //     "FlashDuelsMarketplaceFacet": "0x9faA711B06597BD3a757cFD716c52E72f035E11D",
        //     "FlashDuelsViewFacet": "0xc4A1AE1234e39987c79aE14E00f2A98306C35236",
        //     "OwnershipFacet": "0x65c36658c81EAed25f207C91a8A3F1e82E36ABd1",
        //     "DiamondCutFacet": "0x54eB40902D7cb919EF28AbE286050Ecee2cB9b2B",
        //     "DiamondLoupeFacet": "0x86AE9F81809D3cC09e80433c6E41F7fd98eD09AF",
        //     "DiamondInit": "0x639FebBc3b0DF17e10b65E7B69138265A3e4648A",
        //     "Diamond": "0x82f8b57891C7EC3c93ABE194dB80e4d8FC931F09",
        //     "StartBlock": 150967382,
        //     "Goldsky_Subgraph": ""
  
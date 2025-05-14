import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { Credits } from "../typechain-types"
import CreditsABI from "../constants/abis/Credits.json"
import netMap from "../constants/networkMapping.json"
import { forkedChain, networkConfig, ParticipationTokenType } from "../helper-hardhat-config"
import FlashDuelsAdminFacetABI from "../constants/abis/FlashDuelsAdminFacet.json"
import { FlashDuelsAdminFacet } from "../typechain-types"

const main = async () => {
    let tx, txr, deployer, sequencer, liquidator
    const networkName = network.name as keyof typeof netMap

    if (forkedChain.includes(networkName)) {
        console.log("here")
        await helpers.mine()
        const provider = ethers.provider
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN!.toString(), provider)
    } else {
        ;[deployer, , sequencer, liquidator] = await ethers.getSigners()
    }
    const botAddress = "0x16372a30A0b6554Bcb81fed6665B0e628B47FB3a"
    const credits: Credits = new ethers.Contract(netMap[networkName].FlashDuelsCredits, CreditsABI, deployer)
    const flashDuelsAdmin: FlashDuelsAdminFacet = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsAdminFacetABI, deployer)
    tx = await credits.botAddress()
    console.log("Current Bot Address: ", tx)

    // // if (networkConfig[networkName].participatingToken === ParticipationTokenType.CRD) {
    // console.log("Setting Participation Token Type to CRD");
    // tx = await flashDuelsAdmin.setParticipationTokenType(ParticipationTokenType.CRD);
    // await tx.wait(1)

    // console.log("Setting CRD specific parameters");
    // tx = await flashDuelsAdmin.setCreateDuelFee(ethers.parseUnits("5", 18));
    // await tx.wait(1)
    // console.log("Create Duel Fee set to 5 CRD")

    // tx = await flashDuelsAdmin.setMinimumWagerThreshold(ethers.parseUnits("50", 18));
    // await tx.wait(1)
    // console.log("Minimum Threshold set to 50 CRD")

    // const newMinWagerTradeSize = ethers.parseUnits("5", 18);
    // tx = await flashDuelsAdmin.setMinWagerTradeSize(newMinWagerTradeSize);
    // await tx.wait(1)
    // console.log("Minimum Wager Trade Size set to 5 CRD")

    // const newMaxLiquidityCapPerDuel = ethers.parseUnits("20000", 18);
    // tx = await flashDuelsAdmin.setMaxLiquidityCapPerDuel(newMaxLiquidityCapPerDuel);
    // await tx.wait(1)
    // console.log("Max Liquidity Cap Per Duel set to 20000 CRD")

    // const newMaxLiquidityCapAcrossProtocol = ethers.parseUnits("200000", 18);
    // tx = await flashDuelsAdmin.setMaxLiquidityCapAcrossProtocol(newMaxLiquidityCapAcrossProtocol);
    // await tx.wait(1)
    // console.log("Max Liquidity Cap Across Protocol set to 200000 CRD")

    // const newMaxAutoWithdraw = ethers.parseUnits("5000", 18);
    // tx = await flashDuelsAdmin.setMaxAutoWithdraw(newMaxAutoWithdraw);
    // await tx.wait(1)
    // console.log("Max Auto Withdraw set to 5000 CRD")

    // // console.log("Setting Bot Address for CRD")
    // // const credits: any = await Credits.attach(creditsAddress.target)
    // // tx = await credits.setBotAddress(networkConfig[networkName].bot)
    // // await tx.wait()
    // // console.log("Bot Address set to:", networkConfig[networkName].bot)
    // // console.log("Setting CRD specific parameters done");
    // // }

    // console.log("Setting Bot Address...")
    // tx = await credits.setBotAddress(botAddress)
    // await tx.wait()

    // // tx = await credits.botAddress()
    // // console.log("Bot Address: ", tx)

    // console.log("Done")
}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })

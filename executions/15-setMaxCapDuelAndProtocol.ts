import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import netMap from "../constants/networkMapping.json"
import { forkedChain } from "../helper-hardhat-config"
import FlashDuelsAdminFacetABI from "../constants/abis/FlashDuelsAdminFacet.json"
import FlashDuelsViewFacetABI from "../constants/abis/FlashDuelsViewFacet.json"
import { ParticipationTokenType } from "../helper-hardhat-config"

const main = async () => {
    let tx, deployer, sequencer, liquidator
    const networkName: any = network.name as keyof typeof netMap

    if (forkedChain.includes(networkName)) {
        console.log("here")
        await helpers.mine()
        const provider = ethers.provider
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN!.toString(), provider)
    } else {
        ;[deployer, , sequencer, liquidator] = await ethers.getSigners()
    }

    console.log(deployer)

    const flashDuelsAdminFacet = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsAdminFacetABI, deployer)
    const viewFacet = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsViewFacetABI, deployer)

    let maxLiquidityCapPerDuel = await viewFacet.getMaxLiquidityCapPerDuel();
    console.log("Before Max Liquidity Cap Per Duel: ", maxLiquidityCapPerDuel); // 0

    let maxLiquidityCapAcrossProtocol = await viewFacet.getMaxLiquidityCapAcrossProtocol();
    console.log("Before Max Liquidity Cap Across Protocol: ", maxLiquidityCapAcrossProtocol); // 0

    const newMaxLiquidityCapPerDuel = ethers.parseUnits("20000", 18);
    const newMaxLiquidityCapAcrossProtocol = ethers.parseUnits("200000", 18);

    tx = await flashDuelsAdminFacet.setMaxLiquidityCapPerDuel(newMaxLiquidityCapPerDuel);
    await tx.wait(1)
    tx = await flashDuelsAdminFacet.setMaxLiquidityCapAcrossProtocol(newMaxLiquidityCapAcrossProtocol);
    await tx.wait(1)

    maxLiquidityCapPerDuel = await viewFacet.getMaxLiquidityCapPerDuel();
    console.log("After Max Liquidity Cap Per Duel: ", maxLiquidityCapPerDuel); // 20000 * 1e18

    maxLiquidityCapAcrossProtocol = await viewFacet.getMaxLiquidityCapAcrossProtocol();
    console.log("After Max Liquidity Cap Across Protocol: ", maxLiquidityCapAcrossProtocol); // 200000 * 1e18
}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })

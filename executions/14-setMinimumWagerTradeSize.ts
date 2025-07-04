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

    let minWagerTradeSize = await viewFacet.getMinWagerTradeSize();
    console.log("Before Min Wager Trade Size: ", minWagerTradeSize); // 5000000

    const newMinWagerTradeSize = ethers.parseUnits("5", 18);

    tx = await flashDuelsAdminFacet.setMinWagerTradeSize(newMinWagerTradeSize);
    await tx.wait(1)

    minWagerTradeSize = await viewFacet.getMinWagerTradeSize();
    console.log("After Min Wager Trade Size: ", minWagerTradeSize); // 5000000000000000000
}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })

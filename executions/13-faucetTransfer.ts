import { ethers, network } from "hardhat"
import netMap from "../constants/networkMapping.json"
import { Credits } from "../typechain-types"
import { forkedChain } from "../helper-hardhat-config"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import FlashDuelsAdminFacetABI from "../constants/abis/FlashDuelsAdminFacet.json"
import FlashDuelsViewFacetABI from "../constants/abis/FlashDuelsViewFacet.json"
import { ParticipationTokenType } from "../helper-hardhat-config"
import CreditsABI from "../constants/abis/Credits.json"

const main = async () => {
    let tx, deployer, sequencer, liquidator
    const networkName: any = network.name as keyof typeof netMap
    const chainName = networkName as keyof typeof netMap

    if (forkedChain.includes(networkName)) {
        console.log("here")
        await helpers.mine()
        const provider = ethers.provider
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN!.toString(), provider)
    } else {
        ;[deployer, , sequencer, liquidator] = await ethers.getSigners()
    }

    // const usdcContract: FLASHUSDC = new ethers.Contract(netMap[chainName].FLASHUSDC, FLASHUSDCABI, usdcAdmin)
    const usdcContract: Credits = new ethers.Contract(netMap[chainName].FlashDuelsCredits, CreditsABI, deployer)
    console.log(await usdcContract.balanceOf("0x2dC727b15203992B65D7ADbc0108781f1Cb1F9F3"))


    let amount = ethers.parseUnits("10000", 18)
    tx = await usdcContract.connect(deployer).airdrop([deployer.address], [amount])
    await tx.wait(1)

    tx = await usdcContract.connect(deployer).claim()
    await tx.wait(1)

    console.log(await usdcContract.balanceOf(deployer.address))


    tx = await usdcContract.connect(deployer).transfer("0x2dC727b15203992B65D7ADbc0108781f1Cb1F9F3", amount)
    await tx.wait(1)

    console.log(await usdcContract.balanceOf("0x2dC727b15203992B65D7ADbc0108781f1Cb1F9F3"))


}

main()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error(error)
        process.exit(1)
    })

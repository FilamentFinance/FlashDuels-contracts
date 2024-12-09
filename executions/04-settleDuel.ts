import { ethers, network } from "hardhat"
import * as helpers from "@nomicfoundation/hardhat-network-helpers"
import { FlashDuels, FLASHUSDC } from "../typechain-types"
import FlashDuelsABI from "../constants/abis/FlashDuels.json"
import FLASHUSDCABI from "../constants/abis/FLASHUSDC.json"
import netMap from "../constants/networkMapping.json"
import { forkedChain, networkConfig } from "../helper-hardhat-config"
import axios from "axios"
import assert from "assert"

interface DuelSettlement {
    duelId: string
    winningOptionIndex: number
}

const getDuelIds = async (): Promise<string[]> => {
    try {
        const { data } = await axios.get("https://orderbookv3.filament.finance/flashduels/duels/flashduels/expired")
        return data.expiredDuels.map((duel: any) => duel.duelId)
    } catch (error) {
        console.error("Error fetching expired duels:", error)
        return []
    }
}

const getWinningOptionIndexes = (duelIds: string[]): DuelSettlement[] => {
    // Manual mapping of duel IDs to winning options
    const winningOptionsMap: { [key: string]: number } = {
        // Add mappings here for each duel ID
        [duelIds[0]]: 0
    }

    // Map each duel ID to its corresponding winning option
    const settlements: DuelSettlement[] = duelIds.map((duelId) => ({
        duelId,
        winningOptionIndex: winningOptionsMap[duelId] ?? 0 // Default to 0 if not specified
    }))

    return settlements
}

const settleDuel = async (settlements: DuelSettlement[]) => {
    if (!settlements.length) {
        console.log("No duels to settle")
        return
    }

    const networkName = network.name as keyof typeof netMap
    if (!netMap[networkName]) {
        throw new Error(`Network ${networkName} not supported`)
    }

    let deployer
    let bot

    if (forkedChain.includes(networkName)) {
        await helpers.mine()
        const provider = ethers.provider
        if (!process.env.PRIVATE_KEY_ADMIN) {
            throw new Error("PRIVATE_KEY_ADMIN not set in environment")
        }
        deployer = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN, provider)
    } else {
        ;[deployer, , bot] = await ethers.getSigners()
    }

    const flashDuels = new ethers.Contract(
        netMap[networkName].FlashDuels,
        FlashDuelsABI,
        deployer
    ) as unknown as FlashDuels

    const settledDuels = []
    // console.log(settlements)
    for (const settlement of settlements) {
        try {
            const tx = await flashDuels.connect(bot).settleDuel(settlement.duelId, settlement.winningOptionIndex)
            const receipt = await tx.wait(1)
            console.log(
                `Duel ${settlement.duelId} settled with winner ${settlement.winningOptionIndex}. Transaction hash: ${receipt?.hash}`
            )
            settledDuels.push({
                duelId: settlement.duelId,
                winningOptionIndex: settlement.winningOptionIndex
            })
        } catch (error) {
            console.error(`Error settling duel ${settlement.duelId}:`, error)
        }
    }

    if (settledDuels.length > 0) {
        try {
            let duelId = "83ed863e6dc1cbd2a4cb34e87d15219a9d8529501f54330da92cd701eacfc3a7"
            let winningOptionIndex = 0
            await axios.post("https://orderbookv3.filament.finance/flashduels/duels/flashduels/duration", {
                duelIds: [
                    {
                        duelId: "83ed863e6dc1cbd2a4cb34e87d15219a9d8529501f54330da92cd701eacfc3a7",
                        winningOptionIndex: 0
                    }
                ]
            })
            console.log(`Backend updated for ${settledDuels.length} duels`)
            console.log("done")
        } catch (error) {
            console.error("Error updating backend:", error)
        }
    }
}

const main = async () => {
    try {
        const expiredDuelIds = await getDuelIds()
        console.log(expiredDuelIds)
        console.log(`Found ${expiredDuelIds.length} expired duels`)
        const settlements = getWinningOptionIndexes(expiredDuelIds)
        console.log(`Mapped ${settlements.length} settlements with winning options`)

        await settleDuel(settlements)
    } catch (error) {
        console.error("Error in main execution:", error)
        process.exit(1)
    }
}

main()

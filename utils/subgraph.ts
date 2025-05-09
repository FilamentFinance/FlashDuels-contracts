import { ethers, network } from "hardhat"
import netMap from "../constants/networkMapping.json"
import fs from "fs"
import { networkConfig } from "../helper-hardhat-config"

export const createSubgraphConfig = () => {
    const networkName = network.name as keyof typeof netMap
    console.log("networkName", networkName)
    const slug = networkConfig[networkName]?.goldskySlug || "localhost"
    const startBlock = netMap[networkName]?.StartBlock || "26600000"
    const subGraphPath = "constants/goldsky.json"

    let goldskyConfig = {
        version: "1",
        name: "flashduels",
        abis: {
            flashduelscorefacet: {
                path: "abis/FlashDuelsCoreFacet.json"
            },
            flashduelsmarketplacefacet: {
                path: "abis/FlashDuelsMarketplaceFacet.json"
            }
        },
        chains: [slug],
        instances: [
            {
                abi: "flashduelscorefacet",
                address: netMap[networkName].Diamond,
                chain: slug,
                startBlock: startBlock
            },
            {
                abi: "flashduelsmarketplacefacet",
                address: netMap[networkName].Diamond,
                chain: slug,
                startBlock: startBlock
            }
        ]
    }

    if (!fs.existsSync("constants")) {
        fs.mkdirSync("constants")
    }
    fs.writeFileSync(subGraphPath, JSON.stringify(goldskyConfig))
    console.log("Goldsky Subgraphs Data File Created ✅✅✅")
}

createSubgraphConfig()

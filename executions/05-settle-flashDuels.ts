import { ethers, network } from "hardhat";
import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import { FlashDuelsCoreFacet } from "../typechain-types";
import axios from 'axios';
import FlashDuelsCoreFacetABI from "../constants/abis/FlashDuelsCoreFacet.json";
import netMap from "../constants/networkMapping.json";
import { forkedChain, networkConfig } from "../helper-hardhat-config"

// Constants
const EXPIRED_DUELS_URL = 'https://orderbookv3.filament.finance/flashduels/admin/flashDuels/expired';
const SETTLEMENT_NOTIFICATION_URL = 'https://orderbookv2.filament.finance/flashduels/admin/flashDuels/duration';

// Types
interface NetworkMapping {
    [key: string]: {
        Diamond: string;
        FlashDuels: string;
    }
}

interface ExpiredDuel {
    id: string;
    createdAt: number;
    startAt: number;
    category: string;
    betString: string;
    status: number;
    betIcon: string;
    duelType: string;
    endsIn: number;
    duelId: string;
    winner: number;
    userId: string;
}

interface ExpiredDuelsResponse {
    success: boolean;
    expiredDuels: ExpiredDuel[];
}

async function getExpiredDuels(): Promise<ExpiredDuelsResponse> {
    try {
        const response = await axios.get<ExpiredDuelsResponse>(EXPIRED_DUELS_URL);
        return response.data;
    } catch (error) {
        console.error('Error fetching expired duels:', error instanceof Error ? error.message : error);
        return { success: false, expiredDuels: [] };
    }
}

async function notifySettlement(settledDuelIds: string[]): Promise<void> {
    if (settledDuelIds.length === 0) return;

    try {
        const requestBody = {
            duelIds: settledDuelIds
        };

        console.log('Sending notification with body:', JSON.stringify(requestBody, null, 2));

        await axios.post(SETTLEMENT_NOTIFICATION_URL, ["ac8d66bf34704865981781ee84082de788514b4308fecb42458dd9518bf49f94"], {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error notifying settlements:', error instanceof Error ? error.message : error);
    }
}

async function setupContract() {
    let signer: any;
    const networkName = network.name as keyof typeof netMap;

    if (forkedChain.includes(networkName)) {
        await helpers.mine();
        const provider = ethers.provider;
        const privateKey = process.env.PRIVATE_KEY_BOT;
        if (!privateKey) throw new Error("Private key not found in environment");
        signer = new ethers.Wallet(privateKey, provider);
    } else {
        [signer] = await ethers.getSigners();
    }

    // Get contract address from network mapping
    const networkMapping = netMap as NetworkMapping;
    const contractAddress = networkMapping[networkName]?.Diamond;
    if (!contractAddress) {
        throw new Error(`No Diamond contract address found for network ${networkName}`);
    }

    // Create contract instance
    const contract: FlashDuelsCoreFacet = new ethers.Contract(
        contractAddress,
        FlashDuelsCoreFacetABI,
        signer
    );

    return { contract, signer };
}

async function settleDuel(
    duel: ExpiredDuel
): Promise<boolean> {
    try {
        let deployer;
        console.log(`Settling duel ${duel.duelId}`);

        // Get gas estimate

        ;[deployer, , ,] = await ethers.getSigners()


        let networkName = network.name;

        const flashDuels: FlashDuelsCoreFacet = new ethers.Contract(netMap[networkName].Diamond, FlashDuelsCoreFacetABI, deployer)
        // Execute settlement
        const tx = await flashDuels.settleDuel(duel.duelId, 0);

        console.log(`Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait(1); // Wait for 1 confirmation

        console.log(`Settlement confirmed - Transaction: ${tx.hash}`);
        return true;
    } catch (error) {
        console.error(`Error settling duel ${duel.duelId}:`, error instanceof Error ? error.message : error);
        return false;
    }
}

async function processExpiredDuels(): Promise<void> {
    try {
        // Setup
        // const { contract, signer } = await setupContract();
        // const response = await getExpiredDuels();

        // if (!response.success || response.expiredDuels.length === 0) {
        //     console.log('No expired duels found');
        //     return;
        // }

        // console.log(`Found ${response.expiredDuels.length} expired duels`);
        const settledDuels: string[] = [];

        // // Process each duel
        // for (const duel of response.expiredDuels) {
        //     // Check if we have enough gas
        //     const balance = await signer.provider?.getBalance(await signer.getAddress());
        //     if (balance && balance == 0) {
        //         console.error('Insufficient funds for gas');
        //         break;
        //     }

        //     const success = await settleDuel(duel);
        //     if (success) {
        //         settledDuels.push("0xd8c7729b34c5f4c74c3daef49a53eb0ad9dff3838a75a1e001e36ff071dda39c");
        //         // await helpers.mine(1); // Mine a block between transactions
        //     }
        // }
        settledDuels.push("ac8d66bf34704865981781ee84082de788514b4308fecb42458dd9518bf49f94");
        await notifySettlement(settledDuels);
        // Notify settlements
        // if (settledDuels.length > 0) {
        //     await notifySettlement(settledDuels);
        // }

        // console.log(`Settlement process completed. Settled ${settledDuels.length}/${response.expiredDuels.length} duels`);
    } catch (error) {
        console.error('Error in processing expired duels:', error instanceof Error ? error.message : error);
        throw error;
    }
}

async function main() {
    try {
        await processExpiredDuels();
    } catch (error) {
        console.error('Fatal error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main().catch((error) => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export {
    getExpiredDuels,
    settleDuel,
    notifySettlement,
    processExpiredDuels
};
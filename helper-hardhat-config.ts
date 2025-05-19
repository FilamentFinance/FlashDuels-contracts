export interface networkConfigItem {
    chainId: number
    goldskySlug?: string
    deployer: string
    usdc?: string
    usdcAdmin?: string
    bot?: string
    protocolTreasury?: string
    StartBlock?: number,
    creditsMaxSupply?: string,
    credits?: string
    participatingToken: ParticipationTokenType
}

export interface networkConfigInfo {
    [key: string]: networkConfigItem
}

export enum ParticipationTokenType {
    USDC,
    CRD
}

export const networkConfig: networkConfigInfo = {
    hardhat: {
        chainId: 31337,
        goldskySlug: "hardhat",
        deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        usdcAdmin: "0x02d4Bf54Fe8bA630fFc2862a6393C462967D5a1D",
        bot: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        protocolTreasury: "0x02d4Bf54Fe8bA630fFc2862a6393C462967D5a1D",
        creditsMaxSupply: "1000000000000000000000000", // 1 Million
        participatingToken: ParticipationTokenType.USDC
    },
    localhost: {
        chainId: 31337,
        goldskySlug: "localhost",
        deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        usdcAdmin: "0x02d4Bf54Fe8bA630fFc2862a6393C462967D5a1D",
        bot: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        protocolTreasury: "0x02d4Bf54Fe8bA630fFc2862a6393C462967D5a1D",
        participatingToken: ParticipationTokenType.USDC
    },
    seiTestnet: {
        chainId: 1328,
        goldskySlug: "sei-testnet",
        deployer: "0x46eB6E3b93feAcb0C2823303498e2D430402C500",
        usdcAdmin: "0x46eB6E3b93feAcb0C2823303498e2D430402C500",
        bot: "0x8489d212fFeAE043A65b77763c42723325872c8d",
        protocolTreasury: "0x2f26916898c5Aa188676613676ba863d2f1eF597",
        creditsMaxSupply: "1000000000000000000000000", // 1 Million
        participatingToken: ParticipationTokenType.CRD
    },
    seiMainnet: {
        chainId: 1329,
        goldskySlug: "sei",
        deployer: "0x154995E448455D1a731ecA77219a4ea425767f0D",
        usdc: "0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1",
        bot: "0x16372a30A0b6554Bcb81fed6665B0e628B47FB3a",
        protocolTreasury: "0xF4ddE68ed3cbF149fc22db422029e96F4F66f660",
        creditsMaxSupply: "1000000000000000000000000", // 1 Million
        participatingToken: ParticipationTokenType.CRD
    },
    baseMainnet: {
        chainId: 8453,
        goldskySlug: "base",
        deployer: "0x154995E448455D1a731ecA77219a4ea425767f0D",
        usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        bot: "0x160759D72eA832A35fa22F6a613cC1fB333B3221",
        protocolTreasury: "0xF4ddE68ed3cbF149fc22db422029e96F4F66f660",
        creditsMaxSupply: "1000000000000000000000000", // 1 Million
        participatingToken: ParticipationTokenType.CRD
    }
}

export const forkedChain = ["localhost"]
export const testNetworkChains = ["seiTestnet"]
export const VERIFICATION_BLOCK_CONFIRMATIONS = 6

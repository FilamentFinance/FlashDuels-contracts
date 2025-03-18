export interface networkConfigItem {
    chainId: number
    goldskySlug?: string
    deployer: string
    usdc?: string
    usdcAdmin?: string
    bot?: string
    protocolTreasury?: string
    StartBlock?: number,
    creditsMaxSupply?: string
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
        creditsMaxSupply: "1000000000000000000000000" // 1 Million
    },
    localhost: {
        chainId: 31337,
        goldskySlug: "localhost",
        deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        usdcAdmin: "0x02d4Bf54Fe8bA630fFc2862a6393C462967D5a1D",
        bot: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        protocolTreasury: "0x02d4Bf54Fe8bA630fFc2862a6393C462967D5a1D",
    },
    seiTestnet: {
        chainId: 1328,
        goldskySlug: "sei-testnet",
        deployer: "0x91C2352245065B9e5d2514a313b60c1f01BfF60F",
        usdcAdmin: "0x02d4Bf54Fe8bA630fFc2862a6393C462967D5a1D",
        bot: "0x2Eb671E6e0cd965A79A80caF35c5123b7a5D8ebb",
        protocolTreasury: "0x81F20658e0265d89f4Cca7BAf8FB3933B4FcA6Be",
        creditsMaxSupply: "1000000000000000000000000" // 1 Million
    },
    seiMainnet: {
        chainId: 1329,
        goldskySlug: "sei",
        deployer: "0xc060695ecd8ee28d1cf11cdd27c7f368e86986c5",
        usdc: "0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1",
        bot: "",
        protocolTreasury: "",
    }
}

export const forkedChain = ["localhost"]
export const testNetworkChains = ["seiTestnet"]
export const VERIFICATION_BLOCK_CONFIRMATIONS = 6

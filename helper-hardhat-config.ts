export interface networkConfigItem {
    chainId: number
    goldskySlug?: string
    deployer: string
    usdc?: string
    usdcAdmin?: string
}

export interface networkConfigInfo {
    [key: string]: networkConfigItem
}

export const networkConfig: networkConfigInfo = {
    hardhat: {
        chainId: 31337,
        goldskySlug: "hardhat",
        deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        usdcAdmin: "0x02d4Bf54Fe8bA630fFc2862a6393C462967D5a1D",
    },
    localhost: {
        chainId: 31337,
        goldskySlug: "localhost",
        deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        usdcAdmin: "0x02d4Bf54Fe8bA630fFc2862a6393C462967D5a1D",
    },
    seiTestnet: {
        chainId: 1328,
        goldskySlug: "sei-testnet",
        deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        usdcAdmin: "0x02d4Bf54Fe8bA630fFc2862a6393C462967D5a1D",
    },
    seiMainnet: {
        chainId: 1329,
        goldskySlug: "sei",
        deployer: "0xc060695ecd8ee28d1cf11cdd27c7f368e86986c5",
        usdc: "0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1",
        usdcAdmin: "0x02d4Bf54Fe8bA630fFc2862a6393C462967D5a1D",
    }
}

export const forkedChain = ["localhost"]
export const testNetworkChains = ["seiTestnet"]
export const VERIFICATION_BLOCK_CONFIRMATIONS = 6

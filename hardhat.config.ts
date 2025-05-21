import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "@openzeppelin/hardhat-upgrades"
import "./tasks"
import * as dotenv from "dotenv"
import "solidity-docgen"
import "hardhat-abi-exporter"
import "hardhat-contract-sizer"
dotenv.config()

const PRIVATE_KEY_ADMIN_MAINNET = process.env.PRIVATE_KEY_ADMIN_MAINNET || ""
const PRIVATE_KEY_ADMIN_TESTNET = process.env.PRIVATE_KEY_ADMIN_TESTNET || ""
const PRIVATE_KEY_BOT_TESTNET = process.env.PRIVATE_KEY_BOT_TESTNET || ""
const PRIVATE_KEY_BOT_MAINNET = process.env.PRIVATE_KEY_BOT_MAINNET || ""
const SEITRACE_API_KEY = process.env.SEITRACE_API_KEY || ""


const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.26",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            viaIR: true
        }
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337
        },
        localhost: {
            chainId: 31337,
            forking: {
                url: "https://evm-rpc-testnet.sei-apis.com"
            }
        },
        seiTestnet: {
            url: "https://evm-rpc-testnet.sei-apis.com",
            chainId: 1328,
            accounts: [PRIVATE_KEY_ADMIN_TESTNET, PRIVATE_KEY_BOT_TESTNET]
        },
        seiMainnet: {
            url: "https://evm-rpc.sei-apis.com",
            chainId: 1329,
            accounts: [PRIVATE_KEY_ADMIN_MAINNET, PRIVATE_KEY_BOT_MAINNET]
<<<<<<< Updated upstream
=======
        },
        baseMainnet: {
            url: process.env.QUICKNODE_API_KEY_BASE || "",
            chainId: 8453,
            accounts: [PRIVATE_KEY_ADMIN_MAINNET, PRIVATE_KEY_BOT_MAINNET]
        },
        baseSepolia: {
            url: process.env.QUICKNODE_API_KEY_BASE_SEPOLIA || "",
            chainId: 84532,
            accounts: [PRIVATE_KEY_ADMIN_TESTNET, PRIVATE_KEY_BOT_TESTNET]
>>>>>>> Stashed changes
        }
    },
    abiExporter: {
        path: "./constants/abis",
        runOnCompile: true,
        clear: true,
        flat: true,
        spacing: 4,
        only: [
            "FLASHUSDC",
            "OptionToken",
            "Credits",
            "FlashDuelsIncentives",
            "Diamond",
            "FlashDuelsAdminFacet",
            "FlashDuelsCoreFacet",
            "FlashDuelsMarketplaceFacet",
            "FlashDuelsViewFacet",
            "OwnershipFacet",
            "DiamondLoupeFacet",
            "DiamondCutFacet",
        ]
    },
    sourcify: {
        enabled: false
    },
    etherscan: {
        apiKey: {
            seiTestnet: SEITRACE_API_KEY
        },
        customChains: [
            {
                network: "seiTestnet",
                chainId: 1328,
                urls: {
                    apiURL: "https://seitrace.com/atlantic-2/api",
                    browserURL: "https://seitrace.com"
                }
            }
        ]
    },
    docgen: {
        outputDir: "./docs",
        pages: "files",
        collapseNewlines: true
    },
    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: true,
        strict: true
        // only: [":ERC20$"]
    }
}

export default config

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-foundry";
// import "./tasks"
import * as dotenv from "dotenv";
import "solidity-docgen";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
dotenv.config();

const PRIVATE_KEY_ADMIN = process.env.PRIVATE_KEY_ADMIN || "";
const PRIVATE_KEY_TWO = process.env.PRIVATE_KEY_TWO || "";
const PRIVATE_KEY_SEQ = process.env.PRIVATE_KEY_SEQ || "";
const SEITRACE_API_KEY = process.env.SEITRACE_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
      viaIR: true,
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      chainId: 31337,
      forking: {
        url: `${process.env.QUICKNODE_API_KEY}`, //"https://evm-rpc-testnet.sei-apis.com"
      },
    },
    seiTestnet: {
      url: `${process.env.QUICKNODE_API_KEY}`, //"https://indulgent-cosmopolitan-gas.sei-atlantic.quiknode.pro/ae2911d1a7bd8924edfbf9e4711181e0f8b2cd03/", //"https://evm-rpc-testnet.sei-apis.com",
      chainId: 1328,
      accounts: [PRIVATE_KEY_ADMIN, PRIVATE_KEY_TWO, PRIVATE_KEY_SEQ],
    },
    seiMainnet: {
      url: "https://evm-rpc.sei-apis.com",
      chainId: 1329,
      accounts: [PRIVATE_KEY_ADMIN, PRIVATE_KEY_TWO, PRIVATE_KEY_SEQ],
    },
  },
  abiExporter: {
    path: "./constants/abis",
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 4,
    only: ["FlashDuels"],
  },
  sourcify: {
    enabled: false,
  },
  etherscan: {
    apiKey: {
      seiTestnet: SEITRACE_API_KEY,
    },
    customChains: [
      {
        network: "seiTestnet",
        chainId: 1328,
        urls: {
          apiURL: "https://seitrace.com/atlantic-2/api",
          browserURL: "https://seitrace.com",
        },
      },
    ],
  },
  docgen: {
    outputDir: "./docs",
    pages: "files",
    collapseNewlines: true,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true,
    // only: [":ERC20$"]
  },
};

export default config;

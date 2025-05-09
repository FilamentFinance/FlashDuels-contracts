import { expect } from "chai"
import { contracts } from "../typechain-types"
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { ethers, upgrades, network } from "hardhat"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
const helpers = require("@nomicfoundation/hardhat-network-helpers")
import { setupContracts } from "./testSetup"

describe("FlashDuelsViewFacet", function () {
    let duelId: any
    let flashDuelsView: any, flashDuelsViewFacet: any, owner: any, addr1: any, addr2: any;

    async function deploy() {
        const accounts = await ethers.getSigners()
        const contracts = await setupContracts()
        owner = accounts[0]
        addr1 = accounts[1]
        addr2 = accounts[2]
        return { contracts, accounts }
    }

    beforeEach(async function () {
        const { contracts, accounts } = await loadFixture(deploy)
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )

        const expiryTime = 3
        const usdcToken: any = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
        await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
        await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
        await flashDuelsCore.connect(accounts[1]).requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        let receipt = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
        let txr = await receipt.wait(1)
        for (let i = 0; i < txr?.logs.length; i++) {
            if (txr?.logs[i]["args"]) {
                duelId = txr?.logs[i]["args"][1]
            }
        }
    })
    it("should check if threshold is met for a duel", async function () {
        const { contracts, accounts } = await loadFixture(deploy)
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )
        // Setup a duel with options and wagers
        // Call the function and verify the result
        const result = await flashDuelsView.checkIfThresholdMet(duelId);
        expect(result).to.be.a("boolean");
    });

    it("should retrieve duel IDs created by a specific address", async function () {
        // Setup duels created by addr1
        const duelIds = await flashDuelsView.getCreatorToDuelIds(addr1.address);
        expect(duelIds).to.be.an("array");
    });

    it("should retrieve options for a specific duel", async function () {
        const options = await flashDuelsView.getDuelIdToOptions(duelId);
        expect(options).to.be.an("array");
    });

    it("should retrieve the token address for a specific option in a duel", async function () {
        const tokenAddress = await flashDuelsView.getOptionIndexToOptionToken(duelId, 0);
        expect(tokenAddress).to.be.a("string");
    });

    it("should retrieve users for a specific option in a duel", async function () {
        const users = await flashDuelsView.getDuelUsersForOption(duelId, "NO");
        expect(users).to.be.an("array");
    });

    // it("should retrieve user share for a specific option in a duel", async function () {
    //     const share = await flashDuelsView.getUserDuelOptionShare(duelId, 0, addr1.address);
    //     expect(share).to.be.a("number");
    // });

    it("should retrieve wager amounts deposited by a user in a duel", async function () {
        const [optionsLength, options, wagerAmounts] = await flashDuelsView.getWagerAmountDeposited(duelId, addr1.address);
        expect(optionsLength).to.be.a("bigint");
        expect(options).to.be.an("array");
        expect(wagerAmounts).to.be.an("array");
    });

    it("should retrieve the token symbol for a specific duel", async function () {
        const tokenSymbol = await flashDuelsView.getDuelIdToTokenSymbol(duelId);
        expect(tokenSymbol).to.be.a("string");
    });

    it("should retrieve detailed information about a duel", async function () {
        const duel = await flashDuelsView.getDuel(duelId);
        expect(duel).to.be.an("array");
    });

    it("should retrieve detailed information about a crypto duel", async function () {
        const cryptoDuel = await flashDuelsView.getCryptoDuel(duelId);
        expect(cryptoDuel).to.be.an("array");
    });

    it("should calculate the price delta for a specific token in a duel", async function () {
        const [endPrice, startPrice, delta, isEndPriceGreater] = await flashDuelsView.getPriceDelta(duelId, "tokenSymbol", 100);
        expect(endPrice).to.be.a("bigint");
        expect(startPrice).to.be.a("bigint");
        expect(delta).to.be.a("bigint");
        expect(isEndPriceGreater).to.be.a("boolean");
    });

    it("should check if a duel ID is valid", async function () {
        const isValid = await flashDuelsView.isValidDuelId(duelId);
        expect(isValid).to.be.a("boolean");
    });

    it("should check if refund is in progress for a duel", async function () {
        const isRefundInProgress = await flashDuelsView.isRefundInProgress(duelId);
        expect(isRefundInProgress).to.be.a("boolean");
    });

    it("should retrieve the protocol's treasury address", async function () {
        const treasuryAddress = await flashDuelsView.getProtocolTreasury();
        expect(treasuryAddress).to.be.a("string");
    });

    it("should retrieve the total protocol fees generated", async function () {
        const totalFees = await flashDuelsView.getTotalProtocolFeesGenerated();
        expect(totalFees).to.be.a("bigint");
    });

    it("should retrieve the total creator fees earned by a specific creator", async function () {
        const creatorFees = await flashDuelsView.getCreatorFeesEarned(addr1.address);
        expect(creatorFees).to.be.a("bigint");
    });

    it("should retrieve pending duels for a specific user and category", async function () {
        const [pendingDuels, pendingDuelsLength] = await flashDuelsView.getPendingDuels(addr1.address, 0);
        expect(pendingDuels).to.be.an("array");
        expect(pendingDuelsLength).to.be.a("bigint");
    });

    // it("should retrieve pending crypto duels for a specific user", async function () {
    //     const [pendingCryptoDuels, pendingCryptoDuelsLength] = await flashDuelsView.getPendingCryptoDuels(addr1.address);
    //     expect(pendingCryptoDuels).to.be.an("array");
    //     expect(pendingCryptoDuelsLength).to.be.a("bigint");
    // });


    it("should retrieve all pending duels and their count", async function () {
        const [allPendingDuels, allPendingDuelsLength] = await flashDuelsView.getAllPendingDuelsAndCount();
        expect(allPendingDuels).to.be.an("array");
        expect(allPendingDuelsLength).to.be.a("bigint");
    });

    // it("should retrieve all pending crypto duels and their count", async function () {
    //     const [allPendingCryptoDuels, allPendingCryptoDuelsLength] = await flashDuelsView.getAllPendingCryptoDuelsAndCount();
    //     expect(allPendingCryptoDuels).to.be.an("array");
    //     expect(allPendingCryptoDuelsLength).to.be.a("bigint");
    // });

    it("should retrieve the create duel fee", async function () {
        const createDuelFee = await flashDuelsView.getCreateDuelFee();
        expect(createDuelFee).to.be.a("bigint");
    });

    it("should retrieve the protocol fee percentage", async function () {
        const protocolFeePercentage = await flashDuelsView.getProtocolFeePercentage();
        expect(protocolFeePercentage).to.be.a("bigint");
    });

    it("should retrieve the creator fee percentage", async function () {
        const creatorFeePercentage = await flashDuelsView.getCreatorFeePercentage();
        expect(creatorFeePercentage).to.be.a("bigint");
    });

    it("should retrieve the winners chunk size", async function () {
        const winnersChunkSize = await flashDuelsView.getWinnersChunkSize();
        expect(winnersChunkSize).to.be.a("bigint");
    });

    it("should retrieve the refund chunk size", async function () {
        const refundChunkSize = await flashDuelsView.getRefundChunkSize();
        expect(refundChunkSize).to.be.a("bigint");
    });

    it("should retrieve the resolving period", async function () {
        const resolvingPeriod = await flashDuelsView.getResolvingPeriod();
        expect(resolvingPeriod).to.be.a("bigint");
    });

    it("should retrieve the bootstrap period", async function () {
        const bootstrapPeriod = await flashDuelsView.getBootstrapPeriod();
        expect(bootstrapPeriod).to.be.a("bigint");
    });

    // it("should retrieve the marketplace fees", async function () {
    //     const marketPlaceFees = await flashDuelsView.getMarketPlaceFees();
    //     expect(marketPlaceFees).to.be.a("bigint");
    // });

    it("should retrieve the seller fees", async function () {
        const [sellerFees, buyerFees] = await flashDuelsView.getSellerAndBuyerFees();
        expect(sellerFees).to.be.a("bigint");
        expect(buyerFees).to.be.a("bigint");
    });

    it("should retrieve the minimum threshold for wagering", async function () {
        const minThreshold = await flashDuelsView.getMinThreshold();
        expect(minThreshold).to.be.a("bigint");
    });

    it("should retrieve the sale counter", async function () {
        const saleCounter = await flashDuelsView.getSaleCounter();
        expect(saleCounter).to.be.a("bigint");
    });

    it("should retrieve the nonce used to generate unique duel IDs", async function () {
        const nonce = await flashDuelsView.getNonce();
        expect(nonce).to.be.a("bigint");
    });

    it("should retrieve the USDC token contract address", async function () {
        const usdcAddress = await flashDuelsView.getUsdcAddress();
        expect(usdcAddress).to.be.a("string");
    });

    it("should retrieve the bot address", async function () {
        const botAddress = await flashDuelsView.getBotAddress();
        expect(botAddress).to.be.a("string");
    });
});
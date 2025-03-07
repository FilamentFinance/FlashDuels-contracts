import { expect } from "chai"
import { contracts } from "../typechain-types"
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { ethers, upgrades, network } from "hardhat"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
const helpers = require("@nomicfoundation/hardhat-network-helpers")
import { setupContracts } from "./testSetup"

describe("FlashDuelsAdminFacet", function () {
    let flashDuelsAdmin: any, flashDuelsView: any, owner: any, bot: any, user: any, usdcToken: any;

    async function deploy() {
        const accounts = await ethers.getSigners()
        const contracts = await setupContracts()
        return { contracts, accounts }
    }
    it("should pause and unpause the contract", async function () {
        const { contracts, accounts } = await loadFixture(deploy)
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )

        owner = accounts[0]
        bot = accounts[1]
        user = accounts[2]
        await flashDuelsAdmin.connect(owner).pause();
        await expect(flashDuelsAdmin.connect(owner).pause()).to.be.revertedWithCustomError(flashDuelsAdmin, "EnforcedPause");
        await flashDuelsAdmin.connect(owner).unpause();
        await expect(flashDuelsAdmin.connect(owner).unpause()).to.be.revertedWithCustomError(flashDuelsAdmin, "ExpectedPause");
    });

    it("should set the create duel fee", async function () {
        const { contracts, accounts } = await loadFixture(deploy)
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )

        const newFee = ethers.parseUnits("5", 6); // 5 USDC
        await flashDuelsAdmin.connect(owner).setCreateDuelFee(newFee);
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )
        expect(await flashDuelsView.getCreateDuelFee()).to.equal(newFee);
    });

    it("should set the bot address", async function () {
        const { contracts, accounts } = await loadFixture(deploy)
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )
        await flashDuelsAdmin.connect(owner).setBotAddress(user.address);
        expect(await flashDuelsView.getBotAddress()).to.equal(user.address);
    });

    it("should set the protocol address", async function () {
        const { contracts, accounts } = await loadFixture(deploy)
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )
        await flashDuelsAdmin.connect(owner).setProtocolAddress(user.address);
        expect(await flashDuelsView.getProtocolTreasury()).to.equal(user.address);
    });

    it("only owner or bot can approve and create a duel for the user", async function () {
        const { contracts, accounts } = await loadFixture(deploy)
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )

        const expiryTime = 3
        const usdcToken: any = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
        await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
        await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
        await flashDuelsCore.connect(accounts[1]).requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        await expect(flashDuelsAdmin.connect(user).approveAndCreateDuel(user.address, 2, 0)).to.be.revertedWithCustomError(flashDuelsAdmin, "FlashDuels__InvalidOwnerOrBot");
    });

    it("only owner or bot can revoke a duel request", async function () {
        const category = 0; // Assuming 0 is a valid category
        const index = 0; // Assuming 0 is a valid index
        const { contracts, accounts } = await loadFixture(deploy)
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )

        const expiryTime = 3
        const usdcToken: any = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
        await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
        await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
        await flashDuelsCore.connect(accounts[1]).requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        await expect(flashDuelsAdmin.connect(user).revokeCreateDuelRequest(user.address, category, index)).to.be.revertedWithCustomError(flashDuelsAdmin, "FlashDuels__InvalidOwnerOrBot");
    });

    it("should withdraw protocol fees if called by the owner and otherwise reverted", async function () {
        const { contracts, accounts } = await loadFixture(deploy)
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )
        await expect(flashDuelsAdmin.connect(user).withdrawProtocolFees()).to.be.revertedWith("LibDiamond: Must be contract owner");
        expect(await flashDuelsView.getTotalProtocolFeesGenerated()).to.equal(0);
        await expect(flashDuelsAdmin.connect(owner).withdrawProtocolFees()).to.be.revertedWith("No funds available");

    });
});

describe("FlashDuelsAdminFacet Additional Tests", function () {
    let flashDuelsAdmin: any, owner: any, user: any, flashDuelsView: any, bot: any;
    beforeEach(async function () {
        const { contracts, accounts } = await loadFixture(deploy)
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )
        owner = accounts[0]
        bot = accounts[1]
        user = accounts[2]
    })
    async function deploy() {
        const accounts = await ethers.getSigners();
        const contracts = await setupContracts();
        return { contracts, accounts };
    }

    it("should set the create duel fee to the maximum allowed value", async function () {
        const { contracts, accounts } = await loadFixture(deploy);
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        );
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )

        const maxFee = ethers.parseUnits("10", 6); // 10 USDC
        await flashDuelsAdmin.connect(owner).setCreateDuelFee(maxFee);
        expect(await flashDuelsView.getCreateDuelFee()).to.equal(maxFee);
    });

    it("should revert when setting the create duel fee above the maximum allowed value", async function () {
        const { contracts, accounts } = await loadFixture(deploy);
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        );

        const excessiveFee = ethers.parseUnits("11", 6); // 11 USDC
        await expect(flashDuelsAdmin.connect(owner).setCreateDuelFee(excessiveFee)).to.be.revertedWith("Duel fees cannot be more than 10 dollars");
    });

    it("should set the minimum wager threshold to the lower boundary", async function () {
        const { contracts, accounts } = await loadFixture(deploy);
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        );
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )

        const minThreshold = ethers.parseUnits("50", 6); // 50 USDC
        await flashDuelsAdmin.connect(owner).setMinimumWagerThreshold(minThreshold);
        expect(await flashDuelsView.getMinThreshold()).to.equal(minThreshold);
    });

    it("should revert when setting the minimum wager threshold below the allowed range", async function () {
        const { contracts, accounts } = await loadFixture(deploy);
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        );

        const belowMinThreshold = ethers.parseUnits("49", 6); // 49 USDC
        await expect(flashDuelsAdmin.connect(owner).setMinimumWagerThreshold(belowMinThreshold)).to.be.revertedWith("Minimum threshold should be in the range 50 to 100 dollars");
    });

    it("should set the bootstrap period to the lower boundary", async function () {
        const { contracts, accounts } = await loadFixture(deploy);
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        );
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )

        const minBootstrapPeriod = 5 * 60; // 5 minutes
        await flashDuelsAdmin.connect(owner).updateBootstrapPeriod(minBootstrapPeriod);
        expect(await flashDuelsView.getBootstrapPeriod()).to.equal(minBootstrapPeriod);
    });

    it("should revert when setting the bootstrap period below the allowed range", async function () {
        const { contracts, accounts } = await loadFixture(deploy);
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        );

        const belowMinBootstrapPeriod = 4 * 60; // 4 minutes
        await expect(flashDuelsAdmin.connect(owner).updateBootstrapPeriod(belowMinBootstrapPeriod)).to.be.revertedWith("Bootstrap period should be in the range 5 to 30 mins");
    });

    it("should set the resolving period to the minimum allowed value", async function () {
        const { contracts, accounts } = await loadFixture(deploy);
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        );
        flashDuelsView = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )

        const minResolvingPeriod = 48 * 60 * 60; // 48 hours
        await flashDuelsAdmin.connect(owner).setResolvingPeriod(minResolvingPeriod);
        expect(await flashDuelsView.getResolvingPeriod()).to.equal(minResolvingPeriod);
    });

    it("should revert when setting the resolving period below the minimum allowed value", async function () {
        const { contracts, accounts } = await loadFixture(deploy);
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        );

        const belowMinResolvingPeriod = 47 * 60 * 60; // 47 hours
        await expect(flashDuelsAdmin.connect(owner).setResolvingPeriod(belowMinResolvingPeriod)).to.be.revertedWith("Resolving period should be atleast 48 hours");
    });

    it("should set the winners chunk size to the lower boundary", async function () {
        const { contracts, accounts } = await loadFixture(deploy);
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        );

        const minChunkSize = 30;
        await flashDuelsAdmin.connect(owner).setWinnersChunkSizes(minChunkSize);
        expect(await flashDuelsView.getWinnersChunkSize()).to.equal(minChunkSize);
    });

    it("should revert when setting the winners chunk size below the allowed range", async function () {
        const { contracts, accounts } = await loadFixture(deploy);
        flashDuelsAdmin = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        );

        const belowMinChunkSize = 29;
        await expect(flashDuelsAdmin.connect(owner).setWinnersChunkSizes(belowMinChunkSize)).to.be.revertedWith("Chunk size should be in the range 30 to 100");
    });

    it("should set the refund chunk size to the lower boundary", async function () {
        const minRefundChunkSize = 30;
        await flashDuelsAdmin.connect(owner).setRefundChunkSizes(minRefundChunkSize);
        expect(await flashDuelsView.getRefundChunkSize()).to.equal(minRefundChunkSize);
    });

    it("should revert when setting the refund chunk size below the allowed range", async function () {
        const belowMinRefundChunkSize = 29;
        await expect(flashDuelsAdmin.connect(owner).setRefundChunkSizes(belowMinRefundChunkSize)).to.be.revertedWith("Chunk size should be in the range 30 to 100");
    });

    it("should approve and create a duel successfully", async function () {
        const { contracts } = await loadFixture(deploy);
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        const expiryTime = 3;
        const usdcToken: any = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress);
        await usdcToken.connect(owner).mint(user.address, ethers.parseUnits("10", 6));
        await usdcToken.connect(user).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6));
        await flashDuelsCore.connect(user).requestCreateDuel(2, "Will it rain tomorrow?", ["Yes", "No"], expiryTime);
        await flashDuelsAdmin.connect(owner).approveAndCreateDuel(user.address, 2, 0);
        const duelIds = await flashDuelsView.getCreatorToDuelIds(user.address);
        expect(duelIds.length).to.be.greaterThan(0);
    });

    it("should revoke a duel request successfully", async function () {
        const { contracts } = await loadFixture(deploy);
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        const expiryTime = 3;
        const usdcToken: any = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress);
        await usdcToken.connect(owner).mint(user.address, ethers.parseUnits("10", 6));
        await usdcToken.connect(user).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6));
        await flashDuelsCore.connect(user).requestCreateDuel(2, "Will it rain tomorrow?", ["Yes", "No"], expiryTime);
        await flashDuelsAdmin.connect(owner).revokeCreateDuelRequest(user.address, 2, 0);
        const duelIds = await flashDuelsView.getCreatorToDuelIds(user.address);
        expect(duelIds.length).to.equal(0);
    });

    it("should withdraw protocol fees successfully when funds are available", async function () {
        // Simulate protocol fees being generated
        const protocolFees = ethers.parseUnits("10", 6);
        await flashDuelsAdmin.connect(owner).setCreateDuelFee(protocolFees);
        await expect(flashDuelsAdmin.connect(owner).withdrawProtocolFees()).to.be.revertedWith("No funds available");
        expect(await flashDuelsView.getTotalProtocolFeesGenerated()).to.equal(0);
    });

    it("should revert when setting the bot address to zero address", async function () {
        await expect(flashDuelsAdmin.connect(owner).setBotAddress(ethers.ZeroAddress)).to.be.revertedWith("Invalid bot address");
    });

    it("should revert when setting the protocol address to zero address", async function () {
        await expect(flashDuelsAdmin.connect(owner).setProtocolAddress(ethers.ZeroAddress)).to.be.revertedWith("Invalid protocol address");
    });

    it("should set the participation token type successfully", async function () {
        const { contracts } = await loadFixture(deploy);
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        const participationTokenType = 0;
        await flashDuelsAdmin.connect(owner).setParticipationTokenType(participationTokenType);
        expect(await flashDuelsView.getParticipationTokenType()).to.equal(participationTokenType);
    });
});
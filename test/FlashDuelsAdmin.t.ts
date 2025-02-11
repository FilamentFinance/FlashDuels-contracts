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

        const expiryTime = 1
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

        const expiryTime = 1
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
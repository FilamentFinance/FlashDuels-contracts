import { expect } from "chai"
import { contracts } from "../typechain-types"
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { ethers, upgrades, network } from "hardhat"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
const helpers = require("@nomicfoundation/hardhat-network-helpers")
import { setupContracts } from "./testSetup"

describe("FlashDuels Contract", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deploy() {
        const accounts = await ethers.getSigners()
        const contracts = await setupContracts()
        return { contracts, accounts }
    }

    describe("Duel Creation", function () {
        it("should create a duel successfully", async function () {
            const { contracts, accounts } = await loadFixture(deploy)
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )

            const expiryTime = 1
            const usdcToken: any = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            await flashDuelsCore.connect(accounts[1]).requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            let pendingDuels = await flashDuelsView.getAllPendingDuelsAndCount()
            // console.log("pendingDuels: ", pendingDuels)
            expect(pendingDuels[0][0][2]).to.equal("Donald Trump will win the US election ?")
            expect(pendingDuels[1]).to.equal(1)

            let receipt = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
            let txr = await receipt.wait(1)
            // console.log("txr: ", txr)
            pendingDuels = await flashDuelsView.getAllPendingDuelsAndCount()
            // console.log("pendingDuels: ", pendingDuels)
            expect(pendingDuels[1]).to.equal(0)
            // let receipt = await flashDuelsCore
            //     .connect(accounts[1])
            //     .createDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            // let txr = await receipt.wait(1)
            // console.log(txr?.logs)
            // // console.log("Total logs length: ", txr?.logs.length)
            let duelId
            for (let i = 0; i < txr?.logs.length; i++) {
                if (txr?.logs[i]["args"]) {
                    // console.log("duelId: ", txr?.logs[i]["args"][1]);
                    duelId = txr?.logs[i]["args"][1]
                }
            }
            const duel = await flashDuelsView.getDuels(duelId.toString())
            expect(duel.creator).to.equal(accounts[1].address)
            // expect(duel.minWager).to.equal(minWager)
            expect(duel.category).to.equal(2) // DuelCategory.Politics
            expect(duel.topic).to.equal("Donald Trump will win the US election ?")
        })
    })

    describe("Duel Joining", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            return { contracts, accounts }
        }

        it("should allow users to join duels", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            txr = await tx.wait(1)
            await flashDuelsAdmin
                .connect(accounts[0])
                .approveAndCreateDuel(accounts[1].address, 2, 0)
            const amount = ethers.parseUnits("60", 6)
            const optionPrice = ethers.parseUnits("10", 6)

            await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)

            // Approve token transfer
            await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
            await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
            await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)

            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)
            let BTC = contracts.TokenA.tokenA
            // Join Duel with tokenA
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2])
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3])

            duel = await flashDuelsView.getDuels(duelIds[0])
            expect(duel.duelStatus).to.equal(1) // 1 represents the "BootStrapped" status

            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            // Start the duel with the bot account
            await expect(flashDuelsCore.connect(contracts.Bot.bot).startDuel(duelIds[0])).to.emit(
                flashDuelsCore,
                "DuelStarted"
            )

            // // Verify that the duel status has changed to "Live"
            duel = await flashDuelsView.getDuels(duelIds[0])
            expect(duel.duelStatus).to.equal(2) // 2 represents the "Live" status

            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[4])
            const getDuelUsers = await flashDuelsView.getDuelUsersForOption(duelIds[0], "Yes")
            // console.log(getDuelUsers);
        })

        it("should allow only bot to start a duel", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))
            // tx = await flashDuelsCore
            //     .connect(accounts[1])
            //     .createDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            tx = await flashDuelsCore.connect(accounts[1]).requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
            await tx.wait(1)

            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)

            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            // Attempt to start the duel with a non-bot account (should fail)
            await expect(flashDuelsCore.connect(accounts[1]).startDuel(duelIds[0])).to.be.revertedWithCustomError(
                flashDuelsCore,
                "FlashDuels__InvalidBot"
            )
        })
    })

    describe("Duel Settlement", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            return { contracts, accounts }
        }

        it("should settle duel and distribute rewards", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
            await tx.wait(1)

            const amount = ethers.parseUnits("60", 6) // 60 USDC
            const optionPrice = ethers.parseUnits("10", 6) // 10 USDC

            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)

            await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)

            await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
            await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)

            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)

            // Simulate time passage for the bootstrap period to end
            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            await flashDuelsCore.connect(contracts.Bot.bot).startDuel(duelIds[0])

            // Simulate time passage for the duel to expire (6 hours)
            let time = 3600 * 6
            await network.provider.request({
                method: "evm_increaseTime",
                params: [time]
            })
            await network.provider.send("evm_mine")

            const duelIdToOptions = await flashDuelsView.getDuelIdToOptions(duelIds[0])

            await expect(flashDuelsCore.connect(contracts.Bot.bot).settleDuel(duelIds[0], 0)).to.emit(
                flashDuelsCore,
                "DuelSettled"
            )

            // Verify duel status
            duel = await flashDuelsView.getDuels(duelIds[0])
            expect(duel.duelStatus).to.equal(3) // 3 represents the "Settled" status
        })
    })

    describe("Duel Settlement with Reward Distribution", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            return { contracts, accounts }
        }

        it("should settle duel and distribute rewards correctly to winner", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
            await tx.wait(1)
            const amount = ethers.parseUnits("60", 6)
            const optionPrice = ethers.parseUnits("10", 6)

            await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)

            // Approve token transfer
            await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
            await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
            await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)

            let duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)
            let BTC = contracts.TokenA.tokenA
            // Join Duel with tokenA
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2])
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3])

            // Simulate time passage for the bootstrap period to end
            await ethers.provider.send("evm_increaseTime", [30 * 60])

            // Check balances before settlement
            const initialBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address) // 0
            const initialBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address) // 0

            await flashDuelsCore.connect(contracts.Bot.bot).startDuel(duelIds[0])

            let time = 3600 * 6
            await network.provider.request({
                method: "evm_increaseTime",
                params: [time]
            })
            await helpers.time.increase(time)

            // Settle the duel
            await flashDuelsCore.connect(contracts.Bot.bot).settleDuel(duelIds[0], "0")

            // Check balances after settlement
            let finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            let finalBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address)
            expect(finalBalanceAccounts_2).to.be.equal("0")
            expect(finalBalanceAccounts_3).to.be.equal("0")

            let allTImeEarningsAccounts_2 = await flashDuelsView.getAllTimeEarnings(accounts[2].address)
            let allTImeEarningsAccounts_3 = await flashDuelsView.getAllTimeEarnings(accounts[3].address)

            await flashDuelsCore.connect(accounts[2]).withdrawEarnings(allTImeEarningsAccounts_2)

            // Check if accounts[2] (winner) received the rewards
            finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            expect(finalBalanceAccounts_2).to.be.gt(initialBalanceAccounts_2) // accounts[2]'s balance should increase
            // Check if accounts[3] (loser) lost their wager amount
            expect(finalBalanceAccounts_3).to.be.lte(initialBalanceAccounts_3) // accounts[3]'s balance should decrease or remain the same
        })

        it("should not change wallet balance if duel is not settled", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
            await tx.wait(1)
            const amount = ethers.parseUnits("60", 6)
            const optionPrice = ethers.parseUnits("10", 6)

            await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)

            // Approve token transfer
            await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
            await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
            await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)

            let duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)
            let BTC = contracts.TokenA.tokenA
            // Join Duel with tokenA
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2])
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3])

            // Simulate time passage for the bootstrap period to end
            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            // Check balances before settlement
            const initialBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address) // 0
            const initialBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address) // 0

            await flashDuelsCore.connect(contracts.Bot.bot).startDuel(duelIds[0])

            let time = 3600 * 6
            await network.provider.request({
                method: "evm_increaseTime",
                params: [time]
            })
            await helpers.time.increase(time)

            // No settlement is triggered, balances should remain the same
            expect(await usdcToken.balanceOf(accounts[2].address)).to.equal(initialBalanceAccounts_2)
            expect(await usdcToken.balanceOf(accounts[3].address)).to.equal(initialBalanceAccounts_3)
        })
    })

    describe("Duel Cancel and Refund Logic", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            return { contracts, accounts }
        }

        it("should cancel the duel if the threshold is not met after the bootstrap period", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
            await tx.wait(1)

            let duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)
            expect(await flashDuelsView.isValidDuelId(duelIds[0])).to.be.equal(true)

            // Increase time to after the bootstrap period
            let bootstrapPeriod = 1800
            await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1])
            await ethers.provider.send("evm_mine", [])

            // Check that the duel exists and hasn't started yet
            duel = await flashDuelsView.getDuels(duelIds[0])
            expect(duel.duelStatus).to.equal(1) // BootStrapped status

            // Call cancelDuelIfThresholdNotMet by the bot
            await flashDuelsCore.connect(contracts.Bot.bot).cancelDuelIfThresholdNotMet(2, duelIds[0])

            // Validate the duel status is updated to Cancelled
            const cancelledDuel = await flashDuelsView.getDuels(duelIds[0])
            expect(cancelledDuel.duelStatus).to.equal(4) // Cancelled status
        })

        it("should not cancel duel if the threshold is met", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
            await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)

            // Simulate meeting the threshold
            await usdcToken.connect(accounts[0]).mint(accounts[2].address, ethers.parseUnits("25", 6))
            await usdcToken.connect(accounts[0]).mint(accounts[3].address, ethers.parseUnits("25", 6))

            await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 6))
            await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 6))

            let amount = ethers.parseUnits("25", 6)
            let optionPrice = "1000000"
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)
            let bootstrapPeriod = 1800
            // Increase time to after the bootstrap period
            await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1])
            await ethers.provider.send("evm_mine", [])

            // Attempt to cancel the duel
            await expect(
                flashDuelsCore.connect(contracts.Bot.bot).cancelDuelIfThresholdNotMet(2, duelIds[0])
            ).to.be.revertedWith("Threshold met, cannot cancel")
        })

        it("should revert if non-bot tries to cancel the duel", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
            await tx.wait(1)
            let bootstrapPeriod = 1800
            await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1])
            await ethers.provider.send("evm_mine", [])
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)

            await expect(
                flashDuelsCore.connect(accounts[1]).cancelDuelIfThresholdNotMet(2, duelIds[0])
            ).to.be.revertedWithCustomError(flashDuelsCore, "FlashDuels__InvalidBot")
        })
    })

    describe("Refund Duel", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            return { contracts, accounts }
        }
        it("should refund users who wagered on options", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            let tokenA = "tokenA"


            // let receipt = await flashDuelsCore.connect(accounts[1]).createCryptoDuel(
            //     tokenA,
            //     ["Yes", "No"],
            //     6500000000000, // triggerValue
            //     0, // triggerType: aboslute
            //     0, // triggerCondition: Above
            //     duelDuration
            // )
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateCryptoDuel(tokenA, ["Yes", "No"], 6500000000000, 0, 0, duelDuration)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            await tx.wait(1)

            let duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            const cryptoDuel = await flashDuelsView.getDuels(duelIds[0])

            expect(await flashDuelsView.isValidDuelId(duelIds[0])).to.be.equal(true)
            let bootstrapPeriod = 1800
            // Increase time to after the bootstrap period
            await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1])
            await ethers.provider.send("evm_mine", [])

            // Check that the duel exists and hasn't started yet
            duel = await flashDuelsView.getCryptoDuel(duelIds[0])
            expect(duel.duelStatus).to.equal(1) // BootStrapped status

            // Simulate meeting the threshold
            await usdcToken.connect(accounts[0]).mint(accounts[2].address, ethers.parseUnits("20", 6))
            await usdcToken.connect(accounts[0]).mint(accounts[3].address, ethers.parseUnits("20", 6))

            await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 6))
            await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 6))

            let amount = ethers.parseUnits("20", 6)
            let optionPrice = "1000000"
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)

            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)

            const initialBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)

            let wager = await flashDuelsView.getWagerAmountDeposited(duelIds[0], accounts[2].address)
            expect(wager[2][0]).to.equal(20000000)
            expect(wager[2][1]).to.equal(0)

            // Call cancelDuelIfThresholdNotMet by the bot
            await flashDuelsCore.connect(contracts.Bot.bot).cancelDuelIfThresholdNotMet(1, duelIds[0])

            // Validate the duel status is updated to Cancelled
            const cancelledDuel = await flashDuelsView.getCryptoDuel(duelIds[0])
            expect(cancelledDuel.duelStatus).to.equal(4) // Cancelled status

            // Check that the wager was refunded
            let finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            expect(finalBalanceAccounts_2).to.equal(20000000)

            tx = await flashDuelsView.getAllTimeEarnings(accounts[2].address)
            expect(tx).to.equal(0)

            // Ensure wager data is cleared
            wager = await flashDuelsView.getWagerAmountDeposited(duelIds[0], accounts[2].address)
            expect(wager[2][0]).to.equal(0)
            expect(wager[2][1]).to.equal(0)

            // Check that the wager was refunded
            let finalBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address)
            expect(finalBalanceAccounts_3).to.equal(20000000)

            tx = await flashDuelsView.getAllTimeEarnings(accounts[3].address)
            expect(tx).to.equal(0)

            // Ensure wager data is cleared
            wager = await flashDuelsView.getWagerAmountDeposited(duelIds[0], accounts[3].address)
            expect(wager[2][0]).to.equal(0)
            expect(wager[2][1]).to.equal(0)
        })
    })

    describe("Crypto Duel Creation", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            return { contracts, accounts }
        }
        it("should create a crypto duel successfully", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            let tokenA = "tokenA"

            // let receipt = await flashDuelsCore.connect(accounts[1]).createCryptoDuel(
            //     tokenA,
            //     ["Yes", "No"],
            //     6500000000000, // triggerValue
            //     0, // triggerType: aboslute
            //     0, // triggerCondition: Above
            //     duelDuration
            // )
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateCryptoDuel(tokenA, ["Yes", "No"], 6500000000000, 0, 0, duelDuration)
            await tx.wait(1)

            const pendingCryptoDuels = await flashDuelsView.getPendingCryptoDuels(accounts[1].address)
            // console.log("pendingCryptoDuels: ", pendingCryptoDuels)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            txr = await tx.wait(1)

            // console.log(txr?.logs)
            // console.log("Total logs length: ", txr?.logs.length)
            let duelId
            for (let i = 0; i < txr?.logs.length; i++) {
                if (txr?.logs[i]["args"]) {
                    // console.log("duelId: ", txr?.logs[i]["args"][1]);
                    duelId = txr?.logs[i]["args"][1]
                }
            }
            duel = await flashDuelsView.getCryptoDuel(duelId.toString())
            // console.log("duel: ", duel)
            expect(duel.creator).to.equal(accounts[1].address)
        })

        it("should allow users to join duels", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))

            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            const amount = ethers.parseUnits("60", 6)
            const optionPrice = ethers.parseUnits("10", 6)

            await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)

            // Approve token transfer
            await usdcToken.connect(accounts[2]).approve(flashDuelsCore.target, amount)
            await usdcToken.connect(accounts[3]).approve(flashDuelsCore.target, amount)
            await usdcToken.connect(accounts[4]).approve(flashDuelsCore.target, amount)

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            let BTC = "tokenA"
            // let receipt = await flashDuelsCore.connect(accounts[1]).createCryptoDuel(
            //     BTC,
            //     ["Yes", "No"],
            //     6500000000000, // triggerValue
            //     0, // triggerType: aboslute
            //     0, // triggerCondition: Above
            //     duelDuration
            // )
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateCryptoDuel(BTC, ["Yes", "No"], 6500000000000, 0, 0, duelDuration)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)
            // Join Duel with tokenA
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)

            duel = await flashDuelsView.getCryptoDuel(duelIds[0])
            expect(duel.duelStatus).to.equal(1) // 1 represents the "BootStrapped" status

            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            // Start the duel with the bot account
            await expect(
                flashDuelsCore.connect(contracts.Bot.bot).startCryptoDuel(duelIds[0], "6500000000000")
            ).to.emit(flashDuelsCore, "DuelStarted")

            // Verify that the duel status has changed to "Live"
            duel = await flashDuelsView.getCryptoDuel(duelIds[0])
            expect(duel.duelStatus).to.equal(2) // 2 represents the "Live" status

            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[4].address)
            const getDuelUsers = await flashDuelsView.getDuelUsersForOption(duelIds[0], "Yes")
            expect(getDuelUsers[0]).to.equal(accounts[2].address)
        })

        it("should allow only bot to start a duel", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            let BTC = "tokenA"
            // let receipt = await flashDuelsCore.connect(accounts[1]).createCryptoDuel(
            //     BTC,
            //     ["Yes", "No"],
            //     6500000000000, // triggerValue
            //     0, // triggerType: aboslute
            //     0, // triggerCondition: Above
            //     duelDuration
            // )
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateCryptoDuel(BTC, ["Yes", "No"], 6500000000000, 0, 0, duelDuration)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)

            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            // Attempt to start the duel with a non-bot account (should fail)
            await expect(
                flashDuelsCore.connect(accounts[1]).startCryptoDuel(duelIds[0], "6500000000000")
            ).to.be.revertedWithCustomError(flashDuelsCore, "FlashDuels__InvalidBot")
        })

        it("should fail if less than minimum wager", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            let BTC = "tokenA"
            // let receipt = await flashDuelsCore.connect(accounts[1]).createCryptoDuel(
            //     BTC,
            //     ["Yes", "No"],
            //     6500000000000, // triggerValue
            //     0, // triggerType: aboslute
            //     0, // triggerCondition: Above
            //     duelDuration
            // )
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateCryptoDuel(BTC, ["Yes", "No"], 6500000000000, 0, 0, duelDuration)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)

            const amount = ethers.parseUnits("5", 6)
            const optionPrice = ethers.parseUnits("10", 6)
            await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)
            // Approve token transfer
            await usdcToken.connect(accounts[2]).approve(flashDuelsCore.target, amount)

            await expect(
                flashDuelsCore
                    .connect(contracts.Bot.bot)
                    .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[2].address)
            ).to.be.revertedWith("Less than minimum wager")
        })
    })

    describe("Crypto Duel Settlement", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            return { contracts, accounts }
        }

        it("should settle duel and distribute rewards", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            const amount = ethers.parseUnits("60", 6)
            const optionPrice = ethers.parseUnits("10", 6)

            await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)

            // Approve token transfer
            await usdcToken.connect(accounts[2]).approve(flashDuelsCore.target, amount)
            await usdcToken.connect(accounts[3]).approve(flashDuelsCore.target, amount)
            await usdcToken.connect(accounts[4]).approve(flashDuelsCore.target, amount)

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            let BTC = "tokenA"
            // let receipt = await flashDuelsCore.connect(accounts[1]).createCryptoDuel(
            //     BTC,
            //     ["Yes", "No"],
            //     6500000000000, // triggerValue
            //     0, // triggerType: aboslute
            //     0, // triggerCondition: Above
            //     duelDuration
            // )
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateCryptoDuel(BTC, ["Yes", "No"], 6500000000000, 0, 0, duelDuration)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)
            // Join Duel with tokenA
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)

            // Simulate time passage for the bootstrap period to end
            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            await flashDuelsCore.connect(contracts.Bot.bot).startCryptoDuel(duelIds[0], "6500000000000")

            // Simulate time passage for the duel to expire (6 hours)
            let time = 3600 * 6
            await network.provider.request({
                method: "evm_increaseTime",
                params: [time]
            })
            await network.provider.send("evm_mine")

            const endPriceTokenA = "6600000000000"

            const duelIdToOptions = await flashDuelsView.getDuelIdToOptions(duelIds[0])

            await expect(
                flashDuelsCore.connect(contracts.Bot.bot).settleCryptoDuel(duelIds[0], endPriceTokenA)
            ).to.emit(flashDuelsCore, "DuelSettled")
            // .withArgs(duelIds[0], duelIdToOptions[0], 0) // Assume tokenB wins based on mock prices

            // Verify duel status
            duel = await flashDuelsView.getCryptoDuel(duelIds[0])
            expect(duel.duelStatus).to.equal(3) // 3 represents the "Settled" status
        })
    })

    describe("Crypto Duel Settlement with Reward Distribution", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            return { contracts, accounts }
        }

        it("should settle duel and distribute rewards correctly to winner", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            const amount = ethers.parseUnits("60", 6)
            const optionPrice = ethers.parseUnits("10", 6)

            await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
            await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)

            // Approve token transfer
            await usdcToken.connect(accounts[2]).approve(flashDuelsCore.target, amount)
            await usdcToken.connect(accounts[3]).approve(flashDuelsCore.target, amount)
            await usdcToken.connect(accounts[4]).approve(flashDuelsCore.target, amount)

            const getTotalProtocolFeesGeneratedBefore = await flashDuelsView.getTotalProtocolFeesGenerated()
            // console.log("getTotalProtocolFeesGeneratedBefore", getTotalProtocolFeesGeneratedBefore)
            expect(getTotalProtocolFeesGeneratedBefore).to.be.equal("0") // $1.2

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            let BTC = "tokenA"
            // let receipt = await flashDuelsCore.connect(accounts[1]).createCryptoDuel(
            //     BTC,
            //     ["Yes", "No"],
            //     6500000000000, // triggerValue
            //     0, // triggerType: aboslute
            //     0, // triggerCondition: Above
            //     duelDuration
            // )
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateCryptoDuel(BTC, ["Yes", "No"], 6500000000000, 0, 0, duelDuration)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            const cryptoDuel = await flashDuelsView.getDuels(duelIds[0])

            const getTotalProtocolFeesGeneratedAfter = await flashDuelsView.getTotalProtocolFeesGenerated()
            // console.log("getTotalProtocolFeesGeneratedAfter", getTotalProtocolFeesGeneratedAfter)
            expect(getTotalProtocolFeesGeneratedAfter).to.be.equal("5000000") // $1.2

            expect(duelIds.length).to.equal(1)
            // Join Duel with tokenA
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)

            // Simulate time passage for the bootstrap period to end
            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            // Check balances before settlement
            const initialBalanceaccounts_2 = await usdcToken.balanceOf(accounts[2].address) // 0
            const initialBalanceaccounts_3 = await usdcToken.balanceOf(accounts[3].address) // 0
            await network.provider.send("evm_mine")

            const startTokenPrice = "6500000000000"
            await flashDuelsCore.connect(contracts.Bot.bot).startCryptoDuel(duelIds[0], startTokenPrice)

            let time = 3600 * 6
            await network.provider.request({
                method: "evm_increaseTime",
                params: [time]
            })
            // await helpers.time.increase(time)
            const endTokenPrice = "6600000000000"
            // Settle the duel
            await flashDuelsCore.connect(contracts.Bot.bot).settleCryptoDuel(duelIds[0], endTokenPrice)

            // Check balances after settlement
            let finalBalanceaccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            let finalBalanceaccounts_3 = await usdcToken.balanceOf(accounts[3].address)
            expect(finalBalanceaccounts_2).to.be.equal("0")
            expect(finalBalanceaccounts_3).to.be.equal("0")

            let allTImeEarningsaccounts_2 = await flashDuelsView.getAllTimeEarnings(accounts[2].address)
            let allTImeEarningsaccounts_3 = await flashDuelsView.getAllTimeEarnings(accounts[3].address)
            expect(allTImeEarningsaccounts_3).to.be.equal("0")
            // console.log("allTImeEarningsaccounts_2", allTImeEarningsaccounts_2)
            expect(allTImeEarningsaccounts_2).to.be.equal("117600000") // $117.6
            const getTotalProtocolFeesGenerated = await flashDuelsView.getTotalProtocolFeesGenerated()
            // console.log("getTotalProtocolFeesGenerated", getTotalProtocolFeesGenerated)
            const getCreatorFeesEarned = await flashDuelsView.getCreatorFeesEarned(accounts[1].address)
            // console.log("getCreatorFeesEarned", getCreatorFeesEarned)

            expect(getTotalProtocolFeesGenerated).to.be.equal("6200000") // $1.2
            expect(getCreatorFeesEarned).to.be.equal("1200000") // $1.2
            // expect(await usdcToken.balanceOf(cryptoDuel.creator)).to.be.equal("1200000") // $117.6

            await flashDuelsCore.connect(accounts[2]).withdrawEarnings(allTImeEarningsaccounts_2)

            // Check if accounts[2] (winner) received the rewards
            finalBalanceaccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            expect(finalBalanceaccounts_2).to.be.gt(initialBalanceaccounts_2) // accounts[2]'s balance should increase
            // Check if accounts[3] (loser) lost their wager amount
            expect(finalBalanceaccounts_3).to.be.lte(initialBalanceaccounts_3) // accounts[3]'s balance should decrease or remain the same
        })
    })

    describe("Crypto Duel Cancel and Refund Logic", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            return { contracts, accounts }
        }
        it("should cancel the duel if the threshold is not met after the bootstrap period", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            let tokenA = "tokenA"

            // let receipt = await flashDuelsCore.connect(accounts[1]).createCryptoDuel(
            //     tokenA,
            //     ["Yes", "No"],
            //     6500000000000, // triggerValue
            //     0, // triggerType: aboslute
            //     0, // triggerCondition: Above
            //     duelDuration
            // )
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateCryptoDuel(tokenA, ["Yes", "No"], 6500000000000, 0, 0, duelDuration)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            await tx.wait(1)

            let duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            const cryptoDuel = await flashDuelsView.getDuels(duelIds[0])

            expect(await flashDuelsView.isValidDuelId(duelIds[0])).to.be.equal(true)
            let bootstrapPeriod = 1800
            // Increase time to after the bootstrap period
            await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1])
            await ethers.provider.send("evm_mine", [])

            // Check that the duel exists and hasn't started yet
            duel = await flashDuelsView.getCryptoDuel(duelIds[0])
            expect(duel.duelStatus).to.equal(1) // BootStrapped status

            // Call cancelDuelIfThresholdNotMet by the bot
            await flashDuelsCore.connect(contracts.Bot.bot).cancelDuelIfThresholdNotMet(1, duelIds[0])

            // Validate the duel status is updated to Cancelled
            const cancelledDuel = await flashDuelsView.getCryptoDuel(duelIds[0])
            expect(cancelledDuel.duelStatus).to.equal(4) // Cancelled status
        })

        it("should not cancel duel if the threshold is met", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            let tokenA = "tokenA"
            let duelDuration = 0

            // let receipt = await flashDuelsCore.connect(accounts[1]).createCryptoDuel(
            //     tokenA,
            //     ["Yes", "No"],
            //     6500000000000, // triggerValue
            //     0, // triggerType: aboslute
            //     0, // triggerCondition: Above
            //     duelDuration
            // )
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateCryptoDuel(tokenA, ["Yes", "No"], 6500000000000, 0, 0, duelDuration)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)

            // Simulate meeting the threshold
            await usdcToken.connect(accounts[0]).mint(accounts[2].address, ethers.parseUnits("25", 6))
            await usdcToken.connect(accounts[0]).mint(accounts[3].address, ethers.parseUnits("25", 6))

            await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 6))
            await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 6))

            let amount = ethers.parseUnits("25", 6)
            let optionPrice = "1000000"
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)

            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)

            let bootstrapPeriod = 1800
            // Increase time to after the bootstrap period
            await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1])
            await ethers.provider.send("evm_mine", [])

            // Attempt to cancel the duel
            await expect(
                flashDuelsCore.connect(contracts.Bot.bot).cancelDuelIfThresholdNotMet(1, duelIds[0])
            ).to.be.revertedWith("Threshold met, cannot cancel")
        })

        it("should revert if non-bot tries to cancel the duel", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            let tokenA = "tokenA"
            let duelDuration = 0

            // let receipt = await flashDuelsCore.connect(accounts[1]).createCryptoDuel(
            //     tokenA,
            //     ["Yes", "No"],
            //     6500000000000, // triggerValue
            //     0, // triggerType: aboslute
            //     0, // triggerCondition: Above
            //     duelDuration
            // )
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateCryptoDuel(tokenA, ["Yes", "No"], 6500000000000, 0, 0, duelDuration)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)

            // Simulate meeting the threshold
            await usdcToken.connect(accounts[0]).mint(accounts[2].address, ethers.parseUnits("25", 6))

            await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 6))

            let amount = ethers.parseUnits("25", 6)
            let optionPrice = "1000000"
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)

            let bootstrapPeriod = 1800
            // Increase time to after the bootstrap period
            await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1])
            await ethers.provider.send("evm_mine", [])

            await expect(
                flashDuelsCore.connect(accounts[1]).cancelDuelIfThresholdNotMet(1, duelIds[0])
            ).to.be.revertedWithCustomError(flashDuelsCore, "FlashDuels__InvalidBot")
        })

        it("should refund users who wagered on options", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
            await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
            await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )

            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            await usdcToken.connect(accounts[1]).approve(flashDuelsCore.target, ethers.parseUnits("10", 6))

            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            let tokenA = "tokenA"

            // let receipt = await flashDuelsCore.connect(accounts[1]).createCryptoDuel(
            //     tokenA,
            //     ["Yes", "No"],
            //     6500000000000, // triggerValue
            //     0, // triggerType: aboslute
            //     0, // triggerCondition: Above
            //     duelDuration
            // )
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateCryptoDuel(tokenA, ["Yes", "No"], 6500000000000, 0, 0, duelDuration)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            await tx.wait(1)

            let duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            const cryptoDuel = await flashDuelsView.getDuels(duelIds[0])

            expect(await flashDuelsView.isValidDuelId(duelIds[0])).to.be.equal(true)
            let bootstrapPeriod = 1800
            // Increase time to after the bootstrap period
            await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1])
            await ethers.provider.send("evm_mine", [])

            // Check that the duel exists and hasn't started yet
            duel = await flashDuelsView.getCryptoDuel(duelIds[0])
            expect(duel.duelStatus).to.equal(1) // BootStrapped status

            // Simulate meeting the threshold
            await usdcToken.connect(accounts[0]).mint(accounts[2].address, ethers.parseUnits("20", 6))
            await usdcToken.connect(accounts[0]).mint(accounts[3].address, ethers.parseUnits("20", 6))

            await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 6))
            await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 6))

            let amount = ethers.parseUnits("20", 6)
            let optionPrice = "1000000"
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)

            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)

            const initialBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)

            let wager = await flashDuelsView.getWagerAmountDeposited(duelIds[0], accounts[2].address)
            expect(wager[2][0]).to.equal(20000000)
            expect(wager[2][1]).to.equal(0)

            // Call cancelDuelIfThresholdNotMet by the bot
            await flashDuelsCore.connect(contracts.Bot.bot).cancelDuelIfThresholdNotMet(1, duelIds[0])

            // Validate the duel status is updated to Cancelled
            const cancelledDuel = await flashDuelsView.getCryptoDuel(duelIds[0])
            expect(cancelledDuel.duelStatus).to.equal(4) // Cancelled status

            // Check that the wager was refunded
            let finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            expect(finalBalanceAccounts_2).to.equal(20000000)

            tx = await flashDuelsView.getAllTimeEarnings(accounts[2].address)
            expect(tx).to.equal(0)

            // Ensure wager data is cleared
            wager = await flashDuelsView.getWagerAmountDeposited(duelIds[0], accounts[2].address)
            expect(wager[2][0]).to.equal(0)
            expect(wager[2][1]).to.equal(0)

            // Check that the wager was refunded
            let finalBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address)
            expect(finalBalanceAccounts_3).to.equal(20000000)

            tx = await flashDuelsView.getAllTimeEarnings(accounts[3].address)
            expect(tx).to.equal(0)

            // Ensure wager data is cleared
            wager = await flashDuelsView.getWagerAmountDeposited(duelIds[0], accounts[3].address)
            expect(wager[2][0]).to.equal(0)
            expect(wager[2][1]).to.equal(0)
        })
    })
})

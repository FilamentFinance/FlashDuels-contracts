import { expect } from "chai"
import { contracts } from "../typechain-types"
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { ethers, upgrades, network } from "hardhat"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
const helpers = require("@nomicfoundation/hardhat-network-helpers")
import { setupContracts } from "./testSetup"

const isCRDParticipationToken = true;

describe("FlashDuels Contract", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deploy() {
        const accounts = await ethers.getSigners()
        const contracts = await setupContracts()
        const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )
        await flashDuelsAdmin.setParticipationTokenType(1)
        await flashDuelsAdmin.setMinimumWagerThreshold(ethers.parseUnits("50", 18))
        await flashDuelsAdmin.setCreateDuelFee(ethers.parseUnits("5", 18))
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

            const expiryTime = 3
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)

                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                const usdcToken: any = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }

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
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            await flashDuelsAdmin.setParticipationTokenType(1)
            await flashDuelsAdmin.setMinimumWagerThreshold(ethers.parseUnits("50", 18))
            await flashDuelsAdmin.setCreateDuelFee(ethers.parseUnits("5", 18))
            return { contracts, accounts }
        }

        it("should allow users to join duels", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 3
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                const usdcToken: any = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            txr = await tx.wait(1)
            await flashDuelsAdmin
                .connect(accounts[0])
                .approveAndCreateDuel(accounts[1].address, 2, 0)

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("60", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("60", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }

            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[4].address], [amount])

                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[4]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)

                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            }

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

            const expiryTime = 3
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
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
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
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
                "FlashDuelsCoreFacet__InvalidBot"
            )
        })
    })

    describe("Duel Settlement", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            await flashDuelsAdmin.setParticipationTokenType(1)
            await flashDuelsAdmin.setMinimumWagerThreshold(ethers.parseUnits("50", 18))
            await flashDuelsAdmin.setCreateDuelFee(ethers.parseUnits("5", 18))
            return { contracts, accounts }
        }

        it("should settle duel and distribute rewards", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 3
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
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
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
            await tx.wait(1)

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("60", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("60", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }

            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)

            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [amount])

                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
            }

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
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            await flashDuelsAdmin.setParticipationTokenType(1)
            await flashDuelsAdmin.setMinimumWagerThreshold(ethers.parseUnits("50", 18))
            await flashDuelsAdmin.setCreateDuelFee(ethers.parseUnits("5", 18))
            return { contracts, accounts }
        }

        it("should settle duel and distribute rewards correctly to winner", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 3
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
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
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
            await tx.wait(1)

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("60", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("60", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[4].address], [amount])

                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[4]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            }

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
            let initialBalanceAccounts_2;
            let initialBalanceAccounts_3;
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                initialBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address) // 0
                initialBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address) // 0
            } else {
                initialBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address) // 0
                initialBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address) // 0
            }

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
            let finalBalanceAccounts_2;
            let finalBalanceAccounts_3;
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
                finalBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address)
            } else {
                finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
                finalBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address)
            }
            expect(finalBalanceAccounts_2).to.be.equal("0")
            expect(finalBalanceAccounts_3).to.be.equal("0")

            let allTImeEarningsAccounts_2 = await flashDuelsView.getAllTimeEarnings(accounts[2].address)
            let allTImeEarningsAccounts_3 = await flashDuelsView.getAllTimeEarnings(accounts[3].address)

            await flashDuelsCore.connect(accounts[2]).withdrawEarnings(allTImeEarningsAccounts_2)

            // Check if accounts[2] (winner) received the rewards
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            } else {
                finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            }
            expect(finalBalanceAccounts_2).to.be.gt(initialBalanceAccounts_2) // accounts[2]'s balance should increase
            // Check if accounts[3] (loser) lost their wager amount
            expect(finalBalanceAccounts_3).to.be.lte(initialBalanceAccounts_3) // accounts[3]'s balance should decrease or remain the same
        })

        it("should not change wallet balance if duel is not settled", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 3
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
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
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
            await tx.wait(1)
            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("60", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("60", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[4].address], [amount])

                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[4]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            }

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
            let initialBalanceAccounts_2;
            let initialBalanceAccounts_3;
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                initialBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address) // 0
                initialBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address) // 0
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                initialBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address) // 0
                initialBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address) // 0
            }
            await flashDuelsCore.connect(contracts.Bot.bot).startDuel(duelIds[0])

            let time = 3600 * 6
            await network.provider.request({
                method: "evm_increaseTime",
                params: [time]
            })
            await helpers.time.increase(time)

            // No settlement is triggered, balances should remain the same
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                expect(await usdcToken.balanceOf(accounts[2].address)).to.equal(initialBalanceAccounts_2)
                expect(await usdcToken.balanceOf(accounts[3].address)).to.equal(initialBalanceAccounts_3)
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                expect(await usdcToken.balanceOf(accounts[2].address)).to.equal(initialBalanceAccounts_2)
                expect(await usdcToken.balanceOf(accounts[3].address)).to.equal(initialBalanceAccounts_3)
            }
        })
    })

    describe("Duel Cancel and Refund Logic", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            await flashDuelsAdmin.setParticipationTokenType(1)
            await flashDuelsAdmin.setMinimumWagerThreshold(ethers.parseUnits("50", 18))
            await flashDuelsAdmin.setCreateDuelFee(ethers.parseUnits("5", 18))
            return { contracts, accounts }
        }

        it("should cancel the duel if the threshold is not met after the bootstrap period", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 3
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
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
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
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

        it("should not cancel duel if the threshold is met even before the bootstrap period", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 3
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
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
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
            tx = await flashDuelsCore
                .connect(accounts[1])
                .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
            await tx.wait(1)
            tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
            await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)

            // Simulate meeting the threshold
            if (isCRDParticipationToken) {
                const usdcToken: any = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [ethers.parseUnits("25", 18)])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [ethers.parseUnits("25", 18)])
                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 18))
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 18))
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, ethers.parseUnits("25", 6))
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, ethers.parseUnits("25", 6))
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 6))
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 6))
            }

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("25", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("25", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }
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
            ).to.be.revertedWithCustomError(flashDuelsCore, "FlashDuelsCoreFacet__ThresholdMet")
        })

        it("should revert if non-bot tries to cancel the duel", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 3
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
            }
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
            if (isCRDParticipationToken) {
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
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
            ).to.be.revertedWithCustomError(flashDuelsCore, "FlashDuelsCoreFacet__InvalidBot")
        })
    })

    describe("Refund Duel", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            await flashDuelsAdmin.setParticipationTokenType(1)
            await flashDuelsAdmin.setMinimumWagerThreshold(ethers.parseUnits("50", 18))
            await flashDuelsAdmin.setCreateDuelFee(ethers.parseUnits("5", 18))
            return { contracts, accounts }
        }
        it("should refund users who wagered on options", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }

            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)

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
            if (isCRDParticipationToken) {
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [ethers.parseUnits("20", 18)])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [ethers.parseUnits("20", 18)])
                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 18))
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 18))
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, ethers.parseUnits("20", 6))
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, ethers.parseUnits("20", 6))
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 6))
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 6))
            }

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("20", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("20", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }

            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)

            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)

            let initialBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)

            duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)

            let wager = await flashDuelsView.getWagerAmountDeposited(duelIds[0], accounts[2].address)
            expect(wager[2][0]).to.equal(amount)
            expect(wager[2][1]).to.equal(0)

            // Call cancelDuelIfThresholdNotMet by the bot
            await flashDuelsCore.connect(contracts.Bot.bot).cancelDuelIfThresholdNotMet(1, duelIds[0])

            // Validate the duel status is updated to Cancelled
            const cancelledDuel = await flashDuelsView.getCryptoDuel(duelIds[0])
            expect(cancelledDuel.duelStatus).to.equal(4) // Cancelled status

            // Check that the wager was refunded
            let finalBalanceAccounts_2;
            if (isCRDParticipationToken) {
                finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            } else {
                finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            }
            expect(finalBalanceAccounts_2).to.equal(amount)

            tx = await flashDuelsView.getAllTimeEarnings(accounts[2].address)
            expect(tx).to.equal(0)

            // Ensure wager data is cleared
            wager = await flashDuelsView.getWagerAmountDeposited(duelIds[0], accounts[2].address)
            expect(wager[2][0]).to.equal(0)
            expect(wager[2][1]).to.equal(0)

            // Check that the wager was refunded
            let finalBalanceAccounts_3;
            if (isCRDParticipationToken) {
                finalBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address)
                expect(finalBalanceAccounts_3).to.equal(ethers.parseUnits("20", 18))
            } else {
                finalBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address)
                expect(finalBalanceAccounts_3).to.equal(ethers.parseUnits("20", 6))
            }

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
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            await flashDuelsAdmin.setParticipationTokenType(1)
            await flashDuelsAdmin.setMinimumWagerThreshold(ethers.parseUnits("50", 18))
            await flashDuelsAdmin.setCreateDuelFee(ethers.parseUnits("5", 18))
            return { contracts, accounts }
        }
        it("should create a crypto duel successfully", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }

            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )
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
            txr = await tx.wait(1)

            // const pendingCryptoDuels = await flashDuelsView.getPendingCryptoDuels(accounts[1].address)
            // console.log("pendingCryptoDuels: ", pendingCryptoDuels)
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // txr = await tx.wait(1)

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
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }

            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("60", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("60", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }

            if (isCRDParticipationToken) {
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[4].address], [amount])
                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[4]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            }

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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)
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
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }

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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)

            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            // Attempt to start the duel with a non-bot account (should fail)
            await expect(
                flashDuelsCore.connect(accounts[1]).startCryptoDuel(duelIds[0], "6500000000000")
            ).to.be.revertedWithCustomError(flashDuelsCore, "FlashDuelsCoreFacet__InvalidBot")
        })

        it("should fail if less than minimum wager", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            expect(duelIds.length).to.equal(1)

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("5", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("5", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }
            if (isCRDParticipationToken) {
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [amount])
                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
            }

            await expect(
                flashDuelsCore
                    .connect(contracts.Bot.bot)
                    .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[2].address)
            ).to.be.revertedWithCustomError(flashDuelsCore, "FlashDuelsCoreFacet__LessThanMinimumWager")
        })
    })

    describe("Crypto Duel Settlement", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            await flashDuelsAdmin.setParticipationTokenType(1)
            await flashDuelsAdmin.setMinimumWagerThreshold(ethers.parseUnits("50", 18))
            await flashDuelsAdmin.setCreateDuelFee(ethers.parseUnits("5", 18))
            return { contracts, accounts }
        }

        it("should settle duel and distribute rewards", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("60", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("60", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }
            if (isCRDParticipationToken) {
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[4].address], [amount])
                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[4]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            }

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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)
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
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            await flashDuelsAdmin.setParticipationTokenType(1)
            await flashDuelsAdmin.setMinimumWagerThreshold(ethers.parseUnits("50", 18))
            await flashDuelsAdmin.setCreateDuelFee(ethers.parseUnits("5", 18))
            return { contracts, accounts }
        }

        it("should settle duel and distribute rewards correctly to winner", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("60", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("60", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }
            if (isCRDParticipationToken) {
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[4].address], [amount])
                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[4]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            }

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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            const cryptoDuel = await flashDuelsView.getDuels(duelIds[0])

            const getTotalProtocolFeesGeneratedAfter = await flashDuelsView.getTotalProtocolFeesGenerated()
            // console.log("getTotalProtocolFeesGeneratedAfter", getTotalProtocolFeesGeneratedAfter)
            if (isCRDParticipationToken) {
                expect(getTotalProtocolFeesGeneratedAfter).to.be.equal(ethers.parseUnits("5", 18)) // $5
            } else {
                expect(getTotalProtocolFeesGeneratedAfter).to.be.equal(ethers.parseUnits("5", 6)) // $5
            }

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
            if (isCRDParticipationToken) {
                expect(allTImeEarningsaccounts_2).to.be.equal(ethers.parseUnits("115.2", 18)) // $115.2 (2% * 120 + 2% * 120 = 4.8) (120 -4.8 = 115.2) (120 = 60 + 60)
            } else {
                expect(allTImeEarningsaccounts_2).to.be.equal(ethers.parseUnits("115.2", 6)) // $115.2 (2% * 120 + 2% * 120 = 4.8) (120 -4.8 = 115.2) (120 = 60 + 60)
            }
            const getTotalProtocolFeesGenerated = await flashDuelsView.getTotalProtocolFeesGenerated()
            // console.log("getTotalProtocolFeesGenerated", getTotalProtocolFeesGenerated)
            const getCreatorFeesEarned = await flashDuelsView.getCreatorFeesEarned(accounts[1].address)
            // console.log("getCreatorFeesEarned", getCreatorFeesEarned)
            if (isCRDParticipationToken) {
                expect(getTotalProtocolFeesGenerated).to.be.equal(ethers.parseUnits("7.4", 18)) // $7.4 (5 + 2.4) (2% * 120 = 2.4)
            } else {
                expect(getTotalProtocolFeesGenerated).to.be.equal(ethers.parseUnits("7.4", 6)) // $7.4 (5 + 2.4) (2% * 120 = 2.4)
            }
            // console.log("getCreatorFeesEarned", getCreatorFeesEarned)
            if (isCRDParticipationToken) {
                expect(getCreatorFeesEarned).to.be.equal(ethers.parseUnits("2.4", 18)) // $2.4 (2% * 120 = 2.4)
            } else {
                expect(getCreatorFeesEarned).to.be.equal(ethers.parseUnits("2.4", 6)) // $2.4 (2% * 120 = 2.4)
            }
            // expect(await usdcToken.balanceOf(cryptoDuel.creator)).to.be.equal("1200000") // $117.6

            await flashDuelsCore.connect(accounts[2]).withdrawEarnings(allTImeEarningsaccounts_2)

            // Check if accounts[2] (winner) received the rewards
            finalBalanceaccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            expect(finalBalanceaccounts_2).to.be.gt(initialBalanceaccounts_2) // accounts[2]'s balance should increase
            // Check if accounts[3] (loser) lost their wager amount
            expect(finalBalanceaccounts_3).to.be.lte(initialBalanceaccounts_3) // accounts[3]'s balance should decrease or remain the same
        })
        it("should settle duel and distribute rewards correctly to winner in case of one side bets (YES)", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("60", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("60", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }
            if (isCRDParticipationToken) {
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[4].address], [amount])
                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[4]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            }

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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            const cryptoDuel = await flashDuelsView.getDuels(duelIds[0])

            const getTotalProtocolFeesGeneratedAfter = await flashDuelsView.getTotalProtocolFeesGenerated()
            // console.log("getTotalProtocolFeesGeneratedAfter", getTotalProtocolFeesGeneratedAfter)
            if (isCRDParticipationToken) {
                expect(getTotalProtocolFeesGeneratedAfter).to.be.equal(ethers.parseUnits("5", 18)) // $5
            } else {
                expect(getTotalProtocolFeesGeneratedAfter).to.be.equal(ethers.parseUnits("5", 6)) // $5
            }

            expect(duelIds.length).to.equal(1)
            // Join Duel with tokenA
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)
            // await flashDuelsCore
            //     .connect(contracts.Bot.bot)
            //     .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)

            // Simulate time passage for the bootstrap period to end
            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            // Check balances before settlement
            const initialBalanceaccounts_2 = await usdcToken.balanceOf(accounts[2].address) // 0
            // const initialBalanceaccounts_3 = await usdcToken.balanceOf(accounts[3].address) // 0
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
            // let finalBalanceaccounts_3 = await usdcToken.balanceOf(accounts[3].address)
            expect(finalBalanceaccounts_2).to.be.equal("0")
            // expect(finalBalanceaccounts_3).to.be.equal("0")

            let allTImeEarningsaccounts_2 = await flashDuelsView.getAllTimeEarnings(accounts[2].address)
            // let allTImeEarningsaccounts_3 = await flashDuelsView.getAllTimeEarnings(accounts[3].address)
            // expect(allTImeEarningsaccounts_3).to.be.equal("0")
            // console.log("allTImeEarningsaccounts_2", allTImeEarningsaccounts_2)
            if (isCRDParticipationToken) {
                expect(allTImeEarningsaccounts_2).to.be.equal(ethers.parseUnits("57.6", 18)) // $57.6 (2% * 60 + 2% * 60 = 2.4) (60 -2.4 = 57.6) (60 = 60 + 60)
            } else {
                expect(allTImeEarningsaccounts_2).to.be.equal(ethers.parseUnits("57.6", 6)) // $57.6 (2% * 60 + 2% * 60 = 2.4) (60 -2.4 = 57.6) (60 = 60 + 60)
            }
            const getTotalProtocolFeesGenerated = await flashDuelsView.getTotalProtocolFeesGenerated()
            // console.log("getTotalProtocolFeesGenerated", getTotalProtocolFeesGenerated)
            const getCreatorFeesEarned = await flashDuelsView.getCreatorFeesEarned(accounts[1].address)
            // console.log("getCreatorFeesEarned", getCreatorFeesEarned)
            if (isCRDParticipationToken) {
                expect(getTotalProtocolFeesGenerated).to.be.equal(ethers.parseUnits("6.2", 18)) // $6.2 (5 + 1.2) (2% * 60 = 1.2)
            } else {
                expect(getTotalProtocolFeesGenerated).to.be.equal(ethers.parseUnits("6.2", 6)) // $6.2 (5 + 1.2) (2% * 60 = 1.2)
            }
            // console.log("getCreatorFeesEarned", getCreatorFeesEarned)
            if (isCRDParticipationToken) {
                expect(getCreatorFeesEarned).to.be.equal(ethers.parseUnits("1.2", 18)) // $1.2 (2% * 60 = 1.2)
            } else {
                expect(getCreatorFeesEarned).to.be.equal(ethers.parseUnits("1.2", 6)) // $1.2 (2% * 60 = 1.2)
            }
            // expect(await usdcToken.balanceOf(cryptoDuel.creator)).to.be.equal("1200000") // $117.6

            await flashDuelsCore.connect(accounts[2]).withdrawEarnings(allTImeEarningsaccounts_2)

            // Check if accounts[2] (winner) received the rewards
            finalBalanceaccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            expect(finalBalanceaccounts_2).to.be.gt(initialBalanceaccounts_2) // accounts[2]'s balance should increase
            // Check if accounts[3] (loser) lost their wager amount
            // expect(finalBalanceaccounts_3).to.be.lte(initialBalanceaccounts_3) // accounts[3]'s balance should decrease or remain the same
        })
        it("should settle duel and distribute rewards correctly to winner in case of one side bets (YES), but no winner", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("60", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("60", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }
            if (isCRDParticipationToken) {
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[4].address], [amount])
                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[4]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
            }

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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            const cryptoDuel = await flashDuelsView.getDuels(duelIds[0])

            const getTotalProtocolFeesGeneratedAfter = await flashDuelsView.getTotalProtocolFeesGenerated()
            // console.log("getTotalProtocolFeesGeneratedAfter", getTotalProtocolFeesGeneratedAfter)
            if (isCRDParticipationToken) {
                expect(getTotalProtocolFeesGeneratedAfter).to.be.equal(ethers.parseUnits("5", 18)) // $5
            } else {
                expect(getTotalProtocolFeesGeneratedAfter).to.be.equal(ethers.parseUnits("5", 6)) // $5
            }

            expect(duelIds.length).to.equal(1)
            // Join Duel with tokenA
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)
            // await flashDuelsCore
            //     .connect(contracts.Bot.bot)
            //     .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)

            // Simulate time passage for the bootstrap period to end
            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            // Check balances before settlement
            const initialBalanceaccounts_2 = await usdcToken.balanceOf(accounts[2].address) // 0
            // const initialBalanceaccounts_3 = await usdcToken.balanceOf(accounts[3].address) // 0
            await network.provider.send("evm_mine")

            const startTokenPrice = "6500000000000"
            await flashDuelsCore.connect(contracts.Bot.bot).startCryptoDuel(duelIds[0], startTokenPrice)

            let time = 3600 * 6
            await network.provider.request({
                method: "evm_increaseTime",
                params: [time]
            })
            // await helpers.time.increase(time)
            const endTokenPrice = "6400000000000"
            // Settle the duel
            await flashDuelsCore.connect(contracts.Bot.bot).settleCryptoDuel(duelIds[0], endTokenPrice)

            // Check balances after settlement
            let finalBalanceaccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            // let finalBalanceaccounts_3 = await usdcToken.balanceOf(accounts[3].address)
            expect(finalBalanceaccounts_2).to.be.equal("0")
            // expect(finalBalanceaccounts_3).to.be.equal("0")

            let allTImeEarningsaccounts_2 = await flashDuelsView.getAllTimeEarnings(accounts[2].address)
            // let allTImeEarningsaccounts_3 = await flashDuelsView.getAllTimeEarnings(accounts[3].address)
            // expect(allTImeEarningsaccounts_3).to.be.equal("0")
            // console.log("allTImeEarningsaccounts_2", allTImeEarningsaccounts_2)
            if (isCRDParticipationToken) {
                expect(allTImeEarningsaccounts_2).to.be.equal(ethers.parseUnits("0", 18)) 
            } else {
                expect(allTImeEarningsaccounts_2).to.be.equal(ethers.parseUnits("0", 6))
            }
            const getTotalProtocolFeesGenerated = await flashDuelsView.getTotalProtocolFeesGenerated()
            // console.log("getTotalProtocolFeesGenerated", getTotalProtocolFeesGenerated)
            const getCreatorFeesEarned = await flashDuelsView.getCreatorFeesEarned(accounts[1].address)
            // console.log("getCreatorFeesEarned", getCreatorFeesEarned)
            if (isCRDParticipationToken) {
                expect(getTotalProtocolFeesGenerated).to.be.equal(ethers.parseUnits("6.2", 18)) // expected 6.2
            } else {
                expect(getTotalProtocolFeesGenerated).to.be.equal(ethers.parseUnits("6.2", 6)) // expected 6.2
            }
            // console.log("getCreatorFeesEarned", getCreatorFeesEarned)
            if (isCRDParticipationToken) {
                expect(getCreatorFeesEarned).to.be.equal(ethers.parseUnits("1.2", 18)) // $1.2 (2% * 60 = 1.2)
            } else {
                expect(getCreatorFeesEarned).to.be.equal(ethers.parseUnits("1.2", 6)) // $1.2 (2% * 60 = 1.2)
            }
            // expect(await usdcToken.balanceOf(cryptoDuel.creator)).to.be.equal("1200000") // $117.6

            await flashDuelsCore.connect(accounts[2]).withdrawEarnings(allTImeEarningsaccounts_2)

            // Check if accounts[2] (winner) received the rewards
            finalBalanceaccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            expect(finalBalanceaccounts_2).to.be.equal(initialBalanceaccounts_2) // accounts[2]'s balance should increase
            // Check if accounts[3] (loser) lost their wager amount
            const totalProtocolWinnings = await usdcToken.balanceOf(contracts.Diamond.diamond)
            expect(totalProtocolWinnings).to.be.equal(ethers.parseUnits("65", 18)) // $5 it should be 62.6 + 2.4 (fees + creator fee)
            // expect(finalBalanceaccounts_3).to.be.lte(initialBalanceaccounts_3) // accounts[3]'s balance should decrease or remain the same
        })
        // Test that the winners are processed in chunks
        // Tested with chunk size 2 (with commenting out the chunk size check in the contract)
        xit("should settle the duel and distribute rewards correctly to winner in chunks", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                let tx = await usdcToken.connect(accounts[1]).claim()
                await tx.wait(1)
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("60", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("60", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }
            if (isCRDParticipationToken) {
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[4].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[5].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[6].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[7].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[8].address], [amount])
                await usdcToken.connect(accounts[0]).airdrop([accounts[9].address], [amount])
                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[4]).claim()
                await usdcToken.connect(accounts[5]).claim()
                await usdcToken.connect(accounts[6]).claim()
                await usdcToken.connect(accounts[7]).claim()
                await usdcToken.connect(accounts[8]).claim()
                await usdcToken.connect(accounts[9]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[5]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[6]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[7]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[8]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[9]).approve(contracts.Diamond.diamond, amount)
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[4].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[5].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[6].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[7].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[8].address, amount)
                await usdcToken.connect(accounts[0]).mint(accounts[9].address, amount)
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[5]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[6]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[7]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[8]).approve(contracts.Diamond.diamond, amount)
                await usdcToken.connect(accounts[9]).approve(contracts.Diamond.diamond, amount)
            }
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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            const cryptoDuel = await flashDuelsView.getDuels(duelIds[0])

            const getTotalProtocolFeesGeneratedAfter = await flashDuelsView.getTotalProtocolFeesGenerated()
            // console.log("getTotalProtocolFeesGeneratedAfter", getTotalProtocolFeesGeneratedAfter)
            if (isCRDParticipationToken) {
                expect(getTotalProtocolFeesGeneratedAfter).to.be.equal(ethers.parseUnits("5", 18)) // $1.2
            } else {
                expect(getTotalProtocolFeesGeneratedAfter).to.be.equal(ethers.parseUnits("5", 6)) // $1.2
            }

            expect(duelIds.length).to.equal(1)
            // Join Duel with tokenA
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[4].address)
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[5].address)
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[6].address)
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[7].address)
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[8].address)
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[9].address)

            // Simulate time passage for the bootstrap period to end
            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            // Check balances before settlement
            const initialBalanceaccounts_2 = await usdcToken.balanceOf(accounts[2].address) // 0
            const initialBalanceaccounts_3 = await usdcToken.balanceOf(accounts[3].address) // 0
            const initialBalanceaccounts_4 = await usdcToken.balanceOf(accounts[4].address) // 0
            const initialBalanceaccounts_5 = await usdcToken.balanceOf(accounts[5].address) // 0
            await network.provider.send("evm_mine")

            const startTokenPrice = "6500000000000"
            await flashDuelsCore.connect(contracts.Bot.bot).startCryptoDuel(duelIds[0], startTokenPrice)

            tx = await flashDuelsAdmin.setWinnersChunkSizes(2)
            await tx.wait(1)

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
            let finalBalanceaccounts_4 = await usdcToken.balanceOf(accounts[4].address)
            let finalBalanceaccounts_5 = await usdcToken.balanceOf(accounts[5].address)
            let finalBalanceaccounts_6 = await usdcToken.balanceOf(accounts[6].address)
            let finalBalanceaccounts_7 = await usdcToken.balanceOf(accounts[7].address)
            let finalBalanceaccounts_8 = await usdcToken.balanceOf(accounts[8].address)
            let finalBalanceaccounts_9 = await usdcToken.balanceOf(accounts[9].address)
            expect(finalBalanceaccounts_2).to.be.equal("0")
            expect(finalBalanceaccounts_3).to.be.equal("0")
            expect(finalBalanceaccounts_4).to.be.equal("0")
            expect(finalBalanceaccounts_5).to.be.equal("0")
            let allTImeEarningsaccounts_2 = await flashDuelsView.getAllTimeEarnings(accounts[2].address)
            let allTImeEarningsaccounts_3 = await flashDuelsView.getAllTimeEarnings(accounts[3].address)
            let allTImeEarningsaccounts_4 = await flashDuelsView.getAllTimeEarnings(accounts[4].address)
            let allTImeEarningsaccounts_5 = await flashDuelsView.getAllTimeEarnings(accounts[5].address)
            let allTImeEarningsaccounts_6 = await flashDuelsView.getAllTimeEarnings(accounts[6].address)
            let allTImeEarningsaccounts_7 = await flashDuelsView.getAllTimeEarnings(accounts[7].address)
            let allTImeEarningsaccounts_8 = await flashDuelsView.getAllTimeEarnings(accounts[8].address)
            let allTImeEarningsaccounts_9 = await flashDuelsView.getAllTimeEarnings(accounts[9].address)
            if (isCRDParticipationToken) {
                expect(allTImeEarningsaccounts_3).to.be.equal(ethers.parseUnits("0", 18))
                expect(allTImeEarningsaccounts_5).to.be.equal(ethers.parseUnits("0", 18))
                expect(allTImeEarningsaccounts_7).to.be.equal(ethers.parseUnits("0", 18))
                expect(allTImeEarningsaccounts_9).to.be.equal(ethers.parseUnits("0", 18))
            } else {
                expect(allTImeEarningsaccounts_3).to.be.equal(ethers.parseUnits("0", 6))
                expect(allTImeEarningsaccounts_5).to.be.equal(ethers.parseUnits("0", 6))
                expect(allTImeEarningsaccounts_7).to.be.equal(ethers.parseUnits("0", 6))
                expect(allTImeEarningsaccounts_9).to.be.equal(ethers.parseUnits("0", 6))
            }
            // console.log("allTImeEarningsaccounts_2", allTImeEarningsaccounts_2)
            // console.log("allTImeEarningsaccounts_4", allTImeEarningsaccounts_4)
            if (isCRDParticipationToken) {
                expect(allTImeEarningsaccounts_2).to.be.equal(ethers.parseUnits("117.6", 18)) // $117.6 (60 + (120 - 2.4 - 2.4)/2) // 2.4 is the protocol fee, 2.4 is the creator fee
                expect(allTImeEarningsaccounts_4).to.be.equal(ethers.parseUnits("117.6", 18)) // before continueWiningDistributionInChunks
                expect(allTImeEarningsaccounts_6).to.be.equal(ethers.parseUnits("0", 18))
                expect(allTImeEarningsaccounts_8).to.be.equal(ethers.parseUnits("0", 18))
            } else {
                expect(allTImeEarningsaccounts_2).to.be.equal(ethers.parseUnits("117.6", 6)) // $117.6 (60 + (120 - 2.4 - 2.4)/2) // 2.4 is the protocol fee, 2.4 is the creator fee
                expect(allTImeEarningsaccounts_4).to.be.equal(ethers.parseUnits("117.6", 6)) // before continueWiningDistributionInChunks
                expect(allTImeEarningsaccounts_6).to.be.equal(ethers.parseUnits("0", 6))
                expect(allTImeEarningsaccounts_8).to.be.equal(ethers.parseUnits("0", 6))
            }
            await flashDuelsCore.connect(contracts.Bot.bot).continueWinningsDistribution(duelIds[0], 0, "Yes")
            allTImeEarningsaccounts_6 = await flashDuelsView.getAllTimeEarnings(accounts[6].address)
            if (isCRDParticipationToken) {
                expect(allTImeEarningsaccounts_6).to.be.equal(ethers.parseUnits("117.6", 18)) // $117.6 (60 + (120 - 2.4 - 2.4)/2) // 2.4 is the protocol fee, 2.4 is the creator fee
            } else {
                expect(allTImeEarningsaccounts_6).to.be.equal(ethers.parseUnits("117.6", 6)) // $117.6 (60 + (120 - 2.4 - 2.4)/2) // 2.4 is the protocol fee, 2.4 is the creator fee
            }
            allTImeEarningsaccounts_8 = await flashDuelsView.getAllTimeEarnings(accounts[8].address)
            if (isCRDParticipationToken) {
                expect(allTImeEarningsaccounts_8).to.be.equal(ethers.parseUnits("117.6", 18)) // $117.6 (60 + (120 - 2.4 - 2.4)/2) // 2.4 is the protocol fee, 2.4 is the creator fee
            } else {
                expect(allTImeEarningsaccounts_8).to.be.equal(ethers.parseUnits("117.6", 6)) // $117.6 (60 + (120 - 2.4 - 2.4)/2) // 2.4 is the protocol fee, 2.4 is the creator fee
            }
            const getTotalProtocolFeesGenerated = await flashDuelsView.getTotalProtocolFeesGenerated()
            // console.log("getTotalProtocolFeesGenerated", getTotalProtocolFeesGenerated)
            const getCreatorFeesEarned = await flashDuelsView.getCreatorFeesEarned(accounts[1].address)
            console.log("getCreatorFeesEarned", getCreatorFeesEarned)
            if (isCRDParticipationToken) {
                expect(getTotalProtocolFeesGenerated).to.be.equal(ethers.parseUnits("9.8", 18)) // $5 + $4.8 (2% of 240)
                expect(getCreatorFeesEarned).to.be.equal(ethers.parseUnits("4.8", 18)) // $4.8 (2% of 240)
            } else {
                expect(getTotalProtocolFeesGenerated).to.be.equal(ethers.parseUnits("9.8", 6)) // $5 + $4.8 (2% of 240)
                expect(getCreatorFeesEarned).to.be.equal(ethers.parseUnits("4.8", 6)) // $4.8 (2% of 240)
            }

            await flashDuelsCore.connect(accounts[2]).withdrawEarnings(allTImeEarningsaccounts_2)
            await flashDuelsCore.connect(accounts[4]).withdrawEarnings(allTImeEarningsaccounts_4)
            // Check if accounts[2] (winner) received the rewards
            finalBalanceaccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            finalBalanceaccounts_4 = await usdcToken.balanceOf(accounts[4].address)
            expect(finalBalanceaccounts_2).to.be.gt(initialBalanceaccounts_2) // accounts[2]'s balance should increase
            // Check if accounts[3] (loser) lost their wager amount
            expect(finalBalanceaccounts_3).to.be.lte(initialBalanceaccounts_3) // accounts[3]'s balance should decrease or remain the same
            expect(finalBalanceaccounts_4).to.be.gt(initialBalanceaccounts_4) // accounts[4]'s balance should decrease or remain the same
            expect(finalBalanceaccounts_5).to.be.lte(initialBalanceaccounts_5) // accounts[5]'s balance should decrease or remain the same
        })

    })

    describe("Crypto Duel Cancel and Refund Logic", function () {
        async function deploy() {
            const accounts = await ethers.getSigners()
            const contracts = await setupContracts()
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            await flashDuelsAdmin.setParticipationTokenType(1)
            await flashDuelsAdmin.setMinimumWagerThreshold(ethers.parseUnits("50", 18))
            await flashDuelsAdmin.setCreateDuelFee(ethers.parseUnits("5", 18))
            return { contracts, accounts }
        }
        it("should cancel the duel if the threshold is not met after the bootstrap period", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                await usdcToken.connect(accounts[1]).claim()
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
          
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)

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
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                await usdcToken.connect(accounts[1]).claim()
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
                await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
            }
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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)

            // Simulate meeting the threshold
            if (isCRDParticipationToken) {
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [ethers.parseUnits("25", 18)])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [ethers.parseUnits("25", 18)])
                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 18))
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 18))
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, ethers.parseUnits("25", 6))
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, ethers.parseUnits("25", 6))
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 6))
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 6))
            }

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("25", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("25", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }
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
            ).to.be.revertedWithCustomError(flashDuelsCore, "FlashDuelsCoreFacet__ThresholdMet")
        })

        it("should revert if non-bot tries to cancel the duel", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                await usdcToken.connect(accounts[1]).claim()
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
            }
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )

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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)
            const duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)

            // Simulate meeting the threshold
            if (isCRDParticipationToken) {
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [ethers.parseUnits("25", 18)])
                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("25", 18))
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, ethers.parseUnits("25", 6))
            }

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("25", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("25", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)

            let bootstrapPeriod = 1800
            // Increase time to after the bootstrap period
            await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1])
            await ethers.provider.send("evm_mine", [])

            await expect(
                flashDuelsCore.connect(accounts[1]).cancelDuelIfThresholdNotMet(1, duelIds[0])
            ).to.be.revertedWithCustomError(flashDuelsCore, "FlashDuelsCoreFacet__InvalidBot")
        })

        it("should refund users who wagered on options", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                await usdcToken.connect(accounts[1]).claim()
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
            }
            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )

            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )


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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)

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
            if (isCRDParticipationToken) {
                await usdcToken.connect(accounts[0]).airdrop([accounts[2].address], [ethers.parseUnits("20", 18)])
                await usdcToken.connect(accounts[0]).airdrop([accounts[3].address], [ethers.parseUnits("20", 18)])
                await usdcToken.connect(accounts[2]).claim()
                await usdcToken.connect(accounts[3]).claim()
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 18))
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 18))
            } else {
                await usdcToken.connect(accounts[0]).mint(accounts[2].address, ethers.parseUnits("20", 6))
                await usdcToken.connect(accounts[0]).mint(accounts[3].address, ethers.parseUnits("20", 6))
                await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 6))
                await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 6))
            }

            let amount;
            let optionPrice;
            if (isCRDParticipationToken) {
                amount = ethers.parseUnits("20", 18)
                optionPrice = ethers.parseUnits("10", 6)
            } else {
                amount = ethers.parseUnits("20", 6)
                optionPrice = ethers.parseUnits("10", 6)
            }
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)

            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)

            const initialBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)

            let wager = await flashDuelsView.getWagerAmountDeposited(duelIds[0], accounts[2].address)
            expect(wager[2][0]).to.equal(amount)
            expect(wager[2][1]).to.equal(0)
            let finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            expect(finalBalanceAccounts_2).to.equal(0)

            wager = await flashDuelsView.getWagerAmountDeposited(duelIds[0], accounts[3].address)
            expect(wager[2][0]).to.equal(0)
            expect(wager[2][1]).to.equal(amount)
            let finalBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address)
            expect(finalBalanceAccounts_3).to.equal(0)

            // Call cancelDuelIfThresholdNotMet by the bot
            await flashDuelsCore.connect(contracts.Bot.bot).cancelDuelIfThresholdNotMet(1, duelIds[0])

            // Validate the duel status is updated to Cancelled
            const cancelledDuel = await flashDuelsView.getCryptoDuel(duelIds[0])
            expect(cancelledDuel.duelStatus).to.equal(4) // Cancelled status

            // Check that the wager was refunded
            finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            expect(finalBalanceAccounts_2).to.equal(amount)

            tx = await flashDuelsView.getAllTimeEarnings(accounts[2].address)
            expect(tx).to.equal(0)

            // Ensure wager data is cleared
            wager = await flashDuelsView.getWagerAmountDeposited(duelIds[0], accounts[2].address)
            expect(wager[2][0]).to.equal(0)
            expect(wager[2][1]).to.equal(0)

            // Check that the wager was refunded
            finalBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address)
            expect(finalBalanceAccounts_3).to.equal(amount)

            tx = await flashDuelsView.getAllTimeEarnings(accounts[3].address)
            expect(tx).to.equal(0)

            // Ensure wager data is cleared
            wager = await flashDuelsView.getWagerAmountDeposited(duelIds[0], accounts[3].address)
            expect(wager[2][0]).to.equal(0)
            expect(wager[2][1]).to.equal(0)
        })

        // Test that the refund is processed in chunks
        // Tested with chunk size 2 (with commenting out the chunk size check in the contract)
        xit("should process refund in chunks", async function () {
            let duel: any, usdcToken: any, tx: any, txr: any
            let { contracts, accounts } = await loadFixture(deploy)
            const duelDuration = 0 // 3 hours   

            const expiryTime = 1
            // const minWager = ethers.parseUnits("10", 6) // 10 USDC
            if (isCRDParticipationToken) {
                usdcToken = await ethers.getContractAt("Credits", contracts?.Credits.creditsAddress as string)
                await usdcToken.connect(accounts[0]).airdrop([accounts[1].address], [ethers.parseUnits("10", 18)])
                await usdcToken.connect(accounts[1]).claim()
                await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 18))
            } else {
                usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress as string)
            }

            const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
                contracts.Diamond.diamond
            )
            const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
                contracts.Diamond.diamond
            )


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
            // tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 1, 0)
            // await tx.wait(1)

            let duelIds = await flashDuelsView.getCreatorToDuelIds(accounts[1].address)
            const cryptoDuel = await flashDuelsView.getDuels(duelIds[0])

            expect(await flashDuelsView.isValidDuelId(duelIds[0])).to.be.equal(true)

            let bootstrapPeriod = 1800
            // Increase time to after the bootstrap period
            await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1])
            await ethers.provider.send("evm_mine", [])

            // Simulate meeting the threshold
            await usdcToken.connect(accounts[0]).mint(accounts[2].address, ethers.parseUnits("2", 6))
            await usdcToken.connect(accounts[0]).mint(accounts[3].address, ethers.parseUnits("2", 6))
            await usdcToken.connect(accounts[0]).mint(accounts[4].address, ethers.parseUnits("2", 6))
            await usdcToken.connect(accounts[0]).mint(accounts[5].address, ethers.parseUnits("2", 6))

            await usdcToken.connect(accounts[2]).approve(contracts.Diamond.diamond, ethers.parseUnits("2", 6))
            await usdcToken.connect(accounts[3]).approve(contracts.Diamond.diamond, ethers.parseUnits("2", 6))
            await usdcToken.connect(accounts[4]).approve(contracts.Diamond.diamond, ethers.parseUnits("2", 6))
            await usdcToken.connect(accounts[5]).approve(contracts.Diamond.diamond, ethers.parseUnits("20", 6))

            let amount = ethers.parseUnits("2", 6)
            let optionPrice = "1000000"
            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[2].address)

            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[3].address)

            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "Yes", 0, optionPrice, amount, accounts[4].address)

            await flashDuelsCore
                .connect(contracts.Bot.bot)
                .joinCryptoDuel(duelIds[0], "No", 1, optionPrice, amount, accounts[5].address)

            tx = await flashDuelsAdmin.setRefundChunkSizes(2)
            await tx.wait(1)
            // Call cancelDuelIfThresholdNotMet by the bot
            await flashDuelsCore.connect(contracts.Bot.bot).cancelDuelIfThresholdNotMet(1, duelIds[0])

            // Validate the duel status is updated to Cancelled
            const cancelledDuel = await flashDuelsView.getCryptoDuel(duelIds[0])
            expect(cancelledDuel.duelStatus).to.equal(4) // Cancelled status

            // Check that the wager was refunded
            let finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            expect(finalBalanceAccounts_2).to.equal(2000000)

            let finalBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address)
            expect(finalBalanceAccounts_3).to.equal(0)

            let finalBalanceAccounts_4 = await usdcToken.balanceOf(accounts[4].address)
            expect(finalBalanceAccounts_4).to.equal(2000000)

            let finalBalanceAccounts_5 = await usdcToken.balanceOf(accounts[5].address)
            expect(finalBalanceAccounts_5).to.equal(0)

            // Call refundDuelByBot by the bot
            await flashDuelsCore.connect(contracts.Bot.bot).continueRefundsInChunks(duelIds[0])
            await tx.wait(1)
            // Validate the wager was refunded
            finalBalanceAccounts_2 = await usdcToken.balanceOf(accounts[2].address)
            expect(finalBalanceAccounts_2).to.equal(2000000)

            finalBalanceAccounts_3 = await usdcToken.balanceOf(accounts[3].address)
            expect(finalBalanceAccounts_3).to.equal(2000000)

            // Check that the wager was refunded
            finalBalanceAccounts_4 = await usdcToken.balanceOf(accounts[4].address)
            expect(finalBalanceAccounts_4).to.equal(2000000)

            finalBalanceAccounts_5 = await usdcToken.balanceOf(accounts[5].address)
            expect(finalBalanceAccounts_5).to.equal(2000000)
        })
    })
})

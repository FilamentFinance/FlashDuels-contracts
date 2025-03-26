import { expect } from "chai"
import { contracts, FlashDuels, FLASHUSDC } from "../typechain-types"
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { ethers, upgrades, network } from "hardhat"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
const helpers = require("@nomicfoundation/hardhat-network-helpers")
import FLASHUSDCABI from "../constants/abis/FLASHUSDC.json"
import { setupContracts } from "./testSetup"

describe("FlashDuels Marketplace Contract", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deploy() {
        const accounts = await ethers.getSigners()
        const contracts = await setupContracts()
        return { contracts, accounts }
    }

    it("Should allow the seller to create a sale", async function () {
        let duel: any,
            tx: any,
            txr: any,
            sellerOptionToken: any,
            usdc: any,
            flashDuels: any,
            owner: any,
            seller: any,
            buyer: any,
            protocolTreasury: any,
            usdAddress: any

        let usdcToken: any, tokenA: any, tokenB: any, bot: any, addr1: any, addr2: any, addr3: any
        const { contracts, accounts } = await loadFixture(deploy)
        addr1 = accounts[1]
        addr2 = accounts[2]
        addr3 = accounts[3]
        seller = accounts[4]
        owner = accounts[0]
        const expiryTime = 3
        // const minWager = ethers.parseUnits("10", 6) // 10 USDC
        // usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
        usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress?.toString())
        await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
        await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
        const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsMarketplace: any =
            await contracts.FlashDuelsMarketplaceFacet.flashDuelsMarketplaceFacetContract.attach(
                contracts.Diamond.diamond
            )
        const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )

        // let receipt = await flashDuelsCore
        //     .connect(accounts[1])
        //     .createDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        tx = await flashDuelsCore
            .connect(accounts[1])
            .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        await tx.wait(1)
        tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
        await tx.wait(1)
        const amount = ethers.parseUnits("60", 6)
        const optionPrice = ethers.parseUnits("10", 6)

        await usdcToken.connect(owner).mint(addr2.address, amount)
        await usdcToken.connect(owner).mint(addr3.address, amount)
        await usdcToken.connect(owner).mint(seller.address, amount)

        // Approve token transfer
        await usdcToken.connect(addr2).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(addr3).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(seller).approve(contracts.Diamond.diamond, amount)

        let duelIds = await flashDuelsView.getCreatorToDuelIds(addr1.address)
        expect(duelIds.length).to.equal(1)
        await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "Yes", 0, optionPrice, amount, addr2)
        await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, addr3)
        tx = await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, seller)
        txr = await tx.wait(1)
        duel = await flashDuelsView.getDuel(duelIds[0])
        expect(duel.duelStatus).to.equal(1) // 1 represents the "BootStrapped" status

        await ethers.provider.send("evm_increaseTime", [30 * 60])
        await ethers.provider.send("evm_mine", [])

        // Start the duel with the bot account
        await expect(flashDuelsCore.connect(contracts.Bot.bot).startDuel(duelIds[0])).to.emit(
            flashDuelsCore,
            "DuelStarted"
        )

        // // Verify that the duel status has changed to "Live"
        duel = await flashDuelsView.getDuel(duelIds[0])
        expect(duel.duelStatus).to.equal(2) // 2 represents the "Live" status

        for (let i = 0; i < txr?.logs.length; i++) {
            if (txr?.logs[i]["args"]) {
                sellerOptionToken = txr?.logs[i]["args"][4]
            }
        }
        // console.log("sellerOptionToken", sellerOptionToken);
        let optionToken: FLASHUSDC = new ethers.Contract(sellerOptionToken, FLASHUSDCABI, owner)
        await optionToken.connect(seller).approve(contracts.Diamond.diamond, ethers.parseUnits("5", 18))
        tx = await flashDuelsMarketplace
            .connect(seller)
            .sell(sellerOptionToken, duelIds[0], 1, ethers.parseUnits("5", 18), "7000000")
        txr = await tx.wait(1)

        await expect(
            flashDuelsMarketplace
                .connect(seller)
                .sell(sellerOptionToken, duelIds[0], 1, ethers.parseUnits("0", 18), "7000000")
        ).to.be.revertedWith("Amount must be greater than zero")
    })
})

describe("Cancel Sale", function () {
    async function deploy() {
        const accounts = await ethers.getSigners()
        const contracts = await setupContracts()
        return { contracts, accounts }
    }
    it("Should allow the seller to cancel their sale", async function () {
        let duel: any,
            tx: any,
            txr: any,
            sellerOptionToken: any,
            usdc: any,
            flashDuels: any,
            owner: any,
            seller: any,
            buyer: any,
            protocolTreasury: any,
            usdAddress: any

        let usdcToken: any, tokenA: any, tokenB: any, bot: any, addr1: any, addr2: any, addr3: any
        const { contracts, accounts } = await loadFixture(deploy)
        addr1 = accounts[1]
        addr2 = accounts[2]
        addr3 = accounts[3]
        seller = accounts[4]
        owner = accounts[0]
        const expiryTime = 3
        // const minWager = ethers.parseUnits("10", 6) // 10 USDC
        // usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
        usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress?.toString())
        await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
        await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
        const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsMarketplace: any =
            await contracts.FlashDuelsMarketplaceFacet.flashDuelsMarketplaceFacetContract.attach(
                contracts.Diamond.diamond
            )
        const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )

        // let receipt = await flashDuelsCore
        //     .connect(accounts[1])
        //     .createDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        tx = await flashDuelsCore
            .connect(accounts[1])
            .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        await tx.wait(1)
        tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
        await tx.wait(1)
        const amount = ethers.parseUnits("60", 6)
        const optionPrice = ethers.parseUnits("10", 6)

        await usdcToken.connect(owner).mint(addr2.address, amount)
        await usdcToken.connect(owner).mint(addr3.address, amount)
        await usdcToken.connect(owner).mint(seller.address, amount)

        // Approve token transfer
        await usdcToken.connect(addr2).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(addr3).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(seller).approve(contracts.Diamond.diamond, amount)

        let duelIds = await flashDuelsView.getCreatorToDuelIds(addr1.address)
        expect(duelIds.length).to.equal(1)
        await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "Yes", 0, optionPrice, amount, addr2)
        await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, addr3)
        tx = await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, seller)
        txr = await tx.wait(1)
        duel = await flashDuelsView.getDuel(duelIds[0])
        expect(duel.duelStatus).to.equal(1) // 1 represents the "BootStrapped" status

        await ethers.provider.send("evm_increaseTime", [30 * 60])
        await ethers.provider.send("evm_mine", [])

        // Start the duel with the bot account
        await expect(flashDuelsCore.connect(contracts.Bot.bot).startDuel(duelIds[0])).to.emit(
            flashDuelsCore,
            "DuelStarted"
        )

        // // Verify that the duel status has changed to "Live"
        duel = await flashDuelsView.getDuel(duelIds[0])
        expect(duel.duelStatus).to.equal(2) // 2 represents the "Live" status

        for (let i = 0; i < txr?.logs.length; i++) {
            if (txr?.logs[i]["args"]) {
                sellerOptionToken = txr?.logs[i]["args"][4]
            }
        }

        // console.log("sellerOptionToken", sellerOptionToken);

        let optionToken: FLASHUSDC = new ethers.Contract(sellerOptionToken, FLASHUSDCABI, owner)
        await optionToken.connect(seller).approve(contracts.Diamond.diamond, ethers.parseUnits("5", 18))
        tx = await flashDuelsMarketplace
            .connect(seller)
            .sell(sellerOptionToken, duelIds[0], 1, ethers.parseUnits("5", 18), "7000000")
        txr = await tx.wait(1)

        await flashDuelsMarketplace.connect(seller).cancelSell(sellerOptionToken, 0)
        const sale = await flashDuelsView.getSales(sellerOptionToken, 0)
        expect(sale.seller).to.equal("0x0000000000000000000000000000000000000000") // Ensure the sale is deleted
    })

    it("Should revert if a non-seller tries to cancel the sale", async function () {
        let duel: any,
            tx: any,
            txr: any,
            sellerOptionToken: any,
            usdc: any,
            flashDuels: any,
            owner: any,
            seller: any,
            buyer: any,
            protocolTreasury: any,
            usdAddress: any

        let usdcToken: any, tokenA: any, tokenB: any, bot: any, addr1: any, addr2: any, addr3: any
        const { contracts, accounts } = await loadFixture(deploy)
        addr1 = accounts[1]
        addr2 = accounts[2]
        addr3 = accounts[3]
        seller = accounts[4]
        buyer = accounts[5]
        owner = accounts[0]
        const expiryTime = 3
        // const minWager = ethers.parseUnits("10", 6) // 10 USDC
        // usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
        usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress?.toString())
        await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
        await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
        const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsMarketplace: any =
            await contracts.FlashDuelsMarketplaceFacet.flashDuelsMarketplaceFacetContract.attach(
                contracts.Diamond.diamond
            )
        const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )

        // let receipt = await flashDuelsCore
        //     .connect(accounts[1])
        //     .createDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        tx = await flashDuelsCore
            .connect(accounts[1])
            .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        await tx.wait(1)
        tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
        await tx.wait(1)    
        const amount = ethers.parseUnits("60", 6)
        const optionPrice = ethers.parseUnits("10", 6)

        await usdcToken.connect(owner).mint(addr2.address, amount)
        await usdcToken.connect(owner).mint(addr3.address, amount)
        await usdcToken.connect(owner).mint(seller.address, amount)

        // Approve token transfer
        await usdcToken.connect(addr2).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(addr3).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(seller).approve(contracts.Diamond.diamond, amount)

        let duelIds = await flashDuelsView.getCreatorToDuelIds(addr1.address)
        expect(duelIds.length).to.equal(1)
        await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "Yes", 0, optionPrice, amount, addr2)
        await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, addr3)
        tx = await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, seller)
        txr = await tx.wait(1)
        duel = await flashDuelsView.getDuel(duelIds[0])
        expect(duel.duelStatus).to.equal(1) // 1 represents the "BootStrapped" status

        await ethers.provider.send("evm_increaseTime", [30 * 60])
        await ethers.provider.send("evm_mine", [])

        // Start the duel with the bot account
        await expect(flashDuelsCore.connect(contracts.Bot.bot).startDuel(duelIds[0])).to.emit(
            flashDuelsCore,
            "DuelStarted"
        )

        // // Verify that the duel status has changed to "Live"
        duel = await flashDuelsView.getDuel(duelIds[0])
        expect(duel.duelStatus).to.equal(2) // 2 represents the "Live" status

        for (let i = 0; i < txr?.logs.length; i++) {
            if (txr?.logs[i]["args"]) {
                sellerOptionToken = txr?.logs[i]["args"][4]
            }
        }

        // console.log("sellerOptionToken", sellerOptionToken);

        let optionToken: FLASHUSDC = new ethers.Contract(sellerOptionToken, FLASHUSDCABI, owner)
        await optionToken.connect(seller).approve(contracts.Diamond.diamond, ethers.parseUnits("5", 18))
        tx = await flashDuelsMarketplace
            .connect(seller)
            .sell(sellerOptionToken, duelIds[0], 1, ethers.parseUnits("5", 18), "7000000")
        txr = await tx.wait(1)

        await expect(flashDuelsMarketplace.connect(buyer).cancelSell(sellerOptionToken, 0)).to.be.revertedWith(
            "You are not the seller"
        )
    })
})

describe("Token Purchase", function () {
    async function deploy() {
        const accounts = await ethers.getSigners()
        const contracts = await setupContracts()
        return { contracts, accounts }
    }

    it("Should allow a buyer to purchase tokens from a sale", async function () {
        let duel: any,
            tx: any,
            txr: any,
            sellerOptionToken: any,
            owner: any,
            seller: any,
            buyer: any

        let usdcToken: any, tokenA: any, tokenB: any, bot: any, addr1: any, addr2: any, addr3: any
        const { contracts, accounts } = await loadFixture(deploy)
        addr1 = accounts[1]
        addr2 = accounts[2]
        addr3 = accounts[3]
        seller = accounts[4]
        buyer = accounts[5]
        owner = accounts[0]
        const expiryTime = 3
        // const minWager = ethers.parseUnits("10", 6) // 10 USDC
        // usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
        usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress?.toString())
        await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
        await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsMarketplace: any =
            await contracts.FlashDuelsMarketplaceFacet.flashDuelsMarketplaceFacetContract.attach(
                contracts.Diamond.diamond
            )
        const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )

        // let receipt = await flashDuelsCore
        //     .connect(accounts[1])
        //     .createDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        tx = await flashDuelsCore
            .connect(accounts[1])
            .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        await tx.wait(1)
        tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
        await tx.wait(1)

        let amount = ethers.parseUnits("60", 6)
        const optionPrice = ethers.parseUnits("10", 6)

        await usdcToken.connect(owner).mint(addr2.address, amount)
        await usdcToken.connect(owner).mint(addr3.address, amount)
        await usdcToken.connect(owner).mint(seller.address, amount)

        // Approve token transfer
        await usdcToken.connect(addr2).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(addr3).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(seller).approve(contracts.Diamond.diamond, amount)

        let duelIds = await flashDuelsView.getCreatorToDuelIds(addr1.address)
        expect(duelIds.length).to.equal(1)
        await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "Yes", 0, optionPrice, amount, addr2)
        await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, addr3)
        tx = await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, seller)
        txr = await tx.wait(1)
        duel = await flashDuelsView.getDuel(duelIds[0])
        expect(duel.duelStatus).to.equal(1) // 1 represents the "BootStrapped" status

        await ethers.provider.send("evm_increaseTime", [30 * 60])
        await ethers.provider.send("evm_mine", [])

        // Start the duel with the bot account
        await expect(flashDuelsCore.connect(contracts.Bot.bot).startDuel(duelIds[0])).to.emit(
            flashDuelsCore,
            "DuelStarted"
        )

        // // Verify that the duel status has changed to "Live"
        duel = await flashDuelsView.getDuel(duelIds[0])
        expect(duel.duelStatus).to.equal(2) // 2 represents the "Live" status

        for (let i = 0; i < txr?.logs.length; i++) {
            if (txr?.logs[i]["args"]) {
                sellerOptionToken = txr?.logs[i]["args"][4]
            }
        }

        // console.log("sellerOptionToken", sellerOptionToken);

        let optionToken: FLASHUSDC = new ethers.Contract(sellerOptionToken, FLASHUSDCABI, owner)
        await optionToken.connect(seller).approve(contracts.Diamond.diamond, ethers.parseUnits("5", 18))
        tx = await flashDuelsMarketplace
            .connect(seller)
            .sell(sellerOptionToken, duelIds[0], 1, ethers.parseUnits("5", 18), "7000000")
        txr = await tx.wait(1)

        amount = ethers.parseUnits("70", 6)

        await usdcToken.connect(owner).mint(buyer.address, amount)
        await usdcToken.connect(buyer).approve(contracts.Diamond.diamond, ethers.parseUnits("70", 6))
        tx = await flashDuelsView.getDuel(duelIds[0])

        await ethers.provider.send("evm_increaseTime", [50 * 60])
        await ethers.provider.send("evm_mine", [])

        
        await flashDuelsMarketplace.connect(contracts.Bot.bot).buy(buyer.address, sellerOptionToken, duelIds[0], 1, [0], [ethers.parseUnits("5", 18)])
        const sale = await flashDuelsView.getSales(sellerOptionToken, 0)
        expect(sale.seller).to.equal("0x0000000000000000000000000000000000000000") // Ensure the sale is deleted
    })

    it("Should allow a buyer to partially purchase tokens from a sale", async function () {
        let duel: any,
            tx: any,
            txr: any,
            sellerOptionToken: any,
            owner: any,
            seller: any,
            buyer: any

        let usdcToken: any, tokenA: any, tokenB: any, bot: any, addr1: any, addr2: any, addr3: any
        const { contracts, accounts } = await loadFixture(deploy)
        addr1 = accounts[1]
        addr2 = accounts[2]
        addr3 = accounts[3]
        seller = accounts[4]
        buyer = accounts[5]
        owner = accounts[0]
        const expiryTime = 3
        // const minWager = ethers.parseUnits("10", 6) // 10 USDC
        // usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
        usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress?.toString())
        await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
        await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsMarketplace: any =
            await contracts.FlashDuelsMarketplaceFacet.flashDuelsMarketplaceFacetContract.attach(
                contracts.Diamond.diamond
            )
        const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )

        // let receipt = await flashDuelsCore
        //     .connect(accounts[1])
        //     .createDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        tx = await flashDuelsCore
            .connect(accounts[1])
            .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        await tx.wait(1)
        tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
        await tx.wait(1)

        let amount = ethers.parseUnits("60", 6)
        const optionPrice = ethers.parseUnits("10", 6)

        await usdcToken.connect(owner).mint(addr2.address, amount)
        await usdcToken.connect(owner).mint(addr3.address, amount)
        await usdcToken.connect(owner).mint(seller.address, amount)

        // Approve token transfer
        await usdcToken.connect(addr2).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(addr3).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(seller).approve(contracts.Diamond.diamond, amount)

        let duelIds = await flashDuelsView.getCreatorToDuelIds(addr1.address)
        expect(duelIds.length).to.equal(1)
        await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "Yes", 0, optionPrice, amount, addr2)
        await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, addr3)
        tx = await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, seller)
        txr = await tx.wait(1)
        duel = await flashDuelsView.getDuel(duelIds[0])
        expect(duel.duelStatus).to.equal(1) // 1 represents the "BootStrapped" status

        await ethers.provider.send("evm_increaseTime", [30 * 60])
        await ethers.provider.send("evm_mine", [])

        // Start the duel with the bot account
        await expect(flashDuelsCore.connect(contracts.Bot.bot).startDuel(duelIds[0])).to.emit(
            flashDuelsCore,
            "DuelStarted"
        )

        // // Verify that the duel status has changed to "Live"
        duel = await flashDuelsView.getDuel(duelIds[0])
        expect(duel.duelStatus).to.equal(2) // 2 represents the "Live" status

        for (let i = 0; i < txr?.logs.length; i++) {
            if (txr?.logs[i]["args"]) {
                sellerOptionToken = txr?.logs[i]["args"][4]
            }
        }

        // console.log("sellerOptionToken", sellerOptionToken);

        let optionToken: FLASHUSDC = new ethers.Contract(sellerOptionToken, FLASHUSDCABI, owner)
        await optionToken.connect(seller).approve(contracts.Diamond.diamond, ethers.parseUnits("5", 18))
        tx = await flashDuelsMarketplace
            .connect(seller)
            .sell(sellerOptionToken, duelIds[0], 1, ethers.parseUnits("5", 18), "7000000")
        txr = await tx.wait(1)

        amount = ethers.parseUnits("54", 6)

        await usdcToken.connect(owner).mint(buyer.address, amount)
        await usdcToken.connect(buyer).approve(contracts.Diamond.diamond, ethers.parseUnits("54", 6))
        tx = await flashDuelsView.getDuel(duelIds[0])
        await ethers.provider.send("evm_increaseTime", [50 * 60])
        await ethers.provider.send("evm_mine", [])
        await flashDuelsMarketplace.connect(contracts.Bot.bot).buy(buyer.address, sellerOptionToken, duelIds[0], 1, [0], [ethers.parseUnits("3", 18)])
        const sale = await flashDuelsView.getSales(sellerOptionToken, 0)
        expect(sale.seller).to.equal(seller.address) // Ensure the sale is deleted
        expect(sale.quantity).to.equal(ethers.parseUnits("2", 18)) // Ensure the sale is deleted
    })


    it("Should allow a buyer to purchase tokens from multiple sales (sellers)", async function () {
        let duel: any,
            tx: any,
            txr: any,
            sellerOptionToken1: any,
            sellerOptionToken2: any,
            owner: any,
            seller1: any,
            seller2: any,
            buyer: any

        let usdcToken: any, tokenA: any, tokenB: any, bot: any, addr1: any, addr2: any, addr3: any
        const { contracts, accounts } = await loadFixture(deploy)
        addr1 = accounts[1]
        addr2 = accounts[2]
        addr3 = accounts[3]
        seller1 = accounts[4]
        seller2 = accounts[6]
        buyer = accounts[5]
        owner = accounts[0]
        const expiryTime = 3
        // const minWager = ethers.parseUnits("10", 6) // 10 USDC
        // usdcToken = await contracts.USDC.usdcContract.attach(contracts.USDC.usdAddress)
        usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress?.toString())
        await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
        await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsMarketplace: any =
            await contracts.FlashDuelsMarketplaceFacet.flashDuelsMarketplaceFacetContract.attach(
                contracts.Diamond.diamond
            )
        const flashDuelsView: any = await contracts.FlashDuelsViewFacet.flashDuelsViewFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsAdmin: any = await contracts.FlashDuelsAdminFacet.flashDuelsAdminFacetContract.attach(
            contracts.Diamond.diamond
        )

        // let receipt = await flashDuelsCore
        //     .connect(accounts[1])
        //     .createDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        tx = await flashDuelsCore
            .connect(accounts[1])
            .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        await tx.wait(1)
        tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
        await tx.wait(1)

        let amount = ethers.parseUnits("60", 6)
        const optionPrice = ethers.parseUnits("10", 6)

        await usdcToken.connect(owner).mint(addr2.address, amount)
        await usdcToken.connect(owner).mint(addr3.address, amount)
        await usdcToken.connect(owner).mint(seller1.address, amount)
        await usdcToken.connect(owner).mint(seller2.address, amount)

        // Approve token transfer
        await usdcToken.connect(addr2).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(addr3).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(seller1).approve(contracts.Diamond.diamond, amount)
        await usdcToken.connect(seller2).approve(contracts.Diamond.diamond, amount)

        let duelIds = await flashDuelsView.getCreatorToDuelIds(addr1.address)
        expect(duelIds.length).to.equal(1)
        await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "Yes", 0, optionPrice, amount, addr2)
        await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, addr3)
        tx = await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, seller1)
        txr = await tx.wait(1)
        let tx2 = await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, seller2)
        let txr2 = await tx2.wait(1)
        duel = await flashDuelsView.getDuel(duelIds[0])
        expect(duel.duelStatus).to.equal(1) // 1 represents the "BootStrapped" status

        await ethers.provider.send("evm_increaseTime", [30 * 60])
        await ethers.provider.send("evm_mine", [])

        // Start the duel with the bot account
        await expect(flashDuelsCore.connect(contracts.Bot.bot).startDuel(duelIds[0])).to.emit(
            flashDuelsCore,
            "DuelStarted"
        )

        // // Verify that the duel status has changed to "Live"
        duel = await flashDuelsView.getDuel(duelIds[0])
        expect(duel.duelStatus).to.equal(2) // 2 represents the "Live" status

        for (let i = 0; i < txr?.logs.length; i++) {
            if (txr?.logs[i]["args"]) {
                sellerOptionToken1 = txr?.logs[i]["args"][4]
            }
        }

        for (let i = 0; i < txr2?.logs.length; i++) {
            if (txr2?.logs[i]["args"]) {
                sellerOptionToken2 = txr2?.logs[i]["args"][4]
            }
        }

        // console.log("sellerOptionToken", sellerOptionToken);

        let optionToken1: FLASHUSDC = new ethers.Contract(sellerOptionToken1, FLASHUSDCABI, owner)
        await optionToken1.connect(seller1).approve(contracts.Diamond.diamond, ethers.parseUnits("5", 18))
        tx = await flashDuelsMarketplace
            .connect(seller1)
            .sell(sellerOptionToken1, duelIds[0], 1, ethers.parseUnits("5", 18), "7000000")
        txr = await tx.wait(1)

        let optionToken2: FLASHUSDC = new ethers.Contract(sellerOptionToken2, FLASHUSDCABI, owner)
        await optionToken2.connect(seller2).approve(contracts.Diamond.diamond, ethers.parseUnits("5", 18))
        tx = await flashDuelsMarketplace
            .connect(seller2)
            .sell(sellerOptionToken2, duelIds[0], 1, ethers.parseUnits("5", 18), "7000000")

        amount = ethers.parseUnits("140", 6)

        await usdcToken.connect(owner).mint(buyer.address, amount)
        await usdcToken.connect(buyer).approve(contracts.Diamond.diamond, ethers.parseUnits("140", 6))
        tx = await flashDuelsView.getDuel(duelIds[0])
        await ethers.provider.send("evm_increaseTime", [50 * 60])
        await ethers.provider.send("evm_mine", [])
        // @note - here sellerOptionToken1 == sellerOptionToken2
        await flashDuelsMarketplace.connect(contracts.Bot.bot).buy(buyer.address, sellerOptionToken1, duelIds[0], 1, [0, 1], [ethers.parseUnits("5", 18), ethers.parseUnits("3", 18)])
        let sale = await flashDuelsView.getSales(sellerOptionToken1, 0)
        expect(sale.seller).to.equal("0x0000000000000000000000000000000000000000") // Ensure the sale is deleted
        expect(sale.quantity).to.equal(ethers.parseUnits("0", 18)) // Ensure the sale is deleted

        sale = await flashDuelsView.getSales(sellerOptionToken2, 1)
        expect(sale.seller).to.equal(seller2.address) // Ensure the sale is deleted
        expect(sale.quantity).to.equal(ethers.parseUnits("2", 18)) // Ensure the sale is deleted
    })

    it("Should revert if the duel has ended", async function () {
        let duel: any, usdcToken: any, tx: any, txr: any, sellerOptionToken: any
        let { contracts, accounts } = await loadFixture(deploy)

        const expiryTime = 3
        // const minWager = ethers.parseUnits("10", 6) // 10 USDC
        usdcToken = await contracts.USDC.usdcContract?.attach(contracts.USDC.usdAddress?.toString())
        await usdcToken.connect(accounts[0]).mint(accounts[1].address, ethers.parseUnits("10", 6))
        await usdcToken.connect(accounts[1]).approve(contracts.Diamond.diamond, ethers.parseUnits("10", 6))
        const flashDuelsCore: any = await contracts.FlashDuelsCoreFacet.flashDuelsCoreFacetContract.attach(
            contracts.Diamond.diamond
        )
        const flashDuelsMarketplace: any =
            await contracts.FlashDuelsMarketplaceFacet.flashDuelsMarketplaceFacetContract.attach(
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
        tx = await flashDuelsCore
            .connect(accounts[1])
            .requestCreateDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], expiryTime)
        await tx.wait(1)
        tx = await flashDuelsAdmin.connect(accounts[0]).approveAndCreateDuel(accounts[1].address, 2, 0)
        await tx.wait(1)

        let amount = ethers.parseUnits("60", 6) // 60 USDC
        let optionPrice = ethers.parseUnits("10", 6) // 10 USDC

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

        let seller = accounts[4]

        await usdcToken.connect(accounts[0]).mint(seller.address, amount)

        // Approve token transfer
        await usdcToken.connect(seller).approve(contracts.Diamond.diamond, amount)

        tx = await flashDuelsCore.connect(contracts.Bot.bot).joinDuel(duelIds[0], "No", 1, optionPrice, amount, seller)
        txr = await tx.wait(1)

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

        for (let i = 0; i < txr?.logs.length; i++) {
            if (txr?.logs[i]["args"]) {
                sellerOptionToken = txr?.logs[i]["args"][4]
            }
        }

        await expect(flashDuelsCore.connect(contracts.Bot.bot).settleDuel(duelIds[0], 0)).to.emit(
            flashDuelsCore,
            "DuelSettled"
        )

        // Verify duel status
        duel = await flashDuelsView.getDuels(duelIds[0])
        expect(duel.duelStatus).to.equal(3) // 3 represents the "Settled" status

        let buyer = accounts[5]
        let bot = accounts[3]

        await expect(
            flashDuelsMarketplace.connect(contracts.Bot.bot).buy(buyer.address, sellerOptionToken, duelIds[0], 1, [0], [amount])
        ).to.be.revertedWithCustomError(flashDuelsMarketplace, "FlashDuelsMarketplace__DuelEnded")
    })
})

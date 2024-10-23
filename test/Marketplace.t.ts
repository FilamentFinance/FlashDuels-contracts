import { expect } from "chai"
import { FlashDuels } from "../typechain-types"
import { ethers, upgrades, network } from "hardhat"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
const helpers = require("@nomicfoundation/hardhat-network-helpers")
import ERC20ABI from "../constants/abis/FLASHUSDC.json"
import { FlASHUSDC } from "../typechain-types/contracts/mocks/mockToken.sol/FLASHUSDC"

describe("FlashDuels Marketplace Contract", function () {
    let flashDuelsMarketplace: any,
        usdc: any,
        flashDuels: any,
        owner: any,
        seller: any,
        buyer: any,
        protocolTreasury: any,
        usdAddress: any
    let usdcToken: any, tokenA: any, tokenB: any, bot: any, addr1: any, addr2: any, addr3: any
    beforeEach(async function () {
        ;[owner, seller, buyer, protocolTreasury, addr1, addr2, addr3, bot] = await ethers.getSigners()

        const networkName = network.name
        const usdcAdmin = networkConfig[networkName].usdcAdmin

        if (networkName === "seiMainnet") {
            usdAddress = networkConfig[networkName].usdc
        } else {
            const USDC = await ethers.getContractFactory("FLASHUSDC")
            const usdcNew = await upgrades.deployProxy(USDC, ["UFLASHUSDC", "FLASHUSDC", usdcAdmin])
            usdcToken = await usdcNew.waitForDeployment()
            usdAddress = await usdcToken.getAddress()
        }

        // Deploy mock tokens for the duel
        const TokenAMock = await ethers.getContractFactory("MockERC20")
        tokenA = await TokenAMock.deploy("Token A", "TKA", 18)
        await tokenA.waitForDeployment()

        const TokenBMock = await ethers.getContractFactory("MockERC20")
        tokenB = await TokenBMock.deploy("Token B", "TKB", 18)
        await tokenB.waitForDeployment()

        // Deploy FlashDuels contract
        const FlashDuelsFactory = await ethers.getContractFactory("FlashDuels")
        const flashDuelsProxy = await upgrades.deployProxy(FlashDuelsFactory, [usdAddress, bot.address])
        flashDuels = await flashDuelsProxy.waitForDeployment()

        // await flashDuels.setSupportedTokenSymbols(["tokenA", "tokenB"])

        // Deploy FlashDuelsMarketplace
        const FlashDuelsMarketplace = await ethers.getContractFactory("FlashDuelsMarketplace")
        const flashDuelsMarketplaceProxy = await upgrades.deployProxy(FlashDuelsMarketplace, [
            usdAddress,
            flashDuels.target,
            protocolTreasury.address
        ])
        flashDuelsMarketplace = await flashDuelsMarketplaceProxy.waitForDeployment()
    })

    describe("Initialization", function () {
        it("Should set the correct USDC token address", async function () {
            expect(await flashDuelsMarketplace.usdc()).to.equal(usdAddress)
        })

        it("Should set the correct FlashDuels contract address", async function () {
            expect(await flashDuelsMarketplace.flashDuels()).to.equal(flashDuels.target)
        })
    })

    describe("Sale Creation", function () {
        let duel: any
        let sellerOptionToken: any
        let duelIds: any
        beforeEach(async function () {
            const expiryTime = 1
            const minWager = ethers.parseUnits("10", 6) // 10 USDC
            await usdcToken.connect(owner).mint(addr1.address, ethers.parseUnits("10", 6))
            await usdcToken.connect(addr1).approve(flashDuels.target, ethers.parseUnits("10", 6))
            let receipt = await flashDuels
                .connect(addr1)
                .createDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], minWager, expiryTime)
            let txr = await receipt.wait()
            // console.log(txr?.logs)
            // console.log("Total logs length: ", txr?.logs.length)
            let duelId
            for (let i = 0; i < txr?.logs.length; i++) {
                if (txr?.logs[i]["args"]) {
                    // console.log("duelId: ", txr?.logs[i]["args"][1]);
                    duelId = txr?.logs[i]["args"][1]
                }
            }
            const amount = ethers.parseUnits("60", 6)
            const optionPrice = ethers.parseUnits("10", 6)

            await usdcToken.connect(owner).mint(addr2.address, amount)
            await usdcToken.connect(owner).mint(addr3.address, amount)
            await usdcToken.connect(owner).mint(seller.address, amount)

            // Approve token transfer
            await usdcToken.connect(addr2).approve(flashDuels.target, amount)
            await usdcToken.connect(addr3).approve(flashDuels.target, amount)
            await usdcToken.connect(seller).approve(flashDuels.target, amount)

            duelIds = await flashDuels.getCreatorToDuelIds(addr1.address)
            expect(duelIds.length).to.equal(1)

            // Join Duel with tokenA
            await flashDuels.connect(addr2).joinDuel(duelIds[0], "Yes", 0, optionPrice, amount)
            await flashDuels.connect(addr3).joinDuel(duelIds[0], "No", 1, optionPrice, amount)
            let tx = await flashDuels.connect(seller).joinDuel(duelIds[0], "No", 1, optionPrice, amount)
            txr = await tx.wait(1)
            duel = await flashDuels.duels(duelIds[0])
            expect(duel.duelStatus).to.equal(1) // 1 represents the "BootStrapped" status

            await ethers.provider.send("evm_increaseTime", [30 * 60])
            await ethers.provider.send("evm_mine", [])

            // Start the duel with the bot account
            await expect(flashDuels.connect(bot).startDuel(duelIds[0])).to.emit(flashDuels, "DuelStarted")

            // // Verify that the duel status has changed to "Live"
            duel = await flashDuels.duels(duelIds[0])
            expect(duel.duelStatus).to.equal(2) // 2 represents the "Live" status

            for (let i = 0; i < txr?.logs.length; i++) {
                if (txr?.logs[i]["args"]) {
                    sellerOptionToken = txr?.logs[i]["args"][4]
                }
            }
        })

        it("Should allow the seller to create a sale", async function () {
            let optionToken: FlASHUSDC = new ethers.Contract(sellerOptionToken, ERC20ABI, owner)
            await optionToken.connect(seller).approve(flashDuelsMarketplace.target, ethers.parseUnits("5", 18))
            let tx = await flashDuelsMarketplace
                .connect(seller)
                .sell(sellerOptionToken, duelIds[0], 1, ethers.parseUnits("5", 18), "7000000")
            let txr = await tx.wait(1)
        })

        it("Should emit SaleCreated event on sale creation", async function () {
            let optionToken: FlASHUSDC = new ethers.Contract(sellerOptionToken, ERC20ABI, owner)
            await optionToken.connect(seller).approve(flashDuelsMarketplace.target, ethers.parseUnits("5", 18))
            await expect(
                flashDuelsMarketplace
                    .connect(seller)
                    .sell(sellerOptionToken, duelIds[0], 1, ethers.parseUnits("5", 18), "7000000")
            )
                .to.emit(flashDuelsMarketplace, "SaleCreated")
                .withArgs(0, seller.address, sellerOptionToken, ethers.parseUnits("5", 18), ethers.parseUnits("7", 6))
        })

        it("Should revert if the quantity is zero", async function () {
            let optionToken: FlASHUSDC = new ethers.Contract(sellerOptionToken, ERC20ABI, owner)
            await optionToken.connect(seller).approve(flashDuelsMarketplace.target, ethers.parseUnits("5", 18))
            await expect(
                flashDuelsMarketplace
                    .connect(seller)
                    .sell(sellerOptionToken, duelIds[0], 1, ethers.parseUnits("0", 18), "7000000")
            ).to.be.revertedWith("Amount must be greater than zero")
        })

        describe("Cancel Sale", function () {
            it("Should allow the seller to cancel their sale", async function () {
                let optionToken: FlASHUSDC = new ethers.Contract(sellerOptionToken, ERC20ABI, owner)
                await optionToken.connect(seller).approve(flashDuelsMarketplace.target, ethers.parseUnits("5", 18))
                let tx = await flashDuelsMarketplace
                    .connect(seller)
                    .sell(sellerOptionToken, duelIds[0], 1, ethers.parseUnits("5", 18), "7000000")
                await flashDuelsMarketplace.connect(seller).cancelSell(sellerOptionToken, 0)
                const sale = await flashDuelsMarketplace.sales(sellerOptionToken, 0)
                expect(sale.seller).to.equal("0x0000000000000000000000000000000000000000") // Ensure the sale is deleted
            })

            it("Should emit SaleCancelled event on cancellation", async function () {
                let optionToken: FlASHUSDC = new ethers.Contract(sellerOptionToken, ERC20ABI, owner)
                await optionToken.connect(seller).approve(flashDuelsMarketplace.target, ethers.parseUnits("5", 18))
                let tx = await flashDuelsMarketplace
                    .connect(seller)
                    .sell(sellerOptionToken, duelIds[0], 1, ethers.parseUnits("5", 18), "7000000")
                await expect(flashDuelsMarketplace.connect(seller).cancelSell(sellerOptionToken, 0))
                    .to.emit(flashDuelsMarketplace, "SaleCancelled")
                    .withArgs(0, seller.address, sellerOptionToken)
            })

            it("Should revert if a non-seller tries to cancel the sale", async function () {
                await expect(flashDuelsMarketplace.connect(buyer).cancelSell(sellerOptionToken, 0)).to.be.revertedWith(
                    "You are not the seller"
                )
            })
        })

        describe("Token Purchase", function () {
            beforeEach(async function () {
                let optionToken: FlASHUSDC = new ethers.Contract(sellerOptionToken, ERC20ABI, owner)
                await optionToken.connect(seller).approve(flashDuelsMarketplace.target, ethers.parseUnits("5", 18))
                let tx = await flashDuelsMarketplace
                    .connect(seller)
                    .sell(sellerOptionToken, duelIds[0], 1, ethers.parseUnits("5", 18), ethers.parseUnits("10", 6))
            })

            it("Should allow a buyer to purchase tokens from a sale", async function () {
                const amount = ethers.parseUnits("10", 6)

                await usdcToken.connect(owner).mint(buyer.address, amount)
                await usdcToken.connect(buyer).approve(flashDuelsMarketplace.target, ethers.parseUnits("10", 6))
                let tx = await flashDuels.duels(duelIds[0])
                console.log("flashduels", tx)
                await flashDuelsMarketplace.connect(buyer).buy(sellerOptionToken, duelIds[0], 0)
                const sale = await flashDuelsMarketplace.sales(sellerOptionToken, 0)
                expect(sale.seller).to.equal("0x0000000000000000000000000000000000000000") // Ensure the sale is deleted
            })

            it("Should emit TokensPurchased event on purchase", async function () {
                const amount = ethers.parseUnits("10", 6)

                await usdcToken.connect(owner).mint(buyer.address, amount)
                await usdcToken.connect(buyer).approve(flashDuelsMarketplace.target, ethers.parseUnits("10", 6))
                let tx = await flashDuels.duels(duelIds[0])
                console.log("flashduels", tx)
                await expect(flashDuelsMarketplace.connect(buyer).buy(sellerOptionToken, duelIds[0], 0))
                    .to.emit(flashDuelsMarketplace, "TokensPurchased")
                    .withArgs(
                        buyer.address,
                        seller.address,
                        sellerOptionToken,
                        ethers.parseUnits("5", 18),
                        ethers.parseUnits("10", 6)
                    )
            })

            it("Should revert if the duel has ended", async function () {
                const amount = ethers.parseUnits("60", 6) // 60 USDC
                const optionPrice = ethers.parseUnits("10", 6) // 10 USDC

                const expiryTime = 1
                const minWager = ethers.parseUnits("10", 6) // 10 USDC
                await usdcToken.connect(owner).mint(addr1.address, ethers.parseUnits("10", 6))
                await usdcToken.connect(addr1).approve(flashDuels.target, ethers.parseUnits("10", 6))
                let receipt = await flashDuels
                    .connect(addr1)
                    .createDuel(2, "Donald Trump will win the US election ?", ["Yes", "No"], minWager, expiryTime)
                let txr = await receipt.wait()
                // console.log(txr?.logs)
                // console.log("Total logs length: ", txr?.logs.length)
                let duelId
                for (let i = 0; i < txr?.logs.length; i++) {
                    if (txr?.logs[i]["args"]) {
                        // console.log("duelId: ", txr?.logs[i]["args"][1]);
                        duelId = txr?.logs[i]["args"][1]
                    }
                }
                duelIds = await flashDuels.getCreatorToDuelIds(addr1.address)
                // expect(duelIds.length).to.equal(1)

                await usdcToken.connect(owner).mint(addr2.address, amount)
                await usdcToken.connect(owner).mint(addr3.address, amount)

                await usdcToken.connect(addr2).approve(flashDuels.target, amount)
                await usdcToken.connect(addr3).approve(flashDuels.target, amount)

                await flashDuels.connect(addr2).joinDuel(duelIds[0], "Yes", 0, optionPrice, amount)
                await flashDuels.connect(addr3).joinDuel(duelIds[0], "No", 1, optionPrice, amount)

                await ethers.provider.send("evm_increaseTime", [30 * 60])
                await ethers.provider.send("evm_mine", [])

                duelIds = await flashDuels.getCreatorToDuelIds(addr1.address)
                // expect(duelIds.length).to.equal(1)

                // await flashDuels.connect(bot).startDuel(duelIds[0])

                // Simulate time passage for the duel to expire (6 hours)
                let time = 3600 * 6
                await network.provider.request({
                    method: "evm_increaseTime",
                    params: [time]
                })
                await network.provider.send("evm_mine")

                const duelIdToOptions = await flashDuels.getDuelIdToOptions(duelIds[0])

                await expect(flashDuels.connect(bot).settleDuel(duelIds[0], 0))
                    .to.emit(flashDuels, "DuelSettled")
                    .withArgs(duelIds[0], duelIdToOptions[0], 0) // Assume tokenB wins based on mock prices

                // Verify duel status
                const duel = await flashDuels.duels(duelIds[0])
                expect(duel.duelStatus).to.equal(3) // 3 represents the "Settled" status

                await expect(
                    flashDuelsMarketplace.connect(buyer).buy(sellerOptionToken, duelIds[0], 0)
                ).to.be.revertedWithCustomError(flashDuelsMarketplace, "FlashDuelsMarketplace__DuelEnded")
            })
        })
    })
})

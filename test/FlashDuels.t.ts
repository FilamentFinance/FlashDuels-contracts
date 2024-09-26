import { expect } from "chai";
import { FlashDuels } from "../typechain-types";
import { ethers, upgrades, network } from "hardhat"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
// import fs from "fs"
// import { deploy } from "@openzeppelin/hardhat-upgrades/dist/utils";
const helpers = require("@nomicfoundation/hardhat-network-helpers")


describe("FlashDuels Contract", function () {
    let flashDuels: any;
    let owner: any;
    let addr1: any;
    let addr2: any;
    let addr3: any;
    let bot: any;
    let usdcToken: any;
    let tokenA: any;
    let tokenB: any;
    let randomToken: any;
    let usdAddress: any;
    let mockOracleA: any;
    let mockOracleB: any;

    beforeEach(async function () {
        [owner, addr1, addr2, addr3, bot] = await ethers.getSigners();
        let networkName = network.name;
        let usdcAdmin = networkConfig[networkName].usdcAdmin;


        if (networkName === "seiMainnet") {
            usdAddress = { target: networkConfig[networkName].usdc }
        } else {
            const USDC = await ethers.getContractFactory("USDCF")
            const usdcNew = await upgrades.deployProxy(USDC, ["USDC Filament", "USDFIL", usdcAdmin])
            usdcToken = await usdcNew.waitForDeployment()
            usdAddress = usdcToken.target;
        }

        // Deploy mock tokens for the duel
        const TokenAMock = await ethers.getContractFactory("MockERC20");
        tokenA = await TokenAMock.deploy("Token A", "TKA", 18);
        await tokenA.waitForDeployment();

        const TokenBMock = await ethers.getContractFactory("MockERC20");
        tokenB = await TokenBMock.deploy("Token B", "TKB", 18);
        await tokenB.waitForDeployment();

        const MockOracleFactoryA = await ethers.getContractFactory("MockOracle");
        mockOracleA = await MockOracleFactoryA.deploy();
        await mockOracleA.waitForDeployment();

        await mockOracleA.setPrice(1500);


        const MockOracleFactoryB = await ethers.getContractFactory("MockOracle");
        mockOracleB = await MockOracleFactoryB.deploy();
        await mockOracleB.waitForDeployment();

        await mockOracleB.setPrice(2000);

        // Deploy FlashDuels contract
        const FlashDuelsFactory = await ethers.getContractFactory("FlashDuels");
        const flashDuelsProxy = await upgrades.deployProxy(FlashDuelsFactory, [usdAddress, bot.address])
        flashDuels = await flashDuelsProxy.waitForDeployment()

        // Add supported tokens
        await flashDuels.addSupportedToken(tokenA.target);
        await flashDuels.addSupportedToken(tokenB.target);

        await flashDuels.setPriceAggregator(tokenA.target, mockOracleA.target);
        await flashDuels.setPriceAggregator(tokenB.target, mockOracleB.target);
    });

    describe("Duel Creation", function () {
        it("should create a duel successfully", async function () {
            const expiryTime = 1; // Representing enum for 6 hours
            const minWager = ethers.parseEther("10");

            await expect(
                flashDuels
                    .connect(addr1)
                    .createDuel(tokenA.target, tokenB.target, expiryTime, minWager, {
                        value: ethers.parseEther("1"),
                    })
            )
                .to.emit(flashDuels, "DuelCreated");

            const duel = await flashDuels.duels(1);
            expect(duel.creator).to.equal(addr1.address);
            expect(duel.tokenA).to.equal(tokenA.target);
            expect(duel.tokenB).to.equal(tokenB.target);
            expect(duel.minWager).to.equal(minWager);
        });

        it("should fail if unsupported tokens are provided", async function () {
            const RandomToken = await ethers.getContractFactory("MockERC20");
            randomToken = await RandomToken.deploy("Random Token", "RND", 18);
            await randomToken.waitForDeployment();

            await expect(
                flashDuels
                    .connect(addr1)
                    .createDuel(randomToken.target, tokenB.target, 1, ethers.parseEther("10"), {
                        value: ethers.parseEther("1"),
                    })
            ).to.be.revertedWith("Unsupported tokens");
        });

        it("should fail if insufficient SEI fee is provided", async function () {
            await expect(
                flashDuels
                    .connect(addr1)
                    .createDuel(tokenA.target, tokenB.target, 1, ethers.parseEther("10"), {
                        value: ethers.parseEther("0.5"), // Insufficient SEI fee
                    })
            ).to.be.revertedWith("Minimum 1 SEI required to create a duel");
        });
    });

    describe("Duel Joining", function () {
        beforeEach(async function () {
            await flashDuels
                .connect(addr1)
                .createDuel(tokenA.target, tokenB.target, 1, ethers.parseEther("10"), {
                    value: ethers.parseEther("1"),
                });
        });

        it("should allow users to join duels", async function () {
            const amount = ethers.parseEther("60");

            await tokenA.connect(owner).mint(addr2.address, amount);
            await tokenB.connect(owner).mint(addr3.address, amount);
            // console.log(await tokenA.balanceOf(addr2.address));
            // console.log(await tokenB.balanceOf(addr3.address));

            // Approve token transfer
            await tokenA.connect(addr2).approve(flashDuels.target, amount);
            await tokenB.connect(addr3).approve(flashDuels.target, amount);

            // Join Duel with tokenA
            await expect(
                flashDuels.connect(addr2).joinDuel(1, tokenA.target, amount)
            )
                .to.emit(flashDuels, "DuelJoined");

            let duel = await flashDuels.duels(1);
            // console.log("duel totalWagerA", duel.totalWagerA);
            expect(duel.totalWagerA).to.equal(amount);

            // Join Duel with tokenB
            await expect(
                flashDuels.connect(addr3).joinDuel(1, tokenB.target, amount)
            )
                .to.emit(flashDuels, "DuelJoined");
            // console.log("duel totalWagerB", duel.totalWagerB);
            duel = await flashDuels.duels(1);
            // console.log("duel totalWagerB", duel.totalWagerB);
            // console.log("duel startTime", duel.startTime);
            // console.log("duel expiryTime", duel.expiryTime);

            expect(duel.totalWagerB).to.equal(amount);
        });

        it("should fail if token is not part of the duel", async function () {
            const amount = ethers.parseEther("60");

            const RandomToken = await ethers.getContractFactory("MockERC20");
            randomToken = await RandomToken.deploy("Random Token", "RND", 18);
            await randomToken.waitForDeployment();

            await randomToken.connect(addr2).approve(flashDuels.target, amount);

            await expect(
                flashDuels.connect(addr2).joinDuel(1, randomToken.target, amount)
            ).to.be.revertedWith("Invalid token for this duel");
        });

        it("should fail if wager is below minimum", async function () {
            const amount = ethers.parseEther("5");

            await tokenA.connect(addr2).approve(flashDuels.target, amount);

            await expect(
                flashDuels.connect(addr2).joinDuel(1, tokenA.target, amount)
            ).to.be.revertedWith("Wager below minimum");
        });
    });

    describe("Duel Settlement", function () {
        beforeEach(async function () {
            // Setup duels and join for settlement testing
            await flashDuels
                .connect(addr1)
                .createDuel(tokenA.target, tokenB.target, 1, ethers.parseEther("10"), {
                    value: ethers.parseEther("1"),
                });

            const amountA = ethers.parseEther("60");
            const amountB = ethers.parseEther("70");

            await tokenA.connect(owner).mint(addr2.address, amountA);
            await tokenB.connect(owner).mint(addr3.address, amountB);
            // console.log(await tokenA.balanceOf(addr2.address));
            // console.log(await tokenB.balanceOf(addr3.address));

            // Approve token transfer
            await tokenA.connect(addr2).approve(flashDuels.target, amountA);
            await tokenB.connect(addr3).approve(flashDuels.target, amountB);

            await flashDuels.connect(addr2).joinDuel(1, tokenA.target, amountA);
            await flashDuels.connect(addr3).joinDuel(1, tokenB.target, amountB);

        });

        it("should settle duel and distribute rewards", async function () {
            // // Simulate time passage for the duel to expire
            await ethers.provider.send("evm_increaseTime", [30 * 60]);
            await ethers.provider.send("evm_mine", []);

            // let time = 30 * 60; // 30 minutes
            // await network.provider.request({
            //     method: "evm_increaseTime",
            //     params: [time]
            // })
            // await helpers.time.increase(time)

            await flashDuels.connect(bot).startDuel(1)

            let time = 3600 * 6
            await network.provider.request({
                method: "evm_increaseTime",
                params: [time]
            })
            await helpers.time.increase(time)

            await expect(flashDuels.settleDuel(1))
                .to.emit(flashDuels, "DuelSettled")
                .withArgs(1, tokenB.target); // Assume tokenB wins based on mock prices
        });
    });

    describe("Duel Settlement with Reward Distribution", function () {
        beforeEach(async function () {
            // Setup duels and join for settlement testing
            await flashDuels
                .connect(addr1)
                .createDuel(tokenA.target, tokenB.target, 1, ethers.parseEther("10"), {
                    value: ethers.parseEther("1"),
                });
    
            const amountA = ethers.parseEther("60");
            const amountB = ethers.parseEther("70");
    
            await tokenA.connect(owner).mint(addr2.address, amountA);
            await tokenB.connect(owner).mint(addr3.address, amountB);
    
            // Approve token transfer
            await tokenA.connect(addr2).approve(flashDuels.target, amountA);
            await tokenB.connect(addr3).approve(flashDuels.target, amountB);
    
            await flashDuels.connect(addr2).joinDuel(1, tokenA.target, amountA);
            await flashDuels.connect(addr3).joinDuel(1, tokenB.target, amountB);
        });
    
        it("should settle duel and distribute rewards correctly to winner", async function () {
            // Simulate time passage for the duel to expire
            await ethers.provider.send("evm_increaseTime", [30 * 60]); // 30 minutes
            await ethers.provider.send("evm_mine", []);
    
            // Set mock prices so tokenB wins
            await mockOracleB.setPrice(2000); // Price for tokenB
            await mockOracleA.setPrice(1500); // Price for tokenA
    
            // Check balances before settlement
            const initialBalanceAddr2 = await tokenA.balanceOf(addr2.address);
            const initialBalanceAddr3 = await tokenB.balanceOf(addr3.address);
    
            await flashDuels.connect(bot).startDuel(1);

            let time = 3600 * 6
            await network.provider.request({
                method: "evm_increaseTime",
                params: [time]
            })
            await helpers.time.increase(time)
    
            // Settle the duel
            await flashDuels.settleDuel(1);
    
            // Check balances after settlement
            const finalBalanceAddr2 = await tokenA.balanceOf(addr2.address);
            const finalBalanceAddr3 = await tokenB.balanceOf(addr3.address);
    
            // Check if addr3 (winner) received the rewards
            expect(finalBalanceAddr3).to.be.gt(initialBalanceAddr3); // addr3's balance should increase
    
            // Check if addr2 (loser) lost their wager amount
            expect(finalBalanceAddr2).to.be.lte(initialBalanceAddr2); // addr2's balance should decrease
        });
    
        it("should not change wallet balance if duel is not settled", async function () {
            const initialBalanceAddr2 = await tokenA.balanceOf(addr2.address);
            const initialBalanceAddr3 = await tokenB.balanceOf(addr3.address);
    
            // No settlement is triggered, balances should remain the same
            expect(await tokenA.balanceOf(addr2.address)).to.equal(initialBalanceAddr2);
            expect(await tokenB.balanceOf(addr3.address)).to.equal(initialBalanceAddr3);
        });
    });
    
});

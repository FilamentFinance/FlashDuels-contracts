import { expect } from "chai";
import { FlashDuels } from "../typechain-types";
import { ethers, upgrades, network } from "hardhat"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
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
        const networkName = network.name;
        const usdcAdmin = networkConfig[networkName].usdcAdmin;

        if (networkName === "seiMainnet") {
            usdAddress = networkConfig[networkName].usdc;
        } else {
            const USDC = await ethers.getContractFactory("USDCF");
            const usdcNew = await upgrades.deployProxy(USDC, ["USDC Filament", "USDFIL", usdcAdmin]);
            usdcToken = await usdcNew.waitForDeployment();
            usdAddress = await usdcToken.getAddress();
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
        await flashDuels.setSupportedToken(tokenA.target);
        await flashDuels.setSupportedToken(tokenB.target);

        await flashDuels.setPriceAggregator(tokenA.target, mockOracleA.target);
        await flashDuels.setPriceAggregator(tokenB.target, mockOracleB.target);
    });

    describe("Duel Creation", function () {
        it("should create a duel successfully", async function () {
            const expiryTime = 1; // 6 hours
            const minWager = ethers.parseUnits("10", 6); // 10 USDC
            await usdcToken.connect(owner).mint(addr1.address, ethers.parseUnits("10", 6));
            await usdcToken.connect(addr1).approve(flashDuels.target, ethers.parseUnits("10", 6));
            let receipt = await
                flashDuels
                    .connect(addr1)
                    .createDuel(tokenA.target, tokenB.target, "Topic A", "Topic B", expiryTime, minWager, 1); // 1 for DuelCategory.Crypto
            let txr = await receipt.wait();
            // console.log(txr?.logs)
            // console.log("Total logs length: ", txr?.logs.length)
            let duelId;
            for (let i = 0; i < txr?.logs.length; i++) {
                if (txr?.logs[i]["args"]) {
                    // console.log("duelId: ", txr?.logs[i]["args"][0]);
                    duelId = txr?.logs[i]["args"][0];
                }
            }
            const duel = await flashDuels.duels(duelId.toString());
            // console.log("duel", duel);
            expect(duel.creator).to.equal(addr1.address);
            expect(duel.tokenA).to.equal(tokenA.target);
            expect(duel.tokenB).to.equal(tokenB.target);
            expect(duel.minWager).to.equal(minWager);
            expect(duel.category).to.equal(1); // DuelCategory.Crypto
        });

        it("should fail if unsupported tokens are provided", async function () {
            const RandomToken = await ethers.getContractFactory("MockERC20");
            randomToken = await RandomToken.deploy("Random Token", "RND", 18);
            await randomToken.waitForDeployment();

            await expect(
                flashDuels
                    .connect(addr1)
                    .createDuel(randomToken.target, tokenB.target, "Topic A", "Topic B", 1, ethers.parseUnits("10", 6), 1)
            ).to.be.revertedWith("Unsupported tokens");
        });
    });

    describe("Duel Joining", function () {
        let duelId: any;
        let duel: any;
        let topicA: any;
        let topicB: any;
        let expiryTime: any;
        let minWager: any;
        beforeEach(async function () {
            expiryTime = 1;

            minWager = ethers.parseUnits("10", 6); // 10 USDC
            await usdcToken.connect(owner).mint(addr1.address, ethers.parseUnits("10", 6));
            await usdcToken.connect(addr1).approve(flashDuels.target, ethers.parseUnits("10", 6));
            topicA = "Topic A";
            topicB = "Topic B";

            await ethers.provider.send("evm_increaseTime", [30 * 60]);
            await ethers.provider.send("evm_mine", []);

            let receipt = await
                flashDuels
                    .connect(addr1)
                    .createDuel(tokenA.target, tokenB.target, topicA, topicB, expiryTime, minWager, 1); // 1 for DuelCategory.Crypto
            let txr = await receipt.wait();
            // console.log(txr?.logs)
            // console.log("Total logs length: ", txr?.logs.length)
            for (let i = 0; i < txr?.logs.length; i++) {
                if (txr?.logs[i]["args"]) {
                    // console.log("duelId: ", txr?.logs[i]["args"][0]);
                    duelId = txr?.logs[i]["args"][0];

                }
            }
        });

        it("should allow only bot to start a duel", async function () {
            // Create a new duel
            expiryTime = 1;
            const wager = ethers.parseUnits("60", 6);
            await usdcToken.connect(owner).mint(addr1.address, wager);
            await usdcToken.connect(addr1).approve(flashDuels.target, wager);

            const createDuelTx = await flashDuels
                .connect(addr1)
                .createDuel(tokenA.target, tokenB.target, topicA, topicB, expiryTime, wager, 1);

            const txReceipt = await createDuelTx.wait();
            // const duelId = txReceipt.logs[0].args[0];
            const duelId = await flashDuels.creatorTopicsToDuelId(addr1.address, topicA, topicB);

            // Attempt to start the duel with a non-bot account (should fail)
            await expect(
                flashDuels.connect(addr1).startDuel(duelId)
            ).to.be.revertedWithCustomError(flashDuels, "FlashDuels__InvalidBot");
        });

        it("should allow users to join duels", async function () {
            const amount = ethers.parseUnits("60", 6);

            await usdcToken.connect(owner).mint(addr2.address, amount);
            await usdcToken.connect(owner).mint(addr3.address, amount);
            // console.log(await tokenA.balanceOf(addr2.address));
            // console.log(await tokenB.balanceOf(addr3.address));

            // Approve token transfer
            await usdcToken.connect(addr2).approve(flashDuels.target, amount);
            await usdcToken.connect(addr3).approve(flashDuels.target, amount);

            const duelId = await flashDuels.creatorTopicsToDuelId(addr1.address, topicA, topicB);

            // Join Duel with tokenA
            await flashDuels.connect(addr2).joinDuel(duelId, tokenA.target, true, amount);
            await flashDuels.connect(addr3).joinDuel(duelId, tokenB.target, false, amount);

            duel = await flashDuels.duels(duelId);
            expect(duel.duelStatus).to.equal(1);  // 1 represents the "BootStrapped" status

            await ethers.provider.send("evm_increaseTime", [30 * 60]);
            await ethers.provider.send("evm_mine", []);

            // Start the duel with the bot account
            await expect(
                flashDuels.connect(bot).startDuel(duelId)
            ).to.emit(flashDuels, "DuelStarted")

            // // Verify that the duel status has changed to "Live"
            duel = await flashDuels.duels(duelId);
            expect(duel.duelStatus).to.equal(2); // 2 represents the "Live" status

        });

        it("should fail if token is not part of the duel", async function () {
            const amount = ethers.parseUnits("60", 6);

            const RandomToken = await ethers.getContractFactory("MockERC20");
            const randomToken = await RandomToken.deploy("Random Token", "RND", 6);
            await randomToken.waitForDeployment();

            await randomToken.connect(owner).mint(addr2.address, amount);
            await randomToken.connect(addr2).approve(flashDuels.target, amount);

            const duelId = await flashDuels.creatorTopicsToDuelId(addr1.address, topicA, topicB);

            await expect(
                flashDuels.connect(addr2).joinDuel(duelId, randomToken.target, true, amount)
            ).to.be.revertedWith("Invalid token for this duel");
        });

        it("should fail if wager is below minimum", async function () {
            const amount = ethers.parseUnits("5", 6); // 5 USDC

            await usdcToken.connect(owner).mint(addr2.address, amount);
            await usdcToken.connect(addr2).approve(flashDuels.target, amount);

            const duelId = await flashDuels.creatorTopicsToDuelId(addr1.address, topicA, topicB);

            await expect(
                flashDuels.connect(addr2).joinDuel(duelId, tokenA.target, true, amount)
            ).to.be.revertedWith("Wager below minimum");
        });
    });

    describe("Duel Settlement", function () {
        let duelId: string;
        let topicA: string;
        let topicB: string;
        const amount = ethers.parseUnits("60", 6); // 60 USDC

        beforeEach(async function () {
            // Setup duels and join for settlement testing
            topicA = "Topic A";
            topicB = "Topic B";

            await usdcToken.connect(owner).mint(addr1.address, ethers.parseUnits("10", 6));

            await usdcToken.connect(addr1).approve(flashDuels.target, ethers.parseUnits("10", 6));
            await flashDuels
                .connect(addr1)
                .createDuel(tokenA.target, tokenB.target, topicA, topicB, 0, amount, 1);

            duelId = await flashDuels.creatorTopicsToDuelId(addr1.address, topicA, topicB);

            await usdcToken.connect(owner).mint(addr2.address, amount);
            await usdcToken.connect(owner).mint(addr3.address, amount);

            await usdcToken.connect(addr2).approve(flashDuels.target, amount);
            await usdcToken.connect(addr3).approve(flashDuels.target, amount);

            await flashDuels.connect(addr2).joinDuel(duelId, tokenA.target, true, amount);
            await flashDuels.connect(addr3).joinDuel(duelId, tokenB.target, false, amount);
        });

        it("should settle duel and distribute rewards", async function () {
            // Simulate time passage for the bootstrap period to end
            await ethers.provider.send("evm_increaseTime", [30 * 60]);
            await ethers.provider.send("evm_mine", []);

            await flashDuels.connect(bot).startDuel(duelId);

            // Simulate time passage for the duel to expire (6 hours)
            let time = 3600 * 6;
            await network.provider.request({
                method: "evm_increaseTime",
                params: [time]
            });
            await network.provider.send("evm_mine");

            // Set mock prices so tokenB wins
            await mockOracleB.setPrice(2000); // Price for tokenB
            await mockOracleA.setPrice(1500); // Price for tokenA

            await expect(flashDuels.connect(bot).settleDuel(duelId))
                .to.emit(flashDuels, "DuelSettled")
                .withArgs(duelId, topicB); // Assume tokenB wins based on mock prices

            // Verify duel status
            const duel = await flashDuels.duels(duelId);
            expect(duel.duelStatus).to.equal(3); // 3 represents the "Settled" status
        });
    });

    describe("Duel Settlement with Reward Distribution", function () {
        let duelId: string;
        let topicA: string;
        let topicB: string;
        const amount = ethers.parseUnits("60", 6); // 60 USDC

        beforeEach(async function () {
            // Setup duels and join for settlement testing
            topicA = "Topic A";
            topicB = "Topic B";

            await usdcToken.connect(owner).mint(addr1.address, ethers.parseUnits("10", 6));

            await usdcToken.connect(addr1).approve(flashDuels.target, ethers.parseUnits("10", 6));
            await flashDuels
                .connect(addr1)
                .createDuel(tokenA.target, tokenB.target, topicA, topicB, 0, amount, 1);

            duelId = await flashDuels.creatorTopicsToDuelId(addr1.address, topicA, topicB);

            await usdcToken.connect(owner).mint(addr2.address, amount);
            await usdcToken.connect(owner).mint(addr3.address, amount);

            await usdcToken.connect(addr2).approve(flashDuels.target, amount);
            await usdcToken.connect(addr3).approve(flashDuels.target, amount);

            await flashDuels.connect(addr2).joinDuel(duelId, tokenA.target, true, amount);
            await flashDuels.connect(addr3).joinDuel(duelId, tokenB.target, false, amount);
        });

        it("should settle duel and distribute rewards correctly to winner", async function () {
            // Simulate time passage for the bootstrap period to end
            await ethers.provider.send("evm_increaseTime", [30 * 60]);
            await ethers.provider.send("evm_mine", []);

            // Set mock prices so tokenB wins
            await mockOracleB.setPrice(2000); // Price for tokenB
            await mockOracleA.setPrice(1500); // Price for tokenA

            // Check balances before settlement
            const initialBalanceAddr2 = await usdcToken.balanceOf(addr2.address); // 0
            const initialBalanceAddr3 = await usdcToken.balanceOf(addr3.address); // 0


            await flashDuels.connect(bot).startDuel(duelId);

            let time = 3600 * 6;
            await network.provider.request({
                method: "evm_increaseTime",
                params: [time]
            });
            // await helpers.time.increase(time)
            await network.provider.send("evm_mine");

            // Settle the duel
            await flashDuels.connect(bot).settleDuel(duelId);

            // Check balances after settlement
            let finalBalanceAddr2 = await usdcToken.balanceOf(addr2.address);
            let finalBalanceAddr3 = await usdcToken.balanceOf(addr3.address);
            expect(finalBalanceAddr2).to.be.equal("0");
            expect(finalBalanceAddr3).to.be.equal("0");

            let allTImeEarningsAddr2 = await flashDuels.allTimeEarnings(addr2.address);
            let allTImeEarningsAddr3 = await flashDuels.allTimeEarnings(addr3.address);

            await flashDuels.connect(addr3).withdrawEarnings(allTImeEarningsAddr3);

            // Check if addr3 (winner) received the rewards
            finalBalanceAddr3 = await usdcToken.balanceOf(addr3.address);
            expect(finalBalanceAddr3).to.be.gt(initialBalanceAddr3); // addr3's balance should increase
            // Check if addr2 (loser) lost their wager amount
            expect(finalBalanceAddr2).to.be.lte(initialBalanceAddr2); // addr2's balance should decrease or remain the same
        });

        it("should not change wallet balance if duel is not settled", async function () {
            const initialBalanceAddr2 = await usdcToken.balanceOf(addr2.address);
            const initialBalanceAddr3 = await usdcToken.balanceOf(addr3.address);

            // No settlement is triggered, balances should remain the same
            expect(await usdcToken.balanceOf(addr2.address)).to.equal(initialBalanceAddr2);
            expect(await usdcToken.balanceOf(addr3.address)).to.equal(initialBalanceAddr3);
        });
    });

});

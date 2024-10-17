import { expect } from "chai";
import { FlashDuels } from "../typechain-types";
import { ethers, upgrades, network } from "hardhat";
import { networkConfig, testNetworkChains } from "../helper-hardhat-config";
const helpers = require("@nomicfoundation/hardhat-network-helpers");

describe("FlashDuels Contract", function () {
  let flashDuels: any;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let addr3: any;
  let addr4: any;
  let bot: any;
  let usdcToken: any;
  let tokenA: any;
  let tokenB: any;
  let randomToken: any;
  let usdAddress: any;
  let mockOracleA: any;
  let mockOracleB: any;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, addr4, bot] = await ethers.getSigners();
    const networkName = network.name;
    const usdcAdmin = networkConfig[networkName].usdcAdmin;

    if (networkName === "seiMainnet") {
      usdAddress = networkConfig[networkName].usdc;
    } else {
      const USDC = await ethers.getContractFactory("FLASHUSDC");
      const usdcNew = await upgrades.deployProxy(USDC, [
        "USDC Filament",
        "USDFIL",
        usdcAdmin,
      ]);
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
    const flashDuelsProxy = await upgrades.deployProxy(FlashDuelsFactory, [
      usdAddress,
      bot.address,
    ]);
    flashDuels = await flashDuelsProxy.waitForDeployment();

    // Add supported tokens
    await flashDuels.setSupportedTokens([tokenA.target, tokenB.target]);
    // await flashDuels.setSupportedToken(tokenB.target);

    await flashDuels.setPriceAggregators(
      [tokenA.target, tokenB.target],
      [mockOracleA.target, mockOracleB.target]
    );
    // await flashDuels.setPriceAggregator(tokenB.target, mockOracleB.target);
  });

  describe("Duel Creation", function () {
    it("should create a duel successfully", async function () {
      const expiryTime = 1;
      const minWager = ethers.parseUnits("10", 6); // 10 USDC
      await usdcToken
        .connect(owner)
        .mint(addr1.address, ethers.parseUnits("10", 6));
      await usdcToken
        .connect(addr1)
        .approve(flashDuels.target, ethers.parseUnits("10", 6));
      let receipt = await flashDuels
        .connect(addr1)
        .createDuel(
          2,
          "Donald Trump will win the US election ?",
          ["Yes", "No"],
          minWager,
          expiryTime
        );
      let txr = await receipt.wait();
      // console.log(txr?.logs)
      // console.log("Total logs length: ", txr?.logs.length)
      let duelId;
      for (let i = 0; i < txr?.logs.length; i++) {
        if (txr?.logs[i]["args"]) {
          // console.log("duelId: ", txr?.logs[i]["args"][1]);
          duelId = txr?.logs[i]["args"][1];
        }
      }
      const duel = await flashDuels.duels(duelId.toString());
      expect(duel.creator).to.equal(addr1.address);
      expect(duel.minWager).to.equal(minWager);
      expect(duel.category).to.equal(2); // DuelCategory.Politics
    });
  });

  describe("Duel Joining", function () {
    let duel: any;
    beforeEach(async function () {
      const expiryTime = 1;
      const minWager = ethers.parseUnits("10", 6); // 10 USDC
      await usdcToken
        .connect(owner)
        .mint(addr1.address, ethers.parseUnits("10", 6));
      await usdcToken
        .connect(addr1)
        .approve(flashDuels.target, ethers.parseUnits("10", 6));
      let receipt = await flashDuels
        .connect(addr1)
        .createDuel(
          2,
          "Donald Trump will win the US election ?",
          ["Yes", "No"],
          minWager,
          expiryTime
        );
      let txr = await receipt.wait();
      // console.log(txr?.logs)
      // console.log("Total logs length: ", txr?.logs.length)
      let duelId;
      for (let i = 0; i < txr?.logs.length; i++) {
        if (txr?.logs[i]["args"]) {
          // console.log("duelId: ", txr?.logs[i]["args"][1]);
          duelId = txr?.logs[i]["args"][1];
        }
      }
    });

    it("should allow users to join duels", async function () {
      const amount = ethers.parseUnits("60", 6);
      const optionPrice = ethers.parseUnits("10", 6);

      await usdcToken.connect(owner).mint(addr2.address, amount);
      await usdcToken.connect(owner).mint(addr3.address, amount);
      await usdcToken.connect(owner).mint(addr4.address, amount);

      // Approve token transfer
      await usdcToken.connect(addr2).approve(flashDuels.target, amount);
      await usdcToken.connect(addr3).approve(flashDuels.target, amount);
      await usdcToken.connect(addr4).approve(flashDuels.target, amount);

      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);
      let BTC = tokenA;

      // Join Duel with tokenA
      await flashDuels
        .connect(addr2)
        .joinDuel(duelIds[0], "Yes", 0, optionPrice, amount);
      await flashDuels
        .connect(addr3)
        .joinDuel(duelIds[0], "No", 1, optionPrice, amount);

      duel = await flashDuels.duels(duelIds[0]);
      expect(duel.duelStatus).to.equal(1); // 1 represents the "BootStrapped" status

      await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);

      // Start the duel with the bot account
      await expect(flashDuels.connect(bot).startDuel(duelIds[0])).to.emit(
        flashDuels,
        "DuelStarted"
      );

      // // Verify that the duel status has changed to "Live"
      duel = await flashDuels.duels(duelIds[0]);
      expect(duel.duelStatus).to.equal(2); // 2 represents the "Live" status

      //   await flashDuels.connect(addr4).joinDuel(duelIds[0], 1, amount);
      await flashDuels
        .connect(addr4)
        .joinDuel(duelIds[0], "No", 1, optionPrice, amount);
      const getDuelUsers = await flashDuels.getDuelUsersForOption(
        duelIds[0],
        "Yes"
      );
      // console.log(getDuelUsers);
    });

    it("should allow only bot to start a duel", async function () {
      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);

      await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);

      // Attempt to start the duel with a non-bot account (should fail)
      await expect(
        flashDuels.connect(addr1).startDuel(duelIds[0])
      ).to.be.revertedWithCustomError(flashDuels, "FlashDuels__InvalidBot");
    });

    it("should fail if wager is below minimum", async function () {
      const amount = ethers.parseUnits("5", 6); // 5 USDC
      const optionPrice = ethers.parseUnits("1", 6); // 1 USDC

      await usdcToken.connect(owner).mint(addr2.address, amount);
      await usdcToken.connect(addr2).approve(flashDuels.target, amount);

      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);
      let BTC = tokenA;

      await expect(
        flashDuels
          .connect(addr2)
          .joinDuel(duelIds[0], "No", 1, optionPrice, amount)
      ).to.be.revertedWith("Wager below minimum");
    });
  });

  describe("Duel Settlement", function () {
    const amount = ethers.parseUnits("60", 6); // 60 USDC
    const optionPrice = ethers.parseUnits("10", 6); // 10 USDC

    beforeEach(async function () {
      const expiryTime = 1;
      const minWager = ethers.parseUnits("10", 6); // 10 USDC
      await usdcToken
        .connect(owner)
        .mint(addr1.address, ethers.parseUnits("10", 6));
      await usdcToken
        .connect(addr1)
        .approve(flashDuels.target, ethers.parseUnits("10", 6));
      let receipt = await flashDuels
        .connect(addr1)
        .createDuel(
          2,
          "Donald Trump will win the US election ?",
          ["Yes", "No"],
          minWager,
          expiryTime
        );
      let txr = await receipt.wait();
      // console.log(txr?.logs)
      // console.log("Total logs length: ", txr?.logs.length)
      let duelId;
      for (let i = 0; i < txr?.logs.length; i++) {
        if (txr?.logs[i]["args"]) {
          // console.log("duelId: ", txr?.logs[i]["args"][1]);
          duelId = txr?.logs[i]["args"][1];
        }
      }
      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);

      await usdcToken.connect(owner).mint(addr2.address, amount);
      await usdcToken.connect(owner).mint(addr3.address, amount);

      await usdcToken.connect(addr2).approve(flashDuels.target, amount);
      await usdcToken.connect(addr3).approve(flashDuels.target, amount);

      await flashDuels
        .connect(addr2)
        .joinDuel(duelIds[0], "Yes", 0, optionPrice, amount);
      await flashDuels
        .connect(addr3)
        .joinDuel(duelIds[0], "No", 1, optionPrice, amount);
    });

    it("should settle duel and distribute rewards", async function () {
      // Simulate time passage for the bootstrap period to end
      await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);

      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);

      await flashDuels.connect(bot).startDuel(duelIds[0]);

      // Simulate time passage for the duel to expire (6 hours)
      let time = 3600 * 6;
      await network.provider.request({
        method: "evm_increaseTime",
        params: [time],
      });
      await network.provider.send("evm_mine");

      const duelIdToOptions = await flashDuels.getDuelIdToOptions(duelIds[0]);

      await expect(flashDuels.connect(bot).settleDuel(duelIds[0], 0))
        .to.emit(flashDuels, "DuelSettled")
        .withArgs(duelIds[0], duelIdToOptions[0], 0); // Assume tokenB wins based on mock prices

      // Verify duel status
      const duel = await flashDuels.duels(duelIds[0]);
      expect(duel.duelStatus).to.equal(3); // 3 represents the "Settled" status
    });
  });

  describe("Duel Settlement with Reward Distribution", function () {
    const amount = ethers.parseUnits("60", 6); // 60 USDC
    const optionPrice = ethers.parseUnits("10", 6); // 10 USDC
    let expiryTime: any;
    let minWager: any;

    beforeEach(async function () {
      expiryTime = 1;
      minWager = ethers.parseUnits("10", 6); // 10 USDC
      await usdcToken
        .connect(owner)
        .mint(addr1.address, ethers.parseUnits("10", 6));
      await usdcToken
        .connect(addr1)
        .approve(flashDuels.target, ethers.parseUnits("10", 6));
      let receipt = await flashDuels
        .connect(addr1)
        .createDuel(
          2,
          "Donald Trump will win the US election ?",
          ["Yes", "No"],
          minWager,
          expiryTime
        );
      let txr = await receipt.wait();
      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);

      await usdcToken.connect(owner).mint(addr2.address, amount);
      await usdcToken.connect(owner).mint(addr3.address, amount);

      await usdcToken.connect(addr2).approve(flashDuels.target, amount);
      await usdcToken.connect(addr3).approve(flashDuels.target, amount);

      await flashDuels
        .connect(addr2)
        .joinDuel(duelIds[0], "Yes", 0, optionPrice, amount);

      await flashDuels
        .connect(addr3)
        .joinDuel(duelIds[0], "No", 1, optionPrice, amount);
    });

    it("should settle duel and distribute rewards correctly to winner", async function () {
      // Simulate time passage for the bootstrap period to end
      await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);

      // Check balances before settlement
      const initialBalanceAddr2 = await usdcToken.balanceOf(addr2.address); // 0
      const initialBalanceAddr3 = await usdcToken.balanceOf(addr3.address); // 0
      await network.provider.send("evm_mine");

      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);

      await flashDuels.connect(bot).startDuel(duelIds[0]);

      let time = 3600 * 6;
      await network.provider.request({
        method: "evm_increaseTime",
        params: [time],
      });
      // await helpers.time.increase(time)

      // Settle the duel
      await flashDuels.connect(bot).settleDuel(duelIds[0], "0");

      // Check balances after settlement
      let finalBalanceAddr2 = await usdcToken.balanceOf(addr2.address);
      let finalBalanceAddr3 = await usdcToken.balanceOf(addr3.address);
      expect(finalBalanceAddr2).to.be.equal("0");
      expect(finalBalanceAddr3).to.be.equal("0");

      let allTImeEarningsAddr2 = await flashDuels.allTimeEarnings(
        addr2.address
      );
      let allTImeEarningsAddr3 = await flashDuels.allTimeEarnings(
        addr3.address
      );

      await flashDuels.connect(addr2).withdrawEarnings(allTImeEarningsAddr2);

      // Check if addr2 (winner) received the rewards
      finalBalanceAddr2 = await usdcToken.balanceOf(addr2.address);
      expect(finalBalanceAddr2).to.be.gt(initialBalanceAddr2); // addr2's balance should increase
      // Check if addr3 (loser) lost their wager amount
      expect(finalBalanceAddr3).to.be.lte(initialBalanceAddr3); // addr3's balance should decrease or remain the same
    });

    it("should not change wallet balance if duel is not settled", async function () {
      const initialBalanceAddr2 = await usdcToken.balanceOf(addr2.address);
      const initialBalanceAddr3 = await usdcToken.balanceOf(addr3.address);

      // No settlement is triggered, balances should remain the same
      expect(await usdcToken.balanceOf(addr2.address)).to.equal(
        initialBalanceAddr2
      );
      expect(await usdcToken.balanceOf(addr3.address)).to.equal(
        initialBalanceAddr3
      );
    });
  });

  describe("Duel Cancel and Refund Logic", function () {
    const bootstrapPeriod = 3600; // Example bootstrap period of 1 hour
    const minThreshold = ethers.parseUnits("100", 6); // Example threshold of 100 USDC
    let topic: string;
    let amount = ethers.parseUnits("60", 6); // 60 USDC
    let optionPrice = ethers.parseUnits("10", 6); // 10 USDC
    let expiryTime: any;
    let minWager: any;

    beforeEach(async function () {
      // Setup duels and join for settlement testing
      expiryTime = 1;
      minWager = ethers.parseUnits("10", 6); // 10 USDC
      await usdcToken
        .connect(owner)
        .mint(addr1.address, ethers.parseUnits("10", 6));

      await usdcToken
        .connect(addr1)
        .approve(flashDuels.target, ethers.parseUnits("10", 6));
      await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);
      let receipt = await flashDuels
        .connect(addr1)
        .createDuel(
          2,
          "Donald Trump will win the US election ?",
          ["Yes", "No"],
          minWager,
          expiryTime
        );
      let txr = await receipt.wait();
      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);
      expect(await flashDuels.isValidDuelId(duelIds[0])).to.be.equal(true);
    });

    describe("Cancel Duel if Threshold Not Met", function () {
      it("should cancel the duel if the threshold is not met after the bootstrap period", async function () {
        // Increase time to after the bootstrap period
        await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1]);
        await ethers.provider.send("evm_mine", []);
        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);

        // Check that the duel exists and hasn't started yet
        const duel = await flashDuels.duels(duelIds[0]);
        expect(duel.duelStatus).to.equal(1); // BootStrapped status

        // Call cancelDuelIfThresholdNotMet by the bot
        await flashDuels
          .connect(bot)
          .cancelDuelIfThresholdNotMet(2, duelIds[0]);

        // Validate the duel status is updated to Cancelled
        const cancelledDuel = await flashDuels.duels(duelIds[0]);
        expect(cancelledDuel.duelStatus).to.equal(4); // Cancelled status
      });

      it("should not cancel duel if the threshold is met", async function () {
        // Simulate meeting the threshold
        await usdcToken.connect(owner).mint(addr2.address, minThreshold);
        await usdcToken.connect(owner).mint(addr3.address, minThreshold);

        await usdcToken.connect(addr2).approve(flashDuels.target, minThreshold);
        await usdcToken.connect(addr3).approve(flashDuels.target, minThreshold);
        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);

        await flashDuels
          .connect(addr2)
          .joinDuel(duelIds[0], "Yes", 0, optionPrice, amount);

        await flashDuels
          .connect(addr3)
          .joinDuel(duelIds[0], "No", 1, optionPrice, amount);

        // Increase time to after the bootstrap period
        await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1]);
        await ethers.provider.send("evm_mine", []);

        // Attempt to cancel the duel
        await expect(
          flashDuels.connect(bot).cancelDuelIfThresholdNotMet(2, duelIds[0])
        ).to.be.revertedWith("Threshold met, cannot cancel");
      });

      it("should revert if non-bot tries to cancel the duel", async function () {
        await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1]);
        await ethers.provider.send("evm_mine", []);
        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);

        await expect(
          flashDuels.connect(addr1).cancelDuelIfThresholdNotMet(2, duelIds[0])
        ).to.be.revertedWithCustomError(flashDuels, "FlashDuels__InvalidBot");
      });
    });

    describe("Refund Duel", function () {
      const bootstrapPeriod = 3600; // Example bootstrap period of 1 hour
      let amount = ethers.parseUnits("70", 6);
      beforeEach(async function () {
        await flashDuels
          .connect(owner)
          .setMinimumWagerThreshold(ethers.parseUnits("80", 6));
        await usdcToken.connect(owner).mint(addr2.address, amount);

        await usdcToken.connect(addr2).approve(flashDuels.target, amount);

        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
        let BTC = tokenA;
        // await flashDuels.connect(addr2).joinDuel(duelIds[0], 0, amount);
        await flashDuels
          .connect(addr2)
          .joinDuel(duelIds[0], "Yes", 0, optionPrice, amount);

        await usdcToken.connect(owner).mint(addr3.address, amount);

        await usdcToken.connect(addr3).approve(flashDuels.target, amount);

        // await flashDuels.connect(addr3).joinDuel(duelIds[0], 1, amount);
        await flashDuels
          .connect(addr3)
          .joinDuel(duelIds[0], "No", 1, optionPrice, amount);

        await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1]);
        await ethers.provider.send("evm_mine", []);

        await flashDuels
          .connect(bot)
          .cancelDuelIfThresholdNotMet(2, duelIds[0]);
      });

      it("should refund users who wagered on option 1", async function () {
        const initialBalanceAddr2 = await usdcToken.balanceOf(addr1.address);
        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);

        let wagerAddr2 = await flashDuels.getWagerAmountDeposited(
          duelIds[0],
          addr2.address
        );
        // Refund addr1
        await flashDuels.connect(addr2).refundDuel(2, duelIds[0]);

        // Check that the wager was refunded
        const finalBalanceAddr2 = await usdcToken.balanceOf(addr2.address);
        expect(finalBalanceAddr2).to.equal(initialBalanceAddr2 + amount);

        // Ensure wager data is cleared
        const wager = await flashDuels.getWagerAmountDeposited(
          duelIds[0],
          addr2.address
        );
        expect(wager[2][0]).to.equal(0);
        expect(wager[2][1]).to.equal(0);
      });

      it("should refund users who wagered on option 2", async function () {
        const initialBalanceAddr3 = await usdcToken.balanceOf(addr3.address);
        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);

        let wagerAddr3 = await flashDuels.getWagerAmountDeposited(
          duelIds[0],
          addr3.address
        );
        // Refund addr3
        await flashDuels.connect(addr3).refundDuel(2, duelIds[0]);

        // Check that the wager was refunded
        const finalBalanceAddr3 = await usdcToken.balanceOf(addr3.address);
        expect(finalBalanceAddr3).to.equal(initialBalanceAddr3 + amount);

        // Ensure wager data is cleared
        const wager = await flashDuels.getWagerAmountDeposited(
          duelIds[0],
          addr3.address
        );
        expect(wager[2][0]).to.equal(0);
        expect(wager[2][1]).to.equal(0);
      });

      it("should revert if the duel is not cancelled", async function () {
        // Create a new duel that is not cancelled

        await usdcToken
          .connect(owner)
          .mint(addr1.address, ethers.parseUnits("10", 6));

        await usdcToken
          .connect(addr1)
          .approve(flashDuels.target, ethers.parseUnits("10", 6));
        let BTC = tokenA;
        topic = "Donald Trump will win the US election ?";
        let receipt = await flashDuels
          .connect(addr1)
          .createDuel(2, topic, ["Yes", "No"], minWager, expiryTime);
        let txr = await receipt.wait();
        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
        expect(duelIds.length).to.equal(2);
        expect(await flashDuels.isValidDuelId(duelIds[1])).to.be.equal(true);

        await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1]);
        await ethers.provider.send("evm_mine", []);

        await expect(
          flashDuels.connect(addr1).refundDuel(2, duelIds[1])
        ).to.be.revertedWith("Duel is live or settled");
      });
    });
  });

  describe("Crypto Duel Creation", function () {
    it("should create a crypto duel successfully", async function () {
      const duelDuration = 0; // 3 hours
      const minWager = ethers.parseUnits("10", 6); // 10 USDC
      await usdcToken
        .connect(owner)
        .mint(addr1.address, ethers.parseUnits("10", 6));
      await usdcToken
        .connect(addr1)
        .approve(flashDuels.target, ethers.parseUnits("10", 6));
      let receipt = await flashDuels.connect(addr1).createCryptoDuel(
        tokenA,
        // "BTC price will go beyond $65000.00",
        ["Yes", "No"],
        minWager,
        65000, // triggerValue
        0, // triggerType: aboslute
        0, // triggerCondition: Above
        duelDuration
      );

      let txr = await receipt.wait();
      // console.log(txr?.logs)
      // console.log("Total logs length: ", txr?.logs.length)
      let duelId;
      for (let i = 0; i < txr?.logs.length; i++) {
        if (txr?.logs[i]["args"]) {
          // console.log("duelId: ", txr?.logs[i]["args"][0]);
          duelId = txr?.logs[i]["args"][2];
        }
      }
      const duel = await flashDuels.cryptoDuels(duelId.toString());
      expect(duel.creator).to.equal(addr1.address);
      expect(duel.minWager).to.equal(minWager);
    });

    it("should fail if unsupported tokens are provided", async function () {
      const duelDuration = 0; // 3 hours
      const minWager = ethers.parseUnits("10", 6); // 10 USDC
      const RandomToken = await ethers.getContractFactory("MockERC20");
      randomToken = await RandomToken.deploy("Random Token", "RND", 18);
      await randomToken.waitForDeployment();

      await expect(
        flashDuels
          .connect(addr1)
          .createCryptoDuel(
            randomToken.target,
            ["Yes", "No"],
            minWager,
            65000,
            0,
            0,
            duelDuration
          )
      ).to.be.revertedWith("Unsupported token");
    });
  });

  describe("Crypto Duel Joining", function () {
    let cryptoDuelId: any;
    let duel: any;
    let topic: any;
    let duelDuration: any;
    let minWager: any;
    beforeEach(async function () {
      duelDuration = 0;
      minWager = ethers.parseUnits("10", 6); // 10 USDC
      await usdcToken
        .connect(owner)
        .mint(addr1.address, ethers.parseUnits("10", 6));
      await usdcToken
        .connect(addr1)
        .approve(flashDuels.target, ethers.parseUnits("10", 6));
      (topic = "BTC price will go beyond $65000.00"),
        await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);
      let BTC = tokenA;
      let receipt = await flashDuels
        .connect(addr1)
        .createCryptoDuel(
          BTC,
          ["Yes", "No"],
          minWager,
          65000,
          0,
          0,
          duelDuration
        );
      let txr = await receipt.wait();
      // console.log(txr?.logs)
      // console.log("Total logs length: ", txr?.logs.length)
      for (let i = 0; i < txr?.logs.length; i++) {
        if (txr?.logs[i]["args"]) {
          // console.log("duelId: ", txr?.logs[i]["args"][0]);
          cryptoDuelId = txr?.logs[i]["args"][2];
        }
      }
    });

    it("should allow users to join duels", async function () {
      const amount = ethers.parseUnits("60", 6);
      const optionPrice = ethers.parseUnits("10", 6);

      await usdcToken.connect(owner).mint(addr2.address, amount);
      await usdcToken.connect(owner).mint(addr3.address, amount);
      await usdcToken.connect(owner).mint(addr4.address, amount);

      // Approve token transfer
      await usdcToken.connect(addr2).approve(flashDuels.target, amount);
      await usdcToken.connect(addr3).approve(flashDuels.target, amount);
      await usdcToken.connect(addr4).approve(flashDuels.target, amount);

      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);
      let BTC = tokenA;

      // Join Duel with tokenA
      await flashDuels
        .connect(addr2)
        .joinCryptoDuel(duelIds[0], "Yes", BTC, 0, optionPrice, amount);
      await flashDuels
        .connect(addr3)
        .joinCryptoDuel(duelIds[0], "No", BTC, 1, optionPrice, amount);

      duel = await flashDuels.cryptoDuels(duelIds[0]);
      expect(duel.duelStatus).to.equal(1); // 1 represents the "BootStrapped" status

      await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);

      // Start the duel with the bot account
      await expect(flashDuels.connect(bot).startCryptoDuel(duelIds[0])).to.emit(
        flashDuels,
        "DuelStarted"
      );

      // Verify that the duel status has changed to "Live"
      duel = await flashDuels.cryptoDuels(duelIds[0]);
      expect(duel.duelStatus).to.equal(2); // 2 represents the "Live" status

      await flashDuels
        .connect(addr4)
        .joinCryptoDuel(duelIds[0], "No", BTC, 1, optionPrice, amount);
      const getDuelUsers = await flashDuels.getDuelUsersForOption(
        duelIds[0],
        "Yes"
      );
    });

    it("should allow only bot to start a duel", async function () {
      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);

      await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);

      // Attempt to start the duel with a non-bot account (should fail)
      await expect(
        flashDuels.connect(addr1).startCryptoDuel(duelIds[0])
      ).to.be.revertedWithCustomError(flashDuels, "FlashDuels__InvalidBot");
    });

    it("should fail if token is not part of the duel", async function () {
      const amount = ethers.parseUnits("60", 6);
      const optionPrice = ethers.parseUnits("10", 6);

      const RandomToken = await ethers.getContractFactory("MockERC20");
      const randomToken = await RandomToken.deploy("Random Token", "RND", 6);
      await randomToken.waitForDeployment();

      await randomToken.connect(owner).mint(addr2.address, amount);
      await randomToken.connect(addr2).approve(flashDuels.target, amount);

      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);

      await expect(
        flashDuels
          .connect(addr2)
          .joinCryptoDuel(
            duelIds[0],
            "No",
            randomToken.target,
            1,
            optionPrice,
            amount
          )
      ).to.be.revertedWith("Invalid token for this duel");
    });

    it("should fail if wager is below minimum", async function () {
      const amount = ethers.parseUnits("5", 6); // 5 USDC
      const optionPrice = ethers.parseUnits("1", 6); // 1 USDC

      await usdcToken.connect(owner).mint(addr2.address, amount);
      await usdcToken.connect(addr2).approve(flashDuels.target, amount);

      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);
      let BTC = tokenA;

      await expect(
        flashDuels
          .connect(addr2)
          .joinCryptoDuel(duelIds[0], "No", BTC, 1, optionPrice, amount)
      ).to.be.revertedWith("Wager below minimum");
    });
  });

  describe("Crypto Duel Settlement", function () {
    const amount = ethers.parseUnits("60", 6); // 60 USDC
    const optionPrice = ethers.parseUnits("10", 6); // 10 USDC
    let duelDuration: any;
    let minWager: any;

    beforeEach(async function () {
      duelDuration = 0;
      minWager = ethers.parseUnits("10", 6); // 10 USDC
      // Setup duels and join for settlement testing
      await usdcToken
        .connect(owner)
        .mint(addr1.address, ethers.parseUnits("10", 6));

      await usdcToken
        .connect(addr1)
        .approve(flashDuels.target, ethers.parseUnits("10", 6));
      let topic = "BTC price will go beyond $65000.00";

      await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);
      let BTC = tokenA;
      let receipt = await flashDuels
        .connect(addr1)
        .createCryptoDuel(
          BTC,
          ["Yes", "No"],
          minWager,
          65000,
          0,
          0,
          duelDuration
        );
      let txr = await receipt.wait();
      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);

      await usdcToken.connect(owner).mint(addr2.address, amount);
      await usdcToken.connect(owner).mint(addr3.address, amount);

      await usdcToken.connect(addr2).approve(flashDuels.target, amount);
      await usdcToken.connect(addr3).approve(flashDuels.target, amount);

      await flashDuels
        .connect(addr2)
        .joinCryptoDuel(duelIds[0], "Yes", BTC, 0, optionPrice, amount);
      await flashDuels
        .connect(addr3)
        .joinCryptoDuel(duelIds[0], "No", BTC, 1, optionPrice, amount);
    });

    it("should settle duel and distribute rewards", async function () {
      // Simulate time passage for the bootstrap period to end
      await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);

      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);

      await flashDuels.connect(bot).startCryptoDuel(duelIds[0]);

      // Simulate time passage for the duel to expire (6 hours)
      let time = 3600 * 6;
      await network.provider.request({
        method: "evm_increaseTime",
        params: [time],
      });
      await network.provider.send("evm_mine");

      // Set mock prices so tokenB wins
      await mockOracleB.setPrice(2000); // Price for tokenB
      await mockOracleA.setPrice(66000); // Price for tokenA

      const duelIdToOptions = await flashDuels.getDuelIdToOptions(duelIds[0]);

      await expect(flashDuels.connect(bot).settleCryptoDuel(duelIds[0]))
        .to.emit(flashDuels, "DuelSettled")
        .withArgs(duelIds[0], duelIdToOptions[0], 0); // Assume tokenB wins based on mock prices

      // Verify duel status
      const duel = await flashDuels.cryptoDuels(duelIds[0]);
      expect(duel.duelStatus).to.equal(3); // 3 represents the "Settled" status
    });
  });

  describe("Crypto Duel Settlement with Reward Distribution", function () {
    const amount = ethers.parseUnits("60", 6); // 60 USDC
    const optionPrice = ethers.parseUnits("10", 6); // 10 USDC
    let duelDuration: any;
    let minWager: any;

    beforeEach(async function () {
      duelDuration = 0;
      minWager = ethers.parseUnits("10", 6); // 10 USDC
      // Setup duels and join for settlement testing
      await usdcToken
        .connect(owner)
        .mint(addr1.address, ethers.parseUnits("10", 6));

      await usdcToken
        .connect(addr1)
        .approve(flashDuels.target, ethers.parseUnits("10", 6));
      let topic = "BTC price will go beyond $65000.00";

      await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);
      let BTC = tokenA;
      let receipt = await flashDuels
        .connect(addr1)
        .createCryptoDuel(
          BTC,
          ["Yes", "No"],
          minWager,
          65000,
          0,
          0,
          duelDuration
        );
      let txr = await receipt.wait();
      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);

      await usdcToken.connect(owner).mint(addr2.address, amount);
      await usdcToken.connect(owner).mint(addr3.address, amount);

      await usdcToken.connect(addr2).approve(flashDuels.target, amount);
      await usdcToken.connect(addr3).approve(flashDuels.target, amount);

      await flashDuels
        .connect(addr2)
        .joinCryptoDuel(duelIds[0], "Yes", BTC, 0, optionPrice, amount);

      await flashDuels
        .connect(addr3)
        .joinCryptoDuel(duelIds[0], "No", BTC, 1, optionPrice, amount);
    });

    it("should settle duel and distribute rewards correctly to winner", async function () {
      // Simulate time passage for the bootstrap period to end
      await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);

      // Set mock prices so tokenB wins
      await mockOracleB.setPrice(2000); // Price for tokenB
      await mockOracleA.setPrice(66000); // Price for tokenA

      // Check balances before settlement
      const initialBalanceAddr2 = await usdcToken.balanceOf(addr2.address); // 0
      const initialBalanceAddr3 = await usdcToken.balanceOf(addr3.address); // 0
      await network.provider.send("evm_mine");

      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);

      await flashDuels.connect(bot).startCryptoDuel(duelIds[0]);

      let time = 3600 * 6;
      await network.provider.request({
        method: "evm_increaseTime",
        params: [time],
      });
      // await helpers.time.increase(time)

      // Settle the duel
      await flashDuels.connect(bot).settleCryptoDuel(duelIds[0]);

      // Check balances after settlement
      let finalBalanceAddr2 = await usdcToken.balanceOf(addr2.address);
      let finalBalanceAddr3 = await usdcToken.balanceOf(addr3.address);
      expect(finalBalanceAddr2).to.be.equal("0");
      expect(finalBalanceAddr3).to.be.equal("0");

      let allTImeEarningsAddr2 = await flashDuels.allTimeEarnings(
        addr2.address
      );
      let allTImeEarningsAddr3 = await flashDuels.allTimeEarnings(
        addr3.address
      );

      await flashDuels.connect(addr2).withdrawEarnings(allTImeEarningsAddr2);

      // Check if addr2 (winner) received the rewards
      finalBalanceAddr2 = await usdcToken.balanceOf(addr2.address);
      expect(finalBalanceAddr2).to.be.gt(initialBalanceAddr2); // addr2's balance should increase
      // Check if addr3 (loser) lost their wager amount
      expect(finalBalanceAddr3).to.be.lte(initialBalanceAddr3); // addr3's balance should decrease or remain the same
    });

    it("should not change wallet balance if duel is not settled", async function () {
      const initialBalanceAddr2 = await usdcToken.balanceOf(addr2.address);
      const initialBalanceAddr3 = await usdcToken.balanceOf(addr3.address);

      // No settlement is triggered, balances should remain the same
      expect(await usdcToken.balanceOf(addr2.address)).to.equal(
        initialBalanceAddr2
      );
      expect(await usdcToken.balanceOf(addr3.address)).to.equal(
        initialBalanceAddr3
      );
    });
  });

  describe("Crypto Duel Cancel and Refund Logic", function () {
    const bootstrapPeriod = 1800; // Example bootstrap period of 1 hour
    const minThreshold = ethers.parseUnits("100", 6); // Example threshold of 100 USDC
    let amount = ethers.parseUnits("60", 6); // 60 USDC
    let optionPrice = ethers.parseUnits("10", 6); // 10 USDC
    let duelDuration: any;
    let minWager: any;
    let topic: any;

    beforeEach(async function () {
      // Setup duels and join for settlement testing
      duelDuration = 0;
      minWager = ethers.parseUnits("10", 6); // 10 USDC
      await usdcToken
        .connect(owner)
        .mint(addr1.address, ethers.parseUnits("10", 6));

      await usdcToken
        .connect(addr1)
        .approve(flashDuels.target, ethers.parseUnits("10", 6));
      await ethers.provider.send("evm_increaseTime", [30 * 60]);
      await ethers.provider.send("evm_mine", []);
      let BTC = tokenA;
      topic = "BTC price will go beyond $65000.00";
      let receipt = await flashDuels
        .connect(addr1)
        .createCryptoDuel(
          BTC,
          ["Yes", "No"],
          minWager,
          65000,
          0,
          0,
          duelDuration
        );
      let txr = await receipt.wait();
      const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
      expect(duelIds.length).to.equal(1);
      expect(await flashDuels.isValidDuelId(duelIds[0])).to.be.equal(true);
    });

    describe("Cancel Duel if Threshold Not Met", function () {
      it("should cancel the duel if the threshold is not met after the bootstrap period", async function () {
        // Increase time to after the bootstrap period
        await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1]);
        await ethers.provider.send("evm_mine", []);
        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);

        // Check that the duel exists and hasn't started yet
        const duel = await flashDuels.cryptoDuels(duelIds[0]);
        expect(duel.duelStatus).to.equal(1); // BootStrapped status

        // Call cancelDuelIfThresholdNotMet by the bot
        await flashDuels
          .connect(bot)
          .cancelDuelIfThresholdNotMet(1, duelIds[0]);

        // Validate the duel status is updated to Cancelled
        const cancelledDuel = await flashDuels.cryptoDuels(duelIds[0]);
        expect(cancelledDuel.duelStatus).to.equal(4); // Cancelled status
      });

      it("should not cancel duel if the threshold is met", async function () {
        // Simulate meeting the threshold
        await usdcToken.connect(owner).mint(addr2.address, minThreshold);
        await usdcToken.connect(owner).mint(addr3.address, minThreshold);

        await usdcToken.connect(addr2).approve(flashDuels.target, minThreshold);
        await usdcToken.connect(addr3).approve(flashDuels.target, minThreshold);
        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
        let BTC = tokenA;
        await flashDuels
          .connect(addr2)
          .joinCryptoDuel(duelIds[0], "Yes", BTC, 0, optionPrice, amount);

        await flashDuels
          .connect(addr3)
          .joinCryptoDuel(duelIds[0], "No", BTC, 1, optionPrice, amount);

        // Increase time to after the bootstrap period
        await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1]);
        await ethers.provider.send("evm_mine", []);

        // Attempt to cancel the duel
        await expect(
          flashDuels.connect(bot).cancelDuelIfThresholdNotMet(1, duelIds[0])
        ).to.be.revertedWith("Threshold met, cannot cancel");
      });

      it("should revert if non-bot tries to cancel the duel", async function () {
        await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1]);
        await ethers.provider.send("evm_mine", []);
        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);

        await expect(
          flashDuels.connect(addr1).cancelDuelIfThresholdNotMet(1, duelIds[0])
        ).to.be.revertedWithCustomError(flashDuels, "FlashDuels__InvalidBot");
      });
    });

    describe("Refund Duel", function () {
      const bootstrapPeriod = 3600; // Example bootstrap period of 1 hour
      let amount = ethers.parseUnits("70", 6);
      beforeEach(async function () {
        await flashDuels
          .connect(owner)
          .setMinimumWagerThreshold(ethers.parseUnits("80", 6));
        await usdcToken.connect(owner).mint(addr2.address, amount);

        await usdcToken.connect(addr2).approve(flashDuels.target, amount);

        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
        let BTC = tokenA;
        await flashDuels
          .connect(addr2)
          .joinCryptoDuel(duelIds[0], "Yes", BTC, 0, optionPrice, amount);
        await usdcToken.connect(owner).mint(addr3.address, amount);

        await usdcToken.connect(addr3).approve(flashDuels.target, amount);

        await flashDuels
          .connect(addr3)
          .joinCryptoDuel(duelIds[0], "No", BTC, 1, optionPrice, amount);

        await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1]);
        await ethers.provider.send("evm_mine", []);

        await flashDuels
          .connect(bot)
          .cancelDuelIfThresholdNotMet(1, duelIds[0]);
      });

      it("should refund users who wagered on option 1", async function () {
        const initialBalanceAddr2 = await usdcToken.balanceOf(addr1.address);
        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);

        let wagerAddr2 = await flashDuels.getWagerAmountDeposited(
          duelIds[0],
          addr2.address
        );
        // Refund addr1
        await flashDuels.connect(addr2).refundDuel(1, duelIds[0]);

        // Check that the wager was refunded
        const finalBalanceAddr2 = await usdcToken.balanceOf(addr2.address);
        expect(finalBalanceAddr2).to.equal(initialBalanceAddr2 + amount);

        // Ensure wager data is cleared
        const wager = await flashDuels.getWagerAmountDeposited(
          duelIds[0],
          addr2.address
        );
        expect(wager[2][0]).to.equal(0);
        expect(wager[2][1]).to.equal(0);
      });

      it("should refund users who wagered on option 2", async function () {
        const initialBalanceAddr3 = await usdcToken.balanceOf(addr3.address);
        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);

        let wagerAddr3 = await flashDuels.getWagerAmountDeposited(
          duelIds[0],
          addr3.address
        );
        // Refund addr3
        await flashDuels.connect(addr3).refundDuel(1, duelIds[0]);

        // Check that the wager was refunded
        const finalBalanceAddr3 = await usdcToken.balanceOf(addr3.address);
        expect(finalBalanceAddr3).to.equal(initialBalanceAddr3 + amount);

        // Ensure wager data is cleared
        const wager = await flashDuels.getWagerAmountDeposited(
          duelIds[0],
          addr3.address
        );
        expect(wager[2][0]).to.equal(0);
        expect(wager[2][1]).to.equal(0);
      });

      it("should revert if the duel is not cancelled", async function () {
        // Create a new duel that is not cancelled

        await usdcToken
          .connect(owner)
          .mint(addr1.address, ethers.parseUnits("10", 6));

        await usdcToken
          .connect(addr1)
          .approve(flashDuels.target, ethers.parseUnits("10", 6));
        let BTC = tokenA;
        topic = "BTC price will go beyond $65000.00";
        let receipt = await flashDuels
          .connect(addr1)
          .createCryptoDuel(
            BTC,
            ["Yes", "No"],
            minWager,
            65000,
            0,
            0,
            duelDuration
          );
        let txr = await receipt.wait();
        const duelIds = await flashDuels.getCreatorToDuelIds(addr1.address);
        expect(duelIds.length).to.equal(2);
        expect(await flashDuels.isValidDuelId(duelIds[1])).to.be.equal(true);

        await ethers.provider.send("evm_increaseTime", [bootstrapPeriod + 1]);
        await ethers.provider.send("evm_mine", []);

        await expect(
          flashDuels.connect(addr1).refundDuel(1, duelIds[1])
        ).to.be.revertedWith("Duel is live or settled");
      });
    });
  });
});

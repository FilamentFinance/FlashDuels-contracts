const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("MockOracle", function () {
    let mockOracle: any

    before(async function () {
        const MockOracleFactory = await ethers.getContractFactory("MockOracle")
        mockOracle = await MockOracleFactory.deploy()
        await mockOracle.waitForDeployment()
    })

    it("should set and return the correct price", async function () {
        // Set the mock price to 2000 (e.g., $2000 in USD)
        await mockOracle.setPrice(2000)

        // Fetch the price from the mock oracle
        const price = await mockOracle.latestAnswer()
        expect(price).to.equal(2000)
    })

    it("should return correct data from latestRoundData", async function () {
        // Set the mock price to 1500
        await mockOracle.setPrice(1500)

        // Fetch the full data from the oracle
        const [roundId, answer, startedAt, updatedAt] = await mockOracle.latestRoundData()
        expect(answer).to.equal(1500)
    })
})

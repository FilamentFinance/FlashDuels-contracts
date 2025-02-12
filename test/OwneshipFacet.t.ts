import { expect } from "chai"
import { contracts } from "../typechain-types"
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { ethers, upgrades, network } from "hardhat"
import { networkConfig, testNetworkChains } from "../helper-hardhat-config"
const helpers = require("@nomicfoundation/hardhat-network-helpers")
import { setupContracts } from "./testSetup"

describe("OwnershipFacet", function () {
  let OwnershipFacet: any, owner: any, addr1: any, addr2: any;

  async function deploy() {
    const accounts = await ethers.getSigners()
    const contracts = await setupContracts()
    owner = accounts[0]
    addr1 = accounts[1]
    addr2 = accounts[2]
    return { contracts, accounts }
}

  it("should transfer ownership", async function () {
    const { contracts, accounts } = await loadFixture(deploy)
    OwnershipFacet = await contracts.OwnershipFacet.ownershipFacetContract.attach(
      contracts.Diamond.diamond
    )
    await OwnershipFacet.transferOwnership(addr1.address);
    expect(await OwnershipFacet.pendingOwner()).to.equal(addr1.address);
  });

  it("should allow pending owner to accept ownership", async function () {
    const { contracts, accounts } = await loadFixture(deploy)
    OwnershipFacet = await contracts.OwnershipFacet.ownershipFacetContract.attach(
      contracts.Diamond.diamond
    )
    await OwnershipFacet.transferOwnership(addr1.address);
    await OwnershipFacet.connect(addr1).acceptOwnership();
    expect(await OwnershipFacet.owner()).to.equal(addr1.address);
  });

  it("should not allow non-owner to transfer ownership", async function () {
    const { contracts, accounts } = await loadFixture(deploy)
    OwnershipFacet = await contracts.OwnershipFacet.ownershipFacetContract.attach(
      contracts.Diamond.diamond
    )
    await expect(
      OwnershipFacet.connect(addr1).transferOwnership(addr2.address)
    ).to.be.revertedWith("LibDiamond: Must be contract owner");
  });

  it("should not allow non-pending owner to accept ownership", async function () {
    const { contracts, accounts } = await loadFixture(deploy)
    OwnershipFacet = await contracts.OwnershipFacet.ownershipFacetContract.attach(
      contracts.Diamond.diamond
    )
    await OwnershipFacet.transferOwnership(addr1.address);
    await expect(
      OwnershipFacet.connect(addr2).acceptOwnership()
    ).to.be.revertedWithCustomError(OwnershipFacet, "OwnableUnauthorizedAccount");
  });

  it("should emit OwnershipTransferred event", async function () {
    const { contracts, accounts } = await loadFixture(deploy)
    OwnershipFacet = await contracts.OwnershipFacet.ownershipFacetContract.attach(
      contracts.Diamond.diamond
    )
    await OwnershipFacet.transferOwnership(addr1.address);
    await expect(OwnershipFacet.connect(addr1).acceptOwnership())
      .to.emit(OwnershipFacet, "OwnershipTransferred")
      .withArgs(owner.address, addr1.address);
  });
});
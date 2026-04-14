import { network } from "hardhat";
import { describe, it, beforeEach } from "mocha";
import { expect } from "chai";

describe("AMM simple tests with Viem", function () {
  let publicClient: any;
  let walletClient: any;
  let owner: any;

  let tokenA: any;
  let tokenB: any;
  let amm: any;

  beforeEach(async () => {
    // Connect to Hardhat OP network
    const { viem } = await network.connect({
      network: "hardhatOp",
      chainType: "op",
    });

    publicClient = await viem.getPublicClient();
    [walletClient] = await viem.getWalletClients();

    owner = walletClient.account;

    // Deploy ERC20 tokens
    const ERC20Factory = await walletClient.getContractFactory("ERC20");
    tokenA = await ERC20Factory.deploy("Token A", "TKA");
    tokenB = await ERC20Factory.deploy("Token B", "TKB");

    // Mint tokens to owner
    await tokenA.mint(owner.address, 1_000n * 10n ** 18n);
    await tokenB.mint(owner.address, 1_000n * 10n ** 18n);

    // Deploy AMM
    const AMMFactory = await walletClient.getContractFactory("AMM");
    amm = await AMMFactory.deploy(tokenA.target, tokenB.target);
  });

  it("adds liquidity", async () => {
    await tokenA.approve(amm.target, 100n * 10n ** 18n);
    await tokenB.approve(amm.target, 100n * 10n ** 18n);

    const lpMinted = await amm.callStatic.addLiquidity(
      100n * 10n ** 18n,
      100n * 10n ** 18n
    );

    await amm.addLiquidity(100n * 10n ** 18n, 100n * 10n ** 18n);

    const balance = await amm.balanceOf(owner.address);
    expect(balance).to.equal(lpMinted);
  });

  it("performs a simple swap A → B", async () => {
    // First add liquidity
    await tokenA.approve(amm.target, 100n * 10n ** 18n);
    await tokenB.approve(amm.target, 100n * 10n ** 18n);
    await amm.addLiquidity(100n * 10n ** 18n, 100n * 10n ** 18n);

    // Swap 10 A → B
    const amountBOut = await amm.callStatic.swapAforB(10n * 10n ** 18n, 0n);
    await amm.swapAforB(10n * 10n ** 18n, 0n);

    const newReserves = await amm.getReserves();
    expect(newReserves[0]).to.equal(110n * 10n ** 18n); // 100 + 10
    expect(newReserves[1]).to.equal(100n * 10n ** 18n - amountBOut);
  });
});
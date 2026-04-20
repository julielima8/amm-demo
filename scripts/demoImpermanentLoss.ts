import { network } from "hardhat";
import { parseUnits, formatUnits } from "viem";

const DECIMALS = 18;

function fmt(x: bigint) {
  return formatUnits(x, DECIMALS);
}

async function main() {
  const { viem, networkName } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [wallet] = await viem.getWalletClients();
  const user = wallet.account.address;

  console.log("=== DEMO: IMPERMANENT LOSS ===");

  // -------------------------
  // DEPLOY FRESH CONTRACTS
  // -------------------------
  console.log("\nDeploying fresh TokenA, TokenB, and AMM...");

  const tokenA = await viem.deployContract("TokenA", []);
  const tokenB = await viem.deployContract("TokenB", []);
  const amm = await viem.deployContract("AMM", [
    tokenA.address,
    tokenB.address,
  ]);

  // -------------------------
  // INITIALIZE CLEAN POOL
  // -------------------------
  const amountA = parseUnits("1000", DECIMALS);
  const amountB = parseUnits("1000", DECIMALS);

  console.log("\nAdding initial liquidity: 1000 A + 1000 B");

  const approveAHash = await tokenA.write.approve([amm.address, amountA]);
  await publicClient.waitForTransactionReceipt({ hash: approveAHash });

  const approveBHash = await tokenB.write.approve([amm.address, amountB]);
  await publicClient.waitForTransactionReceipt({ hash: approveBHash });

  const addLiquidityHash = await amm.write.addLiquidity([amountA, amountB]);
  await publicClient.waitForTransactionReceipt({ hash: addLiquidityHash });

  let reserves = await amm.read.getReserves();
  console.log("Initial reserves:", fmt(reserves[0]), "A,", fmt(reserves[1])), "B";

  const lp = await amm.read.balanceOf([user]);
  const total = await amm.read.totalSupply();

  console.log("LP balance:", fmt(lp));
  console.log("Total LP supply:", fmt(total));

  // -------------------------
  // SIMULATE EXTERNAL PRICE MOVE
  // -------------------------
  console.log("\nAssume external market price changes so that 1 A = 2 B.");
  console.log("Arbitrage traders swap B for A in AMM until spot price matches external price.");

  const arbIn = parseUnits("500", DECIMALS);

  const approveArbHash = await tokenB.write.approve([amm.address, arbIn]);
  await publicClient.waitForTransactionReceipt({ hash: approveArbHash });

  const arbSwapHash = await amm.write.swapBforA([arbIn, 0n]);
  await publicClient.waitForTransactionReceipt({ hash: arbSwapHash });

  reserves = await amm.read.getReserves();
  console.log("Post-arbitrage reserves:", fmt(reserves[0]), "A,", fmt(reserves[1])), "B";

  // -------------------------
  // COMPARE LP VALUE VS holding
  // -------------------------
  const share = Number(lp) / Number(total);

  const reserveAFloat = Number(formatUnits(reserves[0], DECIMALS));
  const reserveBFloat = Number(formatUnits(reserves[1], DECIMALS));

  // Demo assumption: external price is now 1 A = 2 B
  const lpValue = share * (reserveAFloat * 2 + reserveBFloat);

  // If user had simply held 1000 A and 1000 B:
  const hodlValue = 1000 * 2 + 1000;

  console.log("\nValue comparison:");
  console.log("LP value:", lpValue.toFixed(6));
  console.log("Value if had held outside of AMM:", hodlValue.toFixed(6));
  console.log("Impermanent loss:", (hodlValue - lpValue).toFixed(6));

  console.log("\nConclusion:");
  console.log("- LP underperforms HODL after the price move.");
  console.log("- This underperformance is impermanent loss.");
  console.log("- The loss is only realized if the LP liquidates their shares from the pool.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
import { formatUnits } from "viem";
import { fmt, getAmountOut, getContracts, toWei } from "./helpers.js";

function spotPrice(reserveA: bigint, reserveB: bigint): number {
  return Number(formatUnits(reserveB, 18)) / Number(formatUnits(reserveA, 18));
}

function executionPrice(amountIn: bigint, amountOut: bigint): number {
  return Number(formatUnits(amountOut, 18)) / Number(formatUnits(amountIn, 18));
}

async function main() {
  const { publicClient, tokenA, amm } = await getContracts();

  console.log("=== DEMO: PRICE IMPACT & SLIPPAGE ===");

  let reserves = await amm.read.getReserves();
  let startSpot = spotPrice(reserves[0], reserves[1]);

  // -------------------------
  // SMALL SWAP
  // -------------------------
  const smallIn = toWei("10");
  const idealSmallOut = 10 * startSpot;
  const actualSmallOut = getAmountOut(smallIn, reserves[0], reserves[1]);
  const smallExec = executionPrice(smallIn, actualSmallOut);

  console.log("\nSmall swap (10 A)");
  console.log(`Spot price before swap: ${startSpot.toFixed(6)} B per A`);
  console.log(`Expected # of tokens received: ${idealSmallOut.toFixed(6)} B`);
  console.log(`Actual # of tokens received: ${fmt(actualSmallOut)} B`);
  console.log(`Actual execution price: ${smallExec.toFixed(6)} B per A`);
  console.log(
    `** Slippage: ${(((startSpot - smallExec) / startSpot) * 100).toFixed(4)}%`
  );

  const approveSmallHash = await tokenA.write.approve([amm.address, smallIn]);
  await publicClient.waitForTransactionReceipt({ hash: approveSmallHash });

  const smallSwapHash = await amm.write.swapAforB([smallIn, 0n]);
  await publicClient.waitForTransactionReceipt({ hash: smallSwapHash });

  reserves = await amm.read.getReserves();
  let endSpot = spotPrice(reserves[0], reserves[1]);

  // -------------------------
  // LARGE SWAP
  // -------------------------
  const largeIn = toWei("300");
  startSpot = endSpot;

  const idealLargeOut = 300 * startSpot;
  const actualLargeOut = getAmountOut(largeIn, reserves[0], reserves[1]);
  const largeExec = executionPrice(largeIn, actualLargeOut);

  console.log("\nLarge swap (300 A)");
  console.log(`Spot price before: ${startSpot.toFixed(6)} B per A`);
  console.log(`Expected # of tokens received: ${idealLargeOut.toFixed(6)} B`);
  console.log(`Actual # of tokens received: ${fmt(actualLargeOut)} B`);
  console.log(`Actual execution price: ${largeExec.toFixed(6)} B per A`);
  console.log(
    `** Slippage: ${(((startSpot - largeExec) / startSpot) * 100).toFixed(4)}%`
  );

  const approveLargeHash = await tokenA.write.approve([amm.address, largeIn]);
  await publicClient.waitForTransactionReceipt({ hash: approveLargeHash });

  const largeSwapHash = await amm.write.swapAforB([largeIn, 0n]);
  await publicClient.waitForTransactionReceipt({ hash: largeSwapHash });

  reserves = await amm.read.getReserves();
  endSpot = spotPrice(reserves[0], reserves[1]);

  console.log("\nTakeaway:");
  console.log("- Execution price is the average price the trader actually spends over all infinitesimal shares.");
  console.log("- Larger trades move further along the x*y=k curve.");
  console.log("- That is why larger trades have worse execution.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
import { network } from "hardhat";
import { parseUnits, formatUnits } from "viem";

const DECIMALS = 18;

function fmt(x: bigint) {
  return formatUnits(x, DECIMALS);
}

// constant product helper
function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint) {
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [wallet] = await viem.getWalletClients();
  const user = wallet.account.address;

  // Deploy fresh contracts
  const tokenA = await viem.deployContract("TokenA", []);
  const tokenB = await viem.deployContract("TokenB", []);
  const amm = await viem.deployContract("AMM", [
    tokenA.address,
    tokenB.address,
  ]);

  console.log("=== DEPLOYED ===");
  console.log("TokenA:", tokenA.address);
  console.log("TokenB:", tokenB.address);
  console.log("AMM:", amm.address);

  // Assume tokens already minted to user in constructor

  // -------------------------
  // DEMO 1: ADD LIQUIDITY
  // -------------------------
  console.log("\n=== DEMO 1: ADD LIQUIDITY ===");

  let reserves = await amm.read.getReserves();
  console.log("Initial reserves:", reserves);

  const amountA = parseUnits("1000", DECIMALS);
  const amountB = parseUnits("1000", DECIMALS);

  await tokenA.write.approve([amm.address, amountA]);
  await tokenB.write.approve([amm.address, amountB]);

  await amm.write.addLiquidity([amountA, amountB]);

  reserves = await amm.read.getReserves();
  const lpBalance = await amm.read.balanceOf([user]);

  console.log("Reserves after:", fmt(reserves[0]), fmt(reserves[1]));
  console.log("LP tokens minted:", fmt(lpBalance));

  // -------------------------
  // DEMO 2: PRICE IMPACT
  // -------------------------
  console.log("\n=== DEMO 2: PRICE IMPACT ===");

  function logPrice(label: string, rA: bigint, rB: bigint) {
    const price = Number(rB) / Number(rA);
    console.log(`${label} price (B per A):`, price.toFixed(4));
  }

  reserves = await amm.read.getReserves();
  logPrice("Initial", reserves[0], reserves[1]);

  // SMALL SWAP (10 A)
  const smallIn = parseUnits("10", DECIMALS);
  await tokenA.write.approve([amm.address, smallIn]);

  const expectedSmallOut = getAmountOut(
    smallIn,
    reserves[0],
    reserves[1]
  );

  console.log("\nSmall swap (10 A):");
  console.log("Expected out:", fmt(expectedSmallOut));

  await amm.write.swapAforB([smallIn, 0n]);

  let newReserves = await amm.read.getReserves();
  logPrice("After small swap", newReserves[0], newReserves[1]);

  // LARGE SWAP (300 A)
  const largeIn = parseUnits("300", DECIMALS);
  await tokenA.write.approve([amm.address, largeIn]);

  const expectedLargeOut = getAmountOut(
    largeIn,
    newReserves[0],
    newReserves[1]
  );

  console.log("\nLarge swap (300 A):");
  console.log("Expected out:", fmt(expectedLargeOut));

  await amm.write.swapAforB([largeIn, 0n]);

  newReserves = await amm.read.getReserves();
  logPrice("After large swap", newReserves[0], newReserves[1]);

  console.log("\nNotice:");
  console.log("- Large trade gets worse price");
  console.log("- This is price impact from x*y=k");

  // -------------------------
  // DEMO 3: IMPERMANENT LOSS
  // -------------------------
  console.log("\n=== DEMO 3: IMPERMANENT LOSS ===");

  // Reset pool for clean example
  console.log("\nResetting pool...");
  const tokenA2 = await viem.deployContract("TokenA", []);
  const tokenB2 = await viem.deployContract("TokenB", []);
  const amm2 = await viem.deployContract("AMM", [
    tokenA2.address,
    tokenB2.address,
  ]);

  const amt = parseUnits("1000", DECIMALS);

  await tokenA2.write.approve([amm2.address, amt]);
  await tokenB2.write.approve([amm2.address, amt]);
  await amm2.write.addLiquidity([amt, amt]);

  let r = await amm2.read.getReserves();

  console.log("Initial reserves:", fmt(r[0]), fmt(r[1]));

  // Simulate price doubling externally (A doubles vs B)
  console.log("\nSimulating external price: A doubles");

  // Arbitrage pushes pool to new ratio ~ 2:1
  // (simulate by swapping B -> A repeatedly)
  const arbIn = parseUnits("500", DECIMALS);
  await tokenB2.write.approve([amm2.address, arbIn]);
  await amm2.write.swapBforA([arbIn, 0n]);

  r = await amm2.read.getReserves();

  console.log("Post-arbitrage reserves:", fmt(r[0]), fmt(r[1]));

  // LP withdrawal value
  const lp = await amm2.read.balanceOf([user]);
  const total = await amm2.read.totalSupply();

  // convert LP share safely
  const share = Number(lp) / Number(total);

  // convert reserves from wei → tokens
  const rA = Number(formatUnits(r[0], 18));
  const rB = Number(formatUnits(r[1], 18));

  // A doubled in price → 1 A = 2 B
  const valueLP = share * (rA * 2 + rB);

  // HODL value (already in token units, so this is fine)
  const hodlValue = 1000 * 2 + 1000;

  console.log("\nValue comparison:");
  console.log("LP value:", valueLP.toFixed(2));
  console.log("HODL value:", hodlValue.toFixed(2));

  console.log("\nConclusion:");
  console.log("- LP underperforms HODL when price moves");
  console.log("- This is impermanent loss");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
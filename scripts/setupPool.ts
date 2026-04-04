import { network } from "hardhat";
import { formatUnits, parseUnits } from "viem";

const TOKEN_A_ADDRESS = "0x56b9B64430dF15A189326A63Fabe7eaDeF652B2A";
const TOKEN_B_ADDRESS = "0xA2c868a189391c369635f2759DE273b19633Cb84";
const AMM_ADDRESS = "0xcd63d4c4B7F541Ba541f44cE002193b2E96f3a16";

// INITIAL LIQUIDITY TO ADD
const AMOUNT_A = "1000";
const AMOUNT_B = "1000";

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const user = walletClient.account.address;
  console.log("Using account:", user);

  // Get typed contract instances
  const tokenA = await viem.getContractAt("TokenA", TOKEN_A_ADDRESS);
  const tokenB = await viem.getContractAt("TokenB", TOKEN_B_ADDRESS);
  const amm = await viem.getContractAt("AMM", AMM_ADDRESS);

  // Assume standard ERC-20 decimals = 18
  const decimalsA = await tokenA.read.decimals();
  const decimalsB = await tokenB.read.decimals();

  const amountA = parseUnits(AMOUNT_A, decimalsA);
  const amountB = parseUnits(AMOUNT_B, decimalsB);

  console.log(`Preparing to add liquidity:`);
  console.log(`  TokenA: ${AMOUNT_A}`);
  console.log(`  TokenB: ${AMOUNT_B}`);

  // Check wallet balances first
  const balA = await tokenA.read.balanceOf([user]);
  const balB = await tokenB.read.balanceOf([user]);

  console.log("\nWallet balances before:");
  console.log(`  TokenA: ${formatUnits(balA, decimalsA)}`);
  console.log(`  TokenB: ${formatUnits(balB, decimalsB)}`);

  if (balA < amountA) {
    throw new Error("Insufficient TokenA balance");
  }
  if (balB < amountB) {
    throw new Error("Insufficient TokenB balance");
  }

  // Approve AMM to spend tokens
  console.log("\nApproving TokenA...");
  const approveAHash = await tokenA.write.approve([AMM_ADDRESS, amountA]);
  await publicClient.waitForTransactionReceipt({ hash: approveAHash });
  console.log("  TokenA approved:", approveAHash);

  console.log("Approving TokenB...");
  const approveBHash = await tokenB.write.approve([AMM_ADDRESS, amountB]);
  await publicClient.waitForTransactionReceipt({ hash: approveBHash });
  console.log("  TokenB approved:", approveBHash);

  // Add liquidity
  console.log("\nAdding liquidity...");
  const addLiquidityHash = await amm.write.addLiquidity([amountA, amountB]);
  const addLiquidityReceipt = await publicClient.waitForTransactionReceipt({
    hash: addLiquidityHash,
  });

  console.log("  addLiquidity tx:", addLiquidityHash);
  console.log("  status:", addLiquidityReceipt.status);

  // Read updated state
  const reserves = await amm.read.getReserves();
  const lpBalance = await amm.read.balanceOf([user]);
  const totalLpSupply = await amm.read.totalSupply();

  const balAAfter = await tokenA.read.balanceOf([user]);
  const balBAfter = await tokenB.read.balanceOf([user]);

  console.log("\nPool state after adding liquidity:");
  console.log(`  reserveA: ${formatUnits(reserves[0], decimalsA)}`);
  console.log(`  reserveB: ${formatUnits(reserves[1], decimalsB)}`);

  console.log("\nLP token state:");
  console.log(`  Your LP balance: ${formatUnits(lpBalance, 18)}`);
  console.log(`  Total LP supply: ${formatUnits(totalLpSupply, 18)}`);

  console.log("\nWallet balances after:");
  console.log(`  TokenA: ${formatUnits(balAAfter, decimalsA)}`);
  console.log(`  TokenB: ${formatUnits(balBAfter, decimalsB)}`);

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
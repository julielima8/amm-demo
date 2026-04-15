import { network } from "hardhat";
import { expect } from "chai";
import TokenAArtifact from "../artifacts/contracts/TokenA.sol/TokenA.json" assert { type: "json" };
import TokenBArtifact from "../artifacts/contracts/TokenB.sol/TokenB.json" assert { type: "json" };
import AMMArtifact from "../artifacts/contracts/SimpleAMM.sol/AMM.json" assert { type: "json" };

const tokenAAbi = TokenAArtifact.abi;
const tokenABytecode = TokenAArtifact.bytecode;

const tokenBAbi = TokenBArtifact.abi;
const tokenBBytecode = TokenBArtifact.bytecode;

const ammAbi = AMMArtifact.abi;
const ammBytecode = AMMArtifact.bytecode;

async function setup() {
  const connection = await network.connect({ network: "hardhatMainnet" });

  const { viem } = connection;
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const user = walletClient.account.address;

  return { connection, publicClient, walletClient, user };
}

async function main() {
  console.log("🚀 Starting AMM viem tests...");

  const { publicClient, walletClient, user } = await setup();

  // -----------------------------
  // Deploy mock tokens
  // -----------------------------
  const tokenAHash = await walletClient.deployContract({
    abi: tokenAAbi,
    bytecode: tokenABytecode,
  });

  const tokenAReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenAHash });
  const tokenAAddress = tokenAReceipt.contractAddress;

  const tokenBHash = await walletClient.deployContract({
    abi: tokenBAbi,
    bytecode: tokenBBytecode,
  });

  const tokenBReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenBHash });
  const tokenBAddress = tokenBReceipt.contractAddress;

  // Mint
  await walletClient.writeContract({
    address: tokenAAddress,
    abi: tokenAAbi,
    functionName: "mint",
    args: [user, 1000n * 10n ** 18n],
  });

  await walletClient.writeContract({
    address: tokenBAddress,
    abi: tokenBAbi,
    functionName: "mint",
    args: [user, 1000n * 10n ** 18n],
  });

  // -----------------------------
  // Deploy AMM
  // -----------------------------
  const ammHash = await walletClient.deployContract({
    abi: ammAbi,
    bytecode: ammBytecode,
    args: [tokenAAddress, tokenBAddress],
  });

  const ammReceipt = await publicClient.waitForTransactionReceipt({ hash: ammHash });
  const ammAddress = ammReceipt.contractAddress;

  // Approve
  await walletClient.writeContract({
    address: tokenAAddress,
    abi: tokenAAbi,
    functionName: "approve",
    args: [ammAddress, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
  });

  await walletClient.writeContract({
    address: tokenBAddress,
    abi: tokenBAbi,
    functionName: "approve",
    args: [ammAddress, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
  });

  // =========================================================
  // TEST 1: Add Liquidity
  // =========================================================
  await walletClient.writeContract({
    address: ammAddress,
    abi: ammAbi,
    functionName: "addLiquidity",
    args: [100n * 10n ** 18n, 100n * 10n ** 18n],
  });

  let reserves = await publicClient.readContract({
    address: ammAddress,
    abi: ammAbi,
    functionName: "getReserves",
  });

  expect(reserves[0]).to.equal(100n * 10n ** 18n);
  expect(reserves[1]).to.equal(100n * 10n ** 18n);

  console.log("✅ addLiquidity passed");

  // =========================================================
  // TEST 2: Swap A → B
  // =========================================================
  const beforeB = await publicClient.readContract({
    address: tokenBAddress,
    abi: tokenBAbi,
    functionName: "balanceOf",
    args: [user],
  });

  await walletClient.writeContract({
    address: ammAddress,
    abi: ammAbi,
    functionName: "swapAforB",
    args: [10n * 10n ** 18n, 0n],
  });

  const afterB = await publicClient.readContract({
    address: tokenBAddress,
    abi: tokenBAbi,
    functionName: "balanceOf",
    args: [user],
  });

  expect(afterB > beforeB).to.equal(true);
  console.log("✅ swapAforB passed");

  // =========================================================
  // TEST 3: Swap B → A
  // =========================================================
  const beforeA = await publicClient.readContract({
    address: tokenAAddress,
    abi: tokenAAbi,
    functionName: "balanceOf",
    args: [user],
  });

  await walletClient.writeContract({
    address: ammAddress,
    abi: ammAbi,
    functionName: "swapBforA",
    args: [10n * 10n ** 18n, 0n],
  });

  const afterA = await publicClient.readContract({
    address: tokenAAddress,
    abi: tokenAAbi,
    functionName: "balanceOf",
    args: [user],
  });

  expect(afterA > beforeA).to.equal(true);
  console.log("✅ swapBforA passed");

  // =========================================================
  // TEST 4: Remove Liquidity
  // =========================================================
  const lp = await publicClient.readContract({
    address: ammAddress,
    abi: ammAbi,
    functionName: "balanceOf",
    args: [user],
  });

  await walletClient.writeContract({
    address: ammAddress,
    abi: ammAbi,
    functionName: "removeLiquidity",
    args: [lp],
  });

  reserves = await publicClient.readContract({
    address: ammAddress,
    abi: ammAbi,
    functionName: "getReserves",
  });

  expect(reserves[0]).to.equal(0n);
  expect(reserves[1]).to.equal(0n);

  console.log("✅ removeLiquidity passed");

  console.log("🎉 ALL TESTS PASSED");
}

main().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
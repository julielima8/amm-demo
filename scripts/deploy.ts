import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();

  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("Deploying contracts with account:", deployer.account.address);

  // Deploy TokenA
  const tokenA = await viem.deployContract("TokenA", []);
  console.log("TokenA deployed to:", tokenA.address);

  // Deploy TokenB
  const tokenB = await viem.deployContract("TokenB", []);
  console.log("TokenB deployed to:", tokenB.address);

  // Deploy AMM
  const amm = await viem.deployContract("AMM", [
    tokenA.address,
    tokenB.address,
  ]);
  console.log("AMM deployed to:", amm.address);

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
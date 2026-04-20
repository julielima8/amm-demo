import { fmt, getContracts } from "./helpers.js";

async function main() {
  const { user, amm } = await getContracts();

  const reserves = await amm.read.getReserves();
  const lpBalance = await amm.read.balanceOf([user]);
  const totalSupply = await amm.read.totalSupply();

  console.log("=== DEMO: CURRENT LIQUIDITY STATE ===");
  console.log("Reserve A:", fmt(reserves[0]));
  console.log("Reserve B:", fmt(reserves[1]));
  console.log("Your LP balance:", fmt(lpBalance));
  console.log("Total LP supply:", fmt(totalSupply));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
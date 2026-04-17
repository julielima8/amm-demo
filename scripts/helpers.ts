import { network } from "hardhat";
import { formatUnits, parseUnits } from "viem";
import { ADDRESSES } from "../deployments.js";

export const DECIMALS = 18;

export function fmt(x: bigint) {
  return formatUnits(x, DECIMALS);
}

export function toWei(x: string) {
  return parseUnits(x, DECIMALS);
}

export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
) {
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

export function logPrice(label: string, rA: bigint, rB: bigint) {
  const price = Number(formatUnits(rB, DECIMALS)) / Number(formatUnits(rA, DECIMALS));
  console.log(`${label} price (B per A):`, price.toFixed(6));
}

export async function getContracts() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [wallet] = await viem.getWalletClients();
  const user = wallet.account.address;

  const tokenAAddress = ADDRESSES.sepolia.tokenA as `0x${string}`;
  const tokenBAddress = ADDRESSES.sepolia.tokenB as `0x${string}`;
  const ammAddress = ADDRESSES.sepolia.amm as `0x${string}`;

  if (!tokenAAddress || !tokenBAddress || !ammAddress) {
    throw new Error("Missing TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, or AMM_ADDRESS in deployments.ts");
  }

  const tokenA = await viem.getContractAt("TokenA", tokenAAddress);
  const tokenB = await viem.getContractAt("TokenB", tokenBAddress);
  const amm = await viem.getContractAt("AMM", ammAddress);

  return { viem, publicClient, wallet, user, tokenA, tokenB, amm };
}

function spotPrice(reserveA: bigint, reserveB: bigint): number {
  return Number(formatUnits(reserveB, 18)) / Number(formatUnits(reserveA, 18));
}

function executionPrice(amountIn: bigint, amountOut: bigint): number {
  return Number(formatUnits(amountOut, 18)) / Number(formatUnits(amountIn, 18));
}

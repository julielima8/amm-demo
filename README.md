# AMM (Automated Market Maker)
Julie Lima and Matthew Lynch
A simple constant-product AMM implementation in Solidity following the x*y=k formula, similar to Uniswap V2.

## Overview

This contract allows users to:
- **Add liquidity** to a token pair and receive LP tokens
- **Remove liquidity** by burning LP tokens
- **Swap** between two ERC20 tokens with a 0.3% fee

## Key Features

- **Constant Product Formula**: Maintains the invariant `reserveA * reserveB = k`
- **LP Tokens**: ERC20 tokens representing liquidity provider shares
- **Slippage Protection**: Min output requirements on swaps
- **0.3% Trading Fee**: Applied to all swaps (997/1000 fee factor)
- **ReentrancyGuard**: Protection against reentrancy attacks
- **SafeERC20**: Safe token transfer handling

## Core Functions

### `addLiquidity(uint256 amountA, uint256 amountB)`
Deposit tokens to provide liquidity. Returns LP tokens proportional to your share of the pool.
- First liquidity provider receives `sqrt(amountA * amountB)` LP tokens
- Subsequent deposits must maintain the current reserve ratio

### `removeLiquidity(uint256 lpAmount)`
Burn LP tokens to withdraw your share of both tokens from the pool.

### `swapAforB(uint256 amountAIn, uint256 minAmountBOut)`
Swap token A for token B with slippage protection.

### `swapBforA(uint256 amountBIn, uint256 minAmountAOut)`
Swap token B for token A with slippage protection.

### `getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)`
Calculate output amount for a given input (includes 0.3% fee).

### `getPrice()`
Returns current price ratios: A per B and B per A (scaled by 1e18).

## Getting Started

### Deployment

Deploy the AMM contract along with TokenA and TokenB using the provided deployment script:

```bash
npx hardhat run scripts/deploy.ts --network <network-name>
```

The deployment script will:
1. Deploy TokenA
2. Deploy TokenB
3. Deploy the AMM contract with both token addresses
4. Output all contract addresses

### Running Tests

To run all tests in the project:

```bash
npx hardhat test
```

You can also selectively run specific test suites:

```bash
# Run Solidity tests only
npx hardhat test solidity

# Run Node.js tests only
npx hardhat test nodejs
```

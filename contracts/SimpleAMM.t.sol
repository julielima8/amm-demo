// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/SimpleAMM.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ─────────────────────────────────────────────────────────────
// Mock ERC20 for testing
// ─────────────────────────────────────────────────────────────
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol)
        ERC20(name, symbol)
    {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ─────────────────────────────────────────────────────────────
// Test Contract
// ─────────────────────────────────────────────────────────────
contract SimpleAMMTest is Test {
    AMM public amm;
    MockERC20 public tokenA;
    MockERC20 public tokenB;

    address public user = address(1);

    function setUp() public {
        tokenA = new MockERC20("TokenA", "A");
        tokenB = new MockERC20("TokenB", "B");

        amm = new AMM(address(tokenA), address(tokenB));

        // Mint tokens to user
        tokenA.mint(user, 1000 ether);
        tokenB.mint(user, 1000 ether);

        // Approvals
        vm.startPrank(user);
        tokenA.approve(address(amm), type(uint256).max);
        tokenB.approve(address(amm), type(uint256).max);
        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────
    // Test: Add Liquidity
    // ─────────────────────────────────────────────────────────
    function testAddLiquidity() public {
        vm.startPrank(user);

        uint256 lp = amm.addLiquidity(100 ether, 100 ether);

        assertGt(lp, 0);
        assertEq(amm.reserveA(), 100 ether);
        assertEq(amm.reserveB(), 100 ether);

        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────
    // Test: Swap A → B
    // ─────────────────────────────────────────────────────────
    function testSwapAforB() public {
        vm.startPrank(user);

        amm.addLiquidity(100 ether, 100 ether);

        uint256 balanceBefore = tokenB.balanceOf(user);

        amm.swapAforB(10 ether, 0);

        uint256 balanceAfter = tokenB.balanceOf(user);

        assertGt(balanceAfter, balanceBefore);

        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────
    // Test: Swap B → A
    // ─────────────────────────────────────────────────────────
    function testSwapBforA() public {
        vm.startPrank(user);

        amm.addLiquidity(100 ether, 100 ether);

        uint256 balanceBefore = tokenA.balanceOf(user);

        amm.swapBforA(10 ether, 0);

        uint256 balanceAfter = tokenA.balanceOf(user);

        assertGt(balanceAfter, balanceBefore);

        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────
    // Test: Remove Liquidity
    // ─────────────────────────────────────────────────────────
    function testRemoveLiquidity() public {
        vm.startPrank(user);

        uint256 lp = amm.addLiquidity(100 ether, 100 ether);

        (uint256 beforeA, uint256 beforeB) = (
            tokenA.balanceOf(user),
            tokenB.balanceOf(user)
        );

        amm.removeLiquidity(lp);

        (uint256 afterA, uint256 afterB) = (
            tokenA.balanceOf(user),
            tokenB.balanceOf(user)
        );

        assertGt(afterA, beforeA);
        assertGt(afterB, beforeB);

        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────
    // Test: Price function
    // ─────────────────────────────────────────────────────────
    function testGetPrice() public {
        vm.startPrank(user);

        amm.addLiquidity(100 ether, 200 ether);

        (uint256 aPerB, uint256 bPerA) = amm.getPrice();

        assertGt(aPerB, 0);
        assertGt(bPerA, 0);

        vm.stopPrank();
    }
}
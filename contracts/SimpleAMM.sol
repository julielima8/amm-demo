// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// OpenZeppelin imports
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AMM is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State ────────────────────────────────────────────────
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    uint256 public reserveA;
    uint256 public reserveB;

    uint256 private constant PRECISION = 1e18;

    // ── Events ───────────────────────────────────────────────
    event LiquidityAdded(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 lpMinted
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 lpBurned
    );

    event Swap(
        address indexed user,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut
    );

    // ── Constructor ──────────────────────────────────────────
    constructor(address _tokenA, address _tokenB)
        ERC20("AMM LP Token", "ALP")
    {
        require(_tokenA != _tokenB, "Identical tokens");
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    // ── Add Liquidity ────────────────────────────────────────
    function addLiquidity(uint256 amountA, uint256 amountB)
        external
        nonReentrant
        returns (uint256 lpMinted)
    {
        require(amountA > 0 && amountB > 0, "Invalid amounts");

        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        uint256 supply = totalSupply();

        // Enforce ratio (optional but safer)
        if (supply > 0) {
            require(
                amountA * _reserveB == amountB * _reserveA,
                "Wrong ratio"
            );
        }

        // Transfer tokens in
        tokenA.safeTransferFrom(msg.sender, address(this), amountA);
        tokenB.safeTransferFrom(msg.sender, address(this), amountB);

        if (supply == 0) {
            lpMinted = _sqrt(amountA * amountB);
        } else {
            lpMinted = _min(
                (amountA * supply) / _reserveA,
                (amountB * supply) / _reserveB
            );
        }

        require(lpMinted > 0, "Insufficient LP minted");

        _mint(msg.sender, lpMinted);

        // Update reserves AFTER transfers
        reserveA = _reserveA + amountA;
        reserveB = _reserveB + amountB;

        emit LiquidityAdded(msg.sender, amountA, amountB, lpMinted);
    }

    // ── Remove Liquidity ─────────────────────────────────────
    function removeLiquidity(uint256 lpAmount)
        external
        nonReentrant
        returns (uint256 amountA, uint256 amountB)
    {
        require(lpAmount > 0, "Invalid LP amount");

        uint256 supply = totalSupply();
        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;

        amountA = (lpAmount * _reserveA) / supply;
        amountB = (lpAmount * _reserveB) / supply;

        require(amountA > 0 && amountB > 0, "Insufficient output");

        _burn(msg.sender, lpAmount);

        reserveA = _reserveA - amountA;
        reserveB = _reserveB - amountB;

        tokenA.safeTransfer(msg.sender, amountA);
        tokenB.safeTransfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, amountA, amountB, lpAmount);
    }

    // ── Swap A → B ───────────────────────────────────────────
    function swapAforB(uint256 amountAIn, uint256 minAmountBOut)
        external
        nonReentrant
        returns (uint256 amountBOut)
    {
        require(amountAIn > 0, "Invalid input");

        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;

        amountBOut = getAmountOut(amountAIn, _reserveA, _reserveB);
        require(amountBOut >= minAmountBOut, "Slippage exceeded");

        uint256 oldK = _reserveA * _reserveB;

        tokenA.safeTransferFrom(msg.sender, address(this), amountAIn);
        tokenB.safeTransfer(msg.sender, amountBOut);

        reserveA = _reserveA + amountAIn;
        reserveB = _reserveB - amountBOut;

        // Invariant check
        assert(reserveA * reserveB >= oldK);

        emit Swap(msg.sender, address(tokenA), amountAIn, amountBOut);
    }

    // ── Swap B → A ───────────────────────────────────────────
    function swapBforA(uint256 amountBIn, uint256 minAmountAOut)
        external
        nonReentrant
        returns (uint256 amountAOut)
    {
        require(amountBIn > 0, "Invalid input");

        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;

        amountAOut = getAmountOut(amountBIn, _reserveB, _reserveA);
        require(amountAOut >= minAmountAOut, "Slippage exceeded");

        uint256 oldK = _reserveA * _reserveB;

        tokenB.safeTransferFrom(msg.sender, address(this), amountBIn);
        tokenA.safeTransfer(msg.sender, amountAOut);

        reserveB = _reserveB + amountBIn;
        reserveA = _reserveA - amountAOut;

        // Invariant check
        assert(reserveA * reserveB >= oldK);

        emit Swap(msg.sender, address(tokenB), amountBIn, amountAOut);
    }

    // ── Pricing Formula (0.3% fee) ───────────────────────────
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(reserveIn > 0 && reserveOut > 0, "No liquidity");

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;

        return numerator / denominator;
    }

    // ── View Functions ───────────────────────────────────────
    function getPrice()
        external
        view
        returns (uint256 aPerB, uint256 bPerA)
    {
        require(reserveA > 0 && reserveB > 0, "No liquidity");

        aPerB = (reserveA * PRECISION) / reserveB;
        bPerA = (reserveB * PRECISION) / reserveA;
    }

    function getReserves() external view returns (uint256, uint256) {
        return (reserveA, reserveB);
    }

    // ── Internal Helpers ─────────────────────────────────────
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function _min(uint256 a, uint256 b)
        internal
        pure
        returns (uint256)
    {
        return a < b ? a : b;
    }
}
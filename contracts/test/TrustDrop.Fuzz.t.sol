// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TrustDropTestBase} from "./TrustDrop.Base.t.sol";
import {TrustDrop} from "../TrustDrop.sol";

/// @notice Fuzz tests for TrustDrop.
contract TrustDropFuzzTest is TrustDropTestBase {

    // ── Fuzz: checkIn timing ──────────────────────────────────────────────────

    /// @dev The vault should not be lapsed at any time before the deadline.
    function testFuzz_IsLapsed_FalseBeforeDeadline(uint32 warpSeconds) public {
        uint256 vaultId = _createSimpleVault(0);

        // Only warp up to deadline (inclusive)
        uint256 maxWarp = INTERVAL + GRACE;
        uint256 warp    = bound(warpSeconds, 0, maxWarp);
        vm.warp(block.timestamp + warp);

        assertFalse(trustDrop.isLapsed(vaultId));
    }

    /// @dev The vault must be lapsed any time strictly after the deadline.
    function testFuzz_IsLapsed_TrueAfterDeadline(uint32 extraSeconds) public {
        uint256 vaultId = _createSimpleVault(0);

        uint256 extra = bound(extraSeconds, 1, 365 days);
        vm.warp(block.timestamp + INTERVAL + GRACE + extra);

        assertTrue(trustDrop.isLapsed(vaultId));
    }

    /// @dev Fuzz the interval and grace window to ensure lapse boundary is always correct.
    function testFuzz_IsLapsed_CustomIntervalAndGrace(
        uint32 interval_,
        uint32 grace_,
        uint32 extraAfterDeadline
    ) public {
        uint256 interval = bound(interval_, 1, 365 days);
        uint256 grace    = bound(grace_, 0, 365 days);
        uint256 extra    = bound(extraAfterDeadline, 1, 365 days);

        address[] memory bens = new address[](1);
        uint256[] memory shs  = new uint256[](1);
        bens[0] = alice; shs[0] = BPS;

        uint256 start = block.timestamp;
        vm.prank(owner);
        uint256 vaultId = trustDrop.createVault(PQ_PK, interval, grace, bens, shs);

        // Before deadline
        vm.warp(start + interval + grace);
        assertFalse(trustDrop.isLapsed(vaultId));

        // After deadline
        vm.warp(start + interval + grace + extra);
        assertTrue(trustDrop.isLapsed(vaultId));
    }

    // ── Fuzz: share distribution ──────────────────────────────────────────────

    /// @dev Two-beneficiary split: shares must sum to BPS; payouts must sum to totalAmount.
    function testFuzz_Claim_TwoBeneficiaryPayoutConservation(
        uint16 share0Bps,
        uint128 totalAmount
    ) public {
        // share0 in [1, 9999]; share1 = BPS - share0
        uint256 s0 = bound(share0Bps, 1, BPS - 1);
        uint256 s1 = BPS - s0;

        // Use a non-trivial amount to make the maths interesting
        uint256 amount = bound(totalAmount, 1, 1_000_000e6);

        address[] memory bens = new address[](2);
        uint256[] memory shs  = new uint256[](2);
        bens[0] = alice; shs[0] = s0;
        bens[1] = bob;   shs[1] = s1;

        usdc.mint(owner, amount);
        vm.prank(owner);
        usdc.approve(address(trustDrop), amount);

        vm.prank(owner);
        uint256 vaultId = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);

        _warpPastLapse();
        trustDrop.claim(vaultId);

        // Last beneficiary absorbs remainder — full conservation guaranteed.
        assertEq(
            usdc.balanceOf(alice) + usdc.balanceOf(bob),
            amount,
            "payouts must sum to totalAmount"
        );
    }

    /// @dev Single beneficiary always receives the entire balance.
    function testFuzz_Claim_SingleBeneficiaryGetsAll(uint128 totalAmount) public {
        uint256 amount  = bound(totalAmount, 1, 1_000_000e6);
        uint256 vaultId = _createSimpleVault(amount);

        _warpPastLapse();
        trustDrop.claim(vaultId);

        assertEq(usdc.balanceOf(alice), amount);
    }

    // ── Fuzz: deposit accumulation ────────────────────────────────────────────

    /// @dev Any sequence of deposits must leave the vault balance at the sum.
    function testFuzz_Deposit_AccumulatesCorrectly(
        uint64 amount1,
        uint64 amount2
    ) public {
        uint256 a1 = bound(amount1, 1, 500_000e6);
        uint256 a2 = bound(amount2, 1, 500_000e6);

        uint256 vaultId = _createSimpleVault(0);
        _deposit(vaultId, a1);
        _deposit(vaultId, a2);

        (, uint256 bal,,,, ) = trustDrop.vaultStatus(vaultId);
        assertEq(bal, a1 + a2);
    }

    // ── Fuzz: checkIn deadline acceptance ────────────────────────────────────

    /// @dev Any deadline strictly in the future must be accepted (sig valid).
    function testFuzz_CheckIn_AcceptsFutureDeadline(uint32 offset) public {
        uint256 vaultId = _createSimpleVault(0);
        uint256 future  = block.timestamp + bound(offset, 1, 365 days);

        vm.prank(owner);
        trustDrop.checkIn(vaultId, future, validSig);

        (, , uint256 lastCI,,, ) = trustDrop.vaultStatus(vaultId);
        assertEq(lastCI, block.timestamp);
    }

    /// @dev Any deadline at or before block.timestamp must revert.
    function testFuzz_CheckIn_RevertsStaleDeadline(uint32 age) public {
        uint256 vaultId = _createSimpleVault(0);
        // age in [0, block.timestamp] maps deadline to [block.timestamp, 0]
        // We want deadline < block.timestamp, so age in [1, block.timestamp]
        uint256 pastDeadline = block.timestamp - bound(age, 1, block.timestamp);

        vm.prank(owner);
        vm.expectRevert(TrustDrop.DeadlineExpired.selector);
        trustDrop.checkIn(vaultId, pastDeadline, validSig);
    }

    // ── Fuzz: invalid share sums revert ──────────────────────────────────────

    function testFuzz_CreateVault_RevertsWrongShareSum(uint16 badSum) public {
        // Any sum ≠ BPS should revert
        uint256 sum = bound(badSum, 0, type(uint16).max);
        vm.assume(sum != BPS);

        address[] memory bens = new address[](1);
        uint256[] memory shs  = new uint256[](1);
        bens[0] = alice;
        shs[0]  = sum;

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidShares.selector);
        trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
    }

    // ── Fuzz: withdraw payout ────────────────────────────────────────────────

    /// @dev Owner always recovers the exact deposited amount via withdraw.
    function testFuzz_Withdraw_OwnerGetsExactBalance(uint128 totalAmount) public {
        uint256 amount  = bound(totalAmount, 0, 1_000_000e6);
        uint256 vaultId = _createSimpleVault(amount);

        uint256 ownerBalanceBefore = usdc.balanceOf(owner);

        vm.prank(owner);
        trustDrop.withdraw(vaultId, _deadline(), validSig);

        assertEq(usdc.balanceOf(owner) - ownerBalanceBefore, amount);
    }
}

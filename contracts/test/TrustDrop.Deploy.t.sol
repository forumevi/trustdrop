// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TrustDropTestBase} from "./TrustDrop.Base.t.sol";
import {TrustDrop} from "../TrustDrop.sol";

/// @notice Deployment / initialisation and happy-path tests.
contract TrustDropDeployTest is TrustDropTestBase {

    // ── Deployment sanity ────────────────────────────────────────────────────

    function test_NextVaultIdStartsAtOne() public view {
        assertEq(trustDrop.nextVaultId(), 1);
    }

    function test_UsdcConstant() public view {
        assertEq(address(trustDrop.USDC()), 0x3600000000000000000000000000000000000000);
    }

    function test_PqVerifierConstant() public view {
        assertEq(trustDrop.PQ_VERIFIER(), 0x1800000000000000000000000000000000000004);
    }

    // ── createVault ──────────────────────────────────────────────────────────

    function test_CreateVault_NoInitialDeposit() public {
        address[] memory bens = new address[](1);
        uint256[] memory shs  = new uint256[](1);
        bens[0] = alice;
        shs[0]  = BPS;

        vm.prank(owner);
        vm.expectEmit(true, true, false, true, address(trustDrop));
        emit TrustDrop.VaultCreated(1, owner, 0, INTERVAL, GRACE);
        uint256 vaultId = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);

        assertEq(vaultId, 1);
        assertEq(trustDrop.nextVaultId(), 2);

        (address o, uint256 bal, uint256 lastCI, uint256 nextDL, bool lapsed, bool settled) =
            trustDrop.vaultStatus(vaultId);

        assertEq(o, owner);
        assertEq(bal, 0);
        assertEq(lastCI, block.timestamp);
        assertEq(nextDL, block.timestamp + INTERVAL + GRACE);
        assertFalse(lapsed);
        assertFalse(settled);
    }

    function test_CreateVault_WithInitialDeposit() public {
        uint256 amount = 500e6;
        usdc.mint(owner, amount);
        vm.prank(owner);
        usdc.approve(address(trustDrop), amount);

        address[] memory bens = new address[](1);
        uint256[] memory shs  = new uint256[](1);
        bens[0] = alice;
        shs[0]  = BPS;

        vm.prank(owner);
        vm.expectEmit(true, true, false, true, address(trustDrop));
        emit TrustDrop.VaultCreated(1, owner, amount, INTERVAL, GRACE);
        uint256 vaultId = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);

        (, uint256 bal,,,, ) = trustDrop.vaultStatus(vaultId);
        assertEq(bal, amount);
        assertEq(usdc.balanceOf(address(trustDrop)), amount);
        assertEq(usdc.balanceOf(owner), 0);
    }

    function test_CreateVault_IncrementsvaultId() public {
        address[] memory bens = new address[](1);
        uint256[] memory shs  = new uint256[](1);
        bens[0] = alice; shs[0] = BPS;

        vm.startPrank(owner);
        uint256 id1 = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
        uint256 id2 = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_CreateVault_StoresBeneficiariesAndShares() public {
        address[] memory bens = new address[](2);
        uint256[] memory shs  = new uint256[](2);
        bens[0] = alice; shs[0] = 6000;
        bens[1] = bob;   shs[1] = 4000;

        vm.prank(owner);
        uint256 vaultId = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);

        (address[] memory retBens, uint256[] memory retShs) = trustDrop.getBeneficiaries(vaultId);
        assertEq(retBens.length, 2);
        assertEq(retBens[0], alice);
        assertEq(retBens[1], bob);
        assertEq(retShs[0], 6000);
        assertEq(retShs[1], 4000);
    }

    /// @dev createVault takes min(balance, allowance) — partial allowance test.
    function test_CreateVault_PartialAllowanceTaken() public {
        uint256 balance   = 1000e6;
        uint256 allowance = 300e6;
        usdc.mint(owner, balance);
        vm.prank(owner);
        usdc.approve(address(trustDrop), allowance);

        address[] memory bens = new address[](1);
        uint256[] memory shs  = new uint256[](1);
        bens[0] = alice; shs[0] = BPS;

        vm.prank(owner);
        uint256 vaultId = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);

        (, uint256 bal,,,, ) = trustDrop.vaultStatus(vaultId);
        assertEq(bal, allowance, "should deposit min(balance,allowance)");
        assertEq(usdc.balanceOf(owner), balance - allowance);
    }

    // ── deposit ──────────────────────────────────────────────────────────────

    function test_Deposit_IncreasesVaultBalance() public {
        uint256 vaultId = _createSimpleVault(0);
        uint256 amount  = 1_000e6;

        usdc.mint(owner, amount);
        vm.prank(owner);
        usdc.approve(address(trustDrop), amount);

        vm.prank(owner);
        vm.expectEmit(true, false, false, true, address(trustDrop));
        emit TrustDrop.Deposited(vaultId, amount);
        trustDrop.deposit(vaultId, amount);

        (, uint256 bal,,,, ) = trustDrop.vaultStatus(vaultId);
        assertEq(bal, amount);
    }

    function test_Deposit_MultipleDepositsAccumulate() public {
        uint256 vaultId = _createSimpleVault(0);
        _deposit(vaultId, 400e6);
        _deposit(vaultId, 600e6);

        (, uint256 bal,,,, ) = trustDrop.vaultStatus(vaultId);
        assertEq(bal, 1_000e6);
    }

    // ── isLapsed ─────────────────────────────────────────────────────────────

    function test_IsLapsed_FalseBeforeInterval() public {
        uint256 vaultId = _createSimpleVault(0);
        assertFalse(trustDrop.isLapsed(vaultId));
    }

    function test_IsLapsed_FalseAtExactDeadline() public {
        uint256 vaultId = _createSimpleVault(0);
        vm.warp(block.timestamp + INTERVAL + GRACE);
        // deadline is lastCheckIn + interval + grace; lapse condition is `> deadline`
        assertFalse(trustDrop.isLapsed(vaultId));
    }

    function test_IsLapsed_TrueAfterDeadlinePlusOne() public {
        uint256 vaultId = _createSimpleVault(0);
        vm.warp(block.timestamp + INTERVAL + GRACE + 1);
        assertTrue(trustDrop.isLapsed(vaultId));
    }

    function test_IsLapsed_FalseAfterSettle() public {
        uint256 vaultId = _createSimpleVault(100e6);
        _warpPastLapse();
        vm.prank(stranger);
        trustDrop.settle(vaultId);
        assertFalse(trustDrop.isLapsed(vaultId));
    }

    // ── checkIn ──────────────────────────────────────────────────────────────

    function test_CheckIn_UpdatesLastCheckIn() public {
        uint256 vaultId = _createSimpleVault(0);

        uint256 warpTarget = block.timestamp + 10 days;
        vm.warp(warpTarget);

        vm.prank(owner);
        vm.expectEmit(true, true, false, true, address(trustDrop));
        emit TrustDrop.CheckedIn(vaultId, 0, warpTarget);
        trustDrop.checkIn(vaultId, _deadline(), validSig);

        (, , uint256 lastCI,,, ) = trustDrop.vaultStatus(vaultId);
        assertEq(lastCI, warpTarget);
    }

    function test_CheckIn_IncrementsNonce() public {
        // We verify nonce increments by checking that the second checkIn emits nonce=1
        uint256 vaultId = _createSimpleVault(0);

        vm.prank(owner);
        trustDrop.checkIn(vaultId, _deadline(), validSig);

        vm.prank(owner);
        vm.expectEmit(true, true, false, false, address(trustDrop));
        emit TrustDrop.CheckedIn(vaultId, 1, block.timestamp);
        trustDrop.checkIn(vaultId, _deadline(), validSig);
    }

    function test_CheckIn_ResetsLapseWindow() public {
        uint256 vaultId = _createSimpleVault(0);

        // Warp close to lapse
        vm.warp(block.timestamp + INTERVAL + GRACE - 1 hours);
        assertFalse(trustDrop.isLapsed(vaultId));

        // Check in
        vm.prank(owner);
        trustDrop.checkIn(vaultId, _deadline(), validSig);

        // Warp by interval + grace again from now — should NOT be lapsed yet
        vm.warp(block.timestamp + INTERVAL + GRACE - 1 hours);
        assertFalse(trustDrop.isLapsed(vaultId));
    }

    // ── settle + claimShare ───────────────────────────────────────────────────

    function test_Settle_EmitsSettled() public {
        uint256 amount  = 1_000e6;
        uint256 vaultId = _createSimpleVault(amount);
        _warpPastLapse();

        vm.prank(stranger);
        vm.expectEmit(true, false, false, false, address(trustDrop));
        emit TrustDrop.Settled(vaultId);
        trustDrop.settle(vaultId);
    }

    function test_Settle_MarksSettledAndZerosBalance() public {
        uint256 amount  = 1_000e6;
        uint256 vaultId = _createSimpleVault(amount);
        _warpPastLapse();

        trustDrop.settle(vaultId);

        (, uint256 bal,,,, bool settled) = trustDrop.vaultStatus(vaultId);
        assertEq(bal, 0);
        assertTrue(settled);
    }

    function test_Settle_PopulatesPendingClaims_Single() public {
        uint256 amount  = 1_000e6;
        uint256 vaultId = _createSimpleVault(amount);
        _warpPastLapse();

        trustDrop.settle(vaultId);

        // alice is the sole beneficiary at 100 %
        assertEq(trustDrop.pendingClaims(vaultId, alice), amount);
    }

    function test_Settle_PopulatesPendingClaims_Split() public {
        uint256 amount  = 1_000e6;
        uint256 vaultId = _createSplitVault(amount);
        _warpPastLapse();

        trustDrop.settle(vaultId);

        // alice 60 % = 600e6, bob 40 % = remainder = 400e6
        assertEq(trustDrop.pendingClaims(vaultId, alice), 600e6);
        assertEq(trustDrop.pendingClaims(vaultId, bob),   400e6);
    }

    function test_ClaimShare_SingleBeneficiaryReceivesAll() public {
        uint256 amount  = 1_000e6;
        uint256 vaultId = _createSimpleVault(amount);
        _warpPastLapse();

        trustDrop.settle(vaultId);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(trustDrop));
        emit TrustDrop.ShareClaimed(vaultId, alice, amount);
        trustDrop.claimShare(vaultId);

        assertEq(usdc.balanceOf(alice), amount);
        assertEq(usdc.balanceOf(address(trustDrop)), 0);
        assertEq(trustDrop.pendingClaims(vaultId, alice), 0);
    }

    function test_ClaimShare_TwoBeneficiariesSplitCorrectly() public {
        uint256 amount  = 1_000e6;
        uint256 vaultId = _createSplitVault(amount);
        _warpPastLapse();

        trustDrop.settle(vaultId);

        vm.prank(alice);
        trustDrop.claimShare(vaultId);

        vm.prank(bob);
        trustDrop.claimShare(vaultId);

        assertEq(usdc.balanceOf(alice), 600e6);
        assertEq(usdc.balanceOf(bob),   400e6);
        assertEq(usdc.balanceOf(address(trustDrop)), 0);
    }

    function test_ClaimShare_ThreeBeneficiariesLastGetsRemainder() public {
        uint256 amount  = 1_000e6;

        address[] memory bens = new address[](3);
        uint256[] memory shs  = new uint256[](3);
        bens[0] = alice; shs[0] = 3334;
        bens[1] = bob;   shs[1] = 3333;
        bens[2] = carol; shs[2] = 3333;

        usdc.mint(owner, amount);
        vm.prank(owner);
        usdc.approve(address(trustDrop), amount);
        vm.prank(owner);
        uint256 vaultId = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);

        _warpPastLapse();
        trustDrop.settle(vaultId);

        uint256 alicePayout = (amount * 3334) / BPS;
        uint256 bobPayout   = (amount * 3333) / BPS;
        uint256 carolPayout = amount - alicePayout - bobPayout;

        vm.prank(alice); trustDrop.claimShare(vaultId);
        vm.prank(bob);   trustDrop.claimShare(vaultId);
        vm.prank(carol); trustDrop.claimShare(vaultId);

        assertEq(usdc.balanceOf(alice), alicePayout);
        assertEq(usdc.balanceOf(bob),   bobPayout);
        assertEq(usdc.balanceOf(carol), carolPayout);
        assertEq(alicePayout + bobPayout + carolPayout, amount);
    }

    function test_Settle_ZeroBalanceVaultSucceeds() public {
        uint256 vaultId = _createSimpleVault(0);
        _warpPastLapse();
        trustDrop.settle(vaultId);
        // pendingClaims is 0; claimShare should revert NothingToClaim
        assertEq(trustDrop.pendingClaims(vaultId, alice), 0);
    }

    function test_Settle_AnyoneCanSettle() public {
        uint256 vaultId = _createSimpleVault(500e6);
        _warpPastLapse();

        // stranger (not the owner) can trigger settle
        vm.prank(stranger);
        trustDrop.settle(vaultId);

        (,,,, , bool settled) = trustDrop.vaultStatus(vaultId);
        assertTrue(settled);
    }

    // ── withdraw ─────────────────────────────────────────────────────────────

    function test_Withdraw_OwnerReceivesFullBalance() public {
        uint256 amount  = 2_000e6;
        uint256 vaultId = _createSimpleVault(amount);

        vm.prank(owner);
        vm.expectEmit(true, true, false, true, address(trustDrop));
        emit TrustDrop.Withdrawn(vaultId, owner, amount);
        trustDrop.withdraw(vaultId, _deadline(), validSig);

        assertEq(usdc.balanceOf(owner), amount);
        assertEq(usdc.balanceOf(address(trustDrop)), 0);

        (, uint256 bal,,,, bool settled) = trustDrop.vaultStatus(vaultId);
        assertEq(bal, 0);
        assertTrue(settled);
    }

    function test_Withdraw_MarksSettled() public {
        uint256 vaultId = _createSimpleVault(500e6);
        vm.prank(owner);
        trustDrop.withdraw(vaultId, _deadline(), validSig);

        (,,,, , bool settled) = trustDrop.vaultStatus(vaultId);
        assertTrue(settled);
    }

    // ── vaultStatus ──────────────────────────────────────────────────────────

    function test_VaultStatus_NextDeadlineCalculation() public {
        uint256 vaultId = _createSimpleVault(0);
        (, , uint256 lastCI, uint256 nextDL,, ) = trustDrop.vaultStatus(vaultId);
        assertEq(nextDL, lastCI + INTERVAL + GRACE);
    }

    // ── getBeneficiaries ─────────────────────────────────────────────────────

    function test_GetBeneficiaries_ReturnsCorrectArrays() public {
        uint256 vaultId = _createSplitVault(0);
        (address[] memory bens, uint256[] memory shs) = trustDrop.getBeneficiaries(vaultId);
        assertEq(bens.length, 2);
        assertEq(shs[0], 6000);
        assertEq(shs[1], 4000);
    }
}

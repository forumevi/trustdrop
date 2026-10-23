// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TrustDropTestBase} from "./TrustDrop.Base.t.sol";
import {TrustDrop} from "../TrustDrop.sol";

/// @notice Revert / access-control tests.
contract TrustDropRevertTest is TrustDropTestBase {

    // ── createVault reverts ───────────────────────────────────────────────────

    function test_CreateVault_RevertsZeroInterval() public {
        address[] memory bens = new address[](1);
        uint256[] memory shs  = new uint256[](1);
        bens[0] = alice; shs[0] = BPS;

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidInterval.selector);
        trustDrop.createVault(PQ_PK, 0, GRACE, bens, shs);
    }

    function test_CreateVault_RevertsEmptyBeneficiaries() public {
        address[] memory bens = new address[](0);
        uint256[] memory shs  = new uint256[](0);

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidBeneficiaries.selector);
        trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
    }

    function test_CreateVault_RevertsMismatchedArrays() public {
        address[] memory bens = new address[](2);
        uint256[] memory shs  = new uint256[](1);
        bens[0] = alice; bens[1] = bob;
        shs[0] = BPS;

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidBeneficiaries.selector);
        trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
    }

    function test_CreateVault_RevertsSharesNotSumTo10000() public {
        address[] memory bens = new address[](2);
        uint256[] memory shs  = new uint256[](2);
        bens[0] = alice; bens[1] = bob;
        shs[0] = 5000; shs[1] = 4999; // 9999 ≠ 10000

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidShares.selector);
        trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
    }

    function test_CreateVault_RevertsSharesOver10000() public {
        address[] memory bens = new address[](1);
        uint256[] memory shs  = new uint256[](1);
        bens[0] = alice;
        shs[0]  = 10001;

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidShares.selector);
        trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
    }

    // ── deposit reverts ───────────────────────────────────────────────────────

    function test_Deposit_RevertsVaultNotFound() public {
        vm.prank(owner);
        vm.expectRevert(TrustDrop.VaultNotFound.selector);
        trustDrop.deposit(999, 100e6);
    }

    function test_Deposit_RevertsNotOwner() public {
        uint256 vaultId = _createSimpleVault(0);

        usdc.mint(stranger, 100e6);
        vm.prank(stranger);
        usdc.approve(address(trustDrop), 100e6);

        vm.prank(stranger);
        vm.expectRevert(TrustDrop.NotOwner.selector);
        trustDrop.deposit(vaultId, 100e6);
    }

    function test_Deposit_RevertsZeroAmount() public {
        uint256 vaultId = _createSimpleVault(0);

        vm.prank(owner);
        vm.expectRevert(TrustDrop.ZeroAmount.selector);
        trustDrop.deposit(vaultId, 0);
    }

    function test_Deposit_RevertsAlreadySettled() public {
        uint256 vaultId = _createSimpleVault(100e6);
        _warpPastLapse();
        trustDrop.claim(vaultId);

        usdc.mint(owner, 50e6);
        vm.prank(owner);
        usdc.approve(address(trustDrop), 50e6);

        vm.prank(owner);
        vm.expectRevert(TrustDrop.AlreadySettled.selector);
        trustDrop.deposit(vaultId, 50e6);
    }

    // ── checkIn reverts ───────────────────────────────────────────────────────

    function test_CheckIn_RevertsVaultNotFound() public {
        vm.prank(owner);
        vm.expectRevert(TrustDrop.VaultNotFound.selector);
        trustDrop.checkIn(999, _deadline(), validSig);
    }

    function test_CheckIn_RevertsNotOwner() public {
        uint256 vaultId = _createSimpleVault(0);

        vm.prank(stranger);
        vm.expectRevert(TrustDrop.NotOwner.selector);
        trustDrop.checkIn(vaultId, _deadline(), validSig);
    }

    function test_CheckIn_RevertsAlreadySettled() public {
        uint256 vaultId = _createSimpleVault(100e6);
        _warpPastLapse();
        trustDrop.claim(vaultId);

        vm.prank(owner);
        vm.expectRevert(TrustDrop.AlreadySettled.selector);
        trustDrop.checkIn(vaultId, _deadline(), validSig);
    }

    function test_CheckIn_RevertsExpiredDeadline() public {
        uint256 vaultId = _createSimpleVault(0);

        uint256 pastDeadline = block.timestamp - 1;

        vm.prank(owner);
        vm.expectRevert(TrustDrop.DeadlineExpired.selector);
        trustDrop.checkIn(vaultId, pastDeadline, validSig);
    }

    function test_CheckIn_RevertsShortSignature() public {
        uint256 vaultId  = _createSimpleVault(0);
        bytes memory sig = new bytes(SIG_LEN - 1); // one byte short

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidPQSignature.selector);
        trustDrop.checkIn(vaultId, _deadline(), sig);
    }

    function test_CheckIn_RevertsLongSignature() public {
        uint256 vaultId  = _createSimpleVault(0);
        bytes memory sig = new bytes(SIG_LEN + 1);

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidPQSignature.selector);
        trustDrop.checkIn(vaultId, _deadline(), sig);
    }

    function test_CheckIn_RevertsInvalidPQSignature() public {
        uint256 vaultId = _createSimpleVault(0);

        // Switch mock to always return false
        _setPQVerifierFalse();

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidPQSignature.selector);
        trustDrop.checkIn(vaultId, _deadline(), validSig);
    }

    function test_CheckIn_RevertsPQVerifierUnavailable() public {
        uint256 vaultId = _createSimpleVault(0);

        // Etch empty bytecode — staticcall returns success=false (no code → revert)
        vm.etch(PQ_VERIFIER, hex"");

        vm.prank(owner);
        vm.expectRevert(TrustDrop.PQVerifierUnavailable.selector);
        trustDrop.checkIn(vaultId, _deadline(), validSig);
    }

    // ── claim reverts ─────────────────────────────────────────────────────────

    function test_Claim_RevertsVaultNotFound() public {
        vm.expectRevert(TrustDrop.VaultNotFound.selector);
        trustDrop.claim(999);
    }

    function test_Claim_RevertsNotLapsed() public {
        uint256 vaultId = _createSimpleVault(100e6);

        vm.expectRevert(TrustDrop.NotLapsed.selector);
        trustDrop.claim(vaultId);
    }

    function test_Claim_RevertsAlreadySettled() public {
        uint256 vaultId = _createSimpleVault(100e6);
        _warpPastLapse();
        trustDrop.claim(vaultId);

        vm.expectRevert(TrustDrop.AlreadySettled.selector);
        trustDrop.claim(vaultId);
    }

    // ── withdraw reverts ──────────────────────────────────────────────────────

    function test_Withdraw_RevertsVaultNotFound() public {
        vm.prank(owner);
        vm.expectRevert(TrustDrop.VaultNotFound.selector);
        trustDrop.withdraw(999, _deadline(), validSig);
    }

    function test_Withdraw_RevertsNotOwner() public {
        uint256 vaultId = _createSimpleVault(500e6);

        vm.prank(stranger);
        vm.expectRevert(TrustDrop.NotOwner.selector);
        trustDrop.withdraw(vaultId, _deadline(), validSig);
    }

    function test_Withdraw_RevertsAlreadySettled() public {
        uint256 vaultId = _createSimpleVault(500e6);
        vm.prank(owner);
        trustDrop.withdraw(vaultId, _deadline(), validSig);

        vm.prank(owner);
        vm.expectRevert(TrustDrop.AlreadySettled.selector);
        trustDrop.withdraw(vaultId, _deadline(), validSig);
    }

    function test_Withdraw_RevertsWhenLapsed() public {
        uint256 vaultId = _createSimpleVault(500e6);
        _warpPastLapse();

        vm.prank(owner);
        vm.expectRevert(TrustDrop.StillLapsed.selector);
        trustDrop.withdraw(vaultId, _deadline(), validSig);
    }

    function test_Withdraw_RevertsExpiredDeadline() public {
        uint256 vaultId = _createSimpleVault(0);

        vm.prank(owner);
        vm.expectRevert(TrustDrop.DeadlineExpired.selector);
        trustDrop.withdraw(vaultId, block.timestamp - 1, validSig);
    }

    function test_Withdraw_RevertsInvalidPQSignature() public {
        uint256 vaultId = _createSimpleVault(0);
        _setPQVerifierFalse();

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidPQSignature.selector);
        trustDrop.withdraw(vaultId, _deadline(), validSig);
    }

    function test_Withdraw_RevertsShortSignature() public {
        uint256 vaultId  = _createSimpleVault(0);
        bytes memory sig = new bytes(100);

        vm.prank(owner);
        vm.expectRevert(TrustDrop.InvalidPQSignature.selector);
        trustDrop.withdraw(vaultId, _deadline(), sig);
    }

    // ── vaultStatus / getBeneficiaries reverts ────────────────────────────────

    function test_VaultStatus_RevertsVaultNotFound() public {
        vm.expectRevert(TrustDrop.VaultNotFound.selector);
        trustDrop.vaultStatus(999);
    }

    function test_GetBeneficiaries_RevertsVaultNotFound() public {
        vm.expectRevert(TrustDrop.VaultNotFound.selector);
        trustDrop.getBeneficiaries(999);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {TrustDrop} from "../TrustDrop.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";
import {MockPQVerifierTrue, MockPQVerifierFalse} from "../test-helpers/MockPQVerifier.sol";

abstract contract TrustDropTestBase is Test {
    // ── Hardcoded contract addresses ────────────────────────────────────────
    address internal constant USDC_ADDR    = 0x3600000000000000000000000000000000000000;
    address internal constant PQ_VERIFIER  = 0x1800000000000000000000000000000000000004;

    // ── SLH-DSA constants (from contract) ───────────────────────────────────
    uint256 internal constant SIG_LEN      = 7856;
    uint256 internal constant BPS          = 10_000;

    // ── Timing constants ────────────────────────────────────────────────────
    uint256 internal constant INTERVAL     = 30 days;
    uint256 internal constant GRACE        = 7 days;

    // ── Actors ──────────────────────────────────────────────────────────────
    address internal owner     = makeAddr("owner");
    address internal alice     = makeAddr("alice");
    address internal bob       = makeAddr("bob");
    address internal carol     = makeAddr("carol");
    address internal stranger  = makeAddr("stranger");

    // ── Deployed contracts ──────────────────────────────────────────────────
    TrustDrop    internal trustDrop;
    MockERC20    internal usdc;

    // ── A valid-length dummy PQ signature (all zeros, 7856 bytes) ───────────
    bytes internal validSig;

    // ── Default PQ public key ────────────────────────────────────────────────
    bytes32 internal constant PQ_PK = bytes32(uint256(0xDEAD));

    function setUp() public virtual {
        // ── 1. Etch MockERC20 at the canonical USDC address ──────────────────
        MockERC20 usdcImpl = new MockERC20("Mock USDC", "mUSDC", 6);
        vm.etch(USDC_ADDR, address(usdcImpl).code);
        usdc = MockERC20(USDC_ADDR);

        // ── 2. Etch the always-true PQ verifier at the precompile address ────
        //      We use a pure function so storage is irrelevant (vm.etch clears it).
        MockPQVerifierTrue pqTrue = new MockPQVerifierTrue();
        vm.etch(PQ_VERIFIER, address(pqTrue).code);

        // ── 3. Deploy TrustDrop ──────────────────────────────────────────────
        trustDrop = new TrustDrop();

        // ── 4. Build a 7856-byte dummy signature ────────────────────────────
        validSig = new bytes(SIG_LEN);

        // ── 5. Warp to a sensible start time so deadline arithmetic works ────
        vm.warp(1_700_000_000);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    /// @dev Switch the PQ verifier to always return false (invalid-sig tests).
    function _setPQVerifierFalse() internal {
        MockPQVerifierFalse pqFalse = new MockPQVerifierFalse();
        vm.etch(PQ_VERIFIER, address(pqFalse).code);
    }

    /// @dev Restore the PQ verifier to always return true.
    function _setPQVerifierTrue() internal {
        MockPQVerifierTrue pqTrue = new MockPQVerifierTrue();
        vm.etch(PQ_VERIFIER, address(pqTrue).code);
    }

    /// @dev Create a vault with a single beneficiary (alice, 100 %).
    function _createSimpleVault(uint256 initialDeposit) internal returns (uint256 vaultId) {
        address[] memory bens = new address[](1);
        uint256[] memory shs  = new uint256[](1);
        bens[0] = alice;
        shs[0]  = BPS; // 100 %

        if (initialDeposit > 0) {
            usdc.mint(owner, initialDeposit);
            vm.prank(owner);
            usdc.approve(address(trustDrop), initialDeposit);
        }

        vm.prank(owner);
        vaultId = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
    }

    /// @dev Create a vault with two beneficiaries (alice 60 %, bob 40 %).
    function _createSplitVault(uint256 initialDeposit) internal returns (uint256 vaultId) {
        address[] memory bens = new address[](2);
        uint256[] memory shs  = new uint256[](2);
        bens[0] = alice; shs[0] = 6000;
        bens[1] = bob;   shs[1] = 4000;

        if (initialDeposit > 0) {
            usdc.mint(owner, initialDeposit);
            vm.prank(owner);
            usdc.approve(address(trustDrop), initialDeposit);
        }

        vm.prank(owner);
        vaultId = trustDrop.createVault(PQ_PK, INTERVAL, GRACE, bens, shs);
    }

    /// @dev Deposit additional USDC into an existing vault.
    function _deposit(uint256 vaultId, uint256 amount) internal {
        usdc.mint(owner, amount);
        vm.prank(owner);
        usdc.approve(address(trustDrop), amount);
        vm.prank(owner);
        trustDrop.deposit(vaultId, amount);
    }

    /// @dev Build a deadline in the future.
    function _deadline() internal view returns (uint256) {
        return block.timestamp + 1 hours;
    }

    /// @dev Warp past the lapse deadline for a vault.
    function _warpPastLapse() internal {
        vm.warp(block.timestamp + INTERVAL + GRACE + 1);
    }
}
